import {afterEach,describe,it,expect,vi} from 'vitest';
import {RoomClient} from '../../src/net/RoomClient';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('LAN initial pairing recovery',()=>{
 it('retries a stalled new ICE state without failure events, with a finite signaling budget',async()=>{
  vi.useFakeTimers();vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});vi.stubGlobal('document',{addEventListener(){},removeEventListener(){}});
  const connections:any[]=[],messages:any[]=[];
  class StalledPeer {connectionState='new';iceConnectionState='new';localDescription:any;remoteDescription=null;onicecandidate:any;ondatachannel:any;onconnectionstatechange:any;
   constructor(){connections.push(this);}createDataChannel(){return {readyState:'connecting',bufferedAmount:0,close(){}};}async createOffer(){return {type:'offer',sdp:'test-only'};}async setLocalDescription(description:any){this.localDescription=description;}close(){this.connectionState='closed';}
  }
  vi.stubGlobal('RTCPeerConnection',StalledPeer);vi.stubGlobal('WebSocket',{OPEN:1});
  const client=new RoomClient() as any;client.session={profile:{id:'host0000'}};client.stopped=false;client.ws={readyState:1,send(data:string){messages.push(JSON.parse(data));},close(){}};
  client.state.room={hostID:'host0000',code:'ABC234',kind:'gems',mode:'lan',players:[{id:'host0000'},{id:'guest000'}],pending:[],started:false,revision:1};
  await client.offer('guest000');expect(connections).toHaveLength(1);await vi.advanceTimersByTimeAsync(9500);expect(connections).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(120000);expect(connections).toHaveLength(5);expect(messages.every(message=>message.type==='signal')).toBe(true);expect(messages).toHaveLength(5);expect(client.state.room.mode).toBe('lan');client.destroy();expect(vi.getTimerCount()).toBe(0);
 });
});
