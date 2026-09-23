import {afterEach,describe,expect,it,vi} from 'vitest';
import {RoomClient} from '../../src/net/RoomClient';
import type {ClientState,RoomInfo} from '../../src/core/room';
import type {Player} from '../../src/core/types';

const host={id:'host0000',name:'Host',avatar:'host'};
const guest={id:'guest000',name:'Guest',avatar:'guest'};
const room:RoomInfo={code:'ABC234',hostID:host.id,kind:'gems',mode:'lan',players:[host,guest].map(profile=>({...profile,connected:true,ready:true})),pending:[],started:false,revision:1};

function deferred<T>(){
 let resolve!:(value:T)=>void,reject!:(reason?:unknown)=>void;
 const promise=new Promise<T>((ok,fail)=>{resolve=ok;reject=fail;});
 return {promise,resolve,reject};
}

class Channel {
 static all:Channel[]=[];
 readyState='connecting';bufferedAmount=0;sent:{type:string;nonce?:string}[]=[];
 onopen?:()=>void;onclose?:()=>void;onmessage?:(event:{data:string})=>void;
 constructor(){Channel.all.push(this);}
 send(raw:string){this.sent.push(JSON.parse(raw) as {type:string;nonce?:string});}
 receive(value:unknown){this.onmessage?.({data:JSON.stringify(value)});}
 close(){}
}

class Peer {
 static all:Peer[]=[];
 connectionState='new';remoteDescription:RTCSessionDescriptionInit|null=null;localDescription:RTCSessionDescriptionInit|null=null;
 onicecandidate?:()=>void;ondatachannel?:()=>void;onconnectionstatechange?:()=>void;
 offer=deferred<RTCSessionDescriptionInit>();remote=deferred<void>();
 constructor(){Peer.all.push(this);}
 createDataChannel(){return new Channel();}
 createOffer(){return this.offer.promise;}
 async createAnswer(){return {type:'answer' as const,sdp:'answer'};}
 async setLocalDescription(value:RTCSessionDescriptionInit){this.localDescription=value;}
 async setRemoteDescription(value:RTCSessionDescriptionInit){await this.remote.promise;this.remoteDescription=value;}
 async addIceCandidate(){}
 close(){this.connectionState='closed';}
}

class Socket {static OPEN=1;readyState=1;sent:unknown[]=[];send(raw:string){this.sent.push(JSON.parse(raw));}close(){this.readyState=3;}}

interface RoomClientHarness {
 state:ClientState;stopped:boolean;connectGeneration:number;ws:Socket;
 session:{profile:Player;code:string;token:string};
 offer(id:string):Promise<void>;signal(id:string,data:unknown):Promise<void>;ensurePeers():void;reset():void;destroy():void;
}

function setup(profile=host){
 const client=new RoomClient() as unknown as RoomClientHarness;
 const socket=new Socket();
 client.session={profile,code:room.code,token:'token'};client.stopped=false;client.state={status:'lobby',transport:'none',paused:false,actionRevision:0,room,mode:'lan'};client.ws=socket;
 return {client,socket};
}

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();Peer.all=[];Channel.all=[];});

