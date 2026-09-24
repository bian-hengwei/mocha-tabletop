import {reactionAPI,publishedReaction,type ReactionEnv} from './reactionCatalog';
import {DurableObject} from 'cloudflare:workers';
import {discoveryNetwork} from './discovery';
import {applyRoomSocial,emptySocial,forgetSocialActor,socialView,type SocialState} from '../src/core/roomSocial';
import {botTurnDelay,changeBots,nextBotSeat,stepBot,continueBotRound} from '../src/core/roomBots';
import {supportsBots} from '../src/core/bots';
import { applyMatch,createMatch,validKind,validProfile,viewRoomMatch,MAX_SPECTATORS,normalizeGameOptions,roomLimits,validateMatchForRoom,type MatchState,type RoomInfo,type RoomMode,type RoomCandidate } from '../src/core/room';
import type {Player} from '../src/core/types';
interface Env extends ReactionEnv {ROOMS:DurableObjectNamespace<GameRoom>;DIRECTORY:DurableObjectNamespace<RoomDirectory>;ASSETS:Fetcher;ALLOWED_ORIGINS?:string}
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');
const goodToken=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{48,128}$/.test(v);
const send=(ws:WebSocket,data:unknown)=>{try{ws.send(JSON.stringify(data));}catch{}};
const error=(e:unknown)=>e instanceof Error?e.message:'连接暂不可用';
const roomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');
interface Entry extends RoomCandidate {hash:string;expires:number}
export default {async fetch(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 try{
  const origin=request.headers.get('Origin'); const allowed=[url.origin,...(env.ALLOWED_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:5174').split(',')];
  if(origin&&!allowed.includes(origin))return json({error:'来源无效'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||url.origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'}});
  if(/^\/api\/(admin\/)?reactions(?:\/|$)/.test(url.pathname)){const result=await reactionAPI(request,env);const headers=new Headers(result.headers);headers.set('Access-Control-Allow-Origin',origin||url.origin);headers.set('Vary','Origin');return new Response(result.body,{status:result.status,headers});}
  if(url.pathname==='/api/health')return json({ok:true,version:2});
  if(!['GET','POST'].includes(request.method))return json({error:'请求无效'},405);
  if(Number(request.headers.get('Content-Length')||0)>100000)return json({error:'请求过大'},413);
  // Never accept a client-supplied discovery hash. Cloudflare overwrites CF-Connecting-IP at ingress.
  const directory=env.DIRECTORY.getByName('directory-v1');
  const ip=request.headers.get('CF-Connecting-IP')||(['127.0.0.1','localhost','[::1]'].includes(url.hostname)?'127.0.0.1':null);
  if(!ip)throw new Error('无法识别网络地址');
  if(url.pathname==='/api/create'||url.pathname==='/api/discover'){
   const forwarded=new Request('https://internal'+url.pathname,{method:request.method,headers:{'X-Client-IP':ip},body:request.method==='POST'?await request.text():undefined});
   const result=await directory.fetch(forwarded);const headers=new Headers(result.headers);headers.set('Access-Control-Allow-Origin',origin||url.origin);headers.set('Vary','Origin');return new Response(result.body,{status:result.status,headers});
  }
  const match=url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})$/);
  if(match&&request.method==='GET'){
   const allowed=await directory.fetch(new Request('https://internal/api/guard',{method:'POST',headers:{'X-Client-IP':ip}}));
   if(!allowed.ok)return allowed;
   if(request.headers.get('Upgrade')?.toLowerCase()==='websocket')return env.ROOMS.getByName(match[1]).fetch(new Request('https://internal/socket',request));
   const result=await env.ROOMS.getByName(match[1]).fetch(new Request('https://internal/status'));
   const headers=new Headers(result.headers);headers.set('Access-Control-Allow-Origin',origin||url.origin);headers.set('Vary','Origin');return new Response(result.body,{status:result.status,headers});
  }
  return json({error:'不存在'},404);
 }catch(e){return json({error:error(e)},400);}
}};
export class RoomDirectory extends DurableObject<Env>{
 async fetch(req:Request):Promise<Response>{
  try{
   const path=new URL(req.url).pathname;
   if(path==='/internal/update'){
    const data=await req.json() as Entry;
    const old=await this.ctx.storage.get<Entry>('room:'+data.code);
    if(old)await this.ctx.storage.put('room:'+data.code,{...old,...data,hash:old.hash});
    return json({ok:true});
   }
   let salt=await this.ctx.storage.get<string>('salt');if(!salt){salt=token();await this.ctx.storage.put('salt',salt);}
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+discoveryNetwork(req.headers.get('X-Client-IP'))))),x=>x.toString(16).padStart(2,'0')).join('');
   const now=Date.now();const key='limit:'+hash;const previous=await this.ctx.storage.get<{since:number;count:number;created:number}>(key);
   const limit=previous&&now-previous.since<600000?previous:{since:now,count:0,created:0};
   limit.count++;if(path==='/api/create')limit.created++;
   if(limit.count>150||limit.created>15)return json({error:'操作太频繁，请稍后再试'},429);
   await this.ctx.storage.put(key,limit);
   if(path==='/api/guard')return json({ok:true});
   if(path==='/api/discover'){
    const rooms=await this.ctx.storage.list<Entry>({prefix:'room:'});
    return json([...rooms.values()].filter(r=>r.hash===hash&&r.expires>now&&r.count>0).slice(0,20).map(({hash,expires,...r})=>r));
   }
   if(path==='/api/create'){
    const body=await req.json() as any;const profile=validProfile(body.profile);validKind(body.kind);const options=normalizeGameOptions(body.kind,body.options,profile.id);
    if(!goodToken(body.token)||!['cloud','lan'].includes(body.mode))throw new Error('建房参数无效');
    let code=roomCode();while(await this.ctx.storage.get('room:'+code))code=roomCode();
    const invite=token();const mode=body.mode as RoomMode;
    const result=await this.env.ROOMS.getByName(code).fetch(new Request('https://internal/init',{method:'POST',body:JSON.stringify({code,profile,kind:body.kind,mode,token:body.token,invite,options})}));
    if(!result.ok)return result;
    await this.ctx.storage.put('room:'+code,{code,kind:body.kind,mode,hostName:profile.name,count:1,max:roomLimits(body.kind,options).max,hash,expires:now+6*3600000});
    if(!await this.ctx.storage.getAlarm())await this.ctx.storage.setAlarm(now+3600000);
    return json({code,invite});
   }
   return json({error:'不存在'},404);
  }catch(e){return json({error:error(e)},400);}
 }
 async alarm(){
  const now=Date.now();
  for(const [key,entry]of await this.ctx.storage.list<Entry>({prefix:'room:'})){
   if(entry.expires>now)continue;
   try{
    // A missed index write must not delete a room that renewed its authoritative lease.
    const response=await this.env.ROOMS.getByName(entry.code).fetch(new Request('https://internal/directory-entry'));
    const update=response.ok?await response.json() as Omit<Entry,'hash'>:undefined;
    const current=await this.ctx.storage.get<Entry>(key);
    if(!current||current.expires>now)continue;
    if(response.status===404)await this.ctx.storage.delete(key);
    else if(update)await this.ctx.storage.put(key,{...update,hash:current.hash});
   }catch{/* Keep the entry on transient failure and retry at the next sweep. */}
  }
  for(const [key,value]of await this.ctx.storage.list<{since:number}>({prefix:'limit:'}))if(value.since+600000<now)await this.ctx.storage.delete(key);
  await this.ctx.storage.setAlarm(now+3600000);
 }
}
const ROOM_TTL=6*3600000,ACTIVITY_RENEW_INTERVAL=5*60000;
interface StoredRoom {social?:SocialState;info:RoomInfo;tokens:Record<string,string>;pendingTokens:Record<string,string>;invite:string;match?:MatchState;ended?:boolean;expires:number;controlSeen:Record<string,string[]>;botDue?:number;botRevision?:number}
interface Attachment {id?:string;authenticated?:boolean;pending?:boolean;opened:number;messages?:number;window?:number;lastSeen?:number}
export class GameRoom extends DurableObject<Env>{
 private data?:StoredRoom;
 constructor(ctx:DurableObjectState,env:Env){super(ctx,env);ctx.blockConcurrencyWhile(async()=>{this.data=await ctx.storage.get<StoredRoom>('room');if(this.data?.info.started&&this.data.info.mode==='cloud'&&!this.data.info.matchID){this.data.info.matchID=crypto.randomUUID();await this.save();}});}
 private checkSeat(spectator:boolean){const r=this.data!.info;
  if(spectator){if(r.allowSpectators===false)throw new Error('房主已关闭观战');if((r.spectators?.length||0)>=MAX_SPECTATORS)throw new Error('观战席已满');}
  else if(r.players.length>=roomLimits(r.kind,r.options).max)throw new Error('房间已满');
 }
 private addMember(p:Player,spectator:boolean){const profile=validProfile(p),r=this.data!.info;
  if(spectator)(r.spectators??=[]).push({...profile,connected:this.connected(p.id)});
  else r.players.push({...profile,ready:false,connected:this.connected(p.id)});
 }
 private revoke(id:string,reason:string){const d=this.data!;
  delete d.tokens[id];delete d.pendingTokens[id];delete d.controlSeen[id];
  forgetSocialActor(d.social,id);
  for(const ws of this.sockets(id)){send(ws,{type:'rejected',error:reason});ws.serializeAttachment({opened:0});ws.close(4003,reason);}
 }
 private async save(){
  const d=this.data;if(!d)return;
  const canAct=!d.ended&&d.expires>Date.now()&&d.info.mode==='cloud'&&!d.info.botError&&d.match&&d.info.players.every(p=>this.connected(p.id))&&nextBotSeat(d.info,d.match);
  if(canAct&&d.match){if(d.botRevision!==d.match.revision||!d.botDue){d.botRevision=d.match.revision;d.botDue=Date.now()+botTurnDelay(d.info.kind);}}
  else {delete d.botDue;delete d.botRevision;}
  await this.ctx.storage.put('room',d);
  await this.scheduleAlarm();
 }
 private async scheduleAlarm(){const d=this.data;if(d)await this.ctx.storage.setAlarm(Math.min(d.expires,d.botDue??Infinity,this.ctx.getWebSockets().some(ws=>!(ws.deserializeAttachment() as Attachment).authenticated)?Date.now()+30000:Infinity));}
 // Renew admitted-player activity in batches, rather than writing on every heartbeat.
 private async renewActivity(now:number){
  const d=this.data;if(!d||d.ended||d.expires<=now||d.expires>=now+ROOM_TTL-ACTIVITY_RENEW_INTERVAL)return false;
  const expires=now+ROOM_TTL;await this.ctx.storage.put('room',{...d,expires});d.expires=expires;
  await this.scheduleAlarm();return true;
 }
 private sockets(id?:string){return this.ctx.getWebSockets().filter(ws=>{const a=ws.deserializeAttachment() as Attachment;return a.authenticated&&(!id||a.id===id);});}
 private connected(id:string){return !!this.data?.info.players.find(p=>p.id===id)?.bot||this.sockets(id).length>0;}
 private infoFor(id:string):RoomInfo{const r=this.data!.info;return {...r,expiresAt:this.data!.expires,allowSpectators:r.allowSpectators!==false,spectators:(r.spectators||[]).map(p=>({...p,connected:this.connected(p.id)})),pending:id===r.hostID?r.pending:[],players:r.players.map(p=>({...p,connected:this.connected(p.id)}))};}
 private snapshot(ws:WebSocket){const a=ws.deserializeAttachment() as Attachment;const d=this.data;if(!d||d.ended||d.expires<=Date.now()||!a.id||!a.authenticated)return;
  if(a.pending){send(ws,{type:'pending'});return;}
  const info=this.infoFor(a.id);const match=d.match&&info.mode==='cloud'?viewRoomMatch(d.match,info,a.id):{};
  send(ws,{type:'snapshot',room:info,...match,social:socialView(d.social,info,Date.now()),serverNow:Date.now(),paused:info.mode==='cloud'&&info.started&&info.players.some(p=>!p.connected),invite:a.id===info.hostID?d.invite:undefined});
 }
 private broadcast(){for(const ws of this.sockets())this.snapshot(ws);}
 private directoryEntry():Omit<Entry,'hash'>{const d=this.data!;return {code:d.info.code,kind:d.info.kind,mode:d.info.mode,hostName:d.info.players.find(p=>p.id===d.info.hostID)?.name||'',count:d.ended||d.info.started?0:d.info.players.length,max:roomLimits(d.info.kind,d.info.options).max,expires:d.expires};}
 private async index(){await this.env.DIRECTORY.getByName('directory-v1').fetch(new Request('https://internal/internal/update',{method:'POST',body:JSON.stringify(this.directoryEntry())}));}
 async fetch(req:Request):Promise<Response>{
  try{
   const path=new URL(req.url).pathname;
   if(path==='/init'){
    if(this.data)return json({error:'房间已存在'},409);
    const b=await req.json() as any;validKind(b.kind);const options=normalizeGameOptions(b.kind,b.options,b.profile.id);
    this.data={info:{code:b.code,kind:b.kind,mode:b.mode,hostID:b.profile.id,options,allowSpectators:true,spectators:[],players:[{...b.profile,ready:true,connected:false}],pending:[],started:false,revision:1},tokens:{[b.profile.id]:b.token},pendingTokens:{},invite:b.invite,expires:Date.now()+ROOM_TTL,controlSeen:{}};
    await this.save();return json({ok:true});
   }
   if(!this.data||this.data.ended||this.data.expires<=Date.now())return json({error:'房间已结束或不存在'},404);
   // Only the directory binding can request lease metadata; public probes use /status.
   if(path==='/directory-entry')return json(this.directoryEntry());
   // Existence only: browser WebSocket errors do not expose HTTP 404 status.
   if(path==='/status')return json({ok:true});
   if(this.ctx.getWebSockets().length>44)return json({error:'房间连接过多'},429);
   const pair=new WebSocketPair();const [client,server]=Object.values(pair);this.ctx.acceptWebSocket(server);server.serializeAttachment({opened:Date.now()});
   await this.scheduleAlarm();
   // No room information is sent before authentication/host approval.
   return new Response(null,{status:101,webSocket:client});
  }catch(e){return json({error:error(e)},400);}
 }
 async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){
  try{
   if(typeof message!=='string'||message.length>150000)throw new Error('消息过大');
   const a=ws.deserializeAttachment() as Attachment;const now=Date.now();if(!a.window||now-a.window>10000){a.window=now;a.messages=0;}a.lastSeen=now;a.messages=(a.messages||0)+1;if(a.messages>100)throw new Error('操作太频繁');ws.serializeAttachment(a);
   const msg=JSON.parse(message);const d=this.data;if(!d||d.ended||d.expires<=now)throw new Error('房间已结束');const r=d.info;
   if(msg.type==='hello'){
    const p=validProfile(msg.profile);if(a.authenticated&&a.id!==p.id)throw new Error('身份不匹配');if(msg.spectator!==undefined&&typeof msg.spectator!=='boolean')throw new Error('观战设置无效');if(!goodToken(msg.token))throw new Error('身份无效');
    if(d.tokens[p.id]&&d.tokens[p.id]!==msg.token||d.pendingTokens[p.id]&&d.pendingTokens[p.id]!==msg.token)throw new Error('身份不匹配');
    const member=!!d.tokens[p.id];
    if(!member){
     const spectator=r.started||msg.spectator===true;
     this.checkSeat(spectator);
     if(msg.invite===d.invite){d.tokens[p.id]=msg.token;this.addMember(p,spectator);r.pending=r.pending.filter(v=>v.id!==p.id);delete d.pendingTokens[p.id];}
     else {if(r.pending.length>=12&&!r.pending.some(v=>v.id===p.id))throw new Error('等待入桌的人太多');r.pending=r.pending.filter(v=>v.id!==p.id);r.pending.push({...p,...(spectator?{spectator:true}:{})});d.pendingTokens[p.id]=msg.token;}
    }
    for(const old of this.sockets(p.id)){if(old!==ws){old.serializeAttachment({opened:0});old.close(4001,'已在另一窗口连接');}}
    ws.serializeAttachment({...a,id:p.id,authenticated:true,pending:!d.tokens[p.id]});
    r.revision++;await this.save();if(d.tokens[p.id])await this.renewActivity(now);this.broadcast();await this.index();return;
   }
   if(!a.authenticated||!a.id)throw new Error('请先连接房间');
   const id=a.id;
   if(msg.type==='ping'){if(!a.pending&&d.tokens[id]&&r.players.some(p=>p.id===id)&&await this.renewActivity(now)){this.broadcast();await this.index();}if(msg.sync===true)this.snapshot(ws);send(ws,{type:'pong'});return;}
   if(a.pending){if(msg.type==='leave'){r.pending=r.pending.filter(p=>p.id!==id);delete d.pendingTokens[id];await this.save();ws.close(1000,'已离开');this.broadcast();return;}throw new Error('正在等待房主同意');}
   if(msg.type==='social'){
    // Room communication uses the authenticated control socket in both modes.
    // It never changes game/action revisions or broadcasts private game views.
    try{
     const asset=msg.command?.type==='reaction'&&msg.command.reaction!=='cow'?await publishedReaction(this.env,msg.command.reaction):undefined;
     const attachment=ws.deserializeAttachment() as Attachment;
     if(this.data!==d||d.ended||d.expires<=Date.now()||!d.tokens[id]||!attachment.authenticated||attachment.id!==id||attachment.pending)throw new Error('房间已结束');
     const sentAt=Date.now(),current=d.social||emptySocial(),next=applyRoomSocial(current,d.info,id,msg.command,msg.requestID,sentAt,asset);
     if(next!==current){await this.ctx.storage.put('room',{...d,social:next});d.social=next;}
     const payload={type:'social',social:socialView(next,d.info,sentAt),serverNow:sentAt};
     for(const target of this.sockets()){const member=target.deserializeAttachment() as Attachment;if(!member.pending&&member.id&&d.tokens[member.id])send(target,payload);}
     send(ws,{type:'socialAck',requestID:msg.requestID});
    }catch(e){send(ws,{type:'socialError',requestID:msg.requestID,error:error(e)});}
    return;
   }
   if(msg.type==='signal'){
    if(r.mode!=='lan')throw new Error('当前不是局域网模式');
    if(typeof msg.to!=='string'||!d.tokens[msg.to]||(id!==r.hostID&&msg.to!==r.hostID))throw new Error('配对对象无效');
    for(const target of this.sockets(msg.to))send(target,{type:'signal',from:id,data:msg.data});if(await this.renewActivity(now)){this.broadcast();await this.index();}return;
   }
   if(typeof msg.requestID!=='string'||!msg.requestID||msg.requestID.length>100)throw new Error('请求编号无效');
   if(d.controlSeen[id]?.includes(msg.requestID)){this.snapshot(ws);return;}
   if(msg.type==='action'){
    if(r.mode!=='cloud'||!r.started||!d.match)throw new Error('牌局未开始');
    if(r.players.some(p=>!this.connected(p.id)))throw new Error('有玩家掉线，牌局已暂停');
    d.match=applyMatch(d.match,r.kind,r.players,id,msg.command,msg.requestID,msg.actionRevision);
   }else if(msg.type==='continueBotRound'){
    if(r.mode!=='cloud'||!d.match||r.players.some(p=>!this.connected(p.id)))throw new Error('连接恢复后继续');d.match=continueBotRound(r,d.match,id);
   }else if(msg.type==='approve'){
    if(id!==r.hostID)throw new Error('只有房主能处理入桌');
    const p=r.pending.find(p=>p.id===msg.playerID);if(!p)throw new Error('申请已过期');
    const spectator=r.started||p.spectator===true;if(msg.accept)this.checkSeat(spectator);
    r.pending=r.pending.filter(v=>v.id!==p.id);
    if(msg.accept){d.tokens[p.id]=d.pendingTokens[p.id];this.addMember(p,spectator);for(const target of this.sockets(p.id)){const att=target.deserializeAttachment() as Attachment;target.serializeAttachment({...att,pending:false});}}
    else for(const target of this.sockets(p.id)){send(target,{type:'rejected',error:'房主婉拒了入桌申请'});target.serializeAttachment({opened:0});target.close(4003,'入桌未获批准');}
    delete d.pendingTokens[p.id];
   }else if(msg.type==='addBot'||msg.type==='setBotDifficulty'||msg.type==='removeBot'){
    r.players=changeBots(r,id,msg);
   }else if(msg.type==='retryBot'){
    if(id!==r.hostID||!r.started)throw new Error('只有房主能重试人机');delete r.botError;
   }else if(msg.type==='removePlayer'){
    if(id!==r.hostID||r.started)throw new Error('只有房主能在准备室移除离线玩家');
    if(msg.playerID===id||!r.players.some(p=>p.id===msg.playerID)||this.connected(msg.playerID))throw new Error('只能移除离线玩家');
    r.players=r.players.filter(p=>p.id!==msg.playerID);delete d.tokens[msg.playerID];delete d.controlSeen[msg.playerID];forgetSocialActor(d.social,msg.playerID);
   }else if(msg.type==='setSpectators'){
    if(id!==r.hostID)throw new Error('只有房主能设置观战');
    if(typeof msg.allowed!=='boolean')throw new Error('观战设置无效');
    r.allowSpectators=msg.allowed;
    if(!msg.allowed){
     for(const p of r.spectators||[])this.revoke(p.id,'房主已关闭观战');
     r.spectators=[];
     for(const p of r.pending.filter(p=>p.spectator||r.started))this.revoke(p.id,'房主已关闭观战');
     r.pending=r.pending.filter(p=>!p.spectator&&!r.started);
    }
   }else if(msg.type==='setSeat'){
    if(r.started)throw new Error('牌局已开始');
    if(id===r.hostID)throw new Error('房主需要保留玩家席位');
    if(typeof msg.spectator!=='boolean')throw new Error('观战设置无效');
    const wasSpectator=!!r.spectators?.some(p=>p.id===id);
    if(wasSpectator!==msg.spectator){
     this.checkSeat(msg.spectator);
     const p=[...r.players,...r.spectators||[]].find(p=>p.id===id)!;
     r.players=r.players.filter(p=>p.id!==id);r.spectators=(r.spectators||[]).filter(p=>p.id!==id);
     this.addMember(p,msg.spectator);
    }
   }else if(msg.type==='ready'){
    if(!r.players.some(p=>p.id===id))throw new Error('观众不能操作牌局');
    if(r.started)throw new Error('牌局已开始');r.players=r.players.map(p=>p.id===id?{...p,ready:!!msg.ready}:p);
   }else if(msg.type==='start'){
    if(id!==r.hostID||r.started)throw new Error('只有房主能开始');
    if(r.players.length<roomLimits(r.kind,r.options).min||r.players.length>roomLimits(r.kind,r.options).max)throw new Error(`需要 ${roomLimits(r.kind,r.options).min}–${roomLimits(r.kind,r.options).max} 人`);
    if(r.players.some(p=>!p.ready||!this.connected(p.id)))throw new Error('请等待所有玩家准备');
    if(r.mode==='lan'&&(!Array.isArray(msg.directPeers)||r.players.some(p=>p.id!==id&&!p.bot&&!msg.directPeers.includes(p.id))))throw new Error('等待局域网直连完成');
    for(const p of r.pending){if(r.allowSpectators!==false)p.spectator=true;else this.revoke(p.id,'房主已关闭观战');}if(r.allowSpectators===false)r.pending=[];
    if(r.mode==='cloud')d.match=createMatch(r.kind,r.players,r.options);r.started=true;r.matchID=crypto.randomUUID();
   }else if(msg.type==='replay'||msg.type==='endGame'){
    if(id!==r.hostID)throw new Error('只有房主能结束本局');r.started=false;delete r.matchID;delete r.botError;delete d.match;r.players=r.players.map(p=>({...p,ready:!!p.bot||p.id===id}));
   }else if(msg.type==='selectGame'){
    if(id!==r.hostID||r.started)throw new Error('请先回到房间');validKind(msg.kind);if(!supportsBots(msg.kind)&&r.players.some(p=>p.bot))throw new Error('请先移除人机，再切换到此游戏');const options=normalizeGameOptions(msg.kind,msg.options,r.hostID);if(r.players.length>roomLimits(msg.kind,options).max)throw new Error('当前人数超过上限');r.kind=msg.kind;r.options=options;r.players=r.players.map(p=>({...p,ready:!!p.bot||p.id===id}));
   }else if(msg.type==='switchToCloud'){
    if(id!==r.hostID||r.mode!=='lan')throw new Error('仅局域网房主可切换');
    if(r.started)d.match=validateMatchForRoom(msg.match,r);
    r.mode='cloud';
   }else if(msg.type==='leave'){
    if(id===r.hostID){
     // Keep only the existing ended-room tombstone; chat must not survive dissolution.
     d.ended=true;delete d.social;delete d.match;d.tokens={};d.pendingTokens={};d.controlSeen={};r.pending=[];r.revision++;
     await this.save();
     for(const target of this.sockets()){send(target,{type:'ended',error:'房主已解散房间'});target.close(1000,'房主已解散房间');}
     await this.index();return;
    }
    else if(r.started&&r.players.some(p=>p.id===id))throw new Error('牌局中请让房主结束本局再离桌');
    else {r.players=r.players.filter(p=>p.id!==id);r.spectators=(r.spectators||[]).filter(p=>p.id!==id);delete d.tokens[id];delete d.controlSeen[id];forgetSocialActor(d.social,id);ws.serializeAttachment({opened:0});ws.close(1000,'离桌');}
   }else throw new Error('未知操作');
   if(d.tokens[id])d.controlSeen[id]=[...(d.controlSeen[id]||[]),msg.requestID].slice(-128);r.revision++;await this.save();const renewed=await this.renewActivity(now);this.broadcast();if(renewed||msg.type!=='action'&&msg.type!=='ready')await this.index();
  }catch(e){send(ws,{type:'error',error:error(e)});}
 }
 async webSocketClose(ws:WebSocket){const a=ws.deserializeAttachment() as Attachment;ws.serializeAttachment({opened:0});try{ws.close(1000,'连接已关闭');}catch{}if(this.data&&a.id){if(a.pending){this.data.info.pending=this.data.info.pending.filter(p=>p.id!==a.id);delete this.data.pendingTokens[a.id];}this.data.info.revision++;await this.save();this.broadcast();}}
 async webSocketError(ws:WebSocket){await this.webSocketClose(ws);try{ws.close(1011,'连接中断');}catch{}}
 async alarm(){
  const now=Date.now();let changed=false;
  // Browser suspension stops application heartbeats, not necessarily WebSockets.
  // Keep authenticated seats until transport close/error or the room lease ends.
  for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment() as Attachment;if(!a.authenticated&&a.opened<now-25000){ws.serializeAttachment({opened:0});ws.close(4000,'连接超时，请重新连接');if(a.pending&&a.id&&this.data){this.data.info.pending=this.data.info.pending.filter(p=>p.id!==a.id);delete this.data.pendingTokens[a.id];}changed=true;}}
  if(changed&&this.data){this.data.info.revision++;await this.save();this.broadcast();}
  const d=this.data;
  if(d&&!d.ended&&d.expires>now&&d.botDue!==undefined&&d.botDue<=now&&d.botRevision===d.match?.revision&&d.info.mode==='cloud'&&d.info.players.every(p=>this.connected(p.id))){
   try{if(d.match){d.match=stepBot(d.info,d.match);d.info.revision++;}}
   catch{d.info.botError='人机暂时无法行动，请重试';}
   delete d.botDue;delete d.botRevision;await this.save();this.broadcast();
  }
  if(this.data&&this.data.expires>now)await this.scheduleAlarm();
  if(this.data&&this.data.expires<=now){this.data.ended=true;for(const ws of this.sockets()){send(ws,{type:'ended',error:'房间已到期，请重新建房'});ws.close(1000,'房间到期');}await this.index();await this.ctx.storage.deleteAll();this.data=undefined;}
 }
}
