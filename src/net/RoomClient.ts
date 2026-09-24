import {botTurnDelay,nextBotSeat,stepBot,continueBotRound} from '../core/roomBots';
import type {BotDifficulty} from '../core/bots/types';
import {supportsRoomSocial,type SocialCommand,type SocialView} from '../core/roomSocial';
import {applyMatch,createMatch,validProfile,viewRoomMatch,optionsKey,validateMatchForRoom,type ClientState,type MatchState,type RoomInfo,type RoomCandidate,type RoomMode} from '../core/room';
import type {Command,GameKind,Player,GameOptions} from '../core/types';
export type {ClientState,RoomCandidate,RoomMode} from '../core/room';
const API=(import.meta.env.VITE_API_BASE||'').replace(/\/$/,'');
const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
const initial=():ClientState=>({status:'idle',transport:'none',paused:false,actionRevision:0});
interface Session {spectator?:boolean;profile:Player;code:string;invite?:string;token:string;savedAt?:number;expiresAt?:number;pendingApproval?:boolean}
export interface SavedSession {profile:Player;code:string;savedAt:number;expiresAt:number}
const SESSION_KEY='mocha-room-session';
const SESSION_TTL=6*60*60*1000;
function availableStorage(localFirst=false):Storage[]{
 const stores:Storage[]=[];
 for(const key of localFirst?['localStorage','sessionStorage'] as const:['sessionStorage','localStorage'] as const){
  try{const storage=globalThis[key];if(storage)stores.push(storage);}catch{/* Accessing the storage property can itself throw. */}
 }
 return stores;
}
interface Peer {pc:RTCPeerConnection;dc?:RTCDataChannel;proven:boolean;syncServed?:boolean;nonce:string;pending:RTCIceCandidateInit[];pairingTimer?:ReturnType<typeof setTimeout>}
/** One client per tab. Cloud sockets hibernate; LAN game traffic never enters the signaling socket. */
export class RoomClient {
 state:ClientState=initial();private listeners=new Set<(state:ClientState)=>void>();
 private socialTimer?:ReturnType<typeof setTimeout>;
 private botTimer?:ReturnType<typeof setTimeout>;private botMatch?:MatchState;private localBotError?:string;
 private ws?:WebSocket;private session?:Session;private stopped=true;private reconnects=0;private reconnectTimer?:ReturnType<typeof setTimeout>;private handshakeTimer?:ReturnType<typeof setTimeout>;
 private socketHeartbeat?:ReturnType<typeof setInterval>;private lastSocketMessage=0;private lastSocketTick=0;private socketProbe?:ReturnType<typeof setTimeout>;
 private networkToken?:string;
 private peers=new Map<string,Peer>();private localMatch?:MatchState;private heartbeat?:ReturnType<typeof setInterval>;private connectGeneration=0;private starting=false;private peerRetry=new Map<string,ReturnType<typeof setTimeout>>();private peerAttempts=new Map<string,number>();
 constructor(){window.addEventListener('online',this.onOnline);document.addEventListener('visibilitychange',this.onVisible);window.addEventListener('pageshow',this.onResume);}
 subscribe(listener:(state:ClientState)=>void){this.listeners.add(listener);listener(this.state);return()=>{this.listeners.delete(listener);};}
 private patch(patch:Partial<ClientState>){
  // Only a changed actionable revision (not presence/heartbeat snapshots) settles a send.
  if(this.state.actionPending&&(
   patch.actionRevision!==undefined&&patch.actionRevision!==this.state.actionRevision||
   patch.paused||patch.error||patch.status&&['idle','lobby','reconnecting','disconnected'].includes(patch.status)||
   patch.room&&(!patch.room.started||patch.room.matchID!==this.state.room?.matchID||patch.room.mode!==this.state.room?.mode)
  ))patch={...patch,actionPending:false};
  this.state={...this.state,...patch};for(const listener of this.listeners)listener(this.state);}
 clearError(){this.patch({error:undefined});}
 sendSocial(command:SocialCommand):string|undefined {
  const room=this.state.room;
  if(this.state.socialPending)return;
  if(!room||!supportsRoomSocial(room.kind)||!room.players.some(p=>p.id===this.state.selfID&&!p.bot)){this.patch({socialError:'只有在座玩家可以发言'});return;}
  if(this.ws?.readyState!==WebSocket.OPEN){this.patch({socialError:'聊天连接中断，请重连后发送'});return;}
  const requestID=crypto.randomUUID();
  this.patch({socialPending:requestID,socialError:undefined,socialAck:undefined});
  try{this.ws.send(JSON.stringify({type:'social',requestID,command}));}
  catch{this.patch({socialPending:undefined,socialError:'聊天连接中断，请重连后发送'});return;}
  this.socialTimer=setTimeout(()=>this.patch({socialPending:undefined,socialError:'未确认发送，请检查记录后重试'}),8000);
  return requestID;
 }
 private receiveSocial(social:SocialView,serverNow:number){
  if(this.state.social&&social.revision<this.state.social.revision)return;
  // Convert authority timestamps once, so clock skew cannot prolong animations.
  const offset=Date.now()-serverNow;
  this.patch({social:{...social,messages:social.messages.map(m=>({...m,at:m.at+offset})),reactions:social.reactions.map(r=>({...r,at:r.at+offset}))}});
 }
 private fail(error:unknown){this.patch({error:error instanceof Error?error.message:String(error)});}
 private terminal(error:string,preserve=false){if(!preserve){this.removeLocal();this.clearSavedSession();}this.reset();this.patch({...initial(),error});}
 private get token(){
  if(this.networkToken)return this.networkToken;
  const stores=availableStorage(true);
  for(const storage of stores)try{const value=storage.getItem('mocha-network-token');if(value&&/^[a-f0-9]{48,128}$/.test(value)){this.networkToken=value;break;}}catch{}
  this.networkToken??=randomToken();
  for(const storage of stores)try{storage.setItem('mocha-network-token',this.networkToken);}catch{}
  return this.networkToken;
 }
 async create(profile:Player,kind:GameKind,mode:RoomMode,options?:GameOptions){
  this.reset();const generation=this.connectGeneration;try{this.patch({status:'connecting',selfID:profile.id,mode});const result=await this.http('/api/create',{profile,kind,mode,options,token:this.token});if(generation!==this.connectGeneration)return;await this.join(profile,result.code,result.invite);}catch(e){if(generation!==this.connectGeneration)return;this.patch({status:'idle'});this.fail(e);}
 }
 async join(profile:Player,code:string,invite?:string,spectator=false){
  try{code=code.toUpperCase().trim();if(!/^[A-Z2-9]{6}$/.test(code))throw new Error('请输入六位房间码');this.reset();this.session={spectator,profile:validProfile(profile),code,invite,token:this.token,savedAt:Date.now(),expiresAt:Date.now()+SESSION_TTL};this.saveSession();this.stopped=false;this.patch({status:'connecting',selfID:profile.id});this.openSocket();}catch(e){if(!this.state.room)this.terminal(e instanceof Error?e.message:String(e));else this.fail(e);}
 }
 /** Public details of this attempt, including when browser storage is unavailable. */
 getConnectionTarget(){const s=this.session;return s?{code:s.code,profile:s.profile}:undefined;}
 /** Same-device resume hint; never exposes the authentication token. */
 getSavedSession():SavedSession|undefined {const s=this.readSession();return s?{profile:s.profile,code:s.code,savedAt:s.savedAt!,expiresAt:s.expiresAt!}:undefined;}
 /** Forget a previous room without sending any room mutation. */
 forgetSession(){this.clearSavedSession();if(this.state.status==='idle'||this.state.status==='disconnected'){this.reset();this.patch(initial());}}
 /** Withdraw a known pending request; retain admitted or legacy room recovery. */
 cancelConnection(){if(this.session?.pendingApproval===true){if(this.ws?.readyState===WebSocket.OPEN)this.control({type:'leave'});this.clearSavedSession();}this.reset();this.patch(initial());}
 /** Only available outside a room; affects this browser's identity, never other players. */
 resetIdentity(){if(this.state.room||this.state.status==='connecting'||this.state.status==='reconnecting')throw new Error('请先离开牌桌，再重置本机用户');this.clearSavedSession();this.reset();this.networkToken=undefined;for(const storage of availableStorage())try{storage.removeItem('mocha-network-token');for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith('mocha-host-'))storage.removeItem(key);}}catch{}this.patch(initial());}
 /** Restore the last room even after closing the tab, or retry a dropped connection. */
 async connect(){if(this.session){this.stopped=false;this.reconnects=0;this.patch({status:'reconnecting',waitingApproval:false});this.openSocket();return;}const s=this.readSession();if(s){this.reset();this.session=s;this.stopped=false;this.patch({status:'connecting',selfID:s.profile.id});this.openSocket();}}
 private readSession():Session|undefined {
  for(const storage of availableStorage()){try{const raw=storage.getItem(SESSION_KEY);if(!raw)continue;const s=JSON.parse(raw) as Session;validProfile(s.profile);if(!/^[A-Z2-9]{6}$/.test(s.code)||typeof s.token!=='string'||!/^[a-f0-9]{48,128}$/.test(s.token))throw new Error('invalid session');
   s.savedAt=typeof s.savedAt==='number'?s.savedAt:Date.now();s.expiresAt=typeof s.expiresAt==='number'?s.expiresAt:s.savedAt+SESSION_TTL;
   // An admitted player's cached lease can lag renewals by the other players.
   if(s.expiresAt+(s.pendingApproval===false?SESSION_TTL:0)<=Date.now())throw new Error('expired session');return s;
  }catch{try{storage.removeItem(SESSION_KEY);}catch{}}}return undefined;
 }
 private saveSession(){if(!this.session)return;const raw=JSON.stringify(this.session);let saved=false;for(const storage of availableStorage())try{storage.setItem(SESSION_KEY,raw);saved=true;}catch{}if(!saved)this.fail('浏览器无法保存房间；关闭网页后可能无法恢复');}
 private clearSavedSession(){for(const storage of availableStorage())try{const raw=storage.getItem(SESSION_KEY);if(!this.session||!raw||JSON.parse(raw).code===this.session.code)storage.removeItem(SESSION_KEY);}catch{}}
 async discover():Promise<RoomCandidate[]>{try{return await this.http('/api/discover');}catch(e){this.fail(e);return [];}}
 setSpectators(allowed:boolean){this.control({type:'setSpectators',allowed});}
 setSeat(spectator:boolean){this.control({type:'setSeat',spectator});}
 addBot(difficulty:BotDifficulty){this.control({type:'addBot',difficulty});}
 setBotDifficulty(playerID:string,difficulty:BotDifficulty){this.control({type:'setBotDifficulty',playerID,difficulty});}
 removeBot(playerID:string){this.control({type:'removeBot',playerID});}
 retryBot(){if(this.isHost&&this.state.room?.mode==='lan'){this.localBotError=undefined;this.broadcastLocal();}else this.control({type:'retryBot'});}
 ready(ready:boolean){this.control({type:'ready',ready});}
 removePlayer(playerID:string){this.control({type:'removePlayer',playerID});}
 approve(playerID:string,accept:boolean){this.control({type:'approve',playerID,accept});}
 selectGame(kind:GameKind,options?:GameOptions){this.control({type:'selectGame',kind,options});}
 start(){const r=this.state.room;if(!r)return;if(r.mode==='lan'&&r.players.some(p=>p.id!==r.hostID&&!p.bot&&!this.peers.get(p.id)?.proven)){this.fail('局域网尚未连通；可由房主切换云端模式');return;}this.starting=true;this.control({type:'start',directPeers:[...this.peers.entries()].filter(([,p])=>p.proven).map(([id])=>id)});}
 continueBotRound(){const room=this.state.room;try{if(room?.mode==='lan'&&this.isHost&&this.localMatch){if(this.state.paused)throw new Error('连接恢复后继续');this.localMatch=continueBotRound(room,this.localMatch,room.hostID);this.persistLocal();this.broadcastLocal();}else this.control({type:'continueBotRound'});}catch(e){this.fail(e);}}
 replay(){this.control({type:'replay'});}
 endGame(){this.control({type:'endGame'});}
 action(command:Command){
  if(this.state.actionPending)return;
  try{if(this.state.paused)throw new Error('连接恢复后继续');const r=this.state.room;if(!r||!r.started)throw new Error('牌局未开始');if(!r.players.some(p=>p.id===this.session?.profile.id))throw new Error('观众不能操作牌局');
   this.patch({actionPending:true});
   const msg={type:'action',command,requestID:crypto.randomUUID(),actionRevision:this.state.actionRevision};
   if(r.mode==='cloud')this.control(msg);else if(this.session?.profile.id===r.hostID)this.applyLocal(r.hostID,msg);else {const p=this.peers.get(r.hostID);if(!p?.proven||p.dc?.readyState!=='open'||p.dc.bufferedAmount>=1000000)throw new Error('与房主的连接已中断');this.sendDC(p,msg);}
  }catch(e){this.fail(e);}
 }
 switchToCloud(){const r=this.state.room;if(!r||r.hostID!==this.session?.profile.id){this.fail('请由房主切换');return;}if(r.started&&!this.localMatch){this.fail('房主牌局状态丢失，请结束本局重新开桌');return;}this.control({type:'switchToCloud',match:this.localMatch});}
 leave(){if(this.state.room?.started&&this.state.room.hostID!==this.session?.profile.id&&this.state.room.players.some(p=>p.id===this.session?.profile.id)){this.fail('请让房主结束本局，再离开牌桌');return;}this.control({type:'leave'});this.removeLocal();this.clearSavedSession();this.reset();this.patch(initial());}
 destroy(){this.reset();window.removeEventListener('online',this.onOnline);document.removeEventListener('visibilitychange',this.onVisible);window.removeEventListener('pageshow',this.onResume);this.listeners.clear();}
 private onOnline=()=>this.onResume();
 private onVisible=()=>{if(document.visibilityState==='visible')this.onResume();};
 private onResume=()=>{
  if(this.stopped)return;
  if(this.ws?.readyState===WebSocket.OPEN)this.probeSocket();
  else if(!this.ws)void this.connect();
  if(this.state.room?.mode==='lan'){
   this.peerAttempts.clear();this.ensurePeers();
   for(const [id,p] of this.peers){
    if(p.dc?.readyState==='open')this.sendDC(p,{type:'probe',nonce:p.nonce});
    if(this.isHost&&!p.proven)this.retryPeer(id,p);
   }
   if(!this.isHost&&!this.peers.get(this.state.room.hostID)?.proven)this.requestPeer();
   this.localStatus();
  }
 };
 // Probe an apparently open transport after suspension/network changes. Never wait
 // for the browser's potentially unbounded WebSocket closing handshake to retry.
 private probeSocket(){
  const ws=this.ws,generation=this.connectGeneration;
  if(!ws||ws.readyState!==WebSocket.OPEN||this.socketProbe)return;
  this.lastSocketTick=Date.now();
  this.socketProbe=setTimeout(()=>{this.socketProbe=undefined;if(document.visibilityState!=='hidden')this.socketClosed(ws,generation);},5000);
  try{ws.send(JSON.stringify({type:'ping',sync:true}));}catch{this.socketClosed(ws,generation);}
 }
 private socketClosed(ws:WebSocket,generation:number,code=1000){
  if(generation!==this.connectGeneration||this.ws!==ws||this.stopped)return;
  this.patch({socialOnline:false});
  this.ws=undefined;clearTimeout(this.handshakeTimer);clearInterval(this.socketHeartbeat);clearTimeout(this.socketProbe);this.socketProbe=undefined;
  try{ws.close();}catch{}
  if(code===4001||code===4003){this.terminal(code===4001?'此玩家已在另一窗口连接，可在这里重新加入':'入桌申请未通过',code===4001);return;}
  void this.checkRoomAvailability(generation);
  const lanAlive=this.state.mode==='lan'&&this.state.transport==='lan'&&!this.state.paused;
  if(!lanAlive)this.patch({status:this.reconnects<6?'reconnecting':'disconnected',waitingApproval:false,paused:!!this.state.room?.started});
  const delay=Math.min(1000*2**Math.min(this.reconnects++,5),30000);
  this.reconnectTimer=setTimeout(()=>this.openSocket(),delay);
 }
 private async http(path:string,body?:unknown){const response=await fetch(API+path,{signal:AbortSignal.timeout(15000),method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw new Error(data.error||'连接暂不可用');return data;}
 private async checkRoomAvailability(generation:number){if(!this.session)return;try{const response=await fetch(API+'/api/rooms/'+this.session.code,{signal:AbortSignal.timeout(5000)});if(generation===this.connectGeneration&&!this.stopped&&response.status===404)this.terminal('房间已结束或不存在，请重新建房或检查房间码');}catch{/* Network errors remain recoverable; only an explicit 404 ends the session. */}}
 private control(msg:any){try{if(this.ws?.readyState!==WebSocket.OPEN)throw new Error('云端连接中断，请重连');this.ws.send(JSON.stringify({...msg,requestID:msg.requestID||crypto.randomUUID()}));}catch(e){this.fail(e);}}
 private openSocket(){
  if(!this.session||this.stopped)return;clearTimeout(this.reconnectTimer);clearInterval(this.socketHeartbeat);clearTimeout(this.socketProbe);this.socketProbe=undefined;const generation=++this.connectGeneration;this.ws?.close();
  const url=new URL(API+'/api/rooms/'+this.session.code,location.origin);url.protocol=url.protocol==='https:'?'wss:':'ws:';const ws=this.ws=new WebSocket(url);clearTimeout(this.handshakeTimer);this.handshakeTimer=setTimeout(()=>this.socketClosed(ws,generation),10000);
  ws.onopen=()=>{
   if(generation!==this.connectGeneration||this.ws!==ws)return;
   this.peerAttempts.clear();this.lastSocketTick=this.lastSocketMessage=Date.now();ws.send(JSON.stringify({type:'hello',...this.session,reactionCatalogVersion:1}));
   this.socketHeartbeat=setInterval(()=>{
    if(generation!==this.connectGeneration||this.ws!==ws)return;
    const now=Date.now(),delayed=now-this.lastSocketTick>30000;this.lastSocketTick=now;
    // Background timer throttling is not evidence of a broken transport.
    if(document.visibilityState!=='hidden'){
     if(delayed){this.probeSocket();return;}
     if(!this.socketProbe&&now-this.lastSocketMessage>45000){this.socketClosed(ws,generation);return;}
    }
    if(ws.readyState===WebSocket.OPEN)try{ws.send(JSON.stringify({type:'ping'}));}catch{this.socketClosed(ws,generation);}
   },15000);
  };
  ws.onmessage=e=>{if(generation!==this.connectGeneration||this.ws!==ws)return;this.lastSocketMessage=Date.now();clearTimeout(this.handshakeTimer);clearTimeout(this.socketProbe);this.socketProbe=undefined;try{this.message(JSON.parse(e.data));}catch(error){this.fail(error);}};
  ws.onerror=()=>{if(generation===this.connectGeneration&&this.ws===ws)this.patch({error:'连接失败，正在尝试恢复'});};
  ws.onclose=e=>this.socketClosed(ws,generation,e.code);
 }
 private message(msg:any){
  if(msg.type==='socialAck'||msg.type==='socialError'){
   if(msg.requestID===this.state.socialPending){clearTimeout(this.socialTimer);this.patch({socialPending:undefined,socialAck:msg.type==='socialAck'?msg.requestID:undefined,socialError:msg.type==='socialError'?msg.error:undefined});}return;
  }
  if(msg.type==='social'){if(this.state.room)this.receiveSocial(msg.social,msg.serverNow);return;}
  if(msg.type==='error'){this.starting=false;if(!this.state.room)this.terminal(msg.error);else this.fail(msg.error);return;}
  if(msg.type==='rejected'||msg.type==='ended'){this.terminal(msg.error);return;}
  if(msg.type==='pong')return;
  if(msg.type==='pending'){this.reconnects=0;if(this.session)this.session.pendingApproval=true;this.patch({waitingApproval:true,status:'connecting',error:undefined});this.saveSession();return;}
  if(msg.type==='signal'){void this.signal(msg.from,msg.data);return;}
  if(msg.type!=='snapshot')return;
  this.reconnects=0;const room=msg.room as RoomInfo;if(this.session){this.session.pendingApproval=false;this.session.expiresAt=room.expiresAt||this.session.expiresAt;}const old=this.state.room;const host=room.hostID===this.session?.profile.id;
  this.patch({room,mode:room.mode,selfID:this.session?.profile.id,waitingApproval:false,status:room.started?'playing':'lobby',error:undefined,inviteURL:msg.invite?`${location.origin}${location.pathname}?room=${room.code}#invite=${msg.invite}`:this.state.inviteURL});
  if(msg.social){this.receiveSocial(msg.social,msg.serverNow);this.patch({socialOnline:true});}
  this.saveSession();
  if(room.mode==='cloud'){this.dropPeers();this.localMatch=undefined;this.patch({transport:'cloud',view:msg.view,actionRevision:msg.actionRevision||0,paused:!!msg.paused});return;}
  if(!room.started){this.localBotError=undefined;this.localMatch=undefined;this.removeLocal();this.patch({view:undefined,actionRevision:0});}
  else if(host&&!this.localMatch){
   for(const storage of availableStorage(true)){try{const saved=storage.getItem('mocha-host-'+room.code);if(!saved)continue;const restored=JSON.parse(saved);if((!room.matchID||restored.matchID===room.matchID)&&restored.kind===room.kind&&restored.players===room.players.map(p=>p.id).join(',')&&optionsKey(room.kind,restored.options,room.hostID)===optionsKey(room.kind,room.options,room.hostID)){const match=validateMatchForRoom(restored.match,room);if(!this.localMatch||match.revision>this.localMatch.revision)this.localMatch=match;}}catch{}}
   if(!this.localMatch&&(this.starting||old&&!old.started)){this.localMatch=createMatch(room.kind,room.players,room.options);this.persistLocal();}
   if(!this.localMatch){this.patch({paused:true,error:'房主本机的牌局状态已丢失，请结束本局重新开始'});}
  }
  this.starting=false;this.ensurePeers();this.localStatus();if(host)this.broadcastLocal();
 }
 private reset(){this.stopped=true;this.reconnects=0;this.starting=false;++this.connectGeneration;clearTimeout(this.socialTimer);clearTimeout(this.reconnectTimer);clearTimeout(this.handshakeTimer);clearInterval(this.socketHeartbeat);clearTimeout(this.socketProbe);this.socketProbe=undefined;this.ws?.close();this.ws=undefined;this.session=undefined;this.dropPeers();this.localMatch=undefined;this.state=initial();}
 private dropPeers(){clearTimeout(this.botTimer);this.botTimer=undefined;this.botMatch=undefined;this.localBotError=undefined;for(const timer of this.peerRetry.values())clearTimeout(timer);this.peerRetry.clear();this.peerAttempts.clear();clearInterval(this.heartbeat);this.heartbeat=undefined;for(const peer of this.peers.values()){clearTimeout(peer.pairingTimer);peer.dc?.close();peer.pc.close();}this.peers.clear();}
 private removeLocal(){if(this.state.room)for(const storage of availableStorage())try{storage.removeItem('mocha-host-'+this.state.room.code);}catch{}}
 private persistLocal(){const r=this.state.room;if(r&&this.localMatch){const raw=JSON.stringify({kind:r.kind,options:r.options,matchID:r.matchID,expiresAt:r.expiresAt,players:r.players.map(p=>p.id).join(','),match:this.localMatch});let saved=false;for(const storage of availableStorage())try{storage.setItem('mocha-host-'+r.code,raw);saved=true;}catch{}if(!saved)this.fail('本地牌局存档失败，请保持房主页打开或切换云端');}}
 private ensurePeers(){
  const r=this.state.room;if(!r||r.mode!=='lan'||!this.session)return;
  if(typeof RTCPeerConnection==='undefined'){this.fail('此浏览器不支持直连，请由房主切换云端');return;}
  const host=this.session.profile.id===r.hostID;const wanted=host?[...r.players.filter(p=>!p.bot),...(r.spectators||[])].filter(p=>p.id!==r.hostID).map(p=>p.id):[r.hostID];
  for(const [id,peer]of this.peers)if(!wanted.includes(id)){clearTimeout(peer.pairingTimer);peer.pc.close();peer.dc?.close();this.peers.delete(id);}
  if(host)for(const id of wanted){const peer=this.peers.get(id);if(!peer||peer.pc.connectionState==='failed'||peer.pc.connectionState==='closed'||peer.pc.connectionState==='disconnected'){peer?.pc.close();void this.offer(id);}}
  if(!host&&!this.peers.has(r.hostID))this.requestPeer();
  // RTC connection/channel events detect transport loss. A peer's JavaScript may
  // be suspended for minutes while its reliable DataChannel remains connected.
  if(!this.heartbeat)this.heartbeat=setInterval(()=>{
   for(const p of this.peers.values())if(p.dc?.readyState==='open')this.sendDC(p,{type:'ping'});
  },5000);
 }
 private requestPeer(){const r=this.state.room;if(r&&this.ws?.readyState===WebSocket.OPEN)this.sendSignal(r.hostID,{type:'reconnect'});}

 private peer(id:string):Peer{
  const previous=this.peers.get(id);clearTimeout(previous?.pairingTimer);clearTimeout(this.peerRetry.get(id));this.peerRetry.delete(id);
  const pc=new RTCPeerConnection({iceServers:[],iceTransportPolicy:'all'});const p:Peer={pc,proven:false,nonce:crypto.randomUUID(),pending:[]};this.peers.set(id,p);previous?.dc?.close();previous?.pc.close();
  // Safari can leave initial gathering in 'new' indefinitely, without a failure event.
  // A bounded handshake watchdog also covers lost offer/answer signaling.
  if(this.isHost)p.pairingTimer=setTimeout(()=>{if(this.peers.get(id)===p&&!p.proven)this.retryPeer(id,p);},8000);
  pc.onicecandidate=e=>{if(e.candidate&&this.peers.get(id)===p)this.sendSignal(id,{candidate:e.candidate.toJSON()});};
  pc.ondatachannel=e=>{if(this.peers.get(id)===p)this.bindDC(id,p,e.channel);};
  pc.onconnectionstatechange=()=>{if(this.peers.get(id)!==p)return;if(['failed','disconnected','closed'].includes(pc.connectionState)){p.proven=false;this.localStatus();if(this.isHost){this.broadcastLocal();this.retryPeer(id,p);}}};
  // A replacement connection is untrusted until its data channel proves the nonce.
  this.localStatus();
  return p;
 }
 private currentPeer(id:string,p:Peer,generation:number){return generation===this.connectGeneration&&this.peers.get(id)===p;}
 private retryPeer(id:string,peer:Peer){if(this.peerRetry.has(id)||this.stopped)return;if((this.peerAttempts.get(id)||0)>=4){if(this.state.room?.spectators?.some(p=>p.id===id))return;this.fail('局域网尚未连通；可由房主切换云端模式');return;}const attempt=(this.peerAttempts.get(id)||0)+1;this.peerAttempts.set(id,attempt);this.peerRetry.set(id,setTimeout(()=>{this.peerRetry.delete(id);if(this.peers.get(id)!==peer||peer.proven||this.ws?.readyState!==WebSocket.OPEN)return;peer.pc.close();void this.offer(id);},Math.min(1500*attempt,6000)));}
 private async offer(id:string){const generation=this.connectGeneration;let p:Peer|undefined;try{p=this.peer(id);this.bindDC(id,p,p.pc.createDataChannel('mocha-tabletop',{ordered:true}));const offer=await p.pc.createOffer();if(!this.currentPeer(id,p,generation))return;await p.pc.setLocalDescription(offer);if(!this.currentPeer(id,p,generation))return;this.sendSignal(id,{description:p.pc.localDescription});}catch(e){if(generation===this.connectGeneration&&(!p||this.peers.get(id)===p))this.fail(e);}}
 private sendSignal(to:string,data:any){this.control({type:'signal',to,data});}
 private async signal(id:string,data:any){const generation=this.connectGeneration;const r=this.state.room;if(!r||r.mode!=='lan'||![...r.players,...(r.spectators||[])].some(p=>p.id===id))return;let p=this.peers.get(id);
  try{
   if(data.type==='reconnect'){if(this.isHost&&(!p||p.proven||['failed','closed','disconnected'].includes(p.pc.connectionState))){this.peerAttempts.delete(id);await this.offer(id);}return;}
   if(data.description?.type==='offer'){if(this.isHost)return;const pendingCandidates=p?.pending||[];p?.pc.close();p=this.peer(id);p.pending=pendingCandidates;await p.pc.setRemoteDescription(data.description);if(!this.currentPeer(id,p,generation))return;for(const candidate of p.pending){await p.pc.addIceCandidate(candidate);if(!this.currentPeer(id,p,generation))return;}p.pending=[];const answer=await p.pc.createAnswer();if(!this.currentPeer(id,p,generation))return;await p.pc.setLocalDescription(answer);if(!this.currentPeer(id,p,generation))return;this.sendSignal(id,{description:p.pc.localDescription});}
   else if(data.description?.type==='answer'&&p){await p.pc.setRemoteDescription(data.description);if(!this.currentPeer(id,p,generation))return;for(const candidate of p.pending){await p.pc.addIceCandidate(candidate);if(!this.currentPeer(id,p,generation))return;}p.pending=[];}
   else if(data.candidate){if(!p)p=this.peer(id);if(p.pc.remoteDescription){await p.pc.addIceCandidate(data.candidate);if(!this.currentPeer(id,p,generation))return;}else p.pending.push(data.candidate);}
  }catch(e){if(p&&this.currentPeer(id,p,generation))this.fail(e);}
 }
 private get isHost(){return this.state.room?.hostID===this.session?.profile.id;}
 private bindDC(id:string,p:Peer,dc:RTCDataChannel){p.dc=dc;
  dc.onopen=()=>{if(this.peers.get(id)!==p)return;this.sendDC(p,{type:'probe',nonce:p.nonce});};
  dc.onclose=()=>{if(this.peers.get(id)!==p)return;p.proven=false;this.localStatus();if(this.isHost){this.broadcastLocal();this.retryPeer(id,p);}};
  dc.onmessage=e=>{if(this.peers.get(id)!==p)return;try{if(typeof e.data!=='string'||e.data.length>150000)throw new Error('局域网消息过大');const msg=JSON.parse(e.data);
    if(msg.type==='probe'){this.sendDC(p,{type:'proof',nonce:msg.nonce});return;}
    if(msg.type==='proof'&&msg.nonce===p.nonce){if(p.proven)return;p.proven=true;p.syncServed=false;clearTimeout(p.pairingTimer);this.peerAttempts.delete(id);const retry=this.peerRetry.get(id);if(retry)clearTimeout(retry);this.peerRetry.delete(id);this.localStatus();if(this.isHost)this.broadcastLocal();else this.sendDC(p,{type:'sync'});return;}
    if(msg.type==='ping'){this.sendDC(p,{type:'pong'});return;}
    if(msg.type==='pong'){if(!p.proven)this.sendDC(p,{type:'probe',nonce:p.nonce});return;}
    if(!p.proven)return;
    // The first host snapshot may arrive before this side's nonce proof.
    if(msg.type==='sync'&&this.isHost){if(!p.syncServed){p.syncServed=true;this.broadcastLocal(id);}return;}
    if(msg.type==='action'&&this.isHost){try{this.applyLocal(id,msg);}catch(e){this.sendDC(p,{type:'error',error:e instanceof Error?e.message:'操作无效'});}return;}
    if(msg.type==='error'){this.fail(msg.error);return;}
    if(msg.type==='lanSnapshot'&&!this.isHost&&id===this.state.room?.hostID){if(msg.room.revision<this.state.room.revision)return;this.patch({room:msg.room,view:msg.view,actionRevision:msg.actionRevision||0,paused:!!msg.paused,transport:'lan',status:msg.room.started?'playing':'lobby',error:undefined});}
   }catch(e){this.fail(e);}
  };
 }
 private sendDC(p:Peer,msg:any){if(p.dc?.readyState==='open'&&p.dc.bufferedAmount<1000000)p.dc.send(JSON.stringify(msg));}
 private localStatus(){const r=this.state.room;if(!r||r.mode!=='lan')return;const connected=this.isHost?r.players.every(p=>p.bot||p.id===r.hostID||this.peers.get(p.id)?.proven):!!this.peers.get(r.hostID)?.proven;this.patch({transport:connected?'lan':'none',paused:r.started&&(!connected||this.isHost&&!this.localMatch)});}
 private applyLocal(actor:string,msg:any){const r=this.state.room;if(!r||!this.localMatch||!r.started||!this.isHost)throw new Error('等待房主开始');if(this.state.paused)throw new Error('有玩家掉线，恢复连接后继续');this.localMatch=applyMatch(this.localMatch,r.kind,r.players,actor,msg.command,msg.requestID,msg.actionRevision);this.persistLocal();this.broadcastLocal();}
 private broadcastLocal(recipientID?:string){const r=this.state.room;if(!r||r.mode!=='lan'||!this.isHost)return;this.localStatus();const room={...r,botError:this.localBotError,spectators:(r.spectators||[]).map(p=>({...p,connected:!!this.peers.get(p.id)?.proven})),players:r.players.map(p=>({...p,connected:!!p.bot||p.id===r.hostID||!!this.peers.get(p.id)?.proven}))};
  for(const p of [...room.players.filter(p=>!p.bot),...room.spectators]){if(recipientID&&p.id!==recipientID)continue;const data={type:'lanSnapshot',room:{...room,pending:p.id===r.hostID?room.pending:[]},...(this.localMatch?viewRoomMatch(this.localMatch,r,p.id):{view:undefined,actionRevision:0}),paused:this.state.paused};
   if(p.id===r.hostID)this.patch({room,view:data.view,actionRevision:data.actionRevision});else {const peer=this.peers.get(p.id);if(peer?.proven)this.sendDC(peer,data);}
  }
  if(!recipientID)this.scheduleLocalBot();
 }
 private scheduleLocalBot(){
  const r=this.state.room;
  if(!r||r.mode!=='lan'||!this.isHost||this.state.paused||this.localBotError||!this.localMatch||!nextBotSeat(r,this.localMatch)){clearTimeout(this.botTimer);this.botTimer=undefined;this.botMatch=undefined;return;}
  if(this.botTimer&&this.botMatch===this.localMatch)return;
  clearTimeout(this.botTimer);
  const scheduled=this.localMatch;this.botMatch=scheduled;
  this.botTimer=setTimeout(()=>{
   this.botTimer=undefined;this.botMatch=undefined;const room=this.state.room;
   if(!room||room.mode!=='lan'||!this.isHost||this.state.paused||this.localMatch!==scheduled)return;
   try{this.localMatch=stepBot(room,this.localMatch);this.persistLocal();}
   catch{this.localBotError='人机暂时无法行动，请重试';}
   this.broadcastLocal();
  },botTurnDelay(r.kind));
 }
}
