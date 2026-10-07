import {action,assertPlayers,seeded,shuffle,validateCommand,type Action,type Command,type GameView,type Player} from '../types';
import {SUSHI_INFO,type SushiCard,type SushiKind,type SushiState} from './sushi';
import {DEFAULT_SUSHI_MENU,SUSHI_MENU_NAMES,validateSushiMenu,type SushiMenu} from './sushiMenu';
interface Effect {seat:number;card:SushiCard;kind:'menu'|'takeout'|'chopsticks'|'spoon'|'order'}
interface Pending extends Effect {cards?:SushiCard[];giver?:number;requested?:string}
export interface SushiPartyData {menu:SushiMenu;seed:number;shuffles:number;dessertDeck:SushiCard[];desserts:SushiCard[][];discard:SushiCard[];phase:'pick'|'effects';queue:Effect[];pending?:Pending;bonus:string[][];copyTargets:(string|null)[];uramakiPlaces:number;roundBonus:number[];misoCount:number;misoIDs:string[];turnStart:string[][]}
export const effectiveSushi=(card:SushiCard):SushiKind=>card.copy??card.kind;
const group=(card:SushiCard)=>{if(card.flipped)return 'flipped';const k=effectiveSushi(card);if(['egg','salmon','squid','wasabi'].includes(k))return 'nigiri';if(k.startsWith('maki'))return 'maki';if(k.startsWith('uramaki'))return 'uramaki';if(k.startsWith('onigiri'))return 'onigiri';if(k.startsWith('fruit'))return 'fruit';return k;};
const count=(cs:SushiCard[],kind:string)=>cs.filter(c=>!c.flipped&&effectiveSushi(c)===kind).length;
const dessert=(c:SushiCard)=>!c.flipped&&['pudding','icecream','fruit'].includes(group(c));
const rollCount=(cs:SushiCard[],family:string)=>cs.reduce((n,c)=>n+(!c.flipped&&group(c)===family?Number(effectiveSushi(c).slice(-1)):0),0);
export function sushiPartyDescription(card:SushiCard,players:number){
 if(card.flipped)return '2 分';const kind=effectiveSushi(card);
 if(kind==='chopsticks')return '后续一手揭牌后再选 1 张，并传出筷子';
 if(kind.startsWith('maki'))return players>=6?'卷数前三名 6 / 4 / 2 分；并列各得全分':'卷数前两名 6 / 3 分；并列各得全分';
 if(kind==='pudding'&&players===2)return '两人局：三轮后最多 +6，最少不扣分';
 return SUSHI_INFO[kind].detail;
}
const choices=(cs:SushiCard[],players=4)=>cs.map(c=>({id:c.id,title:c.flipped?'已打包':SUSHI_INFO[effectiveSushi(c)].title,subtitle:sushiPartyDescription(c,players)}));
const orderNumber=(card:SushiCard)=>card.copiedNumber??card.number??0;
function reshuffle(s:SushiState){const p=s.party!;s.deck=shuffle(s.deck,seeded(p.seed+ ++p.shuffles*104729));}
/** Catalog quantities are independently checked in tests/sushi-party.test.ts. */
export function sushiPartyDeck(menu:SushiMenu):{deck:SushiCard[];desserts:SushiCard[]}{
 const cards=(kind:SushiKind,n:number,start?:number)=>Array.from({length:n},(_,i):SushiCard=>({id:`party-${kind}-${i}`,kind,...(start?{number:start+i}:{})}));
 const groups:Record<string,SushiCard[]>={nigiri:[...cards('egg',4),...cards('salmon',5),...cards('squid',3)],maki:[...cards('maki1',4),...cards('maki2',5),...cards('maki3',3)],temaki:cards('temaki',12),uramaki:[...cards('uramaki3',4),...cards('uramaki4',4),...cards('uramaki5',4)],tempura:cards('tempura',8),sashimi:cards('sashimi',8),dumpling:cards('dumpling',8),eel:cards('eel',8),tofu:cards('tofu',8),onigiri:['onigiriCircle','onigiriTriangle','onigiriSquare','onigiriRectangle'].flatMap(k=>cards(k as SushiKind,2)),edamame:cards('edamame',8),miso:cards('miso',8),chopsticks:cards('chopsticks',3,1),spoon:cards('spoon',3,4),menu:cards('menu',3,7),takeout:cards('takeout',3,10),order:cards('order',3),soy:cards('soy',3),tea:cards('tea',3),wasabi:cards('wasabi',3),pudding:cards('pudding',15),icecream:cards('icecream',15),fruit:[...['fruitWW','fruitOO','fruitPP'].flatMap(k=>cards(k as SushiKind,2)),...['fruitWO','fruitWP','fruitOP'].flatMap(k=>cards(k as SushiKind,3))]};
 return {deck:['nigiri',menu.roll,...menu.appetizers,...menu.specials].flatMap(k=>groups[k]),desserts:groups[menu.dessert]};
}
const resetCard=(c:SushiCard):SushiCard=>({id:c.id,kind:c.kind,...(c.number?{number:c.number}:{})});
function dealParty(s:SushiState){
 const p=s.party!,n=s.players.length,amount=(n<=5?[5,3,2]:[7,5,3])[s.round-1];
 s.deck.push(...p.dessertDeck.splice(0,amount));reshuffle(s);
 const handSize=n<=3?10:n<=5?9:n<=7?8:7;
 s.hands=s.players.map(()=>s.deck.splice(-handSize));s.table=s.players.map(()=>[]);s.picks=s.players.map(()=>null);s.step=1;
 p.phase='pick';p.queue=[];delete p.pending;p.bonus=s.players.map(()=>[]);p.copyTargets=s.players.map(()=>null);p.uramakiPlaces=0;p.roundBonus=s.players.map(()=>0);p.misoCount=0;p.misoIDs=[];p.turnStart=s.players.map(()=>[]);
}
export function createSushiParty(players:Player[],seed:number,menu?:SushiMenu):SushiState{
 assertPlayers(players,2,8);const selected=validateSushiMenu(menu??DEFAULT_SUSHI_MENU,players.length),cards=sushiPartyDeck(selected);
 const s:SushiState={players:structuredClone(players),deck:cards.deck,hands:[],table:[],picks:[],scores:players.map(()=>0),puddings:players.map(()=>0),round:1,step:1,finished:false,winners:[],history:[],roundScores:[],party:{menu:selected,seed,shuffles:0,dessertDeck:shuffle(cards.desserts,seeded(seed+1)),desserts:players.map(()=>[]),discard:[],phase:'pick',queue:[],bonus:[],copyTargets:[],uramakiPlaces:0,roundBonus:[],misoCount:0,misoIDs:[],turnStart:[]}};dealParty(s);return s;
}
export function sushiPartyPlateScore(cards:SushiCard[]):number{
 let points=Math.floor(count(cards,'tempura')/2)*5+Math.floor(count(cards,'sashimi')/3)*10+[0,1,3,6,10,15][Math.min(5,count(cards,'dumpling'))];
 const eel=count(cards,'eel'),tofu=count(cards,'tofu');points+=eel===1?-3:eel>=2?7:0;points+=tofu===1?2:tofu===2?6:0;points+=3*count(cards,'miso')+2*cards.filter(c=>c.flipped).length;
 const shapes=['onigiriCircle','onigiriTriangle','onigiriSquare','onigiriRectangle'].map(k=>count(cards,k));while(shapes.some(n=>n>0)){const unique=shapes.filter(n=>n>0).length;points+=unique*unique;shapes.forEach((n,i)=>shapes[i]=Math.max(0,n-1));}
 for(const c of cards){if(c.flipped)continue;const v=({egg:1,salmon:2,squid:3} as Partial<Record<SushiKind,number>>)[effectiveSushi(c)]??0;const boosted=!!c.wasabiID&&cards.some(w=>w.id===c.wasabiID&&!w.flipped&&effectiveSushi(w)==='wasabi');points+=v*(boosted?3:1);}
 const colors=new Map<string,number>();for(const c of cards)colors.set(group(c),(colors.get(group(c))??0)+1);
 return points+count(cards,'tea')*Math.max(0,...colors.values());
}
function awardUramaki(s:SushiState,end=false){
 const p=s.party!,rolls=s.table.map(cs=>rollCount(cs,'uramaki'));
 const contenders=rolls.map((n,i)=>({n,i})).filter(x=>x.n>=(end?1:10)).sort((a,b)=>b.n-a.n);
 while(contenders.length&&p.uramakiPlaces<3){const amount=contenders[0].n,tied=contenders.filter(x=>x.n===amount),score=[8,5,2][p.uramakiPlaces];for(const {i}of tied){s.scores[i]+=score;p.roundBonus[i]+=score;if(!end){const gone=s.table[i].filter(c=>!c.flipped&&group(c)==='uramaki');p.discard.push(...gone);s.table[i]=s.table[i].filter(c=>!gone.includes(c));}}p.uramakiPlaces+=tied.length;if(end)return;contenders.splice(0,tied.length);}
}
function scoreParty(s:SushiState){
 const p=s.party!,n=s.players.length;if(p.menu.roll==='uramaki')awardUramaki(s,true);
 const points=s.table.map(sushiPartyPlateScore),colors=s.table.map(cs=>new Set(cs.map(group)).size),edamame=s.table.map(cs=>count(cs,'edamame')>0),maxColors=Math.max(...colors);
 s.table.forEach((cs,i)=>{points[i]+=count(cs,'edamame')*Math.min(4,edamame.filter(Boolean).length-(edamame[i]?1:0));if(colors[i]===maxColors)points[i]+=count(cs,'soy')*4;});
 if(p.menu.roll==='maki'){const totals=s.table.map(cs=>rollCount(cs,'maki')),ranks=[...new Set(totals.filter(v=>v>0))].sort((a,b)=>b-a),scores=n>=6?[6,4,2]:[6,3];totals.forEach((v,i)=>{if(v>0)points[i]+=scores[ranks.indexOf(v)]??0;});}
 if(p.menu.roll==='temaki'){const totals=s.table.map(cs=>count(cs,'temaki')),max=Math.max(...totals),min=Math.min(...totals);totals.forEach((v,i)=>{if(v===max)points[i]+=4;if(n>2&&v===min)points[i]-=4;});}
 s.roundScores.push(points.map((v,i)=>v+p.roundBonus[i]));points.forEach((v,i)=>s.scores[i]+=v);
 s.table.forEach((cs,i)=>{p.desserts[i].push(...cs.filter(dessert));s.puddings[i]=p.desserts[i].length;});
 if(s.round<3){s.deck.push(...s.table.flat().filter(c=>!dessert(c)).map(resetCard),...p.discard.map(resetCard));p.discard=[];s.round++;dealParty(s);return;}
 const totals=p.desserts.map(cs=>cs.length),max=Math.max(...totals),min=Math.min(...totals);
 p.desserts.forEach((cs,i)=>{
  if(p.menu.dessert==='pudding'){if(totals[i]===max)s.scores[i]+=6;if(n>2&&totals[i]===min)s.scores[i]-=6;}
  if(p.menu.dessert==='icecream')s.scores[i]+=Math.floor(cs.length/4)*12;
  if(p.menu.dessert==='fruit')for(const fruit of ['W','O','P']){const icons=cs.reduce((sum,c)=>sum+[...effectiveSushi(c).slice(5)].filter(x=>x===fruit).length,0);s.scores[i]+=[-2,0,1,3,6,10][Math.min(5,icons)];}
 });
 const best=Math.max(...s.scores),tie=Math.max(...totals.filter((_,i)=>s.scores[i]===best));s.winners=s.players.filter((_,i)=>s.scores[i]===best&&totals[i]===tie).map(x=>x.id);s.finished=true;
}
const copyID=(key:string|null)=>key?.replace(/^boost:/,'');
const canBoostCopy=(s:SushiState,seat:number,c:SushiCard)=>!c.flipped&&!c.wasabiID&&['egg','salmon','squid'].includes(effectiveSushi(c))&&s.table[seat].some(w=>!w.flipped&&!w.used&&effectiveSushi(w)==='wasabi');
const copyChoices=(s:SushiState,seat:number)=>s.table[seat].flatMap(c=>[...choices([c],s.players.length),...(canBoostCopy(s,seat,c)?[{id:`boost:${c.id}`,title:SUSHI_INFO[effectiveSushi(c)].title,subtitle:'复制并使用芥末'}]:[])]);
function copyCard(card:SushiCard,target:SushiCard,boost=false){card.copy=effectiveSushi(target);card.copiedNumber=orderNumber(target);card.flipped=target.flipped;if(['egg','salmon','squid'].includes(effectiveSushi(target)))card.noWasabi=!boost;}
function play(s:SushiState,seat:number,card:SushiCard){
 const p=s.party!,k=effectiveSushi(card);card.playedAt=s.step;
 if(k==='order'){if(!s.table[seat].length){p.discard.push(card);return;}p.queue.unshift({seat,card,kind:'order'});return;}
 if(k==='menu'||k==='takeout'){p.queue.push({seat,card,kind:k});p.queue.sort((a,b)=>orderNumber(a.card)-orderNumber(b.card)||a.seat-b.seat);return;}
 if(!card.flipped&&['egg','salmon','squid'].includes(k)&&!card.noWasabi){const wasabi=s.table[seat].find(c=>!c.flipped&&effectiveSushi(c)==='wasabi'&&!c.used);if(wasabi){wasabi.used=true;card.wasabiID=wasabi.id;}}
 s.table[seat].push(card);
 if(k==='miso'&&!card.flipped){p.misoCount++;p.misoIDs.push(card.id);if(p.misoCount>1)for(let i=0;i<s.players.length;i++){const gone=s.table[i].filter(c=>p.misoIDs.includes(c.id));p.discard.push(...gone);s.table[i]=s.table[i].filter(c=>!gone.includes(c));}}
}
function nextEffect(s:SushiState){
 const p=s.party!;while(p.queue.length){const e=p.queue.shift()!;
  if(['spoon','chopsticks'].includes(e.kind)&&(!s.table[e.seat].some(c=>c.id===e.card.id&&!c.flipped)||!s.hands[e.seat].length&&e.kind==='chopsticks'))continue;
  if(e.kind==='menu'){const cards=s.deck.splice(-4);if(cards.every(c=>effectiveSushi(c)==='menu')){s.deck.push(...cards);reshuffle(s);p.discard.push(e.card);continue;}p.pending={...e,cards};return;}
  p.pending=e;return;
 }
 delete p.pending;s.hands=s.hands.map((_,i)=>s.hands[(i+s.players.length-1)%s.players.length]);s.picks=s.players.map(()=>null);p.bonus=s.players.map(()=>[]);p.copyTargets=s.players.map(()=>null);s.step++;p.phase='pick';
 if(s.hands.every(h=>!h.length))scoreParty(s);
}
function reveal(s:SushiState){
 const p=s.party!;p.phase='effects';p.turnStart=s.table.map(cs=>cs.map(c=>c.id));p.misoCount=0;p.misoIDs=[];p.queue=[];
 const cards=s.picks.map((ids,i)=>{const at=s.hands[i].findIndex(c=>c.id===ids![0]);return s.hands[i].splice(at,1)[0];});
 // Copies select their targets before the simultaneous reveal.
 cards.forEach((c,i)=>{if(c.kind==='order'){const target=s.table[i].find(t=>t.id===copyID(p.copyTargets[i]));if(target)copyCard(c,target,!!p.copyTargets[i]?.startsWith('boost:'));}});
 cards.forEach((c,i)=>play(s,i,c));awardUramaki(s);
 p.bonus.forEach((ids,i)=>ids.forEach(id=>{const c=s.table[i].find(c=>c.id===id&&!c.flipped);if(c)p.queue.push({seat:i,card:c,kind:effectiveSushi(c) as 'spoon'|'chopsticks'});}));
 p.queue.sort((a,b)=>orderNumber(a.card)-orderNumber(b.card)||a.seat-b.seat);nextEffect(s);
}
function pendingAction(s:SushiState,me:number):Action[]{
 const p=s.party!,e=p.pending;if(!e)return[];
 if(e.giver!==undefined){if(me!==e.giver)return[];return[action('sushi:give','交出索取的牌',choices(s.hands[me].filter(c=>matches(c,e.requested!)),s.players.length),1,1)];}
 if(e.seat!==me)return[];
 if(e.kind==='menu')return[action('sushi:menu','从菜单选牌',choices(e.cards!.filter(c=>effectiveSushi(c)!=='menu'),s.players.length),1,1)];
 if(e.kind==='chopsticks')return[action('sushi:chopsticks','选择第二张牌',choices(s.hands[me],s.players.length),1,1)];
 if(e.kind==='takeout')return[action('sushi:takeout','选择打包的牌',choices(s.table[me].filter(c=>p.turnStart[me].includes(c.id)&&!c.flipped),s.players.length),0,s.table[me].filter(c=>p.turnStart[me].includes(c.id)&&!c.flipped).length)];
 if(e.kind==='order')return[action('sushi:order','选择复制对象',copyChoices(s,me),1,1)];
 const menu=p.menu,types=['nigiri',menu.roll,...menu.appetizers,...menu.specials,menu.dessert],cards=sushiPartyDeck(menu),kinds=[...new Set([...cards.deck,...cards.desserts].map(c=>c.kind))];
 return[action('sushi:spoon','索取哪种牌',[...types.map(k=>({id:`group:${k}`,title:SUSHI_MENU_NAMES[k]})),...kinds.filter(k=>!types.includes(k)).map(k=>({id:`kind:${k}`,title:SUSHI_INFO[k].title}))],1,1)];
}
function matches(card:SushiCard,request:string){return request.startsWith('kind:')?card.kind===request.slice(5):(request==='group:nigiri'?['egg','salmon','squid'].includes(card.kind):request==='group:wasabi'?card.kind==='wasabi':group(card)===request.slice(6));}
export function viewSushiParty(s:SushiState,id:string,spectator=false):GameView{
 const me=spectator?-1:s.players.findIndex(p=>p.id===id),p=s.party!;if(me<0&&!spectator)throw new Error('不在本局中');let actions:Action[]=[];
 if(me>=0&&!s.finished){if(p.phase==='effects')actions=pendingAction(s,me);else if(s.picks[me])actions=[action('cancel','重新选牌')];else{
 const target=copyID(p.copyTargets[me]),hand=s.hands[me].filter(c=>c.kind!=='order'||!s.table[me].length||!!s.table[me].find(t=>t.id===target));actions=[action('pick','确认选牌',choices(hand,s.players.length),1,1)];
 const bonus=s.table[me].filter(c=>!c.flipped&&['chopsticks','spoon'].includes(effectiveSushi(c)));if(bonus.length)actions.push(action('sushi:bonus','本手使用的特殊牌',choices(bonus,s.players.length),0,1));
 if(s.hands[me].some(c=>c.kind==='order')&&s.table[me].length)actions.push(action('sushi:copy','选择复制对象',copyChoices(s,me),1,1));
 }}
 const active=p.pending,waiting=active?s.players[active.giver??active.seat].name:'';
 return structuredClone({kind:'sushi',phase:s.finished?'三轮结束':`第 ${s.round} / 3 轮 · 第 ${s.step} 手`,instruction:s.finished?`胜者：${s.players.filter(x=>s.winners.includes(x.id)).map(x=>x.name).join('、')}`:p.phase==='effects'?`等待 ${waiting} 处理特殊牌`:me>=0&&s.picks[me]?'已锁定，等待其他人选牌':'',finished:s.finished,actions,sections:[],log:s.history,board:{edition:'party',menu:p.menu,phase:p.phase,hand:me<0?[]:s.hands[me],selected:me<0?null:s.picks[me],bonus:me<0?[]:p.bonus[me],copyTarget:me<0?null:p.copyTargets[me],round:s.round,step:s.step,roundScores:s.roundScores,winners:s.winners,players:s.players.map((x,i)=>({...x,table:s.table[i],plateScore:sushiPartyPlateScore(s.table[i]),score:s.scores[i],puddings:s.puddings[i],desserts:p.desserts[i],ready:!!s.picks[i],handCount:s.hands[i].length}))}});
}
export function applySushiParty(state:SushiState,id:string,command:Command):SushiState{
 validateCommand(viewSushiParty(state,id),command);const s=structuredClone(state),p=s.party!,me=s.players.findIndex(x=>x.id===id);
 if(command.action==='cancel'){s.picks[me]=null;return s;}
 if(command.action==='sushi:bonus'){p.bonus[me]=[...command.values];return s;}
 if(command.action==='sushi:copy'){p.copyTargets[me]=command.values[0];return s;}
 if(command.action==='pick'){s.picks[me]=[...command.values];if(s.picks.every(Boolean))reveal(s);return s;}
 const e=p.pending!;delete p.pending;
 const take=(hand:SushiCard[],key:string)=>hand.splice(hand.findIndex(c=>c.id===key),1)[0];
 const removeBonus=()=>take(s.table[e.seat],e.card.id);
 if(command.action==='sushi:menu'){const card=take(e.cards!,command.values[0]);s.deck.push(...e.cards!);reshuffle(s);p.discard.push(e.card);play(s,e.seat,card);}
 if(command.action==='sushi:chopsticks'){const card=take(s.hands[me],command.values[0]),bonus=removeBonus();s.hands[me].push(resetCard(bonus));play(s,me,card);}
 if(command.action==='sushi:takeout'){for(const key of command.values)s.table[me].find(c=>c.id===key)!.flipped=true;p.discard.push(e.card);}
 if(command.action==='sushi:order'){copyCard(e.card,s.table[me].find(c=>c.id===copyID(command.values[0]))!,command.values[0].startsWith('boost:'));play(s,me,e.card);}
 if(command.action==='sushi:spoon'){
  const request=command.values[0];let giver=-1;for(let n=1;n<s.players.length;n++){const i=(me+n)%s.players.length;if(s.hands[i].some(c=>matches(c,request))){giver=i;break;}}
  if(giver<0)p.discard.push(removeBonus());else {p.pending={...e,giver,requested:request};return s;}
 }
 if(command.action==='sushi:give'){const card=take(s.hands[me],command.values[0]),bonus=removeBonus();s.hands[me].push(resetCard(bonus));play(s,e.seat,card);}
 awardUramaki(s);nextEffect(s);return s;
}
