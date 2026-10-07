import type {GameOptions} from '../types';
import {DEFAULT_SUSHI_MENU,validateSushiMenu} from './sushiMenu';
import {sushiPartyDeck,viewSushiParty} from './sushiParty';
import {SUSHI_INFO,type SushiCard,type SushiState} from './sushi';
/** Check the edition and physical card inventory before accepting a persisted Party game. */
export function validateSushiState(input:unknown,options?:GameOptions):void{
 const s=input as SushiState;
 if(!s||typeof s!=='object'||!!s.party!==(options?.sushiEdition==='party'))throw new Error('寿司存档与菜单不一致');
 if(!s.party)return; // Original Classic checkpoints retain their existing schema.
 const fail=()=>{throw new Error('寿司存档无效');},p=s.party,n=s.players?.length;
 const menu=validateSushiMenu(p.menu,n),expected=validateSushiMenu(options?.sushiMenu??DEFAULT_SUSHI_MENU,n);
 if(JSON.stringify(menu)!==JSON.stringify(expected))throw new Error('寿司存档与菜单不一致');
 const integer=(v:unknown)=>Number.isSafeInteger(v),list=(v:unknown):v is unknown[]=>Array.isArray(v),rows=(v:unknown):v is unknown[][]=>list(v)&&v.length===n&&v.every(list);
 if(!integer(n)||n<2||n>8||!integer(s.round)||s.round<1||s.round>3||!integer(s.step)||s.step<1||!integer(p.seed)||!integer(p.shuffles)||p.shuffles<1||!['pick','effects'].includes(p.phase)||typeof s.finished!=='boolean'||s.finished&&s.round!==3)fail();
 if(!rows(s.hands)||!rows(s.table)||!rows(p.desserts)||!rows(p.bonus)||!rows(p.turnStart)||!list(p.copyTargets)||p.copyTargets.length!==n||!list(s.picks)||s.picks.length!==n)fail();
 for(const scores of [s.scores,s.puddings,p.roundBonus])if(!list(scores)||scores.length!==n||!scores.every(integer))fail();
 if(!list(s.roundScores)||s.roundScores.length!==(s.finished?3:s.round-1)||s.roundScores.some(r=>!list(r)||r.length!==n||!r.every(integer))||!list(s.history)||s.history.some(v=>typeof v!=='string')||!list(s.winners)||s.winners.some(id=>!s.players.some(p=>p.id===id)))fail();
 if(!integer(p.uramakiPlaces)||p.uramakiPlaces<0||p.uramakiPlaces>n+2||!integer(p.misoCount)||p.misoCount<0||!list(p.misoIDs)||p.misoIDs.some(id=>typeof id!=='string'))fail();
 const catalog=sushiPartyDeck(menu),physical=new Map([...catalog.deck,...catalog.desserts].map(c=>[c.id,c])),owned=new Map<string,SushiCard>();
 const check=(card:SushiCard)=>{
  if(!card||typeof card!=='object'||!physical.has(card.id)||physical.get(card.id)!.kind!==card.kind||physical.get(card.id)!.number!==card.number)fail();
  if(card.copy!==undefined&&(card.kind!=='order'||!Object.hasOwn(SUSHI_INFO,card.copy)))fail();
  for(const flag of [card.flipped,card.used,card.noWasabi])if(flag!==undefined&&typeof flag!=='boolean')fail();
  if(card.playedAt!==undefined&&(!integer(card.playedAt)||card.playedAt<1)||card.copiedNumber!==undefined&&(!integer(card.copiedNumber)||card.copiedNumber<0||card.copiedNumber>12)||card.wasabiID!==undefined&&!physical.has(card.wasabiID))fail();
 };
 const add=(cards:SushiCard[],aliases=false)=>{if(!list(cards))fail();for(const card of cards){check(card);if(owned.has(card.id)){if(!aliases||JSON.stringify(owned.get(card.id))!==JSON.stringify(card))fail();}else owned.set(card.id,card);}};
 add(s.deck);add(p.dessertDeck);add(p.discard);s.hands.forEach(cs=>add(cs));s.table.forEach(cs=>add(cs));p.desserts.forEach(cs=>add(cs,s.finished));
 if(!list(p.queue)||p.queue.length>30)fail();
 for(const effect of [...p.queue,...(p.pending?[p.pending]:[])]){
  if(!effect||!integer(effect.seat)||effect.seat<0||effect.seat>=n||!['menu','takeout','chopsticks','spoon','order'].includes(effect.kind))fail();
  check(effect.card);
  if(['spoon','chopsticks'].includes(effect.kind)){if(!s.table[effect.seat].some(c=>c.id===effect.card.id))fail();}else add([effect.card]);
 }
 if(p.pending?.cards){if(p.pending.kind!=='menu')fail();add(p.pending.cards);}
 if(p.pending?.giver!==undefined&&(!integer(p.pending.giver)||p.pending.giver<0||p.pending.giver>=n||p.pending.giver===p.pending.seat||p.pending.kind!=='spoon'||typeof p.pending.requested!=='string'))fail();
 if(p.pending?.kind==='menu'&&(!list(p.pending.cards)||p.pending.cards.length>4))fail();
 if(owned.size!==physical.size)fail();
 for(let i=0;i<n;i++){
  if(p.bonus[i].length>1)fail();const pick=s.picks[i];if(pick!==null&&(!list(pick)||pick.length!==1||typeof pick[0]!=='string'||!physical.has(pick[0])||p.phase==='pick'&&!s.hands[i].some(c=>c.id===pick[0])))fail();
  for(const keys of [p.bonus[i],p.turnStart[i]])if(keys.some(k=>typeof k!=='string'||!physical.has(k))||new Set(keys).size!==keys.length)fail();
  if(p.copyTargets[i]!==null&&!physical.has(p.copyTargets[i]!.replace(/^boost:/,'')))fail();
 }
 if(p.phase==='pick'&&(p.pending||p.queue.length)||p.phase==='effects'&&!p.pending)fail();
 if(p.pending){const actor=s.players[p.pending.giver??p.pending.seat].id,actions=viewSushiParty(s,actor).actions;if(!actions.length||actions.some(a=>a.min>a.choices.length))fail();}
}
