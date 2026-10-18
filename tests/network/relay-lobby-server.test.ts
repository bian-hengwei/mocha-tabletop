import {describe,it,expect,vi} from 'vitest';
vi.mock('cloudflare:workers',()=>({DurableObject:class {}}));
const {GameRoom}=await import('../../worker/'+'index');
class Socket {messages:any[]=[];constructor(public attachment:any){}deserializeAttachment(){return this.attachment;}serializeAttachment(a:any){this.attachment=a;}send(raw:string){this.messages.push(JSON.parse(raw));}close(){}get latest(){return this.messages.at(-1);}}
function setup(mode='cloud',count=4,relayMode='queue'){
 const players=Array.from({length:count},(_,i)=>({id:`player_${i}`,name:`Player ${i}`,avatar:'🦊',ready:true,connected:true}));
 const sockets=players.map(p=>new Socket({id:p.id,authenticated:true,opened:Date.now()}));
 const server:any=Object.create(GameRoom.prototype);
 server.data={info:{kind:'drawrelay',code:'ABCDEF',mode,hostID:players[0].id,players,pending:[],spectators:[],started:false,revision:1,options:{relayPlayers:Math.max(6,count),relayMode}},tokens:Object.fromEntries(players.map(p=>[p.id,'a'.repeat(48)])),pendingTokens:{},invite:'invitation-kept',expires:Date.now()+3600000,controlSeen:{}};
 server.ctx={getWebSockets:()=>sockets,storage:{put:vi.fn(async()=>{}),setAlarm:vi.fn(async()=>{}),deleteAll:vi.fn(async()=>{})}};server.env={DIRECTORY:{getByName:()=>({fetch:async()=>new Response('{}')})}};
 const send=async(seat:number,body:any)=>server.webSocketMessage(sockets[seat],JSON.stringify({requestID:crypto.randomUUID(),...body}));
 return {server,sockets,send};
}
describe('authoritative relay lobby settings',()=>{
 for(const mode of ['cloud','lan'])for(const relayMode of ['queue','rounds'])it(`${mode}/${relayMode}: shrinks six planned to four arrived, resets readiness and starts same room`,async()=>{
  const {server,sockets,send}=setup(mode,4,relayMode);const before=structuredClone(server.data);
  await send(0,{type:'start',directPeers:['player_1','player_2','player_3']});expect(sockets[0].latest.error).toContain('本局人数');expect(server.data).toEqual(before);
  await send(0,{type:'selectGame',kind:'drawrelay',options:{relayPlayers:4,relayMode}});
  expect(server.data.info).toMatchObject({code:'ABCDEF',started:false,options:{relayPlayers:4,relayMode}});expect(server.data.tokens).toEqual(before.tokens);expect(server.data.invite).toBe(before.invite);
  expect(server.data.info.players.map((p:any)=>p.ready)).toEqual([true,false,false,false]);expect(sockets[3].latest.room.options.relayPlayers).toBe(4);
  await send(0,{type:'start',directPeers:['player_1','player_2','player_3']});expect(sockets[0].latest.error).toBe('请等待所有玩家准备');
  for(let i=1;i<4;i++)await send(i,{type:'ready',ready:true});
  await send(0,{type:'start',directPeers:['player_1','player_2','player_3']});expect(server.data.info.started).toBe(true);if(mode==='cloud')expect(server.data.match.game.players).toHaveLength(4);
  const started=structuredClone(server.data);await send(0,{type:'selectGame',kind:'drawrelay',options:{relayPlayers:5,relayMode}});expect(sockets[0].latest.error).toBe('请先回到房间');expect(server.data).toEqual(started);
 });
 it('rejects unauthorized, malformed and occupied-seat reductions without partial changes',async()=>{
  const {server,sockets,send}=setup();
  for(const [seat,relayPlayers] of [[1,5],[0,3],[0,2],[0,13],[0,4.5],[0,'5']]){
   const before=structuredClone(server.data);await send(Number(seat),{type:'selectGame',kind:'drawrelay',options:{relayPlayers,relayMode:'queue'}});expect(sockets[Number(seat)].latest.type).toBe('error');expect(server.data).toEqual(before);
  }
  sockets[3].serializeAttachment({opened:0});const before=structuredClone(server.data);await send(0,{type:'selectGame',kind:'drawrelay',options:{relayPlayers:3}});expect(sockets[0].latest.error).toContain('离线座位');expect(server.data).toEqual(before);
  await send(0,{type:'removePlayer',playerID:'player_3'});await send(0,{type:'selectGame',kind:'drawrelay',options:{relayPlayers:3}});expect(server.data.info.players).toHaveLength(3);expect(server.data.info.options.relayPlayers).toBe(3);
 });
 it('increases capacity without promoting pending requests or spectators and preserves credentials',async()=>{
  const {server,sockets,send}=setup('cloud',3);server.data.info.options.relayPlayers=3;
  const observer={id:'observer_0',name:'Observer',avatar:'🦊',connected:true};server.data.info.spectators=[observer];server.data.tokens[observer.id]='b'.repeat(48);
  const pending={id:'waiting_0',name:'Waiting',avatar:'🦊'};server.data.info.pending=[pending];server.data.pendingTokens[pending.id]='c'.repeat(48);
  const before=structuredClone(server.data);await send(0,{type:'approve',playerID:pending.id,accept:true});expect(sockets[0].latest.error).toBe('房间已满');expect(server.data).toEqual(before);
  await send(0,{type:'selectGame',kind:'drawrelay',options:{relayPlayers:4,relayMode:'queue'}});expect(server.data.info.pending).toEqual([pending]);expect(server.data.info.spectators).toEqual([observer]);expect(server.data.tokens).toEqual(before.tokens);
  await send(0,{type:'approve',playerID:pending.id,accept:true});expect(server.data.info.players.at(-1).id).toBe(pending.id);expect(server.data.info.spectators).toEqual([observer]);
 });
 it('accepts legacy flexible rooms and a maximum count of twelve',async()=>{
  const {server,sockets,send}=setup('cloud',4);server.data.info.options={relayMode:'queue'};await send(0,{type:'start'});expect(server.data.info.started).toBe(true);expect(server.data.match.game.players).toHaveLength(4);
  const maximum=setup('cloud',12);await maximum.send(0,{type:'selectGame',kind:'drawrelay',options:{relayPlayers:12}});expect(maximum.sockets[0].latest.type).toBe('snapshot');expect(maximum.server.data.info.players).toHaveLength(12);
 });
});
