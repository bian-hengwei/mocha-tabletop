import {action,type Command,type GameView} from '../types';
import {decodeRelayStroke,RELAY_MAX_STROKES,type DrawRelayState,type RelayEntry} from './drawrelay';
export interface RelayQueue {drafts:(RelayEntry|null)[];selected:Record<string,number>}
const owner=(s:DrawRelayState,book:number)=>s.players[(book+s.books[book].length)%s.players.length].id;
const taskID=(s:DrawRelayState,book:number)=>`${book}:${s.books[book].length}`;
export const queuedBooks=(s:DrawRelayState,id:string)=>s.books.flatMap((pages,book)=>pages.length<s.players.length&&owner(s,book)===id?[book]:[]);
export function freshQueueDraft(s:DrawRelayState,book:number):RelayEntry|null{
 const step=s.books[book].length;if(step===s.players.length)return null;
 return {author:owner(s,book),kind:step%2?'drawing':'text',...(step%2?{strokes:[]}:{text:''})};
}
export function viewRelayQueue(s:DrawRelayState,id:string,spectator:boolean):GameView{
 const books=spectator?[]:queuedBooks(s,id),selected=s.queue!.selected[id],book=books.includes(selected)?selected:books[0],draft=s.queue!.drafts[book];
 const step=book===undefined?0:s.books[book].length,stage=!draft?'waiting':step===0?'prompt':draft.kind==='drawing'?'draw':'guess';
 const marker=draft?[{id:taskID(s,book),title:'当前页'}]:[];
 return structuredClone({kind:'drawrelay',phase:stage==='draw'?'画图':stage==='guess'?'猜图':stage==='prompt'?'开场句':'暂无待办',instruction:'等待接龙任务',finished:false,actions:[...(draft?[action('submit','传给下一位',marker,1,1),...(draft.kind==='drawing'?[action('stroke','画笔',marker,1,1),...(draft.strokes!.length?[action('undo','撤销上一笔',marker,1,1),action('clear','清空画布',marker,1,1)]:[])]:[action('draft','保存草稿',marker,1,1)])]:[]),...(books.length?[action('task','切换任务',books.map(b=>({id:taskID(s,b),title:String(b+1)})),1,1)]:[])],sections:[],log:[],board:{mode:'queue',stage,step,totalSteps:s.players.length,seconds:0,deadlineAt:0,submitted:false,taskID:book===undefined?'':taskID(s,book),tasks:books.map(b=>({id:taskID(s,b),book:b,step:s.books[b].length,kind:s.queue!.drafts[b]!.kind})),players:s.players.map(p=>({...p,ready:s.books.reduce((n,pages)=>n+pages.filter(e=>e.author===p.id).length,0)===s.players.length})),...(draft?{draft,previous:s.books[book].at(-1)}:{})}});
}
export function applyRelayQueue(state:DrawRelayState,id:string,command:Command):DrawRelayState{
 const books=queuedBooks(state,id),book=books.find(b=>taskID(state,b)===command.values[0]);
 if(book===undefined)throw new Error('接龙已换页，请重新查看');
 if(command.action==='task'){
  if(command.values.length!==1)throw new Error('操作无效');
  const s=structuredClone(state);s.queue!.selected[id]=book;return s;
 }
 const old=state.queue!.drafts[book]!;
 if(command.action==='stroke'){
  if(old.kind!=='drawing'||command.values.length!==2||old.strokes!.length>=RELAY_MAX_STROKES)throw new Error('画布已满，请撤销后继续');
  decodeRelayStroke(command.values[1]);
 }else if(command.values.length!==1)throw new Error('操作无效');
 if(command.action==='draft'&&(old.kind!=='text'||typeof command.text!=='string'||[...command.text].length>120||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(command.text)))throw new Error('接龙文字限 120 字');
 if(['undo','clear'].includes(command.action)&&(old.kind!=='drawing'||!old.strokes!.length))throw new Error('画布没有笔迹');
 if(command.action==='submit'&&!(old.kind==='drawing'?old.strokes!.length:old.text!.trim()))throw new Error('请先完成这一页');
 if(!['stroke','draft','undo','clear','submit'].includes(command.action))throw new Error('操作无效');
 const s=structuredClone(state),draft=s.queue!.drafts[book]!;
 if(command.action==='stroke')draft.strokes!.push(command.values[1]);
 if(command.action==='draft')draft.text=command.text!;
 if(command.action==='undo')draft.strokes!.pop();
 if(command.action==='clear')draft.strokes=[];
 if(command.action==='submit'){
  s.books[book].push(draft);s.queue!.drafts[book]=freshQueueDraft(s,book);
  s.step=Math.min(...s.books.map(p=>p.length));s.finished=s.step===s.players.length;
  delete s.queue!.selected[id];
 }
 return s;
}
