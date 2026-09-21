import { action, assertPlayers, seeded, shuffle, validateCommand, type Action, type GameModule, type Player } from '../types';
export type PokerKind = 'doudizhu' | 'guandan';
export interface PokerCard { id: string; rank: number; suit: number }
export interface Combination { type: string; power: number; size: number; bomb: number }
export interface PokerState {
 kind: PokerKind; players: Player[]; hands: PokerCard[][]; bottom: PokerCard[]; played: PokerCard[];
 current: number; phase: 'bid'|'play'|'roundEnd'|'tribute'; rng: number; round: number;
 bid: number; bidder: number; bids: (number|null)[]; landlord: number; multiplier: number; plays: number[];
 last: { player: number; cards: PokerCard[]; combo: Combination } | null; passed: number[];
 order: number[]; previousOrder: number[]; levels: number[]; level: number; scores: number[];
 returns: { from: number; to: number }[]; lead: number; finished: boolean; winners: string[]; history: string[];
}
export const rankName = (rank:number) => ({11:'J',12:'Q',13:'K',14:'A',15:'2',16:'小王',17:'大王'}[rank] || String(rank));
export const pokerTitle = (c:PokerCard) => c.rank >= 16 ? rankName(c.rank) : ['♠','♥','♣','♦'][c.suit]+rankName(c.rank);
export function pokerDeck(copies=1):PokerCard[] { return Array.from({length:copies},(_,copy)=>Array.from({length:54},(_,i)=>({id:`p${copy}-${i}`,rank:i<52?3+Math.floor(i/4):16+i-52,suit:i<52?i%4:4}))).flat(); }
export const levelRank=(level:number)=>level===2?15:level;
const wild=(c:PokerCard,level:number)=>c.suit===1&&c.rank===levelRank(level);
export const pokerPower=(rank:number,kind:PokerKind,level=2)=>kind==='guandan'?(rank>=16?rank+2:rank===levelRank(level)?17:rank===15?2:rank):rank;
export function beats(a:Combination,b?:Combination|null) { if(!b)return true; if(a.bomb||b.bomb)return a.bomb!==b.bomb?a.bomb>b.bomb:a.power>b.power; return a.type===b.type&&a.size===b.size&&a.power>b.power; }
const consecutive=(r:number[])=>r.every((n,i)=>!i||n===r[i-1]+1);
/** Exact natural-card classifier. DDZ excludes 2/jokers from all runs. */
function ddz(cards:PokerCard[]):Combination[] {
 const n=cards.length, counts=new Map<number,number>();cards.forEach(c=>counts.set(c.rank,(counts.get(c.rank)||0)+1));
 const ranks=[...counts.keys()].sort((a,b)=>a-b), groups=[...counts.values()].sort((a,b)=>b-a), out:Combination[]=[];
 const add=(type:string,power:number,bomb=0)=>out.push({type,power,size:n,bomb});
 if(n===2&&ranks.join(',')==='16,17')add('王炸',17,100);
 if(ranks.length===1){if(n<=3)add(['','单张','对子','三张'][n],ranks[0]);if(n===4)add('炸弹',ranks[0],4);}
 if(n===4&&groups.join(',')==='3,1')add('三带一',ranks.find(r=>counts.get(r)===3)!);
 if(n===5&&groups.join(',')==='3,2')add('三带二',ranks.find(r=>counts.get(r)===3)!);
 if(n>=5&&ranks.at(-1)!<15&&consecutive(ranks)&&groups.every(v=>v===1))add('顺子',ranks.at(-1)!);
 if(n>=6&&ranks.at(-1)!<15&&consecutive(ranks)&&groups.every(v=>v===2))add('连对',ranks.at(-1)!);
 for(let len=2;len<=6;len++)for(let start=3;start+len-1<=14;start++){
  const core=Array.from({length:len},(_,i)=>start+i);if(!core.every(r=>(counts.get(r)||0)>=3))continue;
  const rest=new Map(counts);core.forEach(r=>rest.set(r,rest.get(r)!-3));
  if(n===len*3)add('飞机',start+len-1);
  if(n===len*4&&core.every(r=>rest.get(r)===0)&&!((rest.get(16)||0)&&(rest.get(17)||0)))add('飞机带单',start+len-1);
  if(n===len*5&&core.every(r=>rest.get(r)===0)&&[...rest.values()].filter(Boolean).length===len&&[...rest.values()].every(v=>v===0||v===2))add('飞机带对',start+len-1);
 }
 for(const r of ranks.filter(r=>counts.get(r)===4)){
  if(n===6&&!(counts.has(16)&&counts.has(17)))add('四带二',r);
  if(n===8&&ranks.filter(x=>x!==r).length===2&&ranks.filter(x=>x!==r).every(x=>counts.get(x)===2))add('四带两对',r);
 }
 return out;
}
interface Pattern { ranks:number[]; type:string; power:number; bomb:number; suit?:number }
function gdPatterns(level:number):Pattern[] {
 const result:Pattern[]=[],power=(r:number)=>pokerPower(r,'guandan',level),add=(ranks:number[],type:string,p:number,bomb=0,suit?:number)=>result.push({ranks,type,power:p,bomb,suit});
 for(let r=3;r<=17;r++){
  for(let n=1;n<= (r<16?10:2);n++){if(n<=3)add(Array(n).fill(r),['','单张','对子','三张'][n],power(r));else add(Array(n).fill(r),'炸弹',power(r),n*2);}
  if(r<16)for(let pair=3;pair<=17;pair++)if(pair!==r)add([r,r,r,pair,pair],'三带二',power(r));
 }
 add([16,16,17,17],'四大天王',100,100);
 for(const [length,copies,type]of [[5,1,'顺子'],[3,2,'三连对'],[2,3,'钢板']] as const){
  for(let start=1;start+length-1<=14;start++){
   const sequence=Array.from({length},(_,i)=>start+i),ranks=sequence.map(r=>r===1?14:r===2?15:r).flatMap(r=>Array(copies).fill(r));
   add(ranks,type,start+length-1);
   if(copies===1)for(let suit=0;suit<4;suit++)add(ranks,'同花顺',start+length-1,11,suit);
  }
 }
 return result;
}
function fillPattern(cards:PokerCard[],p:Pattern,level:number):PokerCard[]|null {
 const remaining=[...cards],picked:PokerCard[]=[];
 for(const rank of p.ranks){let at=remaining.findIndex(c=>c.rank===rank&&(p.suit===undefined||c.suit===p.suit)&&!wild(c,level));
  if(at<0)at=remaining.findIndex(c=>c.rank===rank&&(p.suit===undefined||c.suit===p.suit));
  if(at<0&&rank<16)at=remaining.findIndex(c=>wild(c,level));if(at<0)return null;picked.push(remaining.splice(at,1)[0]);
 }return picked;
}
export function classifyPoker(cards:PokerCard[],kind:PokerKind,level=2):Combination[] {
 if(!cards.length||new Set(cards.map(c=>c.id)).size!==cards.length)return[];
 if(kind==='doudizhu')return ddz(cards);
 // A single heart-level card retains its level rank; wildcards never impersonate jokers.
 if(cards.length===1)return[{type:'单张',power:pokerPower(cards[0].rank,kind,level),size:1,bomb:0}];
 return gdPatterns(level).filter(p=>p.ranks.length===cards.length&&fillPattern(cards,p,level)).map(p=>({type:p.type,power:p.power,size:cards.length,bomb:p.bomb}));
}
export const combinationKey=(c:Combination)=>`${c.type}:${c.power}:${c.size}:${c.bomb}`;
export function legalPokerCombinations(cards:PokerCard[],kind:PokerKind,level:number,target?:Combination|null){const unique=new Map(classifyPoker(cards,kind,level).filter(c=>beats(c,target)).map(c=>[combinationKey(c),c]));return [...unique.values()].sort((a,b)=>b.bomb-a.bomb||b.power-a.power);}
export function pokerHint(s:PokerState):string[] {
 const hand=s.hands[s.current],target=s.last?.combo;
 if(s.kind==='guandan'){
  const patterns=gdPatterns(s.level).sort((a,b)=>a.bomb-b.bomb||a.power-b.power||b.ranks.length-a.ranks.length);
  for(const p of patterns){if(!beats({...p,size:p.ranks.length},target))continue;const picked=fillPattern(hand,p,s.level);if(picked&&classifyPoker(picked,s.kind,s.level).some(c=>beats(c,target)))return picked.map(c=>c.id);}return[];
 }
 const ranks=[...new Set(hand.map(c=>c.rank))].sort((a,b)=>a-b),candidates:PokerCard[][]=[];
 for(const r of ranks){const group=hand.filter(c=>c.rank===r);for(let n=1;n<=group.length;n++)candidates.push(group.slice(0,n));
  if(group.length===4){const rest=hand.filter(c=>c.rank!==r).sort((a,b)=>a.rank-b.rank);if(rest.length>=2)candidates.push([...group,...rest.slice(0,2)]);const pairs=ranks.filter(v=>v!==r&&hand.filter(c=>c.rank===v).length>=2);if(pairs.length>=2)candidates.push([...group,...pairs.slice(0,2).flatMap(v=>hand.filter(c=>c.rank===v).slice(0,2))]);}
  if(group.length>=3)for(const other of ranks.filter(x=>x!==r)){const wing=hand.filter(c=>c.rank===other);candidates.push([...group.slice(0,3),wing[0]]);if(wing.length>=2)candidates.push([...group.slice(0,3),...wing.slice(0,2)]);}
 }
 for(let copies=1;copies<=3;copies++)for(let len=copies===1?5:copies===2?3:2;len<=12;len++)for(let start=3;start+len-1<=14;start++){
  const run=Array.from({length:len},(_,i)=>hand.filter(c=>c.rank===start+i).slice(0,copies));if(!run.every(g=>g.length===copies))continue;const core=run.flat();candidates.push(core);
  if(copies===3){const rest=hand.filter(c=>!core.some(x=>x.rank===c.rank)).sort((a,b)=>a.rank-b.rank);if(rest.length>=len)candidates.push([...core,...rest.slice(0,len)]);const pairs=ranks.filter(r=>rest.filter(c=>c.rank===r).length>=2).slice(0,len);if(pairs.length===len)candidates.push([...core,...pairs.flatMap(r=>rest.filter(c=>c.rank===r).slice(0,2))]);}
 }
 const jokers=hand.filter(c=>c.rank>=16);if(jokers.length===2)candidates.push(jokers);
 const legal=candidates.flatMap(cards=>ddz(cards).filter(c=>beats(c,target)).map(combo=>({cards,combo}))).sort((a,b)=>a.combo.bomb-b.combo.bomb||a.combo.power-b.combo.power||b.cards.length-a.cards.length);
 return legal[0]?.cards.map(c=>c.id)||[];
}
function deal(s:PokerState){const deck=shuffle(pokerDeck(s.kind==='guandan'?2:1),seeded(s.rng++));s.hands=s.players.map(()=>deck.splice(0,s.kind==='guandan'?27:17));s.bottom=deck;s.played=[];s.last=null;s.passed=[];s.order=[];s.plays=s.players.map(()=>0);s.bid=0;s.bidder=-1;s.bids=s.players.map(()=>null);s.multiplier=1;s.phase=s.kind==='guandan'?'play':'bid';s.landlord=-1;}
function next(s:PokerState,from:number){for(let step=1;step<=s.players.length;step++){const i=(from+step)%s.players.length;if(s.hands[i].length)return i;}return from;}
function endDdz(s:PokerState,me:number){const landlordWin=me===s.landlord;const spring=landlordWin?s.plays.every((n,i)=>i===s.landlord||n===0):s.plays[s.landlord]===1;if(spring){s.multiplier*=2;s.history.push('春天 ×2');}const base=s.bid*s.multiplier;s.scores=s.players.map((_,i)=>(i===s.landlord?2:-1)*base*(landlordWin?1:-1));s.winners=s.players.filter((_,i)=>landlordWin?i===s.landlord:i!==s.landlord).map(p=>p.id);s.finished=true;}
function endGd(s:PokerState){const team=s.order[0]%2,partner=(s.order[0]+2)%4,pos=s.order.indexOf(partner),advance=pos===1?3:pos===2?2:1;
 s.previousOrder=[...s.order];s.scores=s.players.map((_,i)=>i%2===team?advance:0);
 if(s.levels[team]===14&&pos!==3){s.finished=true;s.winners=s.players.filter((_,i)=>i%2===team).map(p=>p.id);}else{s.levels[team]=Math.min(14,s.levels[team]+advance);s.level=s.levels[team];s.phase='roundEnd';}
 s.history.push(`升级 +${advance}`);
}
function setupTribute(s:PokerState){const order=s.previousOrder,first=order[0],double=order[1]%2===first%2,losers=double?[order[2],order[3]]:[order[3]];s.lead=first;
 if(losers.flatMap(i=>s.hands[i]).filter(c=>c.rank===17).length===2){s.current=first;s.history.push('抗贡');return;}
 const gifts=losers.map(from=>({from,card:[...s.hands[from]].filter(c=>!wild(c,s.level)).sort((a,b)=>pokerPower(b.rank,s.kind,s.level)-pokerPower(a.rank,s.kind,s.level))[0]})).sort((a,b)=>pokerPower(b.card.rank,s.kind,s.level)-pokerPower(a.card.rank,s.kind,s.level)||((a.from-first+4)%4)-((b.from-first+4)%4));
 s.returns=[];gifts.forEach((gift,i)=>{const to=order[i];s.hands[gift.from]=s.hands[gift.from].filter(c=>c.id!==gift.card.id);s.hands[to].push(gift.card);s.returns.push({from:to,to:gift.from});s.history.push(`${s.players[gift.from].name} → ${s.players[to].name} · ${pokerTitle(gift.card)}`);});s.lead=gifts[0].from;s.current=s.returns[0].from;s.phase='tribute';
}
function actions(s:PokerState,id:string):Action[]{if(s.finished||id!==s.players[s.current].id)return[];
 if(s.phase==='bid')return[action('bid','叫分',[{id:'0',title:'不叫'},...[1,2,3].filter(n=>n>s.bid).map(n=>({id:String(n),title:String(n)}))],1,1)];
 if(s.phase==='roundEnd')return[action('nextRound','开始下一轮')];
 if(s.phase==='tribute'){const low=s.hands[s.current].filter(c=>c.rank<16&&c.rank!==levelRank(s.level)&&pokerPower(c.rank,s.kind,s.level)<=10),choices=low.length?low:s.hands[s.current];return[action('return','还贡',choices.map(c=>({id:c.id,title:pokerTitle(c)})),1,1)];}
 return[action('play','出牌',s.hands[s.current].map(c=>({id:c.id,title:pokerTitle(c)})),1,s.hands[s.current].length),...(s.last?[action('pass','不出')]:[])];
}
export function pokerModule(kind:PokerKind):GameModule<PokerState>{return{
 create(players,seed){assertPlayers(players,kind==='guandan'?4:3,kind==='guandan'?4:3);const s:PokerState={kind,players:structuredClone(players),hands:[],bottom:[],played:[],current:0,phase:'bid',rng:seed,round:1,bid:0,bidder:-1,bids:[],landlord:-1,multiplier:1,plays:[],last:null,passed:[],order:[],previousOrder:[],levels:[2,2],level:2,scores:players.map(()=>0),returns:[],lead:0,finished:false,winners:[],history:[]};deal(s);return s;},
 view(s,id,spectator=false){if(spectator)id='';const me=s.players.findIndex(p=>p.id===id);if(me<0&&!spectator)return{kind,phase:'',instruction:'仅本局玩家可查看',finished:s.finished,actions:[],sections:[],log:[],board:{}};return structuredClone({kind,phase:s.finished?'本局结束':({bid:'叫地主',play:'出牌阶段',roundEnd:'本轮结算',tribute:'进贡还贡'}[s.phase]),instruction:s.finished?(s.winners.length?`胜者：${s.players.filter(p=>s.winners.includes(p.id)).map(p=>p.name).join('、')}`:'本局和局'):me===s.current?'轮到你了':'等待其他玩家操作',finished:s.finished,actions:spectator?[]:actions(s,id),sections:[],log:s.history.slice(-40),board:{hand:[...(s.hands[me]||[])].sort((a,b)=>pokerPower(b.rank,kind,s.level)-pokerPower(a.rank,kind,s.level)||a.suit-b.suit),current:s.players[s.current].id,phase:s.phase,round:s.round,level:s.level,levels:s.levels,bid:s.bid,multiplier:s.multiplier,bids:s.bids,passed:s.passed,bottom:s.landlord<0?[]:s.bottom,last:s.last,order:s.order,winners:s.winners,hint:me===s.current&&s.phase==='play'&&!s.finished?pokerHint(s):[],players:s.players.map((p,i)=>({...p,count:s.hands[i].length,score:s.scores[i],team:kind==='guandan'?i%2:null,landlord:i===s.landlord,rank:s.order.indexOf(i)+1,...(s.finished||s.phase==='roundEnd'?{hand:s.hands[i]}:{})}))}});},
 apply(state,id,cmd){validateCommand(this.view(state,id),cmd);const s=structuredClone(state),me=s.current;
 if(cmd.action==='bid'){const bid=Number(cmd.values[0]);s.bids[me]=bid;if(bid>s.bid){s.bid=bid;s.bidder=me;}if(bid===3||s.bids.every(b=>b!==null)){if(s.bidder<0){s.current=(s.current+1)%3;deal(s);s.history.push('无人叫分，重新发牌');}else{s.landlord=s.bidder;s.current=s.bidder;s.hands[s.bidder].push(...s.bottom);s.phase='play';}}else s.current=(me+1)%3;return s;}
 if(cmd.action==='nextRound'){s.round++;deal(s);setupTribute(s);return s;}
 if(cmd.action==='return'){const pair=s.returns.shift()!,card=s.hands[me].find(c=>c.id===cmd.values[0])!;s.hands[me]=s.hands[me].filter(c=>c.id!==card.id);s.hands[pair.to].push(card);s.history.push(`${s.players[me].name} → ${s.players[pair.to].name} · ${pokerTitle(card)}`);if(s.returns.length)s.current=s.returns[0].from;else{s.current=s.lead;s.phase='play';}return s;}
 if(cmd.action==='pass'){s.passed.push(me);const waiting=s.hands.map((h,i)=>h.length&&i!==s.last!.player&&!s.passed.includes(i)).some(Boolean);if(!waiting){const leader=s.last!.player,partner=(leader+2)%4;s.current=s.hands[leader].length?leader:kind==='guandan'&&s.hands[partner].length?partner:next(s,leader);s.last=null;s.passed=[];}else s.current=next(s,me);return s;}
 const cards=cmd.values.map(cid=>s.hands[me].find(c=>c.id===cid)!),options=legalPokerCombinations(cards,kind,s.level,s.last?.combo),combo=cmd.text===undefined?options[0]:options.find(c=>combinationKey(c)===cmd.text);
 if(!combo)throw Error('牌型无效或无法压过上一手');s.hands[me]=s.hands[me].filter(c=>!cmd.values.includes(c.id));s.played.push(...cards);s.last={player:me,cards,combo};s.passed=[];s.plays[me]++;if(combo.bomb&&kind==='doudizhu')s.multiplier*=2;s.history.push(`${s.players[me].name} · ${combo.type}`);
 if(!s.hands[me].length){s.order.push(me);if(kind==='doudizhu'){endDdz(s,me);return s;}if(s.order.length===2&&s.order[0]%2===s.order[1]%2||s.order.length===3){s.order.push(...[0,1,2,3].filter(i=>!s.order.includes(i)));endGd(s);return s;}}
 s.current=next(s,me);s.history=s.history.slice(-60);return s;
 }};}
export const doudizhu=pokerModule('doudizhu');
export const guandan=pokerModule('guandan');
