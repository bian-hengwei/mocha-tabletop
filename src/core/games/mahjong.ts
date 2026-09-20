import { action, assertPlayers, seeded, shuffle, validateCommand, type Action, type GameModule, type Player } from '../types';
export type MahjongMode='guangdong'|'sichuan'|'bloodflow'|'laizi';
export const MAHJONG_MODES:Record<MahjongMode,string>={guangdong:'广东推倒胡',sichuan:'四川血战',bloodflow:'血流成河',laizi:'红中赖子'};
export interface Tile {id:string;value:number}
export interface Meld {type:'pong'|'kong'|'concealed';tiles:Tile[];from:number}
interface Response {action:'pass'|'hu'|'pong'|'kong'}
interface Pending {tile:Tile;from:number;rob?:number;responses:Record<number,Response>}
export interface MahjongState {
 players:Player[];mode:MahjongMode;hands:Tile[][];wall:Tile[];melds:Meld[][];discards:Tile[][];current:number;
 phase:'exchange'|'que'|'discard'|'respond';exchange:Record<number,string[]>;missing:Record<number,number>;
 pending:Pending|null;won:number[];wins:{player:number;from:number;tile:Tile;points:number;selfDraw:boolean}[];
 scores:number[];kongPayments:{from:number;to:number;points:number}[];finished:boolean;winners:string[];history:string[];
 drawn:string|null;selfWon:boolean;afterKong:boolean;turn:number;
}
const isSichuan=(s:MahjongState)=>s.mode==='sichuan'||s.mode==='bloodflow';
export const tileSuit=(v:number)=>v<27?Math.floor(v/9):3;
export function tileTitle(tile:Tile|number){const v=typeof tile==='number'?tile:tile.value;return v<27?`${v%9+1}${['万','筒','条'][Math.floor(v/9)]}`:['东','南','西','北','白板','发财','红中'][v-27];}
export function mahjongTiles(mode:MahjongMode):Tile[]{return Array.from({length:(mode==='sichuan'||mode==='bloodflow'?27:34)*4},(_,i)=>({id:`m${i}`,value:Math.floor(i/4)}));}
/** Backtracking uses the lowest natural tile and tries every run containing it, including wildcards before it. */
function sets(counts:number[],wilds:number,memo:Map<string,boolean>):boolean {
 const key=counts.join(',')+':'+wilds;if(memo.has(key))return memo.get(key)!;
 const first=counts.findIndex(n=>n>0);if(first<0)return wilds%3===0;
 const used=Math.min(3,counts[first]);if(3-used<=wilds){counts[first]-=used;const ok=sets(counts,wilds-(3-used),memo);counts[first]+=used;if(ok){memo.set(key,true);return true;}}
 if(first<27)for(let start=Math.max(Math.floor(first/9)*9,first-2);start<=first&&start%9<=6;start++){
  const taken=[start,start+1,start+2].filter(v=>counts[v]>0),needed=3-taken.length;if(needed>wilds)continue;taken.forEach(v=>counts[v]--);const ok=sets(counts,wilds-needed,memo);taken.forEach(v=>counts[v]++);if(ok){memo.set(key,true);return true;}
 }
 memo.set(key,false);return false;
}
export function winningHand(tiles:Tile[],meldCount=0,wildValue=-1):boolean {
 if(tiles.length!==14-meldCount*3)return false;const counts=Array(34).fill(0);let wilds=0;tiles.forEach(t=>t.value===wildValue?wilds++:counts[t.value]++);if(counts.some(n=>n>4))return false;
 if(!meldCount&&counts.reduce((n,c)=>n+c%2,0)<=wilds)return true;
 if(!meldCount&&wildValue<0){const orphans=[0,8,9,17,18,26,27,28,29,30,31,32,33];if(orphans.every(v=>counts[v]>=1)&&orphans.reduce((n,v)=>n+counts[v],0)===14)return true;}
 for(let pair=0;pair<34;pair++){const used=Math.min(2,counts[pair]);if(2-used>wilds)continue;counts[pair]-=used;const ok=sets(counts,wilds-(2-used),new Map());counts[pair]+=used;if(ok)return true;}return false;
}
function active(s:MahjongState,i:number){return s.mode!=='sichuan'||!s.won.includes(i);}
function next(s:MahjongState,from:number){for(let step=1;step<=4;step++){const i=(from+step)%4;if(active(s,i))return i;}return from;}
function clearQue(s:MahjongState,i:number,tiles=s.hands[i]){return !isSichuan(s)||!tiles.some(t=>tileSuit(t.value)===s.missing[i]);}
function canHu(s:MahjongState,i:number,tile?:Tile){const tiles=tile?[...s.hands[i],tile]:s.hands[i];return active(s,i)&&clearQue(s,i,tiles)&&winningHand(tiles,s.melds[i].length,s.mode==='laizi'?33:-1);}
function valueOfWin(s:MahjongState,i:number,tile?:Tile){const hand=tile?[...s.hands[i],tile]:s.hands[i],all=[...hand,...s.melds[i].flatMap(m=>m.tiles)].filter(t=>!(s.mode==='laizi'&&t.value===33)),counts=Array(34).fill(0);hand.forEach(t=>counts[t.value]++);let value=1;
 if(!s.melds[i].length&&counts.every(n=>n%2===0))value*=2;
 if(new Set(all.map(t=>tileSuit(t.value))).size===1&&all.every(t=>t.value<27))value*=4;
 if(counts.filter(n=>n%3===2).length===1&&counts.every(n=>n%3===0||n%3===2))value*=2;
 return Math.min(16,value);
}
function pay(s:MahjongState,from:number,to:number,points:number,kong=false){s.scores[from]-=points;s.scores[to]+=points;if(kong)s.kongPayments.push({from,to,points});}
function readyValue(s:MahjongState,i:number){if(!clearQue(s,i))return 0;let max=0;for(let v=0;v<(isSichuan(s)?27:34);v++){if(s.hands[i].filter(t=>t.value===v).length+s.melds[i].flatMap(m=>m.tiles).filter(t=>t.value===v).length>=4)continue;const tile={id:'probe',value:v};if(canHu(s,i,tile))max=Math.max(max,valueOfWin(s,i,tile));}return max;}
function finish(s:MahjongState,exhausted=false){
 if(exhausted&&isSichuan(s)){const remaining=[0,1,2,3].filter(i=>active(s,i)),ready=remaining.map(i=>({i,value:readyValue(s,i),flower:!clearQue(s,i)}));
  for(const p of ready){if(p.flower)for(const other of ready.filter(q=>!q.flower))pay(s,p.i,other.i,16);else if(!p.value)for(const other of ready.filter(q=>q.value))pay(s,p.i,other.i,other.value);}
  for(const payment of s.kongPayments)if(ready.some(p=>p.i===payment.to&&!p.value))pay(s,payment.to,payment.from,payment.points);
  s.history.push('流局结算：查花猪、查大叫、未听退杠');
 }
 s.finished=true;s.pending=null;const high=Math.max(...s.scores);s.winners=high>0?s.players.filter((_,i)=>s.scores[i]===high).map(p=>p.id):[];s.history.push(exhausted?'牌墙已空，本局结束':'本局结束');
}
function draw(s:MahjongState,i:number,kong=false){if(!s.wall.length){finish(s,true);return;}s.current=i;s.phase='discard';s.pending=null;s.selfWon=false;s.afterKong=kong;const tile=s.wall.pop()!;s.hands[i].push(tile);s.drawn=tile.id;s.turn++;}
function win(s:MahjongState,i:number,from:number,tile:Tile,selfDraw:boolean){let value=valueOfWin(s,i,selfDraw?undefined:tile);if(selfDraw)value*=2;if(s.afterKong||s.pending?.rob!==undefined)value*=2;value=Math.min(32,value);
 if(selfDraw){for(let p=0;p<4;p++)if(p!==i&&active(s,p))pay(s,p,i,value);}else pay(s,from,i,value);
 s.wins.push({player:i,from,tile,points:value,selfDraw});if(!s.won.includes(i))s.won.push(i);s.history.push(`${s.players[i].name} · ${selfDraw?'自摸':'胡牌'} · +${value}`);
}
function kongScore(s:MahjongState,i:number,from:number,concealed:boolean){if(from!==i)pay(s,from,i,2,true);else for(let p=0;p<4;p++)if(p!==i&&active(s,p))pay(s,p,i,concealed?2:1,true);}
function resolve(s:MahjongState){const pending=s.pending!,others=[0,1,2,3].filter(i=>i!==pending.from&&active(s,i));if(others.some(i=>!pending.responses[i]))return;
 const winners=others.filter(i=>pending.responses[i].action==='hu');
 if(winners.length){for(const i of winners)win(s,i,pending.from,pending.tile,false);
  if(pending.rob!==undefined){s.hands[pending.from]=s.hands[pending.from].filter(t=>t.id!==pending.tile.id);s.discards[pending.from].push(pending.tile);}
  if(!isSichuan(s)||s.mode==='sichuan'&&s.won.length>=3){finish(s);return;}s.afterKong=false;draw(s,next(s,pending.from));return;
 }
 if(pending.rob!==undefined){const tile=pending.tile,meld=s.melds[pending.from][pending.rob];s.hands[pending.from]=s.hands[pending.from].filter(t=>t.id!==tile.id);meld.tiles.push(tile);meld.type='kong';kongScore(s,pending.from,pending.from,false);draw(s,pending.from,true);return;}
 const claimant=others.filter(i=>['pong','kong'].includes(pending.responses[i].action)).sort((a,b)=>(a-pending.from+4)%4-(b-pending.from+4)%4)[0];
 if(claimant!==undefined){const kong=pending.responses[claimant].action==='kong',tiles=s.hands[claimant].filter(t=>t.value===pending.tile.value).slice(0,kong?3:2);s.hands[claimant]=s.hands[claimant].filter(t=>!tiles.some(x=>x.id===t.id));s.discards[pending.from]=s.discards[pending.from].filter(t=>t.id!==pending.tile.id);s.melds[claimant].push({type:kong?'kong':'pong',tiles:[...tiles,pending.tile],from:pending.from});s.pending=null;s.current=claimant;s.drawn=null;s.selfWon=false;s.afterKong=false;s.phase='discard';if(kong){kongScore(s,claimant,pending.from,false);draw(s,claimant,true);}return;}
 draw(s,next(s,pending.from));
}
function actions(s:MahjongState,id:string):Action[]{const i=s.players.findIndex(p=>p.id===id);if(i<0||s.finished||!active(s,i))return[];
 if(s.phase==='exchange')return s.exchange[i]?[]:[action('exchange','换三张',s.hands[i].map(t=>({id:t.id,title:tileTitle(t)})),3,3,'选择同一花色的三张牌，交给下家')];
 if(s.phase==='que')return s.missing[i]!==undefined?[]:[action('que','选择定缺',['万','筒','条'].map((title,v)=>({id:String(v),title})),1,1)];
 if(s.phase==='respond'){const pending=s.pending!;if(i===pending.from||pending.responses[i])return[];const result=[action('pass','过')],count=s.hands[i].filter(t=>t.value===pending.tile.value).length,allowed=!(s.mode==='laizi'&&pending.tile.value===33)&&(!isSichuan(s)||tileSuit(pending.tile.value)!==s.missing[i]);
  if(allowed&&canHu(s,i,pending.tile))result.unshift(action('hu','胡牌'));if(pending.rob===undefined&&allowed&&clearQue(s,i)&&!(s.mode==='bloodflow'&&s.won.includes(i))){if(count>=2)result.push(action('pong','碰'));if(count===3&&s.wall.length)result.push(action('kong','杠'));}return result;
 }
 if(i!==s.current)return[];const missing=s.hands[i].filter(t=>tileSuit(t.value)===s.missing[i]),discards=s.mode==='bloodflow'&&s.won.includes(i)?s.hands[i].filter(t=>t.id===s.drawn):missing.length?missing:s.hands[i],result=[action('discard','打出',discards.map(t=>({id:t.id,title:tileTitle(t)})),1,1)];
 if(!s.selfWon&&s.drawn&&canHu(s,i))result.unshift(action('hu','自摸'));
 if(s.wall.length&&clearQue(s,i)&&!s.selfWon&&s.drawn&&!(s.mode==='bloodflow'&&s.won.includes(i))){for(const v of new Set(s.hands[i].map(t=>t.value))){if(s.mode==='laizi'&&v===33)continue;const count=s.hands[i].filter(t=>t.value===v).length;if(count===4)result.push(action(`concealed:${v}`,'暗杠',[{id:String(v),title:tileTitle(v)}],1,1));if(s.melds[i].some(m=>m.type==='pong'&&m.tiles[0].value===v))result.push(action(`added:${v}`,'补杠',[{id:String(v),title:tileTitle(v)}],1,1));}}
 return result;
}
export const mahjong:GameModule<MahjongState>={
 create(players,seed,options){assertPlayers(players,4,4);const mode=options?.mahjongMode||'guangdong';if(!Object.hasOwn(MAHJONG_MODES,mode))throw Error('Mahjong mode is invalid');const wall=shuffle(mahjongTiles(mode),seeded(seed)),hands=players.map(()=>wall.splice(0,13));const first=wall.pop()!;hands[0].push(first);return{players:structuredClone(players),mode,hands,wall,melds:players.map(()=>[]),discards:players.map(()=>[]),current:0,phase:mode==='sichuan'||mode==='bloodflow'?'exchange':'discard',exchange:{},missing:{},pending:null,won:[],wins:[],scores:[0,0,0,0],kongPayments:[],finished:false,winners:[],history:[],drawn:first.id,selfWon:false,afterKong:false,turn:1};},
 view(s,id){const me=s.players.findIndex(p=>p.id===id);if(me<0)return{kind:'mahjong',phase:'',instruction:'仅本局玩家可查看',finished:s.finished,actions:[],sections:[],log:[],board:{}};const legal=actions(s,id);return structuredClone({kind:'mahjong',phase:s.finished?'本局结束':MAHJONG_MODES[s.mode],instruction:s.finished?(s.winners.length?`胜者：${s.players.filter(p=>s.winners.includes(p.id)).map(p=>p.name).join('、')}`:'本局和局'):s.phase==='exchange'?'选择同一花色的三张牌，交给下家':s.phase==='que'?'选择一门花色，本局优先打完':s.phase==='respond'?'等待碰杠胡响应':legal.length?'轮到你了':'等待其他玩家操作',finished:s.finished,actions:legal,sections:[],log:s.history.slice(-40),board:{hand:[...s.hands[me]].sort((a,b)=>a.value-b.value),current:s.players[s.current].id,phase:s.phase,mode:s.mode,wallCount:s.wall.length,drawn:me===s.current?s.drawn:null,wildValue:s.mode==='laizi'?33:-1,turn:s.turn,pending:s.pending?{tile:s.pending.tile,from:s.pending.from,rob:s.pending.rob!==undefined}:null,wins:s.wins,winners:s.winners,players:s.players.map((p,i)=>({...p,count:s.hands[i].length,score:s.scores[i],won:s.won.includes(i),missing:s.phase==='que'&&i!==me?undefined:s.missing[i],discards:s.discards[i],melds:s.melds[i].map(m=>m.type==='concealed'&&i!==me&&!s.finished?{type:m.type,count:4,tiles:[],from:m.from}:m),...(s.finished?{hand:s.hands[i]}:{})}))}});},
 apply(state,id,cmd){validateCommand(this.view(state,id),cmd);const s=structuredClone(state),me=s.players.findIndex(p=>p.id===id);
 if(cmd.action==='exchange'){const tiles=cmd.values.map(cid=>s.hands[me].find(t=>t.id===cid)!);if(new Set(tiles.map(t=>tileSuit(t.value))).size!==1)throw Error('换三张需要相同花色');s.exchange[me]=cmd.values;if(Object.keys(s.exchange).length===4){const exchanged=[0,1,2,3].map(i=>s.hands[i].filter(t=>s.exchange[i].includes(t.id)));s.hands=s.hands.map((hand,i)=>[...hand.filter(t=>!s.exchange[i].includes(t.id)),...exchanged[(i+3)%4]]);s.exchange={};s.drawn=s.hands[0].at(-1)!.id;s.phase='que';}return s;}
 if(cmd.action==='que'){s.missing[me]=Number(cmd.values[0]);if(Object.keys(s.missing).length===4)s.phase='discard';return s;}
 if(s.phase==='respond'){s.pending!.responses[me]={action:cmd.action as Response['action']};resolve(s);return s;}
 if(cmd.action==='hu'){const tile=s.hands[me].find(t=>t.id===s.drawn)||s.hands[me].at(-1)!;win(s,me,me,tile,true);s.selfWon=true;if(!isSichuan(s)||s.mode==='sichuan'&&s.won.length>=3)finish(s);else if(s.mode==='sichuan')draw(s,next(s,me));return s;}
 if(cmd.action.startsWith('concealed:')){const v=Number(cmd.values[0]),tiles=s.hands[me].filter(t=>t.value===v);s.hands[me]=s.hands[me].filter(t=>t.value!==v);s.melds[me].push({type:'concealed',tiles,from:me});kongScore(s,me,me,true);draw(s,me,true);return s;}
 if(cmd.action.startsWith('added:')){const v=Number(cmd.values[0]),tile=s.hands[me].find(t=>t.value===v)!,rob=s.melds[me].findIndex(m=>m.type==='pong'&&m.tiles[0].value===v);s.pending={tile,from:me,rob,responses:{}};s.phase='respond';return s;}
 const tile=s.hands[me].find(t=>t.id===cmd.values[0])!;s.hands[me]=s.hands[me].filter(t=>t.id!==tile.id);s.discards[me].push(tile);s.pending={tile,from:me,responses:{}};s.phase='respond';s.drawn=null;s.selfWon=false;s.history.push(`${s.players[me].name} · ${tileTitle(tile)}`);s.history=s.history.slice(-60);return s;
 }
};
