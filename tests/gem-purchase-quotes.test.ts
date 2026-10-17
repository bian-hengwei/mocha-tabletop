import {describe, expect, it} from 'vitest';
import {gems, gemPurchaseQuote, type GemCard, type Merchant} from '../src/core/games/gems';
const players=[{id:'p0',name:'Alex',avatar:'🦊'},{id:'p1',name:'Blair',avatar:'🐼'}];
const card=(id:string,cost:number[],bonus='white'):GemCard=>({id,cost,bonus,tier:1,points:0});
const merchant=(tokens:number[],bonuses:string[]):Merchant=>({tokens,bought:bonuses.map((bonus,index)=>card(`b${index}`,[0,0,0,0,0],bonus)),reserved:[],nobles:[]});

describe('development purchase quotes',()=>{
 it('uses each gold token once across simultaneous color shortages',()=>{
  // Independent arithmetic: 3 white - 1 bonus - 1 token = 1; 2 blue - 0 - 0 = 2.
  const quote=gemPurchaseQuote(merchant([1,0,0,0,0,2],['white']),card('target',[3,2,0,0,0]));
  expect(quote).toEqual({discounts:[1,0,0,0,0],needed:[2,2,0,0,0],tokens:[1,0,0,0,0],shortfall:[1,2,0,0,0],gold:2,goldNeeded:3,missing:1,payment:null});
 });
 it('keeps surplus bonuses and unused gold out of the required payment',()=>{
  const quote=gemPurchaseQuote(merchant([2,2,0,0,0,4],['white','white','white']),card('target',[1,1,0,0,0]));
  expect(quote.discounts).toEqual([1,0,0,0,0]);expect(quote.needed).toEqual([0,1,0,0,0]);
  expect(quote.payment).toEqual([0,1,0,0,0,0]);expect(quote.goldNeeded).toBe(0);expect(quote.missing).toBe(0);
 });
 it('quotes free purchases without consuming inventory',()=>{
  const m=merchant([1,1,0,0,0,2],['white','blue']),before=structuredClone(m);
  const quote=gemPurchaseQuote(m,card('target',[1,1,0,0,0]));
  expect(quote.payment).toEqual([0,0,0,0,0,0]);expect(m).toEqual(before);
 });
 it('uses the viewer inventory during another player turn and clones quote data',()=>{
  const s=gems.create(players,7),target=s.market[0][0];s.merchants[1].tokens=[1,2,0,0,0,1];
  const view=gems.view(s,'p1');expect(view.actions).toEqual([]);
  expect(view.board.purchaseQuotes[target.id]).toEqual(gemPurchaseQuote(s.merchants[1],target));
  view.board.purchaseQuotes[target.id].tokens[0]=99;expect(s.merchants[1].tokens[0]).toBe(1);
 });
 it('quotes only market cards and the viewer reserved cards, never a deck or opposing reserve',()=>{
  const s=gems.create(players,7),secret=s.decks[0].pop()!,mine=s.decks[1].pop()!;
  s.merchants[0].reserved=[mine];s.merchants[1].reserved=[secret];
  const view=gems.view(s,'p0'),quotes=view.board.purchaseQuotes;
  expect(Object.keys(quotes).sort()).toEqual([...s.market.flat().map(c=>c.id),mine.id].sort());
  expect(JSON.stringify(view)).not.toContain(secret.id);expect(gems.view(s,'',true).board.purchaseQuotes).toEqual({});
  expect(gems.view(s,'stranger').board).toEqual({});
 });
 it('does not authorize an unaffordable purchase or a purchase on another turn',()=>{
  const s=gems.create(players,7),target=s.market[0][0],before=structuredClone(s);
  expect(gems.view(s,'p0').board.purchaseQuotes[target.id].missing).toBeGreaterThan(0);
  expect(()=>gems.apply(s,'p0',{action:'buy',values:[target.id]})).toThrow();
  s.merchants[1].tokens[5]=5;
  expect(()=>gems.apply(s,'p1',{action:'buy',values:[target.id]})).toThrow();
  s.merchants[1].tokens[5]=0;expect(s).toEqual(before);
 });
 it('matches confirmed automatic payment and leaves custom gold substitution legal',()=>{
  let s=gems.create(players,7);const target=card('target',[2,2,0,0,0]);
  s.market[0]=[target];s.nobles=[];s.merchants[0]=merchant([2,1,0,0,0,2],['white']);
  const quote=gems.view(s,'p0').board.purchaseQuotes.target;expect(quote.payment).toEqual([1,1,0,0,0,1]);
  s=gems.apply(s,'p0',{action:'buy',values:['target']});
  expect(gems.view(s,'p0').board.payment.auto).toEqual(quote.payment);
  const auto=gems.apply(s,'p0',{action:'pay_auto',values:[]});expect(auto.merchants[0].tokens).toEqual([1,0,0,0,0,1]);
  const custom=gems.apply(s,'p0',{action:'pay_custom',values:['white:0','gold:0','gold:1']});expect(custom.merchants[0].tokens).toEqual([1,1,0,0,0,0]);
 });
});
