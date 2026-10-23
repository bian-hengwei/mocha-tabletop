import {changeBots} from '../core/roomBots';
import {supportsBots} from '../core/bots';
import {MAX_SPECTATORS, normalizeGameOptions, roomLimits, validKind, validProfile, type RoomInfo} from '../core/room';
import type {GameKind, GameOptions, Player} from '../core/types';

export const OFFLINE_PAIR_LIMIT = 50000;
export const validOfflineToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{48,128}$/.test(value);
export interface OfflineRequest {version:1;type:'request';id:string;expiresAt:number;profile:Player;token:string;spectator:boolean;description:RTCSessionDescriptionInit}
export interface OfflineAnswer {version:1;type:'answer';id:string;expiresAt:number;room:RoomInfo;description:RTCSessionDescriptionInit}
export function readPairing(text:string): OfflineRequest | OfflineAnswer {
 if(text.length>OFFLINE_PAIR_LIMIT)throw new Error('离线配对数据无效');
 let value:Record<string, unknown>;
 try{value=JSON.parse(text);}catch{throw new Error('离线配对数据无效');}
 if(!value||value.version!==1||typeof value.id!=='string'||! /^[a-f0-9-]{36}$/.test(value.id))throw new Error('离线配对数据无效');
 if(typeof value.expiresAt!=='number'||!Number.isFinite(value.expiresAt)||value.expiresAt<=Date.now()||value.expiresAt>Date.now()+600000)throw new Error('配对文件已过期或设备时间不一致，请重新生成');
 const description=value.description as RTCSessionDescriptionInit|undefined;
 if(!description||typeof description.sdp!=='string'||description.sdp.length>30000||!/^v=0\r?\n/.test(description.sdp)||!description.sdp.includes('a=candidate:'))throw new Error('此浏览器未提供本地连接地址，请换用其他浏览器');
 if(value.type==='request'&&description.type==='offer'&&validOfflineToken(value.token)&&typeof value.spectator==='boolean')return {version:1,type:'request',id:value.id,expiresAt:value.expiresAt,profile:validProfile(value.profile),token:value.token,spectator:value.spectator,description:{type:'offer',sdp:description.sdp}};
 if(value.type==='answer'&&description.type==='answer')return {version:1,type:'answer',id:value.id,expiresAt:value.expiresAt,room:readOfflineRoom(value.room),description:{type:'answer',sdp:description.sdp}};
 throw new Error('离线配对数据无效');
}
export function readOfflineRoom(input:unknown):RoomInfo {
 if(!input||typeof input!=='object')throw new Error('离线房间存档无效');
 const r=input as RoomInfo;
 validKind(r.kind);
 if(r.offline!==true||r.mode!=='lan'||! /^[A-Z2-9]{6}$/.test(r.code)||!Array.isArray(r.players)||!Array.isArray(r.spectators)||r.spectators.length>MAX_SPECTATORS||!Number.isSafeInteger(r.revision)||r.revision<1||typeof r.started!=='boolean')throw new Error('离线房间存档无效');
 const options=normalizeGameOptions(r.kind,r.options,r.hostID);
 if(r.players.length<1||r.players.length>roomLimits(r.kind,options).max||r.players[0]?.id!==r.hostID)throw new Error('离线房间存档无效');
 const players=r.players.map(p=>{
  if(p.bot){if(!/^bot_[a-f0-9-]{36}$/.test(p.id)||!['easy','normal','hard'].includes(p.bot.difficulty)||typeof p.name!=='string'||p.name.length>16)throw new Error('离线房间存档无效');return {...p,ready:true,connected:true};}
  return {...validProfile(p),ready:!!p.ready,connected:!!p.connected};
 });
 const spectators=r.spectators.map(p=>({...validProfile(p),connected:!!p.connected}));
 const ids=[...players,...spectators].map(p=>p.id);
 if(new Set(ids).size!==ids.length||r.started&&(typeof r.matchID!=='string'||r.matchID.length>100))throw new Error('离线房间存档无效');
 return {offline:true,mode:'lan',code:r.code,kind:r.kind,hostID:r.hostID,options,players,spectators,allowSpectators:r.allowSpectators!==false,pending:[],started:r.started,revision:r.revision,...(r.started?{matchID:r.matchID}:{})};
}

