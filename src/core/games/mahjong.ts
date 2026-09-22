import {scoreMahjongHand,type Fan} from './mahjongScoring';
import { action, assertPlayers, seeded, shuffle, validateCommand, type Action, type GameModule, type Player } from '../types';
import {MAHJONG_MODES,MAHJONG_RULES,type MahjongMode} from '../mahjongModes';
import {legacyMahjong,type MahjongState as LegacyState} from './mahjongLegacy';
export {MAHJONG_MODES,type MahjongMode} from '../mahjongModes';
export interface Tile {id:string;value:number}
export interface Meld {type:'pong'|'kong'|'concealed'|'chow';tiles:Tile[];from:number}
interface Response {action:'pass'|'hu'|'pong'|'kong'|'chow';start?:number}
interface Pending {tile:Tile;from:number;rob?:number;responses:Record<number,Response>}
export interface MahjongState {
 rulesVersion?:2;wildValue?:number;indicator?:Tile;exchangeDirection?:number;winningTiles?:Tile[];passedHu?:Record<number,number>;passedTiles?:Record<number,number[]>;liability?:Record<number,number>;lastKongFrom?:number;players:Player[];mode:MahjongMode;hands:Tile[][];wall:Tile[];melds:Meld[][];discards:Tile[][];current:number;
 phase:'exchange'|'que'|'discard'|'respond';exchange:Record<number,string[]>;missing:Record<number,number>;
 pending:Pending|null;won:number[];wins:{player:number;from:number;tile:Tile;points:number;selfDraw:boolean;patterns?:Fan[];gained?:number}[];
 scores:number[];kongPayments:{from:number;to:number;points:number;turn?:number}[];finished:boolean;winners:string[];history:string[];
 drawn:string|null;selfWon:boolean;afterKong:boolean;turn:number;
}
const rules=(s:MahjongState)=>MAHJONG_RULES[s.mode];
const isSichuan=(s:MahjongState)=>rules(s).missing;
const isFlow=(s:MahjongState)=>rules(s).family==='flow';
const isBattle=(s:MahjongState)=>rules(s).family==='battle';
const wild=(s:MahjongState)=>s.wildValue??(rules(s).ghost?33:-1);
export const tileSuit=(v:number)=>v<27?Math.floor(v/9):3;
export function tileTitle(tile:Tile|number){const v=typeof tile==='number'?tile:tile.value;return v<27?`${v%9+1}${['万','筒','条'][Math.floor(v/9)]}`:['东','南','西','北','白板','发财','红中'][v-27];}
export function mahjongTiles(mode:MahjongMode):Tile[]{const r=MAHJONG_RULES[mode],values=Array.from({length:r.missing?27:34},(_,i)=>i);return values.flatMap(value=>Array.from({length:value===33?r.redCount:4},(_,copy)=>({id:`m${value*4+copy}`,value}))).concat(r.missing?Array.from({length:r.redCount},(_,copy)=>({id:`red${copy}`,value:33})):[]);}
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
function exchangeInstruction(s:MahjongState){return rules(s).exchange==='any'?'选择任意张牌与牌墙交换，也可以不换':rules(s).exchange==='anyThree'?'选择任意三张牌，确认后一起换牌':'选择同一花色的三张牌，确认后一起换牌';}
function active(s:MahjongState,i:number){return !isBattle(s)||!s.won.includes(i);}
function next(s:MahjongState,from:number){for(let step=1;step<=4;step++){const i=(from+step)%4;if(active(s,i))return i;}return from;}
function clearQue(s:MahjongState,i:number,tiles=s.hands[i]){return !isSichuan(s)||!tiles.some(t=>tileSuit(t.value)===s.missing[i]);}
function canHu(s:MahjongState,i:number,tile?:Tile){const tiles=tile?[...s.hands[i],tile]:s.hands[i];return active(s,i)&&clearQue(s,i,tiles)&&(rules(s).family==='guangdong'?scored(s,i,tile).points>0:winningHand(tiles,s.melds[i].length,wild(s)));}
function scored(s:MahjongState,i:number,tile?:Tile){return scoreMahjongHand(s.mode,tile?[...s.hands[i],tile]:s.hands[i],s.melds[i],wild(s),tile?.value,i,(tile??s.hands[i].find(t=>t.id===s.drawn)??s.hands[i].at(-1))?.value);}
function valueOfWin(s:MahjongState,i:number,tile?:Tile){return scored(s,i,tile).points;}

