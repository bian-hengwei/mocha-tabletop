import {describe,it,expect} from 'vitest';
import {sushi,type SushiCard,type SushiKind,type SushiState} from '../src/core/games/sushi';
import {sushiPartyDeck,sushiPartyPlateScore} from '../src/core/games/sushiParty';
import {DEFAULT_SUSHI_MENU,validateSushiMenu,type SushiMenu} from '../src/core/games/sushiMenu';
import {validateSushiState} from '../src/core/games/sushiValidation';
import {normalizeGameOptions,roomLimits} from '../src/core/room';
import type {Command} from '../src/core/types';
const players=(n:number)=>Array.from({length:n},(_,i)=>({id:`party-player-${i}`,name:`Player ${i}`,avatar:'🦊'}));
const options=(menu=DEFAULT_SUSHI_MENU)=>({sushiEdition:'party' as const,sushiMenu:menu});
const create=(n=4,menu=DEFAULT_SUSHI_MENU)=>sushi.create(players(n),471,options(menu));
const cards=(...kinds:SushiKind[]):SushiCard[]=>kinds.map((kind,i)=>({kind,id:`fixture-${i}`}));
// Expected data transcribed from Gamewright 2016 base-box contents and card guide.
const menus:SushiMenu[]=[DEFAULT_SUSHI_MENU,{roll:'temaki',appetizers:['eel','tofu','onigiri'],specials:['menu','order'],dessert:'icecream'},{roll:'uramaki',appetizers:['edamame','miso','dumpling'],specials:['spoon','takeout'],dessert:'fruit'},{roll:'maki',appetizers:['eel','miso','tofu'],specials:['soy','tea'],dessert:'pudding'}];
describe('Sushi Party base box',()=>{
 it('has the independently transcribed 181-card catalog, including action numbers and fruit pairs',()=>{
  const all=new Map<string,SushiCard>();for(const menu of menus){const c=sushiPartyDeck(menu);for(const card of [...c.deck,...c.desserts])all.set(card.id,card);}
  const expected:Record<string,number>={egg:4,salmon:5,squid:3,maki1:4,maki2:5,maki3:3,temaki:12,uramaki3:4,uramaki4:4,uramaki5:4,tempura:8,sashimi:8,dumpling:8,eel:8,tofu:8,onigiriCircle:2,onigiriTriangle:2,onigiriSquare:2,onigiriRectangle:2,edamame:8,miso:8,chopsticks:3,spoon:3,menu:3,takeout:3,order:3,soy:3,tea:3,wasabi:3,pudding:15,icecream:15,fruitWW:2,fruitOO:2,fruitPP:2,fruitWO:3,fruitWP:3,fruitOP:3};
  expect(Object.fromEntries(Object.keys(expected).map(k=>[k,[...all.values()].filter(c=>c.kind===k).length]))).toEqual(expected);expect(all.size).toBe(181);
  for(const [kind,start]of [['chopsticks',1],['spoon',4],['menu',7],['takeout',10]] as const)expect([...all.values()].filter(c=>c.kind===kind).map(c=>c.number)).toEqual([start,start+1,start+2]);
 });
 it('validates custom menu categories, distinct choices and 2/7/8-player restrictions',()=>{
  expect(()=>validateSushiMenu({...menus[0],appetizers:['eel','eel','tofu']})).toThrow();expect(()=>validateSushiMenu({...menus[0],specials:['fruit','tea']})).toThrow();
  expect(()=>create(2,menus[2])).toThrow();expect(()=>create(7,menus[1])).toThrow();expect(()=>normalizeGameOptions('uno',options(),'owner')).toThrow();
  expect(roomLimits('sushi')).toEqual({min:2,max:5});expect(roomLimits('sushi',options(menus[2]))).toEqual({min:3,max:8});expect(roomLimits('sushi',options(menus[1]))).toEqual({min:2,max:6});
 });
 it('deals the prescribed hand sizes and first-round dessert injection',()=>{for(const n of [2,3,4,5,6,7,8]){const s=create(n);expect(s.hands.every(h=>h.length===(n<=3?10:n<=5?9:n<=7?8:7))).toBe(true);expect(s.party!.dessertDeck).toHaveLength(n<=5?10:8);validateSushiState(s,options());}});
 it('scores independent appetizer, tea and wasabi examples',()=>{
  expect(sushiPartyPlateScore(cards('eel'))).toBe(-3);expect(sushiPartyPlateScore(cards('eel','eel','eel'))).toBe(7);
  expect(sushiPartyPlateScore(cards('tofu','tofu'))).toBe(6);expect(sushiPartyPlateScore(cards('tofu','tofu','tofu'))).toBe(0);
  expect(sushiPartyPlateScore(cards('onigiriCircle','onigiriTriangle','onigiriSquare','onigiriRectangle','onigiriCircle','onigiriSquare'))).toBe(20);
  expect(sushiPartyPlateScore(cards('tea','tea','egg','salmon','wasabi'))).toBe(9);
  const plate=cards('wasabi','squid');plate[1].wasabiID=plate[0].id;expect(sushiPartyPlateScore(plate)).toBe(9);
 });
 it('never exposes other hands, pending Menu cards or copy/bonus selections',()=>{
  let s=create(4,menus[1]);const viewer=s.players[0].id;const privateIDs=s.hands.slice(1).flat().map(c=>c.id);let raw=JSON.stringify(sushi.view(s,viewer));for(const id of privateIDs)expect(raw).not.toContain(id);
  s.party!.pending={seat:1,kind:'menu',card:cards('menu')[0],cards:cards('squid','egg')};s.party!.phase='effects';raw=JSON.stringify(sushi.view(s,viewer));expect(raw).not.toContain('fixture-');expect(sushi.view(s,'',true).actions).toEqual([]);
 });
 for(const [mi,menu]of menus.entries())for(const n of [2,3,6,8]){if(n===2&&mi===2||n===8&&mi===1)continue;
  it(`finishes and conserves all physical cards, menu ${mi}, ${n} players`,()=>{
   let s=create(n,menu),steps=0;const declared=new Set<string>();
   while(!s.finished&&steps++<1200){
    const before=JSON.stringify(s);let acted=false;
    for(const player of s.players){const v=sushi.view(s,player.id),legal=v.actions.filter(a=>a.id!=='cancel');if(!legal.length)continue;
     const bonus=legal.find(a=>a.id==='sushi:bonus'),key=`${s.round}:${s.step}:${player.id}`,copy=legal.find(a=>a.id==='sushi:copy');let cmd:Command;
     if(bonus&&!declared.has(key)){declared.add(key);cmd={action:bonus.id,values:bonus.choices.slice(0,1).map(c=>c.id)};}
     else if(copy&&!s.party!.copyTargets[s.players.indexOf(player)])cmd={action:copy.id,values:[copy.choices[0].id]};
     else {const a=legal.find(a=>a.id==='pick')??legal[0];cmd={action:a.id,values:a.choices.slice(0,a.min).map(c=>c.id)};}
     s=sushi.apply(s,player.id,cmd);validateSushiState(s,options(menu));acted=true;break;
    }
    expect(acted).toBe(true);expect(JSON.stringify(s)).not.toBe(before);
   }
   expect(s.finished).toBe(true);expect(s.roundScores).toHaveLength(3);expect(s.winners.length).toBeGreaterThan(0);
  });
 }
 it('rejects malformed or mismatched Party checkpoints and leaves invalid actions unchanged',()=>{
  const s=create(),before=structuredClone(s);expect(()=>sushi.apply(s,s.players[0].id,{action:'pick',values:[s.hands[1][0].id]})).toThrow();expect(s).toEqual(before);
  expect(()=>validateSushiState(s,{})).toThrow();const broken=structuredClone(s);broken.hands[0].push(broken.hands[1][0]);expect(()=>validateSushiState(broken,options())).toThrow();
  const wrong=structuredClone(s);wrong.party!.menu.roll='temaki';expect(()=>validateSushiState(wrong,options())).toThrow();
 });
});
