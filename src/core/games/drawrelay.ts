import {freshQueueDraft,viewRelayQueue,applyRelayQueue,type RelayQueue} from './relayQueue';
import {action, assertPlayers, type GameModule, type Player, type Command} from '../types';

/** Mocha drawing telephone rules: docs/DRAW_RELAY.md. No external art or word bank. */
export const RELAY_COLORS=['#253c42','#ce5345','#e5ab3e','#438468','#518bb0','#9162a7','#ffffff','#e57c3a','#dc649a','#92c94b','#33b9bb','#a6774b','#888888','#111111','#efdfad','#adc5ee'] as const;
export const RELAY_WIDTHS=[4,9,18,30,48] as const;
export const RELAY_MAX_STROKES=96;
export const RELAY_MAX_POINTS=48;
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export type RelayPoint=[number,number];
export interface RelayEntry {author:string;kind:'text'|'drawing';text?:string;strokes?:string[];skipped?:boolean;timedOut?:boolean}
export interface DrawRelayState {version:1;queue?:RelayQueue;players:Player[];seconds:number;step:number;books:RelayEntry[][];drafts:RelayEntry[];submitted:boolean[];deadlineAt:number;pausedRemaining?:number;finished:boolean;cursors:Record<string,{book:number;page:number}>}
export function encodeRelayStroke(points:RelayPoint[],color:number,width:number):string {
 return alphabet[color]+alphabet[width]+points.map(([x,y])=>alphabet[x>>5]+alphabet[x&31]+alphabet[y>>5]+alphabet[y&31]).join('');
}
export function decodeRelayStroke(encoded:string):{color:number;width:number;points:RelayPoint[]} {
 if(typeof encoded!=='string'||encoded.length<6||encoded.length>2+4*RELAY_MAX_POINTS||(encoded.length-2)%4)throw new Error('接龙笔迹无效');
 const indices=[...encoded].map(c=>alphabet.indexOf(c)),color=indices[0],width=indices[1];
 if(indices.some(n=>n<0)||color>=RELAY_COLORS.length||width>=RELAY_WIDTHS.length||indices.slice(2).some(n=>n>31))throw new Error('接龙笔迹无效');
 const points:RelayPoint[]=[];for(let i=2;i<indices.length;i+=4){const x=indices[i]*32+indices[i+1],y=indices[i+2]*32+indices[i+3];if(y>767)throw new Error('接龙笔迹无效');points.push([x,y]);}
 return {color,width,points};
}
const kindAt=(step:number):RelayEntry['kind']=>step%2?'drawing':'text';
const bookAt=(s:DrawRelayState,seat:number)=>(seat-s.step+s.players.length)%s.players.length;
function freshDrafts(s:DrawRelayState){s.drafts=s.players.map(p=>({author:p.id,kind:kindAt(s.step),...(kindAt(s.step)==='drawing'?{strokes:[]}:{text:''})}));s.submitted=s.players.map(()=>false);}
function advanceStep(s:DrawRelayState){for(let i=0;i<s.players.length;i++)s.books[bookAt(s,i)].push(s.drafts[i]);s.step++;s.deadlineAt=0;delete s.pausedRemaining;if(s.step===s.players.length){s.finished=true;s.drafts=[];s.submitted=[];}else freshDrafts(s);}
function member(s:DrawRelayState,id:string){const seat=s.players.findIndex(p=>p.id===id);if(seat<0)throw new Error('不在本局中');return seat;}
function hasContent(entry:RelayEntry){return entry.kind==='drawing'?!!entry.strokes?.length:!!entry.text?.trim();}
export function relayDeadline(s:DrawRelayState){return s.finished||s.pausedRemaining!==undefined?0:s.deadlineAt;}
/** Only trusted room/local-host code supplies wall-clock time. Client commands cannot tick. */
export function advanceRelayClock(state:DrawRelayState,now:number):DrawRelayState {
 if(!Number.isFinite(now)||state.finished||!state.seconds||state.pausedRemaining!==undefined)return state;
 if(state.deadlineAt>now)return state;
 const s=structuredClone(state);
 if(s.deadlineAt){s.drafts.forEach((entry,i)=>{if(!s.submitted[i]){entry.timedOut=true;if(!hasContent(entry))entry.skipped=true;}});advanceStep(s);}
 if(!s.finished)s.deadlineAt=now+s.seconds*1000;
 return s;
}
export function pauseRelayClock(state:DrawRelayState,now:number){if(!state.seconds||state.finished||state.pausedRemaining!==undefined)return state;return {...state,deadlineAt:0,pausedRemaining:state.deadlineAt?Math.max(0,state.deadlineAt-now):state.seconds*1000};}
export function resumeRelayClock(state:DrawRelayState,now:number){if(state.pausedRemaining===undefined)return state;const s={...state,deadlineAt:now+state.pausedRemaining};delete s.pausedRemaining;return s;}
function assertStep(s:DrawRelayState,command:Command){if(command.values[0]!==String(s.step))throw new Error('接龙已换页，请重新查看');}
export const drawrelay:GameModule<DrawRelayState>={
 create(players,_seed,options){assertPlayers(players,3,12);const seconds=options?.relayMode==='queue'?0:options?.relaySeconds??90;if(![0,60,90,120].includes(seconds))throw new Error('接龙时长无效');const s:DrawRelayState={version:1,players:structuredClone(players),seconds,step:0,books:players.map(()=>[]),drafts:[],submitted:[],deadlineAt:0,finished:false,cursors:{}};if(options?.relayMode==='queue'){s.queue={drafts:players.map((_,b)=>freshQueueDraft(s,b)),selected:{}};}else freshDrafts(s);return s;},
 view(s,id,spectator=false){const seat=spectator?-1:s.players.findIndex(p=>p.id===id);if(seat<0&&!spectator)throw new Error('不在本局中');
  if(s.queue&&!s.finished)return viewRelayQueue(s,id,spectator);
  const stage=s.finished?'gallery':s.step===0?'prompt':s.step%2?'draw':'guess',editable=seat>=0&&!s.finished&&!s.submitted[seat];
  const marker=[{id:String(s.step),title:'当前页'}],actions=editable?[action('submit','传给下一位',marker,1,1),...(stage==='draw'?[action('stroke','画笔',marker,1,1),...(s.drafts[seat].strokes!.length?[action('undo','撤销上一笔',marker,1,1),action('clear','清空画布',marker,1,1)]:[])]:[action('draft','保存草稿',marker,1,1)])]:[];
  const cursor=s.cursors[seat<0?s.players[0].id:id]||{book:0,page:0};
  if(s.finished&&seat>=0)actions.push(action('album','选择画册',s.players.map((p,i)=>({id:String(i),title:p.name,translateTitle:false})),1,1),action('page','选择页码',s.players.map((_,i)=>({id:String(i),title:String(i+1)})),1,1));
  return structuredClone({kind:'drawrelay',phase:s.finished?'画册揭晓':stage==='prompt'?'开场句':stage==='draw'?'画图':'猜图',instruction:s.finished?'查看每句话怎样传到最后':seat<0?'等待玩家完成接龙':s.submitted[seat]?'已提交，等待其他玩家':stage==='prompt'?'写一句话，交给下一位画出来':stage==='draw'?'根据上一页的句子作画':'只看这幅画，写下你的理解',finished:s.finished,actions,sections:[],log:[],board:{stage,step:s.step,totalSteps:s.players.length,seconds:s.seconds,deadlineAt:relayDeadline(s),players:s.players.map((p,i)=>({...p,ready:s.finished||s.submitted[i]})),...(s.finished?{gallery:{...cursor,entry:s.books[cursor.book][cursor.page]}}:seat>=0?{submitted:s.submitted[seat],previous:s.step?s.books[bookAt(s,seat)].at(-1):undefined,draft:s.drafts[seat]}:{})}});
 },
 apply(state,id,command){const seat=member(state,id);if(!command||!Array.isArray(command.values))throw new Error('操作无效');
  if(state.finished){if(!['album','page'].includes(command.action)||command.values.length!==1||!/^(0|[1-9]\d*)$/.test(command.values[0]))throw new Error('操作无效');const n=Number(command.values[0]);if(n>=state.players.length)throw new Error('操作无效');const s=structuredClone(state),cursor=s.cursors[id]||{book:0,page:0};s.cursors[id]=command.action==='album'?{book:n,page:0}:{...cursor,page:n};return s;}
  if(state.queue)return applyRelayQueue(state,id,command);
  if(state.submitted[seat])throw new Error('已经提交本页');assertStep(state,command);
  const old=state.drafts[seat];
  if(command.action==='stroke'){if(old.kind!=='drawing'||command.values.length!==2||old.strokes!.length>=RELAY_MAX_STROKES)throw new Error('画布已满，请撤销后继续');decodeRelayStroke(command.values[1]);}
  else if(command.values.length!==1)throw new Error('操作无效');
  if(command.action==='draft'&&(old.kind!=='text'||typeof command.text!=='string'||[...command.text].length>120||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(command.text)))throw new Error('接龙文字限 120 字');
  if(['undo','clear'].includes(command.action)&&(old.kind!=='drawing'||!old.strokes!.length))throw new Error('画布没有笔迹');
  if(command.action==='submit'&&!hasContent(old))throw new Error('请先完成这一页');
  if(!['stroke','draft','undo','clear','submit'].includes(command.action))throw new Error('操作无效');
  const s=structuredClone(state),draft=s.drafts[seat];
  if(command.action==='stroke')draft.strokes!.push(command.values[1]);
  if(command.action==='draft')draft.text=command.text!;
  if(command.action==='undo')draft.strokes!.pop();
  if(command.action==='clear')draft.strokes=[];
  if(command.action==='submit'){s.submitted[seat]=true;if(s.submitted.every(Boolean))advanceStep(s);}
  return s;
 }
};

