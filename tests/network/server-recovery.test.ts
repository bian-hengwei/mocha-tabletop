import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
vi.mock('cloudflare:workers',()=>({DurableObject:class {}}));
// Keep the Workers runtime out of the DOM-only application typecheck.
const {GameRoom}=await import('../../worker/'+'index');
const host={id:'host0000',name:'房主',avatar:'🦊',ready:true,connected:true};
const guest={id:'guest000',name:'朋友',avatar:'🐻',ready:true,connected:true};
class ServerSocket {messages:any[]=[];closed?:number;constructor(public attachment:any={opened:Date.now()}){}deserializeAttachment(){return this.attachment;}serializeAttachment(a:any){this.attachment=a;}send(raw:string){this.messages.push(JSON.parse(raw));}close(code:number){this.closed=code;}get snapshot(){return this.messages.filter(m=>m.type==='snapshot').at(-1);}}
let server:any,sockets:ServerSocket[],alarm:number|undefined;
const member=(id:string,pending=false)=>new ServerSocket({id,authenticated:true,pending,opened:Date.now(),lastSeen:Date.now()});
const message=(ws:ServerSocket,msg:any)=>server.webSocketMessage(ws,JSON.stringify({requestID:crypto.randomUUID(),...msg}));
beforeEach(()=>{vi.useFakeTimers();sockets=[member(host.id),member(guest.id)];server=Object.create(GameRoom.prototype);server.data={info:{code:'ABC234',kind:'gems',mode:'cloud',hostID:host.id,players:[host,guest],pending:[],started:false,revision:1},tokens:{[host.id]:'a'.repeat(48),[guest.id]:'b'.repeat(48)},pendingTokens:{},invite:'invite',expires:Date.now()+3600000,controlSeen:{}};server.ctx={getWebSockets:()=>sockets,storage:{async put(){},async setAlarm(at:number){alarm=at;},async deleteAll(){}}};server.env={DIRECTORY:{getByName:()=>({fetch:async()=>new Response('{}')})}};});
afterEach(()=>{vi.useRealTimers();});
describe('authoritative reconnect and presence',()=>{
 it('does not let a rejected socket close erase a new application from the same player',async()=>{const profile={id:'pending0',name:'申请人',avatar:'🦊'},token='c'.repeat(48);const first=new ServerSocket();sockets.push(first);await message(first,{type:'hello',profile,token});await message(sockets[0],{type:'approve',playerID:profile.id,accept:false});const retry=new ServerSocket();sockets.push(retry);await message(retry,{type:'hello',profile,token});await server.webSocketClose(first);expect(server.data.info.pending).toEqual([profile]);expect(server.data.pendingTokens[profile.id]).toBe(token);await message(sockets[0],{type:'approve',playerID:profile.id,accept:true});expect(retry.snapshot.room.players.some((p:any)=>p.id===profile.id)).toBe(true);});
 it('keeps private state and host controls unavailable to applicants and guests',async()=>{const applicant=new ServerSocket();sockets.push(applicant);await message(applicant,{type:'hello',profile:{id:'pending0',name:'申请人',avatar:'🦊'},token:'c'.repeat(48)});await message(applicant,{type:'ready',ready:true});expect(applicant.messages.at(-1).error).toContain('等待房主');expect(applicant.messages.some(m=>m.room||m.view||m.invite)).toBe(false);for(const type of ['start','endGame','selectGame','removePlayer','approve']){const revision=server.data.info.revision;await message(sockets[1],{type,kind:'uno',playerID:host.id,accept:true});expect(sockets[1].messages.at(-1).type).toBe('error');expect(server.data.info.revision).toBe(revision);}expect(sockets[1].snapshot?.invite).toBeUndefined();});
 it('reports only room existence on an unauthenticated status probe',async()=>{const response=await server.fetch(new Request('https://internal/status'));expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true});server.data.ended=true;expect((await server.fetch(new Request('https://internal/status'))).status).toBe(404);});
 it('allows a disconnected host to rejoin a running match with the same identity and preserves the round',async()=>{await message(sockets[0],{type:'start'});const match=structuredClone(server.data.match),matchID=server.data.info.matchID;await server.webSocketClose(sockets[0]);expect(sockets[1].snapshot.paused).toBe(true);const restored=new ServerSocket();sockets.push(restored);await message(restored,{type:'hello',profile:host,token:'a'.repeat(48)});expect(restored.snapshot.paused).toBe(false);expect(restored.snapshot.room.matchID).toBe(matchID);expect(server.data.match).toEqual(match);expect(restored.snapshot.room.players).toHaveLength(2);expect(restored.snapshot.room.expiresAt).toBe(server.data.expires);});
 it('replaces a duplicate socket without creating duplicate seats or letting its later close mark the new one offline',async()=>{const original=sockets[1],replacement=new ServerSocket();sockets.push(replacement);await message(replacement,{type:'hello',profile:guest,token:'b'.repeat(48)});expect(original.closed).toBe(4001);expect(original.attachment.authenticated).toBeUndefined();await server.webSocketClose(original);expect(sockets[0].snapshot.room.players.find((p:any)=>p.id===guest.id).connected).toBe(true);expect(server.data.info.players).toHaveLength(2);});
 it('rejects identity takeover with the wrong token',async()=>{const attacker=new ServerSocket();sockets.push(attacker);await message(attacker,{type:'hello',profile:host,token:'c'.repeat(48)});expect(attacker.messages.at(-1).error).toContain('身份不匹配');expect(attacker.attachment.authenticated).toBeUndefined();expect(sockets[0].closed).toBeUndefined();});
 it('sweeps silent authenticated sockets, pauses the game, and keeps their seats recoverable',async()=>{await message(sockets[0],{type:'start'});await vi.advanceTimersByTimeAsync(70000);await message(sockets[0],{type:'ping'});await server.alarm();expect(sockets[1].closed).toBe(4000);expect(sockets[0].snapshot.paused).toBe(true);expect(server.data.tokens[guest.id]).toBe('b'.repeat(48));expect(alarm).toBeLessThan(server.data.expires);});
 it('accepts heartbeat from an applicant waiting for approval',async()=>{const pending=member('pending0',true);sockets.push(pending);await message(pending,{type:'ping'});expect(pending.messages.at(-1)).toEqual({type:'pong'});});
 it('clears abandoned approval requests so the queue cannot fill with offline applicants',async()=>{const pending=member('pending0',true);sockets.push(pending);server.data.info.pending=[{id:'pending0',name:'申请人',avatar:'🦊'}];server.data.pendingTokens.pending0='c'.repeat(48);await server.webSocketClose(pending);expect(server.data.info.pending).toHaveLength(0);expect(server.data.pendingTokens.pending0).toBeUndefined();});
 it('allows only the lobby host to remove an offline seat',async()=>{await message(sockets[0],{type:'removePlayer',playerID:guest.id});expect(sockets[0].messages.at(-1).error).toContain('只能移除离线');await server.webSocketClose(sockets[1]);await message(sockets[0],{type:'removePlayer',playerID:guest.id});expect(server.data.info.players.map((p:any)=>p.id)).toEqual([host.id]);expect(server.data.tokens[guest.id]).toBeUndefined();});
 it('never removes a player midgame and gives each new round a distinct persistent match ID',async()=>{await message(sockets[0],{type:'start'});const firstID=server.data.info.matchID;expect(firstID).toBeTruthy();await server.webSocketClose(sockets[1]);await message(sockets[0],{type:'removePlayer',playerID:guest.id});expect(sockets[0].messages.at(-1).error).toContain('准备室');expect(server.data.info.players).toHaveLength(2);await message(sockets[0],{type:'endGame'});expect(server.data.info.matchID).toBeUndefined();sockets[1].attachment={id:guest.id,authenticated:true,opened:Date.now()};await message(sockets[1],{type:'ready',ready:true});await message(sockets[0],{type:'start'});expect(server.data.info.matchID).toBeTruthy();expect(server.data.info.matchID).not.toBe(firstID);});
});
describe('active room expiry',()=>{
 it('keeps a live match beyond its original six-hour deadline without redealing',async()=>{
  server.data.expires=Date.now()+6*3600000;const originalExpiry=server.data.expires;
  await message(sockets[0],{type:'start'});const match=structuredClone(server.data.match),matchID=server.data.info.matchID;
  const put=vi.spyOn(server.ctx.storage,'put'),index=vi.spyOn(server.env.DIRECTORY,'getByName');
  for(let hour=0;hour<7;hour++){
   await vi.advanceTimersByTimeAsync(3600000);
   for(const socket of sockets)await message(socket,{type:'ping'});
   await server.alarm();
   expect(server.data.expires).toBe(Date.now()+6*3600000);
   for(const socket of sockets){expect(socket.closed).toBeUndefined();expect(socket.snapshot.room.expiresAt).toBe(server.data.expires);expect(socket.snapshot.room.matchID).toBe(matchID);}
  }
  expect(Date.now()).toBeGreaterThan(originalExpiry);expect(server.data.match).toEqual(match);
  expect(put).toHaveBeenCalledWith('room',expect.objectContaining({expires:server.data.expires}));expect(index).toHaveBeenCalled();
 });
 it('coalesces heartbeat persistence instead of writing on every ping',async()=>{
  server.data.expires=Date.now()+6*3600000;const expires=server.data.expires,put=vi.spyOn(server.ctx.storage,'put');
  for(let count=0;count<14;count++){await vi.advanceTimersByTimeAsync(20000);await message(sockets[0],{type:'ping'});}
  expect(put).not.toHaveBeenCalled();expect(server.data.expires).toBe(expires);
  await vi.advanceTimersByTimeAsync(21000);await message(sockets[0],{type:'ping'});
  expect(put).toHaveBeenCalledTimes(1);expect(server.data.expires).toBe(Date.now()+6*3600000);expect(alarm).toBe(Date.now()+30000);
  await message(sockets[1],{type:'ping'});expect(put).toHaveBeenCalledTimes(1);
 });
 it('does not renew for anonymous probes, applicants, invalid messages or failed authentication',async()=>{
  const expires=server.data.expires,pending=member('pending0',true),anonymous=new ServerSocket();sockets.push(pending,anonymous);
  await server.fetch(new Request('https://internal/status'));
  await message(pending,{type:'ping'});expect(pending.messages.at(-1)).toEqual({type:'pong'});
  await message(anonymous,{type:'ping'});await message(anonymous,{type:'hello',profile:host,token:'c'.repeat(48)});
  await message(anonymous,{type:'hello',profile:{id:'pending1',name:'Applicant',avatar:'🦊'},token:'c'.repeat(48)});
  await message(sockets[0],{type:'unknown'});await message(sockets[1],{type:'start'});
  expect(server.data.expires).toBe(expires);
 });
 it('renews admitted reconnects and valid lobby activity, including client expiry snapshots',async()=>{
  const oldExpiry=server.data.expires;await message(sockets[1],{type:'ready',ready:false});
  expect(server.data.expires).toBeGreaterThan(oldExpiry);expect(sockets[0].snapshot.room.expiresAt).toBe(server.data.expires);
  await server.webSocketClose(sockets[0]);await vi.advanceTimersByTimeAsync(10*60000);
  const restored=new ServerSocket();sockets.push(restored);await message(restored,{type:'hello',profile:host,token:'a'.repeat(48)});
  expect(restored.snapshot.room.expiresAt).toBe(Date.now()+6*3600000);expect(restored.snapshot.room.players).toHaveLength(2);
 });
 it('renews valid LAN signaling while rejecting invalid relay activity',async()=>{
  server.data.info.mode='lan';const oldExpiry=server.data.expires;
  await message(sockets[1],{type:'signal',to:'unknown0',data:{type:'offer'}});expect(server.data.expires).toBe(oldExpiry);
  await message(sockets[1],{type:'signal',to:host.id,data:{type:'offer'}});
  expect(server.data.expires).toBe(Date.now()+6*3600000);expect(sockets[0].messages).toContainEqual({type:'signal',from:guest.id,data:{type:'offer'}});
 });
 it('still expires abandoned rooms and never revives an expired or dissolved room',async()=>{
  const remove=vi.spyOn(server.ctx.storage,'deleteAll');server.data.expires=Date.now()+60000;
  await vi.advanceTimersByTimeAsync(60001);const expired=server.data.expires;
  await message(sockets[0],{type:'ping'});expect(server.data.expires).toBe(expired);expect(sockets[0].messages.at(-1).type).toBe('error');
  expect((await server.fetch(new Request('https://internal/status'))).status).toBe(404);
  await server.alarm();expect(remove).toHaveBeenCalledOnce();expect(server.data).toBeUndefined();
 });
 it('does not extend the expiry after the host dissolves the room',async()=>{
  const expires=server.data.expires;await message(sockets[0],{type:'leave'});expect(server.data.ended).toBe(true);expect(server.data.expires).toBe(expires);
  await message(sockets[1],{type:'ping'});expect(server.data.expires).toBe(expires);expect(sockets[1].messages.at(-1).type).toBe('error');
 });
});