/** Local membership authority. Authentication secrets never enter RoomInfo or peer snapshots. */
export class OfflineRoom {
 room:RoomInfo;
 tokens:Record<string,string>;
 private seen:Record<string,string[]>={};
 constructor(profile:Player,kind:GameKind,options:GameOptions|undefined,token:string){
  profile=validProfile(profile);validKind(kind);
  if(!validOfflineToken(token))throw new Error('玩家身份无效');
  const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
  this.room={offline:true,code,kind,options:normalizeGameOptions(kind,options,profile.id),hostID:profile.id,mode:'lan',players:[{...profile,ready:true,connected:true}],spectators:[],allowSpectators:true,pending:[],started:false,revision:1};
  this.tokens={[profile.id]:token};
 }
 static restore(input:unknown,profile:Player,token:string){
  const saved=input as {room?:unknown;tokens?:Record<string,string>};
  const room=readOfflineRoom(saved?.room);
  if(room.hostID!==profile.id||!saved.tokens||saved.tokens[profile.id]!==token)throw new Error('离线房间存档无效');
  const restored=new OfflineRoom(profile,room.kind,room.options,token);
  restored.room={...room,players:room.players.map(p=>({...p,connected:!!p.bot||p.id===room.hostID})),spectators:room.spectators!.map(p=>({...p,connected:false}))};
  const ids=[...room.players.filter(p=>!p.bot),...room.spectators!].map(p=>p.id);
  if(ids.some(id=>!validOfflineToken(saved.tokens![id])))throw new Error('离线房间存档无效');
  restored.tokens=Object.fromEntries(ids.map(id=>[id,saved.tokens![id]]));
  return restored;
 }
 admit(request:OfflineRequest){
  const r=this.room,p=request.profile;
  if(p.id===r.hostID)throw new Error('请使用另一台设备加入');
  if(this.tokens[p.id]){if(this.tokens[p.id]!==request.token)throw new Error('玩家身份无效');return;}
  const spectator=r.started||request.spectator;
  this.checkSeat(spectator);
  this.room={...r,revision:r.revision+1,...(spectator?{spectators:[...r.spectators||[],{...p,connected:false}]}:{players:[...r.players,{...p,ready:false,connected:false}]})};
  this.tokens[p.id]=request.token;
 }
 private checkSeat(spectator:boolean){const r=this.room;
  if(spectator){if(!r.allowSpectators)throw new Error('房主已关闭观战');if(r.spectators!.length>=MAX_SPECTATORS)throw new Error('观战席已满');}
  else if(r.players.length>=roomLimits(r.kind,r.options).max)throw new Error('房间已满');
 }
 control(actor:string,msg:Record<string,unknown>):{start?:boolean;end?:boolean;closed?:boolean;removed:string[]}{
  if(!this.tokens[actor])throw new Error('玩家身份无效');
  if(typeof msg.requestID!=='string'||!msg.requestID||msg.requestID.length>100)throw new Error('请求编号无效');
  if(this.seen[actor]?.includes(msg.requestID))return {removed:[]};
  const r=structuredClone(this.room),host=actor===r.hostID,result:{start?:boolean;end?:boolean;closed?:boolean;removed:string[]}={removed:[]};
  const requireHost=()=>{if(!host)throw new Error('只有房主能操作');};
  switch(msg.type){
   case 'ready': if(r.started)throw new Error('牌局已开始');if(typeof msg.ready!=='boolean'||!r.players.some(p=>p.id===actor))throw new Error('观众不能操作牌局');r.players=r.players.map(p=>p.id===actor?{...p,ready:msg.ready as boolean}:p);break;
   case 'start': {requireHost();const limits=roomLimits(r.kind,r.options);if(r.started||r.players.length<limits.min||r.players.length>limits.max)throw new Error(`需要 ${limits.min}–${limits.max} 人`);if(r.players.some(p=>!p.ready||!p.connected))throw new Error('请等待所有玩家准备');r.started=true;r.matchID=crypto.randomUUID();result.start=true;break;}
   case 'replay': case 'endGame': requireHost();r.started=false;delete r.matchID;r.players=r.players.map(p=>({...p,ready:!!p.bot||p.id===r.hostID}));result.end=true;break;
   case 'selectGame': requireHost();if(r.started)throw new Error('请先回到房间');validKind(msg.kind);if(!supportsBots(msg.kind)&&r.players.some(p=>p.bot))throw new Error('请先移除人机，再切换到此游戏');r.options=normalizeGameOptions(msg.kind,msg.options,r.hostID);if(r.players.length>roomLimits(msg.kind,r.options).max)throw new Error('当前人数超过上限');r.kind=msg.kind;r.players=r.players.map(p=>({...p,ready:!!p.bot||p.id===r.hostID}));break;
   case 'addBot': r.players=changeBots(r,actor,{type:'addBot',difficulty:msg.difficulty});break;
   case 'removeBot': r.players=changeBots(r,actor,{type:'removeBot',playerID:msg.playerID});break;
   case 'setBotDifficulty': r.players=changeBots(r,actor,{type:'setBotDifficulty',playerID:msg.playerID,difficulty:msg.difficulty});break;
   case 'setSpectators': requireHost();if(typeof msg.allowed!=='boolean')throw new Error('观战设置无效');r.allowSpectators=msg.allowed;if(!msg.allowed){result.removed=r.spectators!.map(p=>p.id);r.spectators=[];}break;
   case 'setSeat': {if(host||r.started||typeof msg.spectator!=='boolean')throw new Error('观战设置无效');const p=[...r.players,...r.spectators!].find(p=>p.id===actor)!;if(r.spectators!.some(p=>p.id===actor)!==msg.spectator){this.checkSeat(msg.spectator);r.players=r.players.filter(p=>p.id!==actor);r.spectators=r.spectators!.filter(p=>p.id!==actor);if(msg.spectator)r.spectators.push({...p,connected:true});else r.players.push({...p,ready:false,connected:true});}break;}
   case 'removePlayer': requireHost();if(r.started||msg.playerID===actor||!r.players.some(p=>p.id===msg.playerID&&!p.connected))throw new Error('只能移除离线玩家');result.removed=[msg.playerID as string];break;
   case 'leave': if(host)result.closed=true;else {if(r.started&&r.players.some(p=>p.id===actor))throw new Error('牌局中请让房主结束本局再离桌');result.removed=[actor];}break;
   default: throw new Error('未知操作');
  }
  r.players=r.players.filter(p=>!result.removed.includes(p.id));r.spectators=r.spectators!.filter(p=>!result.removed.includes(p.id));
  for(const id of result.removed){delete this.tokens[id];delete this.seen[id];}
  this.room={...r,revision:r.revision+1};this.seen[actor]=[...this.seen[actor]||[],msg.requestID].slice(-128);
  return result;
 }
}

/** Non-trickle ICE permits two file transfers without a signaling service. */
export async function completeLocalDescription(pc:RTCPeerConnection):Promise<RTCSessionDescriptionInit>{
 if(pc.iceGatheringState!=='complete')await new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>{cleanup();reject(new Error('此浏览器未提供本地连接地址，请换用其他浏览器'));},10000);
  const changed=()=>{if(pc.iceGatheringState==='complete'){cleanup();resolve();}else if(pc.connectionState==='closed'){cleanup();reject(new Error('离线配对已取消'));}};
  const cleanup=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',changed);pc.removeEventListener('connectionstatechange',changed);};
  pc.addEventListener('icegatheringstatechange',changed);pc.addEventListener('connectionstatechange',changed);changed();
 });
 const description=pc.localDescription;
 if(!description?.sdp.includes('a=candidate:'))throw new Error('此浏览器未提供本地连接地址，请换用其他浏览器');
 return {type:description.type,sdp:description.sdp};
}
