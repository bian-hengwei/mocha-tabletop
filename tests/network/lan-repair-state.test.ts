import {afterEach,expect,it,vi} from 'vitest';
import {RoomClient} from '../../src/net/RoomClient';
import type {RoomInfo} from '../../src/core/room';

class Channel {
 readyState='open';bufferedAmount=0;
 sent:{type:string;nonce?:string}[]=[];
 onopen?:()=>void;onclose?:()=>void;onmessage?:(event:{data:string})=>void;
 send(raw:string){this.sent.push(JSON.parse(raw));}
 close(){this.readyState='closed';}
 receive(data:unknown){this.onmessage?.({data:JSON.stringify(data)});}
}
class Peer {
 static all:Peer[]=[];
 connectionState='new';remoteDescription?:RTCSessionDescriptionInit;localDescription?:RTCSessionDescriptionInit;
 ondatachannel?:(event:{channel:Channel})=>void;
 constructor(){Peer.all.push(this);}
 async setRemoteDescription(value:RTCSessionDescriptionInit){this.remoteDescription=value;}
 async createAnswer(){return {type:'answer' as const,sdp:'test-answer'};}
 async setLocalDescription(value:RTCSessionDescriptionInit){this.localDescription=value;}
 close(){this.connectionState='closed';}
}
class Socket {
 static OPEN=1;static current:Socket;readyState=1;
 onopen?:()=>void;onmessage?:(event:{data:string})=>void;
 constructor(){Socket.current=this;}
 send(){}close(){this.readyState=3;}
 receive(data:unknown){this.onmessage?.({data:JSON.stringify(data)});}
}
let client:RoomClient|undefined;
afterEach(()=>{client?.destroy();client=undefined;vi.unstubAllGlobals();});

it('pauses a guest immediately when a replacement LAN offer invalidates the proven channel',async()=>{
 vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});
 vi.stubGlobal('document',{addEventListener(){},removeEventListener(){}});
 vi.stubGlobal('location',{origin:'https://table.test',pathname:'/'});
 for(const key of ['localStorage','sessionStorage'])vi.stubGlobal(key,{getItem(){return null;},setItem(){},removeItem(){}});
 vi.stubGlobal('WebSocket',Socket);vi.stubGlobal('RTCPeerConnection',Peer);Peer.all=[];
 const host={id:'host0000',name:'Host',avatar:'🦊'},guest={id:'guest000',name:'Guest',avatar:'🐶'};
 const room:RoomInfo={code:'ABC234',hostID:host.id,kind:'gems',mode:'lan',players:[host,guest].map(p=>({...p,connected:true,ready:true})),pending:[],started:true,revision:1,matchID:'test-match'};
 client=new RoomClient();await client.join(guest,room.code);const socket=Socket.current;socket.onopen?.();
 socket.receive({type:'snapshot',room});
 const offer=()=>socket.receive({type:'signal',from:host.id,data:{description:{type:'offer',sdp:'test-offer'}}});
 offer();await vi.waitFor(()=>expect(Peer.all[0].localDescription?.type).toBe('answer'));
 const channel=new Channel();Peer.all[0].ondatachannel?.({channel});channel.onopen?.();
 channel.receive({type:'proof',nonce:channel.sent[0].nonce});
 expect(client.state.transport).toBe('lan');expect(client.state.paused).toBe(false);
 client.action({action:'take',values:['white','blue','green']});expect(client.state.actionPending).toBe(true);

 // Receiving the new offer itself must revoke readiness, before async SDP work or a timeout.
 offer();expect(client.state.transport).toBe('none');expect(client.state.paused).toBe(true);
 expect(client.state.actionPending).toBe(false);expect(Peer.all[0].connectionState).toBe('closed');
 const count=channel.sent.length;client.action({action:'take',values:['white','blue','green']});expect(channel.sent).toHaveLength(count);
 await vi.waitFor(()=>expect(Peer.all[1].localDescription?.type).toBe('answer'));
 const replacement=new Channel();Peer.all[1].ondatachannel?.({channel:replacement});replacement.onopen?.();
 expect(client.state.paused).toBe(true);
 replacement.receive({type:'proof',nonce:replacement.sent[0].nonce});
 expect(client.state.transport).toBe('lan');expect(client.state.paused).toBe(false);
});
