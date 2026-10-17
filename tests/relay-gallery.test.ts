import {describe,it,expect} from 'vitest';
import {isRelayGalleryNavigation,applyMatch,createMatch,advanceMatchClock} from '../src/core/room';
const players=Array.from({length:3},(_,i)=>({id:`player_${i}`,name:`Player ${i}`,avatar:'🦊'}));
describe('finished relay gallery pause exemption',()=>{
 it('accepts only finished relay album/page navigation with a single canonical page number',()=>{
  for(const action of ['album','page'])expect(isRelayGalleryNavigation('drawrelay',true,{action,values:['2']})).toBe(true);
  for(const finished of [false,undefined,'true',1])expect(isRelayGalleryNavigation('drawrelay',finished,{action:'page',values:['1']})).toBe(false);
  expect(isRelayGalleryNavigation('gems',true,{action:'page',values:['1']})).toBe(false);
  for(const command of [null,{},'page',{action:'submit',values:['0']},{action:'draft',values:['0'],text:'x'},{action:'page',values:[]},{action:'page',values:['1','2']},{action:'page',values:[1]},{action:'page',values:['-1']},{action:'page',values:['01']},{action:'page',values:['1.0']},{action:'page',values:['1'],text:'x'}])expect(isRelayGalleryNavigation('drawrelay',true,command)).toBe(false);
 });
 it('keeps membership, page bounds and action revision checks at the core authority',()=>{
  let m=createMatch('drawrelay',players,{relaySeconds:60});
  for(let i=0;i<4;i++)m=advanceMatchClock(m,'drawrelay',players,i*60000);
  expect(m.game.finished).toBe(true);const before=structuredClone(m);
  expect(()=>applyMatch(m,'drawrelay',players,'observer',{action:'page',values:['1']},'observer',0)).toThrow('不在本局中');
  expect(()=>applyMatch(m,'drawrelay',players,'player_0',{action:'page',values:['3']},'bounds',m.actorRevisions.player_0)).toThrow('操作无效');
  expect(()=>applyMatch(m,'drawrelay',players,'player_0',{action:'page',values:['1']},'stale',m.actorRevisions.player_0-1)).toThrow('牌局已变化');
  expect(m).toEqual(before);
  const next=applyMatch(m,'drawrelay',players,'player_0',{action:'page',values:['1']},'valid',m.actorRevisions.player_0);
  expect(next.game.cursors.player_0).toEqual({book:0,page:1});expect(next.game.cursors.player_1).toBeUndefined();
 });
});
