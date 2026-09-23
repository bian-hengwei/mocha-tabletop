import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {RoomClient} from '../../src/net/RoomClient';
import type {RoomInfo} from '../../src/core/room';

class Socket {
 static OPEN=1;static current:Socket;readyState=1;sent:Record<string,unknown>[]=[];
 onopen?:()=>void;onmessage?:(event:{data:string})=>void;onclose?:(event:{code:number})=>void;
 constructor(){Socket.current=this;}
 send(raw:string){this.sent.push(JSON.parse(raw));}
 close(){this.readyState=3;}
 receive(data:unknown){this.onmessage?.({data:JSON.stringify(data)});}
}
const profile={id:'social-host',name:'Host',avatar:'\uD83D\uDC31'};
const room:RoomInfo={code:'ABC234',hostID:profile.id,kind:'gems',mode:'cloud',players:[{...profile,connected:true,ready:true}],pending:[],revision:1,started:false};
let client:RoomClient;
const social=(revision=1,at=10000)=>({revision,messages:[{id:'message-1',player:profile,text:'hello',at}],reactions:[{id:'reaction-1',playerID:profile.id,reaction:'cow',at}]});
beforeEach(async()=>{
 vi.useFakeTimers();vi.setSystemTime(20000);
 vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});
 vi.stubGlobal('document',{addEventListener(){},removeEventListener(){}});
 vi.stubGlobal('location',{origin:'https://table.test',pathname:'/'});
 vi.stubGlobal('fetch',vi.fn(async()=>({status:200})));
 for(const key of ['localStorage','sessionStorage'])vi.stubGlobal(key,{getItem(){return null;},setItem(){},removeItem(){}});
 vi.stubGlobal('WebSocket',Socket);
 client=new RoomClient();await client.join(profile,room.code);expect(client.state.status,client.state.error).toBe('connecting');Socket.current.onopen?.();
 Socket.current.receive({type:'snapshot',room,social:social(),serverNow:10000});
});
afterEach(()=>{client.destroy();vi.useRealTimers();vi.unstubAllGlobals();});

describe('room social client delivery',()=>{
 it('allows one pending request and accepts only its acknowledgement',()=>{
  const id=client.sendSocial({type:'chat',text:'hello'});expect(id).toBeTypeOf('string');
  expect(client.sendSocial({type:'reaction',reaction:'cow'})).toBeUndefined();
  Socket.current.receive({type:'socialAck',requestID:'stale'});expect(client.state.socialPending).toBe(id);
  Socket.current.receive({type:'socialAck',requestID:id});expect(client.state.socialPending).toBeUndefined();expect(client.state.socialAck).toBe(id);
  vi.advanceTimersByTime(8001);expect(client.state.socialError).toBeUndefined();
 });
 it('preserves failed delivery state and never automatically resends an uncertain message',()=>{
  const id=client.sendSocial({type:'chat',text:'hello'});
  Socket.current.receive({type:'socialError',requestID:id,error:'发送太快，请稍等片刻'});
  expect(client.state.socialPending).toBeUndefined();expect(client.state.socialError).toContain('发送太快');
  const retry=client.sendSocial({type:'chat',text:'hello'});expect(retry).not.toBe(id);
  vi.advanceTimersByTime(8001);expect(client.state.socialError).toContain('未确认发送');
  expect(Socket.current.sent.filter(m=>m.type==='social')).toHaveLength(2);
  Socket.current.receive({type:'socialAck',requestID:retry});expect(client.state.socialAck).toBeUndefined();
 });
 it('normalizes authority clock skew without reviving expired reactions on reconnect',()=>{
  expect(client.state.social?.messages[0].at).toBe(20000);
  vi.advanceTimersByTime(6000);
  Socket.current.receive({type:'snapshot',room,social:social(),serverNow:16000});
  expect(client.state.social?.reactions[0].at).toBe(20000);
  Socket.current.receive({type:'social',social:social(0,16000),serverNow:16000});
  expect(client.state.social?.revision).toBe(1);
 });
 it('disables sending on disconnection and clears communication on deliberate exit',()=>{
  Socket.current.readyState=3;Socket.current.onclose?.({code:1006});
  expect(client.state.socialOnline).toBe(false);expect(client.sendSocial({type:'chat',text:'offline'})).toBeUndefined();
  expect(client.state.socialError).toContain('连接中断');client.cancelConnection();
  expect(client.state.social).toBeUndefined();expect(client.state.socialPending).toBeUndefined();
 });
 it('prevents spectators and excluded games from sending',()=>{
  for(const forbidden of [{...room,players:[],spectators:[{...profile,connected:true}]},{...room,kind:'codenames'}]){
   Socket.current.receive({type:'snapshot',room:forbidden,social:{revision:2,messages:[],reactions:[]},serverNow:10000});
   expect(client.sendSocial({type:'chat',text:'spoiler'})).toBeUndefined();
  }
  expect(Socket.current.sent.some(m=>m.type==='social')).toBe(false);
 });
 it('clears a dissolved room and ignores its queued snapshots after joining another room',async()=>{
  const old=Socket.current;client.sendSocial({type:'chat',text:'old draft'});
  old.receive({type:'ended',error:'房主已解散房间'});
  expect(client.state.room).toBeUndefined();expect(client.state.social).toBeUndefined();expect(client.state.socialPending).toBeUndefined();
  await client.join(profile,'DEF567');Socket.current.onopen?.();
  Socket.current.receive({type:'snapshot',room:{...room,code:'DEF567'},social:{revision:0,messages:[],reactions:[]},serverNow:20000});
  old.receive({type:'snapshot',room,social:social(50),serverNow:20000});old.receive({type:'social',social:social(51),serverNow:20000});
  expect(client.state.room?.code).toBe('DEF567');expect(client.state.social?.messages).toEqual([]);
 });
});
