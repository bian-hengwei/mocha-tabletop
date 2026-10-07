import {describe,it,expect} from 'vitest';
import {sushi,type SushiKind,type SushiState} from '../src/core/games/sushi';
import {DEFAULT_SUSHI_MENU,type SushiMenu} from '../src/core/games/sushiMenu';
import {validateSushiState} from '../src/core/games/sushiValidation';
import {sushiPartyPlateScore} from '../src/core/games/sushiParty';
// Expected outcomes below are transcribed from Gamewright's expanded base-box manual,
// pages 8–16: https://m.media-amazon.com/images/I/B1lSYxH1W1L.pdf .
function fixture(menu:Partial<SushiMenu>,plates:SushiKind[][],hands:SushiKind[][]){
 const players=hands.map((_,i)=>({id:`p${i}`,name:`Player ${i}`,avatar:'🦊'}));
 const options={sushiEdition:'party' as const,sushiMenu:{...DEFAULT_SUSHI_MENU,...menu}};
 const s=sushi.create(players,47,options);s.deck.push(...s.hands.flat());s.hands=hands.map(()=>[]);s.table=hands.map(()=>[]);s.step=4;
 const take=(kind:SushiKind)=>{let i=s.deck.findIndex(c=>c.kind===kind);if(i>=0)return s.deck.splice(i,1)[0];i=s.party!.dessertDeck.findIndex(c=>c.kind===kind);if(i>=0)return s.party!.dessertDeck.splice(i,1)[0];throw Error(`Fixture lacks ${kind}`);};
 s.table=plates.map(cs=>cs.map(take));s.hands=hands.map(cs=>cs.map(take));return {s,options};
}
const act=(s:SushiState,seat:number,action:string,...values:string[])=>sushi.apply(s,s.players[seat].id,{action,values});
const reveal=(s:SushiState)=>{for(let i=0;i<s.players.length;i++)s=act(s,i,'pick',s.hands[i][0].id);return s;};
const action=(s:SushiState,seat:number,id:string)=>sushi.view(s,s.players[seat].id).actions.find(a=>a.id===id)!;
describe('Party independent special-card scenarios',()=>{
 it('allows one declared bonus per player and rejects two atomically',()=>{
  const {s}=fixture({specials:['chopsticks','spoon']},[['chopsticks','spoon'],[],[]],[['egg','salmon'],['egg','salmon'],['egg','salmon']]);
  expect(action(s,0,'sushi:bonus').max).toBe(1);const before=structuredClone(s);expect(()=>act(s,0,'sushi:bonus',...s.table[0].map(c=>c.id))).toThrow();expect(s).toEqual(before);
 });
 for(const boost of [false,true])it(`Special Order may ${boost?'use':'preserve'} unused Wasabi`,()=>{
  let {s}=fixture({specials:['wasabi','order']},[['salmon','wasabi'],[]],[['order','egg'],['egg','salmon']]);const target=s.table[0][0].id,wasabi=s.table[0][1].id;
  expect(action(s,0,'sushi:copy').choices.map(c=>c.id)).toContain(`boost:${target}`);
  s=act(s,0,'sushi:copy',boost?`boost:${target}`:target);s=reveal(s);const copy=s.table[0].find(c=>c.kind==='order')!;
  expect(copy.wasabiID).toBe(boost?wasabi:undefined);expect(s.table[0].find(c=>c.id===wasabi)!.used??false).toBe(boost);expect(sushiPartyPlateScore(s.table[0])).toBe(boost?8:4);
 });
 it('copying a boosted Nigiri does not copy its Wasabi; copied Wasabi starts unused',()=>{
  let {s}=fixture({specials:['wasabi','order']},[['salmon','wasabi'],[]],[['order','egg'],['egg','salmon']]);s.table[0][0].wasabiID=s.table[0][1].id;s.table[0][1].used=true;
  const plain=act(s,0,'sushi:copy',s.table[0][0].id),copied=reveal(plain);expect(sushiPartyPlateScore(copied.table[0])).toBe(8);
  s=act(s,0,'sushi:copy',s.table[0][1].id);s=reveal(s);expect(s.table[0].find(c=>c.kind==='order')!.used).toBeUndefined();
 });
 it('Miso from a later Chopsticks action discards all soup played that turn, retaining older soup',()=>{
  let {s}=fixture({appetizers:['miso','tempura','dumpling']},[['chopsticks','miso'],[]],[['egg','miso'],['miso','salmon']]);const old=s.table[0][1].id;
  s=act(s,0,'sushi:bonus',s.table[0][0].id);s=reveal(s);expect(s.party!.pending?.kind).toBe('chopsticks');s=act(s,0,'sushi:chopsticks',s.hands[0][0].id);
  expect(s.table.flat().filter(c=>c.kind==='miso').map(c=>c.id)).toEqual([old]);expect(s.party!.discard.filter(c=>c.kind==='miso')).toHaveLength(2);
 });
 for(const request of ['group:nigiri','kind:salmon','kind:squid'])it(`Spoon resolves ${request} against the first matching left-hand player`,()=>{
  let {s}=fixture({specials:['spoon','tea']},[['spoon'],[],[]],[['tempura','egg'],['tempura','egg','salmon'],['tempura','salmon']]);const spoon=s.table[0][0].id;
  s=act(s,0,'sushi:bonus',spoon);s=reveal(s);s=act(s,0,'sushi:spoon',request);
  if(request==='kind:squid'){expect(s.party!.discard.some(c=>c.id===spoon)).toBe(true);expect(s.party!.pending).toBeUndefined();}
  else {expect(s.party!.pending?.giver).toBe(1);const choices=action(s,1,'sushi:give').choices;expect(choices).toHaveLength(request==='group:nigiri'?2:1);expect(sushi.view(s,'p0').actions).toEqual([]);const id=choices.at(-1)!.id;s=act(s,1,'sushi:give',id);expect(s.table[0].some(c=>c.id===id)).toBe(true);expect(s.hands.flat().some(c=>c.id===spoon)).toBe(true);}
 });
 it('Menu cards are private, exclude another Menu, and restore through a pending choice',()=>{
  let {s,options}=fixture({specials:['menu','tea']},[[],[]],[['menu','egg'],['egg','salmon']]);s=reveal(s);const pending=s.party!.pending!;expect(pending.kind).toBe('menu');expect(pending.cards).toHaveLength(4);
  for(const c of pending.cards!)expect(JSON.stringify(sushi.view(s,'p1'))).not.toContain(c.id);validateSushiState(s,options);
  const selected=action(s,0,'sushi:menu').choices[0].id;s=act(s,0,'sushi:menu',selected);expect(s.table[0].some(c=>c.id===selected)).toBe(true);expect(s.party!.discard.some(c=>c.kind==='menu')).toBe(true);validateSushiState(s,options);
 });
 it('Takeout may flip previous-turn cards only, including zero; rejects newly revealed cards',()=>{
  let {s}=fixture({specials:['takeout','chopsticks']},[['chopsticks','salmon'],[]],[['egg','takeout'],['egg','salmon']]);const old=s.table[0][1].id;
  s=act(s,0,'sushi:bonus',s.table[0][0].id);s=reveal(s);s=act(s,0,'sushi:chopsticks',s.hands[0][0].id);const choices=action(s,0,'sushi:takeout');expect(choices.min).toBe(0);expect(choices.choices.map(c=>c.id)).toEqual([old]);const fresh=s.table[0].find(c=>c.kind==='egg')!.id;expect(()=>act(s,0,'sushi:takeout',fresh)).toThrow();s=act(s,0,'sushi:takeout',old);expect(s.table[0].find(c=>c.id===old)!.flipped).toBe(true);
 });
 it('copied dessert survives the round with its physical Order ID',()=>{
  let {s}=fixture({specials:['order','tea']},[['pudding'],[]],[['order'],['egg']]);const id=s.hands[0][0].id;s=act(s,0,'sushi:copy',s.table[0][0].id);s=reveal(s);expect(s.round).toBe(2);expect(s.party!.desserts[0].map(c=>c.id)).toContain(id);expect(s.party!.desserts[0]).toHaveLength(2);expect(s.deck.some(c=>c.id===id)).toBe(false);
 });
 it('Uramaki immediate ties award full first and skip second; round end awards only third',()=>{
  let {s}=fixture({roll:'uramaki'},[['uramaki5'],['uramaki5'],['uramaki3']],[['uramaki5','egg'],['uramaki5','egg'],['egg','salmon']]);s=reveal(s);expect(s.scores).toEqual([8,8,0]);expect(s.party!.uramakiPlaces).toBe(2);s=reveal(s);expect(s.roundScores[0]).toEqual([10,9,4]);
 });
 it('Uramaki round end awards only the next unclaimed rank',()=>{
  let {s}=fixture({roll:'uramaki'},[['uramaki5','uramaki4'],['uramaki5'],['uramaki3']],[['egg'],['egg'],['egg']]);s=reveal(s);expect(s.roundScores[0]).toEqual([9,1,1]);
 });
 it('Maki ties give full points and retain second distinct rank, with 6-player third place',()=>{
  let {s}=fixture({},[['maki3'],['maki3'],['maki2'],['maki1']],[['egg'],['egg'],['egg'],['egg']]);s=reveal(s);expect(s.roundScores[0]).toEqual([7,7,4,1]);
  let six=fixture({},[['maki3'],['maki3'],['maki2'],['maki1'],[],[]],[['egg'],['egg'],['egg'],['egg'],['salmon'],['salmon']]).s;six=reveal(six);expect(six.roundScores[0]).toEqual([7,7,5,3,2,2]);
 });
 for(const [dessert,plates,expected] of [
  ['pudding',[['pudding','pudding'],['pudding'],[]],[7,1,-5]],
  ['icecream',[['icecream','icecream','icecream','icecream'],['icecream'],[]],[13,1,1]],
  ['fruit',[['fruitWW','fruitOP'],['fruitWO'],[]],[2,-1,-5]],
 ] as const)it(`${dessert} uses independent final scoring`,()=>{
  let {s}=fixture({dessert},plates.map(c=>[...c]),[['egg'],['egg'],['egg']]);s.round=3;s.roundScores=[[0,0,0],[0,0,0]];s=reveal(s);expect(s.finished).toBe(true);expect(s.scores).toEqual(expected);
 });
 it('rejects Menu checkpoints with no legal card and illegal cards on other effects',()=>{
  let {s,options}=fixture({specials:['menu','tea']},[[],[]],[['menu','egg'],['egg','salmon']]);s=reveal(s);const pending=s.party!.pending!;s.deck.push(...pending.cards!);pending.cards=[];
  const i=s.deck.findIndex(c=>c.kind==='menu');pending.cards.push(s.deck.splice(i,1)[0]);expect(()=>validateSushiState(s,options)).toThrow();
  pending.kind='takeout';expect(()=>validateSushiState(s,options)).toThrow();
 });
 it('rejects a pending Spoon giver without the requested card',()=>{
  let {s,options}=fixture({specials:['spoon','tea']},[['spoon'],[],[]],[['tempura','egg'],['tempura','salmon'],['tempura','egg']]);s=act(s,0,'sushi:bonus',s.table[0][0].id);s=reveal(s);s=act(s,0,'sushi:spoon','kind:salmon');validateSushiState(s,options);s.party!.pending!.requested='kind:squid';expect(()=>validateSushiState(s,options)).toThrow();
 });
});