export interface MahjongWait {value:number;unseen:number;discardMultiplier:number|null;selfDrawMultiplier:number}
export interface MahjongAssistance {
 waits:MahjongWait[];
 discards:{tile:Tile;waits:MahjongWait[]}[];
 currentWin:{multiplier:number;selfDraw:boolean}|null;
}
/** Only the viewer's hand and visible tiles contribute to counts. IDs deduplicate
 * a claimed discard, pending tile and repeated Blood Flow win records. */
function visibleCounts(s:MahjongState,i:number){
 const visible=new Map<string,Tile>();
 const add=(tiles:Tile[])=>tiles.forEach(tile=>visible.set(tile.id,tile));
 add(s.hands[i]);if(s.indicator)add([s.indicator]);s.discards.forEach(add);
 s.melds.forEach((melds,owner)=>melds.forEach(meld=>{if(owner===i||meld.type!=='concealed')add(meld.tiles);}));
 if(s.pending)add([s.pending.tile]);s.wins.forEach(w=>add([w.tile]));
 const counts=Array<number>(34).fill(0);visible.forEach(tile=>counts[tile.value]++);return counts;
}
function waitsFor(s:MahjongState,i:number,hand:Tile[],seen:number[]):MahjongWait[]{
 if(hand.length!==13-s.melds[i].length*3)return[];
 const probe={...s,hands:s.hands.map((tiles,owner)=>owner===i?hand:tiles)},owned=[...hand,...s.melds[i].flatMap(m=>m.tiles)],result:MahjongWait[]=[];
 for(let value=0;value<34;value++){
  if(isSichuan(s)&&value>=27&&value!==wild(s))continue;const copies=value===33?rules(s).redCount:4;
  if(owned.filter(tile=>tile.value===value).length>=copies)continue;
  const tile={id:'wait-probe',value};if(!canHu(probe,i,tile))continue;
  const base=valueOfWin(probe,i,tile),self=scoreMahjongHand(s.mode,[...hand,tile],s.melds[i],wild(s),undefined,i);
  result.push({value,unseen:Math.max(0,copies-seen[value]),discardMultiplier:value===wild(s)?null:base,selfDrawMultiplier:rules(s).family==='guangdong'?(self.patterns[0].multiplier<8?Math.min(8,self.points*2):self.points):self.points*2});
 }
 return result;
}
function assistance(s:MahjongState,i:number,legal:Action[]):MahjongAssistance|null{
 if(i<0||s.finished||!active(s,i)||s.phase==='exchange'||s.phase==='que')return null;
 const seen=visibleCounts(s,i),discard=legal.find(a=>a.id==='discard'),hu=legal.some(a=>a.id==='hu'),selfDraw=s.phase==='discard';
 // Identical tile values have identical wait lists, including the known discarded tile.
 const byValue=new Map<number,MahjongWait[]>();
 const discards=(discard?.choices??[]).map(choice=>{
  const tile=s.hands[i].find(tile=>tile.id===choice.id)!;
  if(!byValue.has(tile.value))byValue.set(tile.value,waitsFor(s,i,s.hands[i].filter(t=>t.id!==tile.id),seen));
  return{tile,waits:byValue.get(tile.value)!};
 });
 return{waits:waitsFor(s,i,s.hands[i],seen),discards,currentWin:hu?{multiplier:winBreakdown(s,i,selfDraw?undefined:s.pending!.tile,selfDraw).points,selfDraw}:null};
}
function pay(s:MahjongState,from:number,to:number,points:number,kong=false){s.scores[from]-=points;s.scores[to]+=points;if(kong)s.kongPayments.push({from,to,points,turn:s.turn+1});}
function readyValue(s:MahjongState,i:number){if(!clearQue(s,i))return 0;let max=0;for(let v=0;v<34;v++){if(isSichuan(s)&&v>=27&&v!==wild(s))continue;if(s.hands[i].filter(t=>t.value===v).length+s.melds[i].flatMap(m=>m.tiles).filter(t=>t.value===v).length>=(v===33?rules(s).redCount:4))continue;const tile={id:'probe',value:v};if(winningHand([...s.hands[i],tile],s.melds[i].length,wild(s)))max=Math.max(max,valueOfWin(s,i,tile));}return max;}
function finish(s:MahjongState,exhausted=false){
 if(exhausted&&isSichuan(s)){const remaining=[0,1,2,3].filter(i=>active(s,i)),ready=remaining.map(i=>({i,value:readyValue(s,i),flower:!clearQue(s,i)}));
  for(const p of ready){if(p.flower)for(const other of ready.filter(q=>!q.flower))pay(s,p.i,other.i,16);if(!p.value)for(const other of ready.filter(q=>q.value))pay(s,p.i,other.i,other.value);}
  for(const payment of s.kongPayments)if(ready.some(p=>p.i===payment.to&&!p.value))pay(s,payment.to,payment.from,payment.points);
  s.history.push('流局结算：查花猪、查大叫、未听退杠');
 }
 s.finished=true;s.pending=null;const high=Math.max(...s.scores);s.winners=high>0?s.players.filter((_,i)=>s.scores[i]===high).map(p=>p.id):[];s.history.push(exhausted?'牌墙已空，本局结束':'本局结束');
}
function draw(s:MahjongState,i:number,kong=false){if(!s.wall.length){finish(s,true);return;}s.current=i;s.phase='discard';s.pending=null;s.selfWon=false;s.afterKong=kong;const tile=s.wall.pop()!;s.hands[i].push(tile);if(s.passedHu)delete s.passedHu[i];if(s.passedTiles)delete s.passedTiles[i];s.drawn=tile.id;s.turn++;}
function winBreakdown(s:MahjongState,i:number,tile:Tile|undefined,selfDraw:boolean){
 const result=scored(s,i,tile),patterns=[...result.patterns];let value=result.points;
 const bonus=(name:string,multiplier:number)=>{value*=multiplier;patterns.push({name,multiplier});};
 if(rules(s).family==='guangdong'){
  const base=result.patterns[0]?.multiplier??1,rob=s.pending?.rob!==undefined,opening=s.melds.every(ms=>!ms.length);
  if(selfDraw&&base<8){value=Math.min(8,value*2);patterns.push({name:'自摸',multiplier:2});}
  if(selfDraw&&s.afterKong||rob||selfDraw&&!s.wall.length||Object.values(s.pending?.responses??{}).filter(r=>r.action==='hu').length===3){value=Math.max(8,value);patterns.push({name:rob?'抢杠胡':s.afterKong?'杠上花':!s.wall.length?'海底':'一炮三响',multiplier:1});}
  const heaven=selfDraw&&s.turn===1&&!s.discards.flat().length,earth=selfDraw&&i!==0&&s.turn===2&&s.discards.flat().length===1,human=!selfDraw&&s.turn===1&&s.discards.flat().length===1;
  if(opening&&(heaven||earth||human)){value=Math.max(64,value);patterns.push({name:heaven?'天胡':earth?'地胡':'人胡',multiplier:1});}

 }else{
  if(selfDraw)bonus('自摸',2);
  if(s.afterKong||s.pending?.rob!==undefined)bonus(s.pending?.rob!==undefined?'抢杠胡':selfDraw?'杠上花':'杠上炮',2);
  if(isSichuan(s)&&!s.wall.length)bonus('海底',2);
  if(isSichuan(s)&&s.turn===1&&s.melds.every(ms=>!ms.length)&&s.discards.flat().length===(selfDraw?0:1))bonus(selfDraw?'天胡':'地胡',32);
 }
 return{points:value,patterns};
}
function win(s:MahjongState,i:number,from:number,tile:Tile,selfDraw:boolean){
 const before=s.scores[i];const {points:value,patterns}=winBreakdown(s,i,selfDraw?undefined:tile,selfDraw);
 if(rules(s).family==='guangdong'){const liable=s.pending?.rob!==undefined?from:selfDraw?(s.liability?.[i]??(s.afterKong&&s.lastKongFrom!==i?s.lastKongFrom:undefined)):undefined;if(liable!==undefined)pay(s,liable,i,value*3);else if(selfDraw){for(let p=0;p<4;p++)if(p!==i)pay(s,p,i,value);}else pay(s,from,i,value);}
 else if(selfDraw){for(let p=0;p<4;p++)if(p!==i&&active(s,p))pay(s,p,i,value);}else pay(s,from,i,value);
 s.wins.push({player:i,from,tile,points:value,selfDraw,patterns,gained:s.scores[i]-before});if(!s.won.includes(i))s.won.push(i);s.history.push(`${s.players[i].name} · ${selfDraw?'自摸':'胡牌'} · +${s.scores[i]-before}`);
}

