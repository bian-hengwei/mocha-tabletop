import type {ReactionAsset} from './reactionCatalog';
import type {GameKind, Player} from './types';
import type {RoomInfo} from './room';

export const REACTIONS = ['cow'] as const;
export type ReactionID = string;
export const CHAT_LIMIT = 280;
export const CHAT_HISTORY = 80;
export const SOCIAL_DURATION = 5000;
export const SOCIAL_COOLDOWN = 1200;
export type SocialCommand = {type:'chat';text:string} | {type:'reaction';reaction:ReactionID};
export interface ChatMessage {id:string;player:Player;text:string;at:number}
export interface RoomReaction {id:string;playerID:string;reaction:ReactionID;at:number;asset?:ReactionAsset}
export interface SocialView {messages:ChatMessage[];reactions:RoomReaction[];revision:number}
export interface SocialState extends SocialView {seen:Record<string,string[]>;lastSent:Record<string,number>}
export const emptySocial = ():SocialState => ({messages:[],reactions:[],revision:0,seen:{},lastSent:{}});

// These games constrain when players may communicate or reveal identities/words.
export function supportsRoomSocial(kind:GameKind){return !['codenames','werewolf','undercover','avalon'].includes(kind);}

export function applyRoomSocial(state:SocialState,room:RoomInfo,actor:string,input:unknown,requestID:unknown,now:number,asset?:ReactionAsset):SocialState {
 if(!supportsRoomSocial(room.kind))throw new Error('此游戏不开放聊天和表情');
 const player=room.players.find(p=>p.id===actor&&!p.bot);
 if(!player)throw new Error('只有在座玩家可以发言');
 if(typeof requestID!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(requestID))throw new Error('消息编号无效');
 if(state.seen[actor]?.includes(requestID))return state;
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('消息无效');
 const command=input as Record<string,unknown>;
 let text:string|undefined,reaction:ReactionID|undefined;
 if(command.type==='chat'){
  if(Object.keys(command).some(k=>!['type','text'].includes(k))||typeof command.text!=='string')throw new Error('消息无效');
  text=command.text.trim();
  if(!text||command.text.length>CHAT_LIMIT||/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(text))throw new Error('消息限 1–280 个字，请勿输入控制字符');
 }else if(command.type==='reaction'){
  if(Object.keys(command).some(k=>!['type','reaction'].includes(k))||!(REACTIONS.some(id=>id===command.reaction)||(asset&&asset.id===command.reaction)))throw new Error('请选择一个表情');
  reaction=command.reaction as ReactionID;
 }else throw new Error('消息无效');
 if(state.lastSent[actor]!==undefined&&now-state.lastSent[actor]<SOCIAL_COOLDOWN)throw new Error('发送太快，请稍等片刻');
 const id=`${actor}:${requestID}`;
 return {
  revision:state.revision+1,
  messages:text===undefined?state.messages:[...state.messages,{id,player:{id:player.id,name:player.name,avatar:player.avatar},text,at:now}].slice(-CHAT_HISTORY),
  reactions:[...state.reactions.filter(r=>r.at+SOCIAL_DURATION>now&&(!reaction||r.playerID!==actor)),...(reaction?[{id,playerID:actor,reaction,at:now,...(asset?{asset}: {})}]:[])],
  seen:{...state.seen,[actor]:[...(state.seen[actor]||[]),requestID].slice(-128)},
  lastSent:{...state.lastSent,[actor]:now},
 };
}

export function socialView(state:SocialState|undefined,room:RoomInfo,now:number,customReactions=true):SocialView {
 if(!supportsRoomSocial(room.kind)||!state)return {messages:[],reactions:[],revision:state?.revision||0};
 return {messages:state.messages,reactions:state.reactions.filter(r=>(customReactions||REACTIONS.some(id=>id===r.reaction))&&r.at+SOCIAL_DURATION>now&&room.players.some(p=>p.id===r.playerID)),revision:state.revision};
}

export function forgetSocialActor(state:SocialState|undefined,id:string){
 if(!state)return;
 delete state.seen[id];delete state.lastSent[id];
 state.reactions=state.reactions.filter(r=>r.playerID!==id);
}