describe('LAN signaling lifecycle',()=>{
 it('serves state sync requests only after the data channel proves its nonce',()=>{
  vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',new EventTarget());vi.stubGlobal('WebSocket',Socket);vi.stubGlobal('RTCPeerConnection',Peer);
  const {client}=setup();void client.offer(guest.id);const channel=Channel.all[0];channel.readyState='open';channel.onopen?.();
  channel.receive({type:'sync'});expect(channel.sent.map(m=>m.type)).toEqual(['probe']);
  channel.receive({type:'proof',nonce:channel.sent[0].nonce});expect(channel.sent.at(-1)?.type).toBe('lanSnapshot');
  const sent=channel.sent.length;channel.receive({type:'sync'});expect(channel.sent).toHaveLength(sent+1);expect(channel.sent.at(-1)?.type).toBe('lanSnapshot');
  client.destroy();
 });

 it('keeps a proven DataChannel through peer silence and foreground return',async()=>{
  vi.useFakeTimers();vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',Object.assign(new EventTarget(),{visibilityState:'visible'}));vi.stubGlobal('WebSocket',Socket);vi.stubGlobal('RTCPeerConnection',Peer);
  const {client}=setup();void client.offer(guest.id);const peer=Peer.all[0],channel=Channel.all[0];peer.connectionState='connected';channel.readyState='open';channel.onopen?.();channel.receive({type:'proof',nonce:channel.sent[0].nonce});
  client.ensurePeers();await vi.advanceTimersByTimeAsync(120000);expect(client.state.transport).toBe('lan');expect(Peer.all).toHaveLength(1);
  document.dispatchEvent(new Event('visibilitychange'));expect(client.state.transport).toBe('lan');expect(client.state.paused).toBe(false);expect(Peer.all).toHaveLength(1);expect(channel.sent.at(-1)?.type).toBe('probe');client.destroy();expect(vi.getTimerCount()).toBe(0);
 });

 it('lets a reopened guest request new pairing without replacing an offer already in flight',async()=>{
  vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',new EventTarget());vi.stubGlobal('WebSocket',Socket);vi.stubGlobal('RTCPeerConnection',Peer);
  const {client}=setup();void client.offer(guest.id);await client.signal(guest.id,{type:'reconnect'});expect(Peer.all).toHaveLength(1);
  const channel=Channel.all[0];channel.readyState='open';channel.onopen?.();channel.receive({type:'proof',nonce:channel.sent[0].nonce});
  const resume=client.signal(guest.id,{type:'reconnect'});expect(Peer.all).toHaveLength(2);Peer.all[1].offer.resolve({type:'offer',sdp:'resume'});await resume;client.destroy();
 });

 it('does not send an old offer through a replacement socket',async()=>{
  vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});vi.stubGlobal('document',{addEventListener(){},removeEventListener(){}});vi.stubGlobal('WebSocket',Socket);vi.stubGlobal('RTCPeerConnection',Peer);
  const {client}=setup();const pending=client.offer(guest.id);const oldPeer=Peer.all[0];
  client.reset();const replacement=new Socket();client.ws=replacement;client.session={profile:host,code:room.code,token:'new'};client.stopped=false;client.state={status:'lobby',transport:'none',paused:false,actionRevision:0,room,mode:'lan'};
  oldPeer.offer.resolve({type:'offer',sdp:'old'});await pending;
  expect(replacement.sent).toEqual([]);expect(client.state.error).toBeUndefined();client.destroy();
 });

 it('does not report an old offer rejection on the replacement session',async()=>{
  vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});vi.stubGlobal('document',{addEventListener(){},removeEventListener(){}});vi.stubGlobal('WebSocket',Socket);vi.stubGlobal('RTCPeerConnection',Peer);
  const {client}=setup();const pending=client.offer(guest.id);const oldPeer=Peer.all[0];
  client.reset();client.ws=new Socket();client.session={profile:host,code:room.code,token:'new'};client.stopped=false;client.state={status:'lobby',transport:'none',paused:false,actionRevision:0,room,mode:'lan'};
  oldPeer.offer.reject(new Error('old offer failed'));await pending;
  expect(client.state.error).toBeUndefined();client.destroy();
 });

 it('does not send an offer from a peer replaced within the same connection generation',async()=>{
  vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});vi.stubGlobal('document',{addEventListener(){},removeEventListener(){}});vi.stubGlobal('WebSocket',Socket);vi.stubGlobal('RTCPeerConnection',Peer);
  const {client,socket}=setup();const first=client.offer(guest.id);const oldPeer=Peer.all[0];const second=client.offer(guest.id);const currentPeer=Peer.all[1];
  oldPeer.offer.resolve({type:'offer',sdp:'old'});await first;expect(socket.sent).toEqual([]);
  currentPeer.offer.resolve({type:'offer',sdp:'current'});await second;
  expect(socket.sent).toHaveLength(1);expect(socket.sent[0]).toMatchObject({data:{description:{sdp:'current'}}});client.destroy();
 });

 it('keeps mapped data-channel callbacks active across a signaling reconnect',async()=>{
  vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});vi.stubGlobal('document',{addEventListener(){},removeEventListener(){}});vi.stubGlobal('WebSocket',Socket);vi.stubGlobal('RTCPeerConnection',Peer);
  const {client}=setup();void client.offer(guest.id);const channel=Channel.all[0];
  client.connectGeneration++;client.ws=new Socket();channel.readyState='open';channel.onopen?.();
  expect(channel.sent).toHaveLength(1);expect(channel.sent[0].type).toBe('probe');
  channel.receive({type:'proof',nonce:channel.sent[0].nonce});expect(client.state.transport).toBe('lan');
  const beforeReplacement=channel.sent.length;void client.offer(guest.id);channel.receive({type:'ping'});expect(channel.sent).toHaveLength(beforeReplacement);
  client.reset();channel.receive({type:'ping'});expect(channel.sent).toHaveLength(beforeReplacement);client.destroy();
 });

 it('does not answer or report failure from an old incoming signal after reset',async()=>{
  vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});vi.stubGlobal('document',{addEventListener(){},removeEventListener(){}});vi.stubGlobal('WebSocket',Socket);vi.stubGlobal('RTCPeerConnection',Peer);
  const {client}=setup(guest);const pending=client.signal(host.id,{description:{type:'offer',sdp:'old'}});const oldPeer=Peer.all[0];
  client.reset();const replacement=new Socket();client.ws=replacement;client.session={profile:guest,code:room.code,token:'new'};client.stopped=false;client.state={status:'lobby',transport:'none',paused:false,actionRevision:0,room,mode:'lan'};
  oldPeer.remote.resolve();await pending;
  expect(oldPeer.localDescription).toBeNull();expect(replacement.sent).toEqual([]);expect(client.state.error).toBeUndefined();client.destroy();
 });
});
