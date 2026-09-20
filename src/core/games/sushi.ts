import { action, assertPlayers, seeded, shuffle, validateCommand, type GameModule, type Player } from '../types';

export type SushiKind='tempura'|'sashimi'|'dumpling'|'maki1'|'maki2'|'maki3'|'egg'|'salmon'|'squid'|'wasabi'|'pudding'|'chopsticks';
export interface SushiCard {id:string;kind:SushiKind}
export const SUSHI_INFO:Record<SushiKind,{title:string;symbol:string;detail:string}>={
  tempura:{title:'天妇罗',symbol:'🍤',detail:'每 2 张得 5 分'},sashimi:{title:'刺身',symbol:'🐟',detail:'每 3 张得 10 分'},dumpling:{title:'饺子',symbol:'🥟',detail:'1 / 3 / 6 / 10 / 15 分'},maki1:{title:'寿司卷 · 1',symbol:'🍙',detail:'卷数第一 6 分，第二 3 分'},maki2:{title:'寿司卷 · 2',symbol:'🍙',detail:'卷数第一 6 分，第二 3 分'},maki3:{title:'寿司卷 · 3',symbol:'🍙',detail:'卷数第一 6 分，第二 3 分'},egg:{title:'玉子握寿司',symbol:'🍣',detail:'1 分 · 芥末可变 3 分'},salmon:{title:'三文鱼握寿司',symbol:'🍣',detail:'2 分 · 芥末可变 6 分'},squid:{title:'鱿鱼握寿司',symbol:'🍣',detail:'3 分 · 芥末可变 9 分'},wasabi:{title:'芥末',symbol:'🌿',detail:'之后的第一张握寿司 ×3'},pudding:{title:'布丁',symbol:'🍮',detail:'三轮后最多 +6，最少 −6'},chopsticks:{title:'筷子',symbol:'🥢',detail:'之后可换选 2 张，再传出筷子'}
};
export interface SushiState {players:Player[];deck:SushiCard[];hands:SushiCard[][];table:SushiCard[][];picks:(string[]|null)[];scores:number[];puddings:number[];round:number;step:number;finished:boolean;winners:string[];history:string[];roundScores:number[][]}
export function sushiPlateScore(cards:SushiCard[]):number {
  const count=(k:SushiKind)=>cards.filter(c=>c.kind===k).length;
  let total=Math.floor(count('tempura')/2)*5+Math.floor(count('sashimi')/3)*10+[0,1,3,6,10,15][Math.min(5,count('dumpling'))],wasabi=0;
  for(const c of cards){if(c.kind==='wasabi')wasabi++;const value=({egg:1,salmon:2,squid:3} as Partial<Record<SushiKind,number>>)[c.kind];if(value){total+=value*(wasabi?3:1);if(wasabi)wasabi--;}}
  return total;
}
function deal(s:SushiState){const n=12-s.players.length;s.hands=s.players.map(()=>s.deck.splice(-n));s.table=s.players.map(()=>[]);s.picks=s.players.map(()=>null);s.step=1;}
function scoreRound(s:SushiState){
  const points=s.table.map(sushiPlateScore),rolls=s.table.map(cs=>cs.reduce((n,c)=>n+(c.kind.startsWith('maki')?Number(c.kind.slice(-1)):0),0));
  const max=Math.max(...rolls),first=rolls.flatMap((n,i)=>n===max?[i]:[]);
  if(max>0){first.forEach(i=>points[i]+=Math.floor(6/first.length));if(first.length===1){const second=Math.max(...rolls.filter(n=>n<max));if(second>0){const ids=rolls.flatMap((n,i)=>n===second?[i]:[]);ids.forEach(i=>points[i]+=Math.floor(3/ids.length));}}}
  points.forEach((p,i)=>{s.scores[i]+=p;s.puddings[i]+=s.table[i].filter(c=>c.kind==='pudding').length;});s.roundScores.push(points);
  s.history.push(`第 ${s.round} 轮：${s.players.map((p,i)=>`${p.name} +${points[i]}`).join(' · ')}`);
  if(s.round<3){s.round++;deal(s);return;}
  const most=Math.max(...s.puddings),least=Math.min(...s.puddings);
  if(most!==least){const high=s.puddings.flatMap((p,i)=>p===most?[i]:[]),low=s.puddings.flatMap((p,i)=>p===least?[i]:[]);high.forEach(i=>s.scores[i]+=Math.floor(6/high.length));if(s.players.length>2)low.forEach(i=>s.scores[i]-=Math.floor(6/low.length));}
  const best=Math.max(...s.scores),dessert=Math.max(...s.puddings.filter((_,i)=>s.scores[i]===best));s.winners=s.players.filter((_,i)=>s.scores[i]===best&&s.puddings[i]===dessert).map(p=>p.id);s.finished=true;
}
export const sushi:GameModule<SushiState>={
 create(players,seed){assertPlayers(players,2,5);const quantities:Record<SushiKind,number>={tempura:14,sashimi:14,dumpling:14,maki1:6,maki2:12,maki3:8,egg:5,salmon:10,squid:5,wasabi:6,pudding:10,chopsticks:4};const deck=shuffle(Object.entries(quantities).flatMap(([kind,n])=>Array.from({length:n},(_,i)=>({id:`${kind}-${i}`,kind:kind as SushiKind}))),seeded(seed));const s:SushiState={players:structuredClone(players),deck,hands:[],table:[],picks:[],scores:players.map(()=>0),puddings:players.map(()=>0),round:1,step:1,finished:false,winners:[],history:['同时选牌，全部确认后揭晓，手牌向左传递'],roundScores:[]};deal(s);return s;},
 view(s,id){const me=s.players.findIndex(p=>p.id===id);if(me<0)return{kind:'sushi',phase:'不在本局',instruction:'仅本局玩家可查看',finished:s.finished,actions:[],sections:[],log:[],board:{}};
 const picks=s.picks[me],choices=s.hands[me].map(c=>({id:c.id,title:SUSHI_INFO[c.kind].title,subtitle:SUSHI_INFO[c.kind].detail})),canDouble=s.table[me].some(c=>c.kind==='chopsticks')&&choices.length>=2;
 const actions=s.finished?[]:picks?[action('cancel','重新选牌')]:[action('pick','确认选牌',choices,1,canDouble?2:1,canDouble?'可用已打出的筷子选 2 张；按点选顺序结算芥末。':'选择 1 张，等待大家同时揭晓')];
 return structuredClone({kind:'sushi',phase:s.finished?'三轮结束':`第 ${s.round} / 3 轮 · 第 ${s.step} 手`,instruction:s.finished?`胜者：${s.players.filter(p=>s.winners.includes(p.id)).map(p=>p.name).join('、')}`:picks?'已锁定，等待其他人选牌':'选好一道，传出余下的手牌',finished:s.finished,actions,sections:[],log:s.history,board:{hand:s.hands[me],selected:picks,round:s.round,step:s.step,roundScores:s.roundScores,winners:s.winners,players:s.players.map((p,i)=>({...p,table:s.table[i],score:s.scores[i],puddings:s.puddings[i],ready:!!s.picks[i],handCount:s.hands[i].length}))}});},
 apply(state,id,command){validateCommand(sushi.view(state,id),command);const s=structuredClone(state),me=s.players.findIndex(p=>p.id===id);if(command.action==='cancel'){s.picks[me]=null;return s;}s.picks[me]=[...command.values];
 if(s.picks.every(Boolean)){
   s.picks.forEach((ids,i)=>{if(ids!.length===2){const chop=s.table[i].findIndex(c=>c.kind==='chopsticks');s.hands[i].push(s.table[i].splice(chop,1)[0]);}for(const cardID of ids!){const at=s.hands[i].findIndex(c=>c.id===cardID);s.table[i].push(s.hands[i].splice(at,1)[0]);}});
   s.picks=s.players.map(()=>null);s.hands=s.hands.map((_,i)=>s.hands[(i+s.players.length-1)%s.players.length]);s.step++;
   // The last card is revealed automatically in the standard rules.
   if(s.hands[0].length===1){s.hands.forEach((h,i)=>s.table[i].push(h.pop()!));}
   if(!s.hands[0].length)scoreRound(s);
 }
 return s;}
};
