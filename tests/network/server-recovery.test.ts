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

describe('room-owned bot seats and durable turns',()=>{
 it('lets only the lobby host configure bots and resets human readiness',async()=>{
  await message(sockets[1],{type:'addBot',difficulty:'hard'});expect(sockets[1].messages.at(-1).error).toContain('只有房主');expect(server.data.info.players).toHaveLength(2);
  for(const difficulty of ['expert',null,{},1]){await message(sockets[0],{type:'addBot',difficulty});expect(server.data.info.players).toHaveLength(2);}
  await message(sockets[0],{type:'addBot',difficulty:'hard'});const bot=server.data.info.players.at(-1);
  expect(bot).toMatchObject({bot:{difficulty:'hard'},ready:true,connected:true});expect(server.data.tokens[bot.id]).toBeUndefined();expect(sockets[0].snapshot.room.players.at(-1).connected).toBe(true);expect(server.data.info.players[1].ready).toBe(false);
  await message(sockets[0],{type:'setBotDifficulty',playerID:bot.id,difficulty:'easy'});expect(server.data.info.players.at(-1).bot.difficulty).toBe('easy');
  await message(sockets[0],{type:'setBotDifficulty',playerID:host.id,difficulty:'easy'});expect(server.data.info.players[0].bot).toBeUndefined();
  await message(sockets[0],{type:'removeBot',playerID:bot.id});expect(server.data.info.players).toHaveLength(2);
 });
 it('enforces seat capacity without partially mutating a full room',async()=>{
  await message(sockets[0],{type:'addBot',difficulty:'easy'});await message(sockets[0],{type:'addBot',difficulty:'normal'});const before=structuredClone(server.data.info);
  await message(sockets[0],{type:'addBot',difficulty:'hard'});expect(sockets[0].messages.at(-1).error).toBe('房间已满');expect(server.data.info).toEqual(before);
 });
 it('deduplicates add requests, rejects bot impersonation, and exposes no bot hand',async()=>{
  const msg={type:'addBot',difficulty:'normal',requestID:'add-once'};await message(sockets[0],msg);await message(sockets[0],msg);expect(server.data.info.players).toHaveLength(3);
  const bot=server.data.info.players.at(-1),intruder=new ServerSocket();sockets.push(intruder);
  await message(intruder,{type:'hello',profile:{...bot,avatar:'🦊'},token:'e'.repeat(48),invite:'invite'});expect(intruder.messages.at(-1).error).toContain('身份');expect(intruder.messages.some(m=>m.view||m.room)).toBe(false);
  await message(sockets[1],{type:'ready',ready:true});await message(sockets[0],{type:'start'});expect(sockets[0].snapshot.paused).toBe(false);expect(sockets[0].snapshot.view.board).not.toHaveProperty('deck');
  await message(sockets[0],{type:'removeBot',playerID:bot.id});expect(server.data.info.players).toHaveLength(3);expect(sockets[0].messages.at(-1).error).toContain('准备室');
 });
 it('requires removing bots before a social game switch and keeps difficulty across replay',async()=>{
  await message(sockets[0],{type:'addBot',difficulty:'hard'});await message(sockets[0],{type:'selectGame',kind:'avalon'});expect(server.data.info.kind).toBe('gems');expect(sockets[0].messages.at(-1).error).toContain('移除人机');
  await message(sockets[1],{type:'ready',ready:true});await message(sockets[0],{type:'start'});await message(sockets[0],{type:'endGame'});
  expect(server.data.info.players.at(-1)).toMatchObject({bot:{difficulty:'hard'},ready:true});expect(server.data.info.players[1].ready).toBe(false);expect(server.data.botDue).toBeUndefined();
 });
 it('schedules one bot action, survives reload, and never repeats an early alarm',async()=>{
  await server.webSocketClose(sockets[1]);await message(sockets[0],{type:'removePlayer',playerID:guest.id});await message(sockets[0],{type:'addBot',difficulty:'normal'});await message(sockets[0],{type:'start'});
  await message(sockets[0],{type:'action',command:{action:'take_distinct',values:['white','blue','green']},actionRevision:server.data.match.actorRevisions[host.id]});
  expect(server.data.botDue).toBe(Date.now()+700);const revision=server.data.match.revision;
  // Same serialized state in a new DO instance, with the authenticated socket restored.
  const restored=Object.create(GameRoom.prototype);restored.data=JSON.parse(JSON.stringify(server.data));restored.ctx=server.ctx;restored.env=server.env;server=restored;
  await server.alarm();expect(server.data.match.revision).toBe(revision);
  await vi.advanceTimersByTimeAsync(700);await server.alarm();expect(server.data.match.revision).toBe(revision+1);expect(server.data.info.botError).toBeUndefined();
  await server.alarm();expect(server.data.match.revision).toBe(revision+1);expect(server.data.botDue).toBeUndefined();expect(sockets[0].snapshot.paused).toBe(false);
 });
 it('pauses a pending bot on human disconnect, resumes the same match, and cancels on end',async()=>{
  await server.webSocketClose(sockets[1]);await message(sockets[0],{type:'removePlayer',playerID:guest.id});await message(sockets[0],{type:'addBot',difficulty:'easy'});await message(sockets[0],{type:'start'});
  await message(sockets[0],{type:'action',command:{action:'take_distinct',values:['white','blue','green']},actionRevision:server.data.match.actorRevisions[host.id]});
  const match=structuredClone(server.data.match),matchID=server.data.info.matchID;await server.webSocketClose(sockets[0]);await vi.advanceTimersByTimeAsync(1000);await server.alarm();expect(server.data.match).toEqual(match);
  const ws=new ServerSocket();sockets.push(ws);await message(ws,{type:'hello',profile:host,token:'a'.repeat(48)});expect(ws.snapshot.room.matchID).toBe(matchID);expect(server.data.botDue).toBe(Date.now()+700);
  await message(ws,{type:'endGame'});await vi.advanceTimersByTimeAsync(700);await server.alarm();expect(server.data.match).toBeUndefined();expect(server.data.botDue).toBeUndefined();
 });
 it('does not require direct peer connections or signal credentials for bot seats',async()=>{
  await message(sockets[0],{type:'selectGame',kind:'doudizhu'});server.data.info.mode='lan';await message(sockets[0],{type:'addBot',difficulty:'normal'});await message(sockets[1],{type:'ready',ready:true});
  await message(sockets[0],{type:'start',directPeers:[guest.id]});expect(server.data.info.started).toBe(true);expect(server.data.match).toBeUndefined();expect(server.data.botDue).toBeUndefined();
 });
});

