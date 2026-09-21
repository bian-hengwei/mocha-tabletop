import {AVATARS, GAMES, type Command, type GameKind, type GameOptions, type Player} from '../core/types';
import {modules} from '../core/registry';
import {applyMatch, normalizeGameOptions, roomLimits, type MatchState, type RoomInfo} from '../core/room';
import {continueBotRound, nextBotSeat, stepBot} from '../core/roomBots';
import {supportsBots, validBotDifficulty} from '../core/bots';
import type {BotDifficulty} from '../core/bots/types';

export interface Practice {
 id:string; kind:GameKind; players:Player[]; game:unknown; viewer:string; options?:GameOptions;
 mode?:'pass'|'solo'; difficulty?:BotDifficulty; revision?:number; botError?:boolean;
}
const KEY='mocha-practice-v1';
export function createPractice(kind:GameKind,count:number,profile:Player,options?:GameOptions,difficulty?:BotDifficulty,seed=crypto.getRandomValues(new Uint32Array(1))[0]):Practice {
 const canonical=normalizeGameOptions(kind,options,'practice-0'),limits=roomLimits(kind,canonical);
 if(!Number.isInteger(count)||count<limits.min||count>limits.max)throw new Error('单机人数不符合当前规则');
 if(difficulty!==undefined){validBotDifficulty(difficulty);if(!supportsBots(kind))throw new Error('此游戏需要真人交流，不支持人机');}
 const names=options?.language==='en'?['','Alex','Rain','Quinn','Sunny','Robin','Ash','Zephyr','Summer']:['','阿岚','小雨','阿七','橘子','小白','阿木','南风','夏天'];
 const players:Player[]=Array.from({length:count},(_,i)=>({id:`practice-${i}`,name:i===0?profile.name:difficulty?`Mocha ${i}`:names[i]||(options?.language==='en'?`Player ${i+1}`:`玩家${i+1}`),avatar:i===0?profile.avatar:difficulty?'🤖':AVATARS[i],...(i>0&&difficulty?{bot:{difficulty}}:{})}));
 return {id:crypto.randomUUID(),kind,players,game:modules[kind].create(players,seed,canonical),viewer:players[0].id,options:canonical,mode:difficulty?'solo':'pass',...(difficulty?{difficulty}:{}),revision:1};
}
export function restartPractice(p:Practice,seed=crypto.getRandomValues(new Uint32Array(1))[0]):Practice {
 return {...p,id:crypto.randomUUID(),game:modules[p.kind].create(p.players,seed,p.options),viewer:p.players[0].id,revision:1,botError:undefined};
}
function roomFor(p:Practice):RoomInfo{return {code:p.id,kind:p.kind,mode:'cloud',hostID:p.players[0].id,players:p.players.map(player=>({...player,ready:true,connected:true})),pending:[],started:true,revision:p.revision||1,options:p.options};}
function matchFor(p:Practice):MatchState{return {game:p.game,options:p.options,revision:p.revision||1,actorRevisions:Object.fromEntries(p.players.map(player=>[player.id,p.revision||1])),seen:{}};}
function withMatch(p:Practice,m:MatchState):Practice{return {...p,game:m.game,revision:m.revision,botError:undefined};}
export function practiceView(p:Practice){return modules[p.kind].view(p.game,p.mode==='solo'?p.players[0].id:p.viewer);}
export function applyPractice(p:Practice,command:Command):Practice {
 const actor=p.mode==='solo'?p.players[0].id:p.viewer;
 return withMatch(p,applyMatch(matchFor(p),p.kind,p.players,actor,command,`local:${p.revision||1}`,p.revision||1));
}
export function hasPracticeBotTurn(p:Practice){return p.mode==='solo'&&!p.botError&&!!nextBotSeat(roomFor(p),matchFor(p));}
export function stepPracticeBot(p:Practice):Practice {return hasPracticeBotTurn(p)?withMatch(p,stepBot(roomFor(p),matchFor(p))):p;}
export function practiceBotRoundWaiting(p:Practice){return p.mode==='solo'&&!practiceView(p).finished&&!practiceView(p).actions.some(a=>a.id==='nextRound')&&p.players.some(player=>player.bot&&modules[p.kind].view(p.game,player.id).actions.some(a=>a.id==='nextRound'));}
export function continuePracticeRound(p:Practice):Practice{if(p.mode!=='solo')throw new Error('当前没有待开始的下一轮');return withMatch(p,continueBotRound(roomFor(p),matchFor(p),p.players[0].id));}
export function writePractice(p:Practice|null){if(p)localStorage.setItem(KEY,JSON.stringify({at:Date.now(),practice:p}));else localStorage.removeItem(KEY);}
export function readPractice():Practice|null {
 try{
  if(typeof location!=='undefined'&&new URL(location.href).searchParams.has('room'))return null;
  const saved=JSON.parse(localStorage.getItem(KEY)||'null'),p=saved?.practice as Practice|undefined;
  if(!p||typeof p.id!=='string'||!Number.isFinite(saved.at)||Date.now()-saved.at>7*86400000||!Object.hasOwn(GAMES,p.kind)||!Array.isArray(p.players)||!p.players.length||!p.players.some(player=>player.id===p.viewer))return null;
  if(p.mode!==undefined&&p.mode!=='pass'&&p.mode!=='solo')return null;
  if(p.revision!==undefined&&(!Number.isSafeInteger(p.revision)||p.revision<1))return null;
  normalizeGameOptions(p.kind,p.options,p.players[0].id);
  if(p.players.some(player=>typeof player.id!=='string'||typeof player.name!=='string'||typeof player.avatar!=='string'))return null;
  const roster=(p.game as {players?:Player[]}|null)?.players,limits=roomLimits(p.kind,p.options);
  if(p.players.length<limits.min||p.players.length>limits.max||new Set(p.players.map(player=>player.id)).size!==p.players.length||!Array.isArray(roster)||roster.length!==p.players.length||roster.some((player,i)=>player.id!==p.players[i].id||JSON.stringify(player.bot??null)!==JSON.stringify(p.players[i].bot??null)))return null;
  if(p.mode==='solo'){
   if(!supportsBots(p.kind)||validBotDifficulty(p.difficulty)!==p.difficulty||p.players[0].bot||p.players.slice(1).some(player=>player.bot?.difficulty!==p.difficulty))return null;
   p.viewer=p.players[0].id;
  }else if(p.players.some(player=>player.bot))return null;
  const view=practiceView(p);if(!Array.isArray(view.board.players)||!view.board.players.length)return null;
  return p;
 }catch{return null;}
}
