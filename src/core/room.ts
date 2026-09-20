import type { Command, GameKind, GameView, Player, GameOptions } from './types';
import { AVATARS, GAMES } from './types';
import { modules } from './registry';
export type RoomMode = 'cloud' | 'lan';
export interface RoomPlayer extends Player { ready:boolean; connected:boolean }
export interface RoomInfo {code:string;kind:GameKind;mode:RoomMode;hostID:string;options?:GameOptions;players:RoomPlayer[];pending:Player[];started:boolean;revision:number}
export interface RoomCandidate {code:string;kind:GameKind;mode:RoomMode;hostName:string;count:number;max:number}
export interface ClientState {status:'idle'|'connecting'|'lobby'|'playing'|'reconnecting'|'disconnected';mode?:RoomMode;room?:RoomInfo;selfID?:string;view?:GameView;error?:string;transport:'none'|'cloud'|'lan';paused:boolean;inviteURL?:string;actionRevision:number;waitingApproval?:boolean}
export interface MatchState {schemaVersion?:2;options?:GameOptions;game:any;revision:number;actorRevisions:Record<string,number>;seen:Record<string,string[]>}
export function validProfile(input:any):Player {
 if(!input || typeof input.id!=='string'|| !/^[a-zA-Z0-9_-]{8,80}$/.test(input.id))throw new Error('玩家身份无效');
 if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>16)throw new Error('昵称限 1–16 个字');
 if(!AVATARS.includes(input.avatar))throw new Error('请选择一个头像');
 return {id:input.id,name:input.name.trim(),avatar:input.avatar};
}
export function validKind(kind:any):asserts kind is GameKind {if(!Object.hasOwn(GAMES,kind))throw new Error('未知游戏');}
/** Trusted room owner determines the moderator. Never accept another player ID. */
export function normalizeGameOptions(kind:GameKind,input:unknown,hostID:string):GameOptions|undefined {
 if(input!==undefined&&(input===null||typeof input!=='object'||Array.isArray(input)))throw new Error('游戏选项无效');
 const options=(input||{}) as Record<string,unknown>;
 if(Object.keys(options).some(key=>!['werewolfMode','moderatorID'].includes(key)))throw new Error('未知游戏选项');
 if(kind!=='werewolf'){if(Object.keys(options).length)throw new Error('此游戏不支持狼人杀选项');return undefined;}
 const mode=options.werewolfMode??'standard';
 if(!['standard','judge','deal'].includes(mode as string))throw new Error('狼人杀模式无效');
 if(mode==='standard'){if(options.moderatorID!==undefined)throw new Error('标准模式不设置法官');return {werewolfMode:'standard'};}
 if(!/^[a-zA-Z0-9_-]{8,80}$/.test(hostID))throw new Error('房主身份无效');
 if(options.moderatorID!==undefined&&options.moderatorID!==hostID)throw new Error('法官或发牌人必须是房主');
 return {werewolfMode:mode as 'judge'|'deal',moderatorID:hostID};
}
export function roomLimits(kind:GameKind,options?:GameOptions):{min:number;max:number}{const extra=kind==='werewolf'&&options?.werewolfMode==='judge'?1:0;return {min:GAMES[kind].min+extra,max:GAMES[kind].max+extra};}
export function optionsKey(kind:GameKind,options:GameOptions|undefined,hostID:string){return JSON.stringify(normalizeGameOptions(kind,options,hostID)||{});}
export function createMatch(kind:GameKind,players:Player[],options?:GameOptions):MatchState {
 const canonical=normalizeGameOptions(kind,options,players[0]?.id||'');
 return {schemaVersion:2,options:canonical,game:modules[kind].create(players,crypto.getRandomValues(new Uint32Array(1))[0],canonical),revision:1,actorRevisions:Object.fromEntries(players.map(p=>[p.id,1])),seen:{}};
}
/** Validate room identity/options before trusting a LAN checkpoint or cloud handoff. */
export function validateMatchForRoom(value:unknown,room:RoomInfo):MatchState {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('牌局存档无效');
 const match=value as MatchState;
 if(match.schemaVersion!==undefined&&match.schemaVersion!==2)throw new Error('牌局存档版本不支持');
 if(!Number.isSafeInteger(match.revision)||match.revision<1||!match.game||typeof match.game!=='object')throw new Error('牌局存档无效');
 if(optionsKey(room.kind,match.options,room.hostID)!==optionsKey(room.kind,room.options,room.hostID))throw new Error('牌局模式与房间不一致');
 const ids=room.players.map(p=>p.id),sameRoster=(list:any)=>Array.isArray(list)&&list.length===ids.length&&list.every((p:any,i:number)=>p?.id===ids[i]);
 if(!sameRoster(match.game.players))throw new Error('牌局玩家与房间不一致');
 if(!match.actorRevisions||typeof match.actorRevisions!=='object'||Array.isArray(match.actorRevisions)||Object.keys(match.actorRevisions).length!==ids.length||ids.some(id=>!Number.isSafeInteger(match.actorRevisions[id])||match.actorRevisions[id]<1))throw new Error('操作版本无效');
 if(!match.seen||typeof match.seen!=='object'||Array.isArray(match.seen)||Object.entries(match.seen).some(([id,requests])=>!ids.includes(id)||!Array.isArray(requests)||requests.length>128||requests.some(request=>typeof request!=='string'||!request||request.length>100)))throw new Error('操作记录无效');
 if(room.kind==='werewolf'){
  const expected=normalizeGameOptions(room.kind,room.options,room.hostID)!;
  if(optionsKey(room.kind,match.game.options,room.hostID)!==optionsKey(room.kind,expected,room.hostID))throw new Error('狼人杀存档模式或法官身份不一致');
  const participantIDs=ids.filter(id=>expected.werewolfMode!=='judge'||id!==room.hostID);
  if(expected.werewolfMode!=='standard'&&(!Array.isArray(match.game.participants)||match.game.participants.length!==participantIDs.length||match.game.participants.some((p:any,i:number)=>p?.id!==participantIDs[i])))throw new Error('参与发牌的玩家与房间不一致');
  if(!match.game.roles||typeof match.game.roles!=='object'||Object.keys(match.game.roles).length!==participantIDs.length||participantIDs.some(id=>!Object.hasOwn(match.game.roles,id)))throw new Error('身份牌名单与房间不一致');
  if(expected.werewolfMode==='judge'&&Object.hasOwn(match.game.roles,room.hostID))throw new Error('法官不能参与发牌');
 }
 for(const id of ids)viewMatch(match,room.kind,id);
 return structuredClone(match);
}
export function applyMatch(match:MatchState,kind:GameKind,players:Player[],actor:string,command:Command,requestID:string,actionRevision:number):MatchState {
 if(!players.some(p=>p.id===actor))throw new Error('不在本局中');
 if(typeof requestID!=='string'||requestID.length>100||!requestID)throw new Error('操作编号无效');
 if(match.seen[actor]?.includes(requestID))return match;
 if(actionRevision!==match.actorRevisions[actor])throw new Error('牌局已变化，请重选');
 if(!command||typeof command.action!=='string'||!Array.isArray(command.values)||command.values.length>32||command.values.some(v=>typeof v!=='string'||v.length>200))throw new Error('操作无效');
 const before=Object.fromEntries(players.map(p=>[p.id,JSON.stringify(modules[kind].view(match.game,p.id).actions)]));
 const game=modules[kind].apply(structuredClone(match.game),actor,command);
 const actorRevisions={...match.actorRevisions};
 for(const p of players)if(p.id===actor||before[p.id]!==JSON.stringify(modules[kind].view(game,p.id).actions))actorRevisions[p.id]=(actorRevisions[p.id]||0)+1;
 return {...match,game,revision:match.revision+1,actorRevisions,seen:{...match.seen,[actor]:[...(match.seen[actor]||[]),requestID].slice(-128)}};
}
export function viewMatch(match:MatchState,kind:GameKind,id:string){return {view:modules[kind].view(match.game,id),actionRevision:match.actorRevisions[id]||0};}
