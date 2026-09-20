import {migrateLegacyStorage} from '../storage';
import {applyMatch,createMatch,viewMatch,optionsKey,validateMatchForRoom,type ClientState,type MatchState,type RoomInfo,type RoomCandidate,type RoomMode} from '../core/room';
import type {Command,GameKind,Player,GameOptions} from '../core/types';
export type {ClientState,RoomCandidate,RoomMode} from '../core/room';
const API=(import.meta.env.VITE_API_BASE||'').replace(/\/$/,'');
const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
const initial=():ClientState=>({status:'idle',transport:'none',paused:false,actionRevision:0});
interface Session {profile:Player;code:string;invite?:string;token:string}
interface Peer {pc:RTCPeerConnection;dc?:RTCDataChannel;proven:boolean;nonce:string;lastHeard:number;pending:RTCIceCandidateInit[];pairingTimer?:ReturnType<typeof setTimeout>}
/** One client per tab. Cloud sockets hibernate; LAN game traffic never enters the signaling socket. */
export class RoomClient {
 state:ClientState=initial();private listeners=new Set<(state:ClientState)=>void>();
 private ws?:WebSocket;private session?:Session;private stopped=true;private reconnects=0;private reconnectTimer?:ReturnType<typeof setTimeout>;private handshakeTimer?:ReturnType<typeof setTimeout>;
 private peers=new Map<string,Peer>();private localMatch?:MatchState;private heartbeat?:ReturnType<typeof setInterval>;private connectGeneration=0;private starting=false;private peerRetry=new Map<string,ReturnType<typeof setTimeout>>();private peerAttempts=new Map<string,number>();
 constructor(){try{migrateLegacyStorage(localStorage,sessionStorage);}catch{/* Storage may be unavailable in private contexts. */}window.addEventListener('online',this.onOnline);document.addEventListener('visibilitychange',this.onVisible);}
 subscribe(listener:(state:ClientState)=>void){this.listeners.add(listener);listener(this.state);return()=>{this.listeners.delete(listener);};}
 private patch(patch:Partial<ClientState>){this.state={...this.state,...patch};for(const listener of this.listeners)listener(this.state);}
 clearError(){this.patch({error:undefined});}
 private fail(error:unknown){this.patch({error:error instanceof Error?error.message:String(error)});}
 private terminal(error:string){this.removeLocal();this.reset();sessionStorage.removeItem('mocha-room-session');this.patch({...initial(),error});}
 private get token(){let t=localStorage.getItem('mocha-network-token');if(!t){t=randomToken();localStorage.setItem('mocha-network-token',t);}return t;}
 async create(profile:Player,kind:GameKind,mode:RoomMode,options?:GameOptions){
  try{this.reset();const generation=this.connectGeneration;this.patch({status:'connecting',selfID:profile.id,mode});const result=await this.http('/api/create',{profile,kind,mode,options,token:this.token});if(generation!==this.connectGeneration)return;await this.join(profile,result.code,result.invite);}catch(e){this.patch({status:'idle'});this.fail(e);}
 }
 async join(profile:Player,code:string,invite?:string){
  try{code=code.toUpperCase().trim();if(!/^[A-Z2-9]{6}$/.test(code))throw new Error('请输入六位房间码');this.reset();this.session={profile,code,invite,token:this.token};sessionStorage.setItem('mocha-room-session',JSON.stringify(this.session));this.stopped=false;this.patch({status:'connecting',selfID:profile.id});this.openSocket();}catch(e){if(!this.state.room)this.terminal(e instanceof Error?e.message:String(e));else this.fail(e);}
 }
 /** Restore this tab's room after refresh, or retry a dropped connection. */
 async connect(){if(this.session){this.stopped=false;this.reconnects=0;this.openSocket();return;}try{const raw=sessionStorage.getItem('mocha-room-session');if(raw){const s=JSON.parse(raw) as Session;await this.join(s.profile,s.code,s.invite);}}catch{sessionStorage.removeItem('mocha-room-session');}}
 async discover():Promise<RoomCandidate[]>{try{return await this.http('/api/discover');}catch(e){this.fail(e);return [];}}
 ready(ready:boolean){this.control({type:'ready',ready});}
 approve(playerID:string,accept:boolean){this.control({type:'approve',playerID,accept});}
 selectGame(kind:GameKind,options?:GameOptions){this.control({type:'selectGame',kind,options});}
 start(){const r=this.state.room;if(!r)return;if(r.mode==='lan'&&r.players.some(p=>p.id!==r.hostID&&!this.peers.get(p.id)?.proven)){this.fail('局域网尚未连通；可由房主切换云端模式');return;}this.starting=true;this.control({type:'start',directPeers:[...this.peers.entries()].filter(([,p])=>p.proven).map(([id])=>id)});}
 replay(){this.control({type:'replay'});}
 endGame(){this.control({type:'endGame'});}
 action(command:Command){
  try{if(this.state.paused)throw new Error('连接恢复后继续');const r=this.state.room;if(!r||!r.started)throw new Error('牌局未开始');
   const msg={type:'action',command,requestID:crypto.randomUUID(),actionRevision:this.state.actionRevision};
   if(r.mode==='cloud')this.control(msg);else if(this.session?.profile.id===r.hostID)this.applyLocal(r.hostID,msg);else {const p=this.peers.get(r.hostID);if(!p?.proven||p.dc?.readyState!=='open')throw new Error('与房主的连接已中断');this.sendDC(p,msg);}
  }catch(e){this.fail(e);}
 }
 switchToCloud(){const r=this.state.room;if(!r||r.hostID!==this.session?.profile.id){this.fail('请由房主切换');return;}if(r.started&&!this.localMatch){this.fail('房主牌局状态丢失，请结束本局重新开桌');return;}this.control({type:'switchToCloud',match:this.localMatch});}
 leave(){if(this.state.room?.started&&this.state.room.hostID!==this.session?.profile.id){this.fail('请让房主结束本局，再离开牌桌');return;}this.control({type:'leave'});this.reset();sessionStorage.removeItem('mocha-room-session');this.patch(initial());}
 destroy(){this.reset();window.removeEventListener('online',this.onOnline);document.removeEventListener('visibilitychange',this.onVisible);this.listeners.clear();}
 private onOnline=()=>{if(!this.stopped&&this.ws?.readyState!==WebSocket.OPEN)this.connect();};
 private onVisible=()=>{if(document.visibilityState==='visible'&&!this.stopped){if(this.ws?.readyState!==WebSocket.OPEN)this.connect();if(this.state.room?.mode==='lan'){for(const p of this.peers.values()){if(Date.now()-p.lastHeard>18000)p.proven=false;}this.ensurePeers();this.localStatus();}}};
 private async http(path:string,body?:unknown){const response=await fetch(API+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw new Error(data.error||'连接暂不可用');return data;}
 private control(msg:any){try{if(this.ws?.readyState!==WebSocket.OPEN)throw new Error('云端连接中断，请重连');this.ws.send(JSON.stringify({...msg,requestID:msg.requestID||crypto.randomUUID()}));}catch(e){this.fail(e);}}
 private openSocket(){
  if(!this.session||this.stopped)return;clearTimeout(this.reconnectTimer);const generation=++this.connectGeneration;this.ws?.close();
  const url=new URL(API+'/api/rooms/'+this.session.code,location.origin);url.protocol=url.protocol==='https:'?'wss:':'ws:';const ws=this.ws=new WebSocket(url);clearTimeout(this.handshakeTimer);this.handshakeTimer=setTimeout(()=>{if(generation!==this.connectGeneration)return;if(!this.state.room)this.terminal('连接超时，请检查房间码和网络');else ws.close();},10000);
  ws.onopen=()=>{if(generation!==this.connectGeneration)return;this.reconnects=0;this.peerAttempts.clear();ws.send(JSON.stringify({type:'hello',...this.session}));};
  ws.onmessage=e=>{if(generation!==this.connectGeneration)return;clearTimeout(this.handshakeTimer);try{this.message(JSON.parse(e.data));}catch(error){this.fail(error);}};
  ws.onerror=()=>{if(generation===this.connectGeneration)this.patch({error:'连接失败，正在尝试恢复'});};
  ws.onclose=e=>{if(generation!==this.connectGeneration||this.stopped)return;clearTimeout(this.handshakeTimer);if(e.code===4001||e.code===4003){this.terminal(e.code===4001?'此玩家已在另一窗口连接':'入桌申请未通过');return;}
   if(!this.state.room){this.terminal('连接失败，请检查房间码和网络');return;}
   const lanAlive=this.state.mode==='lan'&&this.state.transport==='lan'&&!this.state.paused;
   if(!lanAlive)this.patch({status:'reconnecting',paused:!!this.state.room?.started});
   if(this.reconnects<6)this.reconnectTimer=setTimeout(()=>this.openSocket(),Math.min(1000*2**this.reconnects++,15000));else if(!lanAlive)this.patch({status:'disconnected',error:'连接未恢复，请点重连'});
  };
 }
 private message(msg:any){
  if(msg.type==='error'){this.starting=false;if(!this.state.room)this.terminal(msg.error);else this.fail(msg.error);return;}
  if(msg.type==='rejected'||msg.type==='ended'){this.terminal(msg.error);return;}
  if(msg.type==='pending'){this.patch({waitingApproval:true,status:'connecting',error:undefined});return;}
  if(msg.type==='signal'){void this.signal(msg.from,msg.data).catch(e=>this.fail(e));return;}
  if(msg.type!=='snapshot')return;
  const room=msg.room as RoomInfo;const old=this.state.room;const host=room.hostID===this.session?.profile.id;
  this.patch({room,mode:room.mode,selfID:this.session?.profile.id,waitingApproval:false,status:room.started?'playing':'lobby',error:undefined,inviteURL:msg.invite?`${location.origin}${location.pathname}?room=${room.code}#invite=${msg.invite}`:this.state.inviteURL});
  if(room.mode==='cloud'){this.dropPeers();this.localMatch=undefined;this.patch({transport:'cloud',view:msg.view,actionRevision:msg.actionRevision||0,paused:!!msg.paused});return;}
  if(!room.started){this.localMatch=undefined;this.removeLocal();this.patch({view:undefined,actionRevision:0});}
  else if(host&&!this.localMatch){
   const saved=sessionStorage.getItem('mocha-host-'+room.code);
   if(saved){try{const restored=JSON.parse(saved);if(restored.kind===room.kind&&restored.players===room.players.map(p=>p.id).join(',')&&optionsKey(room.kind,restored.options,room.hostID)===optionsKey(room.kind,room.options,room.hostID))this.localMatch=validateMatchForRoom(restored.match,room);}catch{}}
   if(!this.localMatch&&(this.starting||old&&!old.started)){this.localMatch=createMatch(room.kind,room.players,room.options);this.persistLocal();}
   if(!this.localMatch){this.patch({paused:true,error:'房主本机的牌局状态已丢失，请结束本局重新开始'});}
  }
  this.starting=false;this.ensurePeers();this.localStatus();if(host)this.broadcastLocal();
 }
 private reset(){this.stopped=true;++this.connectGeneration;clearTimeout(this.reconnectTimer);clearTimeout(this.handshakeTimer);this.ws?.close();this.ws=undefined;this.session=undefined;this.dropPeers();this.localMatch=undefined;this.state=initial();}
 private dropPeers(){for(const timer of this.peerRetry.values())clearTimeout(timer);this.peerRetry.clear();this.peerAttempts.clear();clearInterval(this.heartbeat);this.heartbeat=undefined;for(const peer of this.peers.values()){clearTimeout(peer.pairingTimer);peer.dc?.close();peer.pc.close();}this.peers.clear();}
 private removeLocal(){if(this.state.room)sessionStorage.removeItem('mocha-host-'+this.state.room.code);}
 private persistLocal(){const r=this.state.room;if(r&&this.localMatch)sessionStorage.setItem('mocha-host-'+r.code,JSON.stringify({kind:r.kind,options:r.options,players:r.players.map(p=>p.id).join(','),match:this.localMatch}));}
 private ensurePeers(){
  const r=this.state.room;if(!r||r.mode!=='lan'||!this.session)return;
  if(typeof RTCPeerConnection==='undefined'){this.fail('此浏览器不支持直连，请由房主切换云端');return;}
  const host=this.session.profile.id===r.hostID;const wanted=host?r.players.filter(p=>p.id!==r.hostID).map(p=>p.id):[r.hostID];
  for(const [id,peer]of this.peers)if(!wanted.includes(id)){clearTimeout(peer.pairingTimer);peer.pc.close();peer.dc?.close();this.peers.delete(id);}
  if(host)for(const id of wanted){const peer=this.peers.get(id);if(!peer||peer.pc.connectionState==='failed'||peer.pc.connectionState==='closed'||peer.pc.connectionState==='disconnected'){peer?.pc.close();void this.offer(id);}}
  if(!this.heartbeat)this.heartbeat=setInterval(()=>{
   let changed=false;for(const p of this.peers.values()){if(p.proven&&Date.now()-p.lastHeard>18000){p.proven=false;changed=true;}if(p.dc?.readyState==='open')this.sendDC(p,{type:'ping'});}
   if(changed){this.localStatus();if(host)this.broadcastLocal();}
  },5000);
 }
 private peer(id:string):Peer{
  clearTimeout(this.peers.get(id)?.pairingTimer);
  const pc=new RTCPeerConnection({iceServers:[],iceTransportPolicy:'all'});const p:Peer={pc,proven:false,nonce:crypto.randomUUID(),lastHeard:Date.now(),pending:[]};this.peers.set(id,p);
  // Safari can leave initial gathering in 'new' indefinitely, without a failure event.
  // A bounded handshake watchdog also covers lost offer/answer signaling.
  if(this.isHost)p.pairingTimer=setTimeout(()=>{if(this.peers.get(id)===p&&!p.proven)this.retryPeer(id,p);},8000);
  pc.onicecandidate=e=>{if(e.candidate&&this.peers.get(id)===p)this.sendSignal(id,{candidate:e.candidate.toJSON()});};
  pc.ondatachannel=e=>this.bindDC(id,p,e.channel);
  pc.onconnectionstatechange=()=>{if(this.peers.get(id)!==p)return;if(['failed','disconnected','closed'].includes(pc.connectionState)){p.proven=false;this.localStatus();if(this.isHost){this.broadcastLocal();this.retryPeer(id,p);}}};
  return p;
 }
 private retryPeer(id:string,peer:Peer){if(this.peerRetry.has(id)||(this.peerAttempts.get(id)||0)>=4||this.stopped)return;const attempt=(this.peerAttempts.get(id)||0)+1;this.peerAttempts.set(id,attempt);this.peerRetry.set(id,setTimeout(()=>{this.peerRetry.delete(id);if(this.peers.get(id)!==peer||peer.proven||this.ws?.readyState!==WebSocket.OPEN)return;peer.pc.close();void this.offer(id);},Math.min(1500*attempt,6000)));}
 private async offer(id:string){try{const p=this.peer(id);this.bindDC(id,p,p.pc.createDataChannel('mocha-tabletop',{ordered:true}));await p.pc.setLocalDescription(await p.pc.createOffer());this.sendSignal(id,{description:p.pc.localDescription});}catch(e){this.fail(e);}}
 private sendSignal(to:string,data:any){this.control({type:'signal',to,data});}
 private async signal(id:string,data:any){const r=this.state.room;if(!r||r.mode!=='lan'||!r.players.some(p=>p.id===id))return;let p=this.peers.get(id);
  if(data.description?.type==='offer'){if(this.isHost)return;const pendingCandidates=p?.pending||[];p?.pc.close();p=this.peer(id);p.pending=pendingCandidates;await p.pc.setRemoteDescription(data.description);for(const candidate of p.pending)await p.pc.addIceCandidate(candidate);p.pending=[];await p.pc.setLocalDescription(await p.pc.createAnswer());this.sendSignal(id,{description:p.pc.localDescription});}
  else if(data.description?.type==='answer'&&p){await p.pc.setRemoteDescription(data.description);for(const candidate of p.pending)await p.pc.addIceCandidate(candidate);p.pending=[];}
  else if(data.candidate){if(!p)p=this.peer(id);if(p.pc.remoteDescription)await p.pc.addIceCandidate(data.candidate);else p.pending.push(data.candidate);}
 }
 private get isHost(){return this.state.room?.hostID===this.session?.profile.id;}
 private bindDC(id:string,p:Peer,dc:RTCDataChannel){p.dc=dc;
  dc.onopen=()=>{p.lastHeard=Date.now();this.sendDC(p,{type:'probe',nonce:p.nonce});};
  dc.onclose=()=>{if(this.peers.get(id)!==p)return;p.proven=false;this.localStatus();if(this.isHost){this.broadcastLocal();this.retryPeer(id,p);}};
  dc.onmessage=e=>{if(this.peers.get(id)!==p)return;try{if(typeof e.data!=='string'||e.data.length>150000)throw new Error('局域网消息过大');const msg=JSON.parse(e.data);p.lastHeard=Date.now();
    if(msg.type==='probe'){this.sendDC(p,{type:'proof',nonce:msg.nonce});return;}
    if(msg.type==='proof'&&msg.nonce===p.nonce){p.proven=true;clearTimeout(p.pairingTimer);this.peerAttempts.delete(id);const retry=this.peerRetry.get(id);if(retry)clearTimeout(retry);this.peerRetry.delete(id);this.localStatus();if(this.isHost)this.broadcastLocal();return;}
    if(msg.type==='ping'){this.sendDC(p,{type:'pong'});return;}
    if(msg.type==='pong'){if(!p.proven)this.sendDC(p,{type:'probe',nonce:p.nonce});return;}
    if(!p.proven)return;
    if(msg.type==='action'&&this.isHost){try{this.applyLocal(id,msg);}catch(e){this.sendDC(p,{type:'error',error:e instanceof Error?e.message:'操作无效'});}return;}
    if(msg.type==='error'){this.fail(msg.error);return;}
    if(msg.type==='lanSnapshot'&&!this.isHost&&id===this.state.room?.hostID){this.patch({room:msg.room,view:msg.view,actionRevision:msg.actionRevision||0,paused:!!msg.paused,transport:'lan',status:msg.room.started?'playing':'lobby',error:undefined});}
   }catch(e){this.fail(e);}
  };
 }
 private sendDC(p:Peer,msg:any){if(p.dc?.readyState==='open'&&p.dc.bufferedAmount<1000000)p.dc.send(JSON.stringify(msg));}
 private localStatus(){const r=this.state.room;if(!r||r.mode!=='lan')return;const connected=this.isHost?r.players.every(p=>p.id===r.hostID||this.peers.get(p.id)?.proven):!!this.peers.get(r.hostID)?.proven;this.patch({transport:connected?'lan':'none',paused:r.started&&(!connected||this.isHost&&!this.localMatch)});}
 private applyLocal(actor:string,msg:any){const r=this.state.room;if(!r||!this.localMatch||!r.started||!this.isHost)throw new Error('等待房主开始');if(this.state.paused)throw new Error('有玩家掉线，恢复连接后继续');this.localMatch=applyMatch(this.localMatch,r.kind,r.players,actor,msg.command,msg.requestID,msg.actionRevision);this.persistLocal();this.broadcastLocal();}
 private broadcastLocal(){const r=this.state.room;if(!r||r.mode!=='lan'||!this.isHost)return;this.localStatus();const room={...r,players:r.players.map(p=>({...p,connected:p.id===r.hostID||!!this.peers.get(p.id)?.proven}))};
  for(const p of room.players){const data={type:'lanSnapshot',room:{...room,pending:p.id===r.hostID?room.pending:[]},...(this.localMatch?viewMatch(this.localMatch,r.kind,p.id):{view:undefined,actionRevision:0}),paused:this.state.paused};
   if(p.id===r.hostID)this.patch({view:data.view,actionRevision:data.actionRevision});else {const peer=this.peers.get(p.id);if(peer?.proven)this.sendDC(peer,data);}
  }
 }
}