describe('bot continuation and retry authorization',()=>{
 it('only lets the host acknowledge a bot-owned round and deduplicates the request',async()=>{
  await message(sockets[0],{type:'selectGame',kind:'guandan'});await message(sockets[0],{type:'addBot',difficulty:'normal'});await message(sockets[0],{type:'addBot',difficulty:'hard'});await message(sockets[1],{type:'ready',ready:true});await message(sockets[0],{type:'start'});
  server.data.match.game.phase='roundEnd';server.data.match.game.current=2;server.data.match.game.previousOrder=[0,2,1,3];const revision=server.data.match.revision;
  await message(sockets[1],{type:'continueBotRound'});expect(sockets[1].messages.at(-1).error).toContain('房主');expect(server.data.match.revision).toBe(revision);
  const msg={type:'continueBotRound',requestID:'next-round-once'};await message(sockets[0],msg);const after=structuredClone(server.data.match);expect(after.game.round).toBe(2);await message(sockets[0],msg);expect(server.data.match).toEqual(after);
  server.data.info.mode='lan';await message(sockets[0],{type:'continueBotRound'});expect(sockets[0].messages.at(-1).type).toBe('error');expect(server.data.match).toEqual(after);
 });
 it('retains a failed bot turn until host retry and schedules exactly one retry',async()=>{
  await message(sockets[0],{type:'addBot',difficulty:'normal'});await message(sockets[1],{type:'ready',ready:true});await message(sockets[0],{type:'start'});
  for(const [index,player] of [host,guest].entries())await message(sockets[index],{type:'action',command:{action:'take_distinct',values:['white','blue','green']},actionRevision:server.data.match.actorRevisions[player.id]});
  const before=structuredClone(server.data.match),revision=before.revision;
  const botModule=await import('../../src/core/roomBots');const spy=vi.spyOn(botModule,'stepBot').mockImplementationOnce(()=>{throw new Error('simulated policy failure');});
  await vi.advanceTimersByTimeAsync(700);await server.alarm();spy.mockRestore();
  expect(server.data.match).toEqual(before);expect(server.data.info.botError).toBeTruthy();expect(server.data.botDue).toBeUndefined();
  await message(sockets[1],{type:'retryBot'});expect(sockets[1].messages.at(-1).error).toContain('房主');expect(server.data.info.botError).toBeTruthy();expect(server.data.match.revision).toBe(revision);
  const msg={type:'retryBot',requestID:'retry-once'};await message(sockets[0],msg);const due=server.data.botDue;expect(due).toBe(Date.now()+700);expect(server.data.info.botError).toBeUndefined();await message(sockets[0],msg);expect(server.data.botDue).toBe(due);
  await vi.advanceTimersByTimeAsync(700);await server.alarm();expect(server.data.match.revision).toBe(revision+1);await server.alarm();expect(server.data.match.revision).toBe(revision+1);
 });
});