/** Reject malformed/oversized restored LAN and practice state before any projection. */
export function validateRelayState(value:unknown,seconds:number,mode:'rounds'|'queue'='rounds'):asserts value is DrawRelayState {
 const s=value as DrawRelayState,fail=()=>{throw new Error('接龙存档无效');};
 if(!s||s.version!==1||s.seconds!==(mode==='queue'?0:seconds)||![0,60,90,120].includes(s.seconds)||!Array.isArray(s.players)||s.players.length<3||s.players.length>12)return fail();
 const n=s.players.length,ids=s.players.map(p=>p.id);
 if(!!s.queue!==(mode==='queue'))return fail();
 if(new Set(ids).size!==n||!Number.isInteger(s.step)||s.step<0||s.step>n||s.finished!==(s.step===n)||!Number.isFinite(s.deadlineAt)||s.deadlineAt<0||(s.pausedRemaining!==undefined&&(!Number.isFinite(s.pausedRemaining)||s.pausedRemaining<0||s.pausedRemaining>s.seconds*1000||s.deadlineAt!==0)))return fail();
 if(!Array.isArray(s.books)||s.books.length!==n||!Array.isArray(s.drafts)||s.drafts.length!==(s.finished||s.queue?0:n)||!Array.isArray(s.submitted)||s.submitted.length!==(s.finished||s.queue?0:n)||s.submitted.some(v=>typeof v!=='boolean'))return fail();
 const entry=(e:RelayEntry,step:number,author:string)=>{if(!e||e.author!==author||e.kind!==kindAt(step)||e.skipped!==undefined&&typeof e.skipped!=='boolean'||e.timedOut!==undefined&&typeof e.timedOut!=='boolean')return fail();if(e.kind==='text'){if(typeof e.text!=='string'||[...e.text].length>120||e.strokes!==undefined)return fail();}else{if(e.text!==undefined||!Array.isArray(e.strokes)||e.strokes.length>RELAY_MAX_STROKES)return fail();for(const stroke of e.strokes)decodeRelayStroke(stroke);}};
 for(let b=0;b<n;b++){if(!Array.isArray(s.books[b])||(s.queue?s.books[b].length>n:s.books[b].length!==s.step))return fail();s.books[b].forEach((e,step)=>entry(e,step,ids[(b+step)%n]));}
 if(s.queue){
  if(!Array.isArray(s.queue.drafts)||s.queue.drafts.length!==n||s.seconds!==0||s.deadlineAt!==0||s.pausedRemaining!==undefined||s.step!==Math.min(...s.books.map(p=>p.length)))return fail();
  s.queue.drafts.forEach((e,b)=>{const step=s.books[b].length;if(step===n){if(e!==null)return fail();}else entry(e!,step,ids[(b+step)%n]);});
  if(!s.queue.selected||typeof s.queue.selected!=='object'||Array.isArray(s.queue.selected)||Object.keys(s.queue.selected).length>n)return fail();
  for(const [id,b]of Object.entries(s.queue.selected))if(!ids.includes(id)||!Number.isInteger(b)||b<0||b>=n)return fail();
 }else s.drafts.forEach((e,i)=>entry(e,s.step,ids[i]));
 if(!s.cursors||typeof s.cursors!=='object'||Array.isArray(s.cursors)||Object.keys(s.cursors).length>n)return fail();
 for(const [id,cursor]of Object.entries(s.cursors))if(!ids.includes(id)||!cursor||![cursor.book,cursor.page].every(v=>Number.isInteger(v)&&v>=0&&v<n))return fail();
 // Include future fields and redundant attacker data in the envelope budget.
 if(new TextEncoder().encode(JSON.stringify(s)).length>1500000)return fail();
}
