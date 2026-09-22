import type {Tile,Meld} from './mahjong';
import type {MahjongMode} from '../mahjongModes';
import {MAHJONG_RULES} from '../mahjongModes';
export interface Fan {name:string;multiplier:number}
export interface HandScore {points:number;patterns:Fan[]}
interface SetShape {value:number;run:boolean;concealed:boolean;size:number}
interface Shape {pair:number;sets:SetShape[];seven?:boolean;orphans?:boolean}
const countsOf=(tiles:Tile[])=>{const c=Array<number>(34).fill(0);for(const t of tiles)c[t.value]++;return c;};
const terminal=(v:number)=>v>=27||v%9===0||v%9===8;
function* groups(counts:number[],wilds:number,needed:number,limit:number):Generator<SetShape[]>{
 if(!needed){if(!wilds&&counts.every(c=>!c))yield[];return;}
 const first=counts.findIndex(c=>c>0);
 // Canonical first natural tile prevents permutations. Fully wild sets are considered only at the tail.
 const starts=first<0?Array.from({length:limit},(_,i)=>i):[first];
 for(const value of starts){const take=Math.min(3,counts[value]),cost=3-take;if(cost>wilds)continue;counts[value]-=take;for(const tail of groups(counts,wilds-cost,needed-1,limit))yield[{value,run:false,concealed:true,size:3},...tail];counts[value]+=take;}
 const runs=first<0?Array.from({length:27},(_,i)=>i).filter(i=>i%9<7):first<27?Array.from({length:3},(_,i)=>first-i).filter(i=>i>=0&&Math.floor(i/9)===Math.floor(first/9)&&i%9<7):[];
 for(const value of runs){const used=[value,value+1,value+2].filter(v=>counts[v]>0),cost=3-used.length;if(cost>wilds)continue;for(const v of used)counts[v]--;for(const tail of groups(counts,wilds-cost,needed-1,limit))yield[{value,run:true,concealed:true,size:3},...tail];for(const v of used)counts[v]++;}
}
function* shapes(hand:Tile[],melds:Meld[],wildValue:number,limit:number):Generator<Shape>{
 if(hand.length!==14-melds.length*3)return;const c=countsOf(hand),w=wildValue<0?0:c[wildValue];if(wildValue>=0)c[wildValue]=0;
 const exposed=melds.map(m=>({value:m.tiles[0].value,run:m.type==='chow',concealed:m.type==='concealed',size:m.tiles.length}));
 if(!melds.length){
  if(c.reduce((n,x)=>n+x%2,0)<=w)yield{pair:-1,sets:[],seven:true};
  const required=[0,8,9,17,18,26,27,28,29,30,31,32,33];
  if(limit===34&&required.reduce((n,v)=>n+(c[v]===0?1:0),0)<=w&&c.every((n,v)=>!n||required.includes(v))&&hand.length===14)yield{pair:-1,sets:[],orphans:true};
 }
 for(let pair=0;pair<limit;pair++){const used=Math.min(2,c[pair]),cost=2-used;if(cost>w)continue;c[pair]-=used;for(const sets of groups(c,w-cost,4-melds.length,limit))yield{pair,sets:[...sets,...exposed]};c[pair]+=used;}
}
const cache=new Map<string,HandScore>();
/** Evaluate complete, coherent decompositions and choose the highest scoring one. Never combine incompatible shapes. */
export function scoreMahjongHand(mode:MahjongMode,hand:Tile[],melds:Meld[],wildValue:number,discardValue?:number,seat=0):HandScore{
 const key=JSON.stringify([mode,countsOf(hand),melds.map(m=>[m.type,m.tiles.map(t=>t.value)]),wildValue,discardValue,seat]);const saved=cache.get(key);if(saved)return structuredClone(saved);
 const rules=MAHJONG_RULES[mode],red=mode==='redBloodflow',all=[...hand,...melds.flatMap(m=>m.tiles)],natural=all.filter(t=>t.value!==wildValue),physical=countsOf(all),wildCount=all.length-natural.length;
 let best:HandScore={points:0,patterns:[]};
 for(const shape of shapes(hand,melds,wildValue,rules.missing?27:34)){
  const patterns:Fan[]=[],add=(name:string,multiplier:number)=>patterns.push({name,multiplier});
  const values=shape.seven||shape.orphans?natural.map(t=>t.value):[shape.pair,shape.pair,...shape.sets.flatMap(g=>g.run?[g.value,g.value+1,g.value+2]:Array(g.size).fill(g.value) as number[])];
  const suited=values.filter(v=>v<27),pure=suited.length===values.length&&new Set(suited.map(v=>Math.floor(v/9))).size===1,half=suited.length>0&&suited.length<values.length&&new Set(suited.map(v=>Math.floor(v/9))).size===1;
  const triplets=!shape.seven&&!shape.orphans&&shape.sets.every(g=>!g.run),simple=values.every(v=>v<27&&v%9>0&&v%9<8),jiang=values.every(v=>v<27&&[1,4,7].includes(v%9));
  if(rules.family==='pushdown'){
   add(shape.seven?'七对':shape.orphans?'十三幺':'平胡',1);
  }else if(rules.family==='guangdong'){
   if(shape.seven)continue;
   // Guangdong scoring selects the largest base pattern; hard wins are an independent multiplier.
   const candidates:Fan[]=[{name:'鸡胡',multiplier:1}];const candidate=(name:string,multiplier:number)=>candidates.push({name,multiplier});
   if(!shape.seven&&!shape.orphans&&shape.sets.every(g=>g.run))candidate('平胡',2);
   if(triplets)candidate('碰碰胡',4);if(half)candidate('混一色',4);if(pure)candidate('清一色',16);
   if(pure&&triplets)candidate('清碰',32);if(half&&triplets)candidate('混碰',16);
   const dragons=shape.sets.filter(g=>!g.run&&g.value>=31).length,winds=shape.sets.filter(g=>!g.run&&g.value>=27&&g.value<=30).length;
   if(dragons===2&&shape.pair>=31)candidate('小三元',32);if(winds===3&&shape.pair>=27&&shape.pair<=30)candidate('小四喜',32);
   if(values.every(v=>v>=27))candidate('字一色',64);
   if(dragons===3)candidate('大三元',64);if(winds===4)candidate('大四喜',64);
   if(values.every(terminal)&&values.every(v=>v<27))candidate('清幺九',64);
   if(shape.orphans)candidate('十三幺',64);
   if(triplets&&values.every(terminal))candidate('混幺九',32);
   if(pure&&!melds.length&&!wildCount&&[0,8].every(n=>physical[Math.floor(values[0]/9)*9+n]>=3)&&Array.from({length:7},(_,i)=>i+1).every(n=>physical[Math.floor(values[0]/9)*9+n]>=1))candidate('九莲宝灯',64);
   const top=candidates.sort((a,b)=>b.multiplier-a.multiplier)[0];add(top.name,top.multiplier);
   if(top.multiplier<8){if(shape.sets.some(g=>!g.run&&g.value===27+seat))add('门风',2);if(shape.sets.some(g=>!g.run&&g.value===27))add('圈风',2);if(dragons)add('三元刻',2**dragons);}
   if(rules.ghost&&!wildCount)add('硬胡',2);
  }else{
   const kongCount=melds.filter(m=>m.type!=='pong').length,rootCount=physical.filter((n,v)=>v!==wildValue&&n===4).length;
   const sequences=shape.sets.filter(g=>g.run).map(g=>g.value),tripletValues=shape.sets.filter(g=>!g.run).map(g=>g.value);
   const fourConsecutive=tripletValues.some(v=>v<27&&v%9<=5&&[1,2,3].every(n=>tripletValues.includes(v+n)));
   const threeConsecutive=tripletValues.some(v=>v<27&&v%9<=6&&[1,2].every(n=>tripletValues.includes(v+n)));
   let concealed=shape.sets.filter(g=>!g.run&&g.concealed).length;
   if(discardValue!==undefined&&shape.pair!==discardValue&&!sequences.some(v=>discardValue>=v&&discardValue<=v+2)&&shape.sets.some(g=>!g.run&&g.concealed&&g.value===discardValue))concealed--;
   const evenTriplets=triplets&&values.every(v=>v<27&&[1,3,5,7].includes(v%9));
   const redHook=melds.length===4&&hand.some(t=>t.value===33);
   const twinDragons=pure&&!shape.seven&&shape.pair%9===4&&[0,6].every(n=>sequences.filter(v=>v%9===n).length===2);
   const nineGates=pure&&!melds.length&&!wildCount&&[0,8].every(n=>physical[Math.floor(values[0]/9)*9+n]>=3)&&Array.from({length:7},(_,i)=>i+1).every(n=>physical[Math.floor(values[0]/9)*9+n]>=1);
   if(shape.seven&&!(red&&twinDragons))add('七对',4);
   else if(melds.length===4&&!(red&&redHook))add('金钩钓',4);
   else if(triplets&&!(red&&(redHook||evenTriplets||fourConsecutive||concealed===4)))add('碰碰胡',2);
   else if(!(red&&(redHook||twinDragons||evenTriplets||fourConsecutive||concealed===4)))add('平胡',1);
   if(red){if(redHook)add('红中金钩钓',32);if(twinDragons)add('一色双龙会',32);if(evenTriplets)add('全双刻',8);if(fourConsecutive)add('四连刻',16);if(concealed===4)add('四暗刻',16);}
   if(red&&nineGates)add('九莲宝灯',64);else if(pure&&!(red&&twinDragons))add('清一色',4);
   if(jiang)add('将',4);else if(simple&&!(red&&evenTriplets))add('断幺九',2);
   const outside=shape.seven?values.every(terminal):shape.sets.every(g=>g.run?g.value%9===0||g.value%9===6:terminal(g.value))&&terminal(shape.pair);
   if(outside)add('带幺九',4);
   if(red&&kongCount===3)add('十二金钗',8);else if(rootCount)add('根',2**rootCount);
   if(red){
    if(!wildCount)add('硬胡',2);
    const dragon=sequences.some(v=>v%9===0&&sequences.includes(v+3)&&sequences.includes(v+6));
    if(dragon)add('一条龙',4);else if(!nineGates&&sequences.some(v=>v%9<=3&&sequences.includes(v+3)))add('连六',2);
    if(tripletValues.some((v,i)=>tripletValues.some((x,j)=>j>i&&x!==v&&x%9===v%9)))add('双同刻',2);
    if(threeConsecutive&&!fourConsecutive)add('三连刻',4);
    if(concealed===3)add('三暗刻',4);
   }
  }
  let points=patterns.reduce((n,p)=>n*p.multiplier,1);if(rules.family==='guangdong'&&(patterns[0]?.multiplier??0)<8)points=Math.min(8,points);if(points>best.points)best={points,patterns};
 }
 if(cache.size>=256)cache.clear();cache.set(key,structuredClone(best));return best;
}