function recordLiability(s:MahjongState,i:number,from:number){
 if(rules(s).family!=='guangdong'||s.liability?.[i]!==undefined)return;
 const open=s.melds[i].filter(m=>m.type!=='concealed'),triplets=open.filter(m=>m.type!=='chow').map(m=>m.tiles[0].value);
 const special=[31,32,33].every(v=>triplets.includes(v))||[27,28,29,30].every(v=>triplets.includes(v));
 if(special||open.length===4&&!Object.values(s.liability??{}).includes(from))(s.liability??={})[i]=from;
}
function kongScore(s:MahjongState,i:number,from:number,concealed:boolean){if(rules(s).family==='guangdong')return;if(from!==i)pay(s,from,i,2,true);else for(let p=0;p<4;p++)if(p!==i&&active(s,p))pay(s,p,i,concealed?2:1,true);}
function resolve(s:MahjongState){const pending=s.pending!,others=[0,1,2,3].filter(i=>i!==pending.from&&active(s,i));
 // Skip only forced passes, using the same authoritative choices exposed to players.
 // Also completes older saved response windows after their next valid response.
 for(const i of others)if(!pending.responses[i]){const legal=actions(s,s.players[i].id);if(legal.length===1&&legal[0].id==='pass')pending.responses[i]={action:'pass'};}
 if(others.some(i=>!pending.responses[i]))return;
 const winners=others.filter(i=>pending.responses[i].action==='hu');
 if(winners.length){for(const i of winners)win(s,i,pending.from,pending.tile,false);if(s.afterKong&&isSichuan(s)&&pending.rob===undefined){const payments=s.kongPayments.filter(p=>p.to===pending.from&&p.turn===s.turn),income=payments.reduce((n,p)=>n+p.points,0);if(income)for(const i of winners)pay(s,pending.from,i,income);s.kongPayments=s.kongPayments.filter(p=>!payments.includes(p));}
  if(pending.rob!==undefined){s.hands[pending.from]=s.hands[pending.from].filter(t=>t.id!==pending.tile.id);s.discards[pending.from].push(pending.tile);}
  if(!isSichuan(s)||isBattle(s)&&s.won.length>=3){finish(s);return;}s.afterKong=false;draw(s,next(s,pending.from));return;
 }
 if(pending.rob!==undefined){const tile=pending.tile,meld=s.melds[pending.from][pending.rob];s.hands[pending.from]=s.hands[pending.from].filter(t=>t.id!==tile.id);meld.tiles.push(tile);meld.type='kong';kongScore(s,pending.from,pending.from,false);s.lastKongFrom=pending.from;draw(s,pending.from,true);return;}
 const claimant=others.filter(i=>['pong','kong'].includes(pending.responses[i].action)).sort((a,b)=>(a-pending.from+4)%4-(b-pending.from+4)%4)[0]??others.find(i=>pending.responses[i].action==='chow');
 if(claimant!==undefined){const kong=pending.responses[claimant].action==='kong',chow=pending.responses[claimant].action==='chow',start=pending.responses[claimant].start??0,tiles=chow?[start,start+1,start+2].filter(v=>v!==pending.tile.value).map(v=>s.hands[claimant].find(t=>t.value===v)!):s.hands[claimant].filter(t=>t.value===pending.tile.value).slice(0,kong?3:2);s.hands[claimant]=s.hands[claimant].filter(t=>!tiles.some(x=>x.id===t.id));s.discards[pending.from]=s.discards[pending.from].filter(t=>t.id!==pending.tile.id);s.melds[claimant].push({type:kong?'kong':chow?'chow':'pong',tiles:[...tiles,pending.tile].sort((a,b)=>a.value-b.value),from:pending.from});if(s.passedTiles)delete s.passedTiles[claimant];recordLiability(s,claimant,pending.from);s.lastKongFrom=kong?pending.from:undefined;s.pending=null;s.current=claimant;s.drawn=null;s.selfWon=false;s.afterKong=false;s.phase='discard';if(kong){kongScore(s,claimant,pending.from,false);draw(s,claimant,true);}return;}
 draw(s,next(s,pending.from));
}
function actions(s:MahjongState,id:string):Action[]{const i=s.players.findIndex(p=>p.id===id);if(i<0||s.finished||!active(s,i))return[];
 if(s.phase==='exchange')return s.exchange[i]?[]:[action('exchange',rules(s).exchange==='any'?'任意换牌':'换三张',s.hands[i].filter(t=>t.value!==wild(s)).map(t=>({id:t.id,title:tileTitle(t)})),rules(s).exchange==='any'?0:3,rules(s).exchange==='any'?s.hands[i].filter(t=>t.value!==wild(s)).length:3,exchangeInstruction(s))];
 if(s.phase==='que')return s.missing[i]!==undefined?[]:[action('que','选择定缺',['万','筒','条'].map((title,v)=>({id:String(v),title})),1,1)];
 if(s.phase==='respond'){const pending=s.pending!;if(i===pending.from||pending.responses[i])return[];const result=[action('pass','过')],count=s.hands[i].filter(t=>t.value===pending.tile.value).length,allowed=!(pending.tile.value===wild(s))&&(!isSichuan(s)||tileSuit(pending.tile.value)!==s.missing[i]);
  if(allowed&&canHu(s,i,pending.tile)&&(rules(s).family==='guangdong'?!s.passedTiles?.[i]?.includes(pending.tile.value):valueOfWin(s,i,pending.tile)>(s.passedHu?.[i]??0)))result.unshift(action('hu','胡牌'));if(pending.rob===undefined&&allowed&&clearQue(s,i)&&!(isFlow(s)&&s.won.includes(i))){if(count>=2)result.push(action('pong','碰'));if(count===3&&s.wall.length)result.push(action('kong','杠'));}
  if(rules(s).family==='guangdong'&&pending.rob===undefined&&i===(pending.from+1)%4&&pending.tile.value<27&&pending.tile.value!==wild(s)){
   const choices=Array.from({length:3},(_,offset)=>pending.tile.value-offset).filter(start=>start>=0&&Math.floor(start/9)===Math.floor(pending.tile.value/9)&&start%9<=6&&[start,start+1,start+2].filter(v=>v!==pending.tile.value).every(v=>v!==wild(s)&&s.hands[i].some(t=>t.value===v))).map(start=>({id:String(start),title:[start,start+1,start+2].map(v=>tileTitle(v)).join(' · ')}));
   if(choices.length)result.push(action('chow','吃',choices,1,1));
  }return result;
 }
 if(i!==s.current)return[];const missing=s.hands[i].filter(t=>tileSuit(t.value)===s.missing[i]),discards=isFlow(s)&&s.won.includes(i)?s.hands[i].filter(t=>t.id===s.drawn):missing.length?missing:s.hands[i],result=[action('discard','打出',discards.filter(t=>s.mode==='laizi'||t.value!==wild(s)).map(t=>({id:t.id,title:tileTitle(t)})),1,1)];
 if(!s.selfWon&&s.drawn&&canHu(s,i))result.unshift(action('hu','自摸'));
 if(s.wall.length&&clearQue(s,i)&&!s.selfWon&&s.drawn&&!(isFlow(s)&&s.won.includes(i))){for(const v of new Set(s.hands[i].map(t=>t.value))){if(v===wild(s))continue;const count=s.hands[i].filter(t=>t.value===v).length;if(count===4)result.push(action(`concealed:${v}`,'暗杠',[{id:String(v),title:tileTitle(v)}],1,1));if(s.melds[i].some(m=>m.type==='pong'&&m.tiles[0].value===v))result.push(action(`added:${v}`,'补杠',[{id:String(v),title:tileTitle(v)}],1,1));}}
 return result;
}
export const mahjong:GameModule<MahjongState>={
 create(players,seed,options){
  assertPlayers(players,4,4);const mode=options?.mahjongMode||'guangdong';if(!Object.hasOwn(MAHJONG_MODES,mode))throw Error('Mahjong mode is invalid');
  const r=MAHJONG_RULES[mode],random=seeded(seed),wall=shuffle(mahjongTiles(mode),random),indicator=mode==='guangdongGhost'?wall.pop():undefined;
  const wildValue=indicator?(indicator.value<27?Math.floor(indicator.value/9)*9+(indicator.value+1)%9:[27,28,29,30,33,32,31][([27,28,29,30,33,32,31].indexOf(indicator.value)+1)%7]):r.ghost?33:-1;
  const hands=players.map(()=>wall.splice(0,13)),first=wall.pop()!;hands[0].push(first);
  return{rulesVersion:2,wildValue,indicator,exchangeDirection:1+Math.floor(random()*3),winningTiles:[],passedHu:{},passedTiles:{},liability:{},players:structuredClone(players),mode,hands,wall,melds:players.map(()=>[]),discards:players.map(()=>[]),current:0,phase:r.exchange==='none'?'discard':'exchange',exchange:{},missing:{},pending:null,won:[],wins:[],scores:[0,0,0,0],kongPayments:[],finished:false,winners:[],history:[],drawn:first.id,selfWon:false,afterKong:false,turn:1};
 },
 view(s,id,spectator=false){if(!s.rulesVersion&&['guangdong','sichuan','bloodflow','laizi'].includes(s.mode))return legacyMahjong.view(s as LegacyState,id,spectator);if(spectator)id='';const me=s.players.findIndex(p=>p.id===id);if(me<0&&!spectator)return{kind:'mahjong',phase:'',instruction:'仅本局玩家可查看',finished:s.finished,actions:[],sections:[],log:[],board:{}};const legal=spectator?[]:actions(s,id);return structuredClone({kind:'mahjong',phase:s.finished?'本局结束':MAHJONG_MODES[s.mode],instruction:s.finished?(s.winners.length?`胜者：${s.players.filter(p=>s.winners.includes(p.id)).map(p=>p.name).join('、')}`:'本局和局'):s.phase==='exchange'?exchangeInstruction(s):s.phase==='que'?'选择一门花色，本局优先打完':s.phase==='respond'?'等待响应':legal.length?'轮到你了':'等待其他玩家操作',finished:s.finished,actions:legal,sections:[],log:s.history.slice(-40),board:{assistance:spectator?null:assistance(s,me,legal),hand:[...(s.hands[me]||[])].sort((a,b)=>a.value-b.value),current:s.players[s.current].id,phase:s.phase,mode:s.mode,wallCount:s.wall.length,rulesVersion:s.rulesVersion,exchangeRule:rules(s).exchange,exchangeDirection:s.exchangeDirection,locked:isFlow(s)&&s.won.includes(me),indicator:s.indicator,drawn:me===s.current?s.drawn:null,wildValue:wild(s),turn:s.turn,pending:s.pending?{tile:s.pending.tile,from:s.pending.from,rob:s.pending.rob!==undefined}:null,wins:s.wins,winners:s.winners,players:s.players.map((p,i)=>({...p,count:s.hands[i].length,score:s.scores[i],won:s.won.includes(i),missing:s.phase==='que'&&i!==me?undefined:s.missing[i],discards:s.discards[i],melds:s.melds[i].map(m=>m.type==='concealed'&&i!==me&&!s.finished?{type:m.type,count:4,tiles:[],from:m.from}:m),...(s.finished?{hand:s.hands[i]}:{})}))}});},
 apply(state,id,cmd){if(!state.rulesVersion&&['guangdong','sichuan','bloodflow','laizi'].includes(state.mode))return legacyMahjong.apply(state as LegacyState,id,cmd);validateCommand(this.view(state,id),cmd);const s=structuredClone(state),me=s.players.findIndex(p=>p.id===id);
 if(cmd.action==='exchange'){
  const tiles=cmd.values.map(cid=>s.hands[me].find(t=>t.id===cid)!);
  if(rules(s).exchange==='sameThree'&&new Set(tiles.map(t=>tileSuit(t.value))).size!==1)throw Error('换三张需要相同花色');
  s.exchange[me]=cmd.values;
  if(Object.keys(s.exchange).length===4){
   const exchanged=[0,1,2,3].map(i=>s.hands[i].filter(t=>s.exchange[i].includes(t.id)));
   if(rules(s).exchange==='any'){
    // Deal replacements before returning any selected tiles to the wall: no player can redraw a selected tile.
    const replacements=exchanged.map(tiles=>s.wall.splice(0,tiles.length));
    s.hands=s.hands.map((hand,i)=>[...hand.filter(t=>!s.exchange[i].includes(t.id)),...replacements[i]]);
    s.wall=shuffle([...s.wall,...exchanged.flat()],seeded(s.turn*7919+s.wall.reduce((n,t)=>n+t.value*17,0)));
   }else s.hands=s.hands.map((hand,i)=>[...hand.filter(t=>!s.exchange[i].includes(t.id)),...exchanged[(i+4-(s.exchangeDirection??1))%4]]);
   s.exchange={};s.drawn=s.hands[0].at(-1)!.id;s.phase=rules(s).missing?'que':'discard';
  }
  return s;
 }
 if(cmd.action==='que'){s.missing[me]=Number(cmd.values[0]);if(Object.keys(s.missing).length===4)s.phase='discard';return s;}
 if(s.phase==='respond'){if(cmd.action!=='hu'&&actions(s,id).some(a=>a.id==='hu')){(s.passedHu??={})[me]=Math.max(s.passedHu?.[me]??0,valueOfWin(s,me,s.pending!.tile));(s.passedTiles??={})[me]=[...(s.passedTiles?.[me]??[]),s.pending!.tile.value];}s.pending!.responses[me]={action:cmd.action as Response['action'],...(cmd.action==='chow'?{start:Number(cmd.values[0])}:{})};resolve(s);return s;}
 if(cmd.action==='hu'){const tile=s.hands[me].find(t=>t.id===s.drawn)||s.hands[me].at(-1)!;win(s,me,me,tile,true);s.selfWon=true;if(!isSichuan(s)||isBattle(s)&&s.won.length>=3)finish(s);else if(isBattle(s))draw(s,next(s,me));else if(isFlow(s)){s.hands[me]=s.hands[me].filter(t=>t.id!==tile.id);(s.winningTiles??=[]).push(tile);draw(s,next(s,me));}return s;}
 if(cmd.action.startsWith('concealed:')){const v=Number(cmd.values[0]),tiles=s.hands[me].filter(t=>t.value===v);s.hands[me]=s.hands[me].filter(t=>t.value!==v);s.melds[me].push({type:'concealed',tiles,from:me});kongScore(s,me,me,true);s.lastKongFrom=me;draw(s,me,true);return s;}
 if(cmd.action.startsWith('added:')){const v=Number(cmd.values[0]),tile=s.hands[me].find(t=>t.value===v)!,rob=s.melds[me].findIndex(m=>m.type==='pong'&&m.tiles[0].value===v);s.pending={tile,from:me,rob,responses:{}};s.phase='respond';resolve(s);return s;}
 const tile=s.hands[me].find(t=>t.id===cmd.values[0])!;s.hands[me]=s.hands[me].filter(t=>t.id!==tile.id);s.discards[me].push(tile);s.pending={tile,from:me,responses:{}};s.phase='respond';s.drawn=null;s.selfWon=false;s.history.push(`${s.players[me].name} · ${tileTitle(tile)}`);s.history=s.history.slice(-60);resolve(s);return s;
 }
};
