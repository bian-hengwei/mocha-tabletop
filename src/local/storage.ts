import { AVATARS, GAMES, type GameKind, type GameView, type Player } from '../core/types';
import { isWolfRole } from '../core/werewolfPresets';
export function readProfile():Player|null {
  try { const p=JSON.parse(localStorage.getItem('mocha-profile')||'null');
    return p&&typeof p.id==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(p.id)&&typeof p.name==='string'&&p.name.trim()&&AVATARS.includes(p.avatar)?{id:p.id,name:p.name.trim().slice(0,16),avatar:p.avatar}:null;
  } catch { return null; }
}
export type Result='win'|'loss'|'draw'|'host'|'completed';
export interface MatchRecord {id:string;kind:GameKind;at:number;name:string;avatar:string;mode:'cloud'|'lan'|'practice';result:Result;summary:string;score?:number;playerCount:number}
type HistoryStore={records:MatchRecord[];seen:string[]};
const KEY='mocha-history-v1';
function readStore():HistoryStore {
  try {const data=JSON.parse(localStorage.getItem(KEY)||'null');return {records:Array.isArray(data?.records)?data.records.filter((r:any)=>r&&typeof r.id==='string'&&Object.hasOwn(GAMES,r.kind)&&Number.isFinite(r.at)&&r.at>0&&r.at<8640000000000000&&typeof r.avatar==='string'&&Number.isInteger(r.playerCount)&&r.playerCount>=0&&typeof r.name==='string'&&typeof r.summary==='string'&&['win','loss','draw','host','completed'].includes(r.result)&&['cloud','lan','practice'].includes(r.mode)):[],seen:Array.isArray(data?.seen)?data.seen.filter((id:any)=>typeof id==='string'):[]};}
  catch{return {records:[],seen:[]};}
}
export const readHistory=()=>readStore().records;
export function saveRecord(record:MatchRecord):boolean {
  const data=readStore();if(data.seen.includes(record.id))return false;
  data.seen.push(record.id);data.records.unshift(record);data.records=data.records.slice(0,500);
  localStorage.setItem(KEY,JSON.stringify(data));return true;
}
// Keep completed match IDs after deletion so re-opening a result never restores it.
export function deleteRecord(id?:string){const data=readStore();data.records=id?data.records.filter(r=>r.id!==id):[];localStorage.setItem(KEY,JSON.stringify(data));}
export function makeRecord(view:GameView,id:string,selfID:string,player:Player,mode:MatchRecord['mode']):MatchRecord|null {
  if(!view.finished)return null;
  const b=view.board,own=b.players?.find((p:any)=>p.id===selfID);
  let result:Result='completed';
  if(b.isModerator)result='host';
  else if(Array.isArray(b.winners)&&b.winners.length)result=b.winners.includes(selfID)?(b.winners.length>1&&['gems','sushi','century'].includes(view.kind)?'draw':'win'):'loss';
  else if(typeof b.winner==='string'&&b.ownRole){
    if(view.kind==='werewolf')result=(b.winner.startsWith('狼人')===(b.ownRoleKey?isWolfRole(b.ownRoleKey):['狼人','狼王'].includes(b.ownRole)))?'win':'loss';
    if(view.kind==='avalon')result=(b.winner.startsWith('邪恶')===['莫甘娜','刺客','爪牙'].includes(b.ownRole))?'win':'loss';
  }
  return {id,kind:view.kind,at:Date.now(),name:player.name,avatar:player.avatar,mode,result,summary:(b.winner||view.instruction||'本局结束').toString().slice(0,240),...(typeof own?.score==='number'?{score:own.score}:{}),playerCount:b.players?.length||0};
}
