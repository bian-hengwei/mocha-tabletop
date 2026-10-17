import {describe,it,expect} from 'vitest';
import {drawrelay,validateRelayState,encodeRelayStroke,type DrawRelayState} from '../src/core/games/drawrelay';
const players=Array.from({length:12},(_,i)=>({id:`player_${i}`,name:`Player ${i}`,avatar:'🦊'}));
const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).length;

describe('private drawing-relay opening ideas',()=>{
 it.each(['zh','en'] as const)('deals three distinct, bounded %s ideas per player from a reproducible seed',language=>{
  const s=drawrelay.create(players,41,{language});
  expect(s.openingPrompts).toHaveLength(12);
  expect(new Set(s.openingPrompts!.flat()).size).toBe(36);
  expect(s.openingPrompts!.every(choices=>choices.length===3&&choices.every(text=>[...text].length<=120))).toBe(true);
  expect(s.openingPrompts).toEqual(drawrelay.create(players,41,{language}).openingPrompts);
  expect(s.openingPrompts).not.toEqual(drawrelay.create(players,42,{language}).openingPrompts);
  expect(/[\u3400-\u9fff]/u.test(s.openingPrompts!.flat().join(''))).toBe(language==='zh');
  expect(s.drafts.every(draft=>draft.text==='')).toBe(true);
 });
 for(const relayMode of ['rounds','queue'] as const)it(`${relayMode} projects only own unsubmitted opening ideas and never auto-submits`,()=>{
  let s=drawrelay.create(players.slice(0,3),41,{relayMode,language:'en',relaySeconds:0});
  // Explicit independent sentinels make projection/privacy assertions unambiguous.
  s.openingPrompts=[['Private zero A','Private zero B','Private zero C'],['Private one A','Private one B','Private one C'],['Private two A','Private two B','Private two C']];
  expect(drawrelay.view(s,players[0].id).board.openingPrompts).toEqual(s.openingPrompts[0]);
  expect(JSON.stringify(drawrelay.view(s,players[1].id))).not.toContain('Private zero');
  expect(JSON.stringify(drawrelay.view(s,'',true))).not.toContain('Private');
  const marker=relayMode==='queue'?'0:0':'0';
  s=drawrelay.apply(s,players[0].id,{action:'draft',values:[marker],text:'Private zero A, edited'});
  expect(drawrelay.view(s,players[0].id).board.draft.text).toBe('Private zero A, edited');
  expect(s.books[0]).toHaveLength(0);
  expect(JSON.stringify(drawrelay.view(s,players[1].id))).not.toContain('edited');
  s=drawrelay.apply(s,players[0].id,{action:'submit',values:[marker]});
  expect(drawrelay.view(s,players[0].id).board.openingPrompts).toBeUndefined();
  if(relayMode==='queue'){
   s=drawrelay.apply(s,players[1].id,{action:'task',values:['0:1']});
   expect(drawrelay.view(s,players[1].id).board.openingPrompts).toBeUndefined();
   expect(drawrelay.view(s,players[1].id).board.previous.text).toBe('Private zero A, edited');
  }
  const restored=JSON.parse(JSON.stringify(s)) as DrawRelayState;
  validateRelayState(restored,0,relayMode);
  expect(restored.openingPrompts).toEqual(s.openingPrompts);
 });
 it.each(['rounds','queue'] as const)('accepts old %s archives without inventing ideas',relayMode=>{
  const s=drawrelay.create(players.slice(0,3),2,{relayMode,relaySeconds:0});delete s.openingPrompts;
  validateRelayState(s,0,relayMode);
  expect(drawrelay.view(s,players[0].id).board.openingPrompts).toBeUndefined();
  expect(drawrelay.apply(s,players[0].id,{action:'draft',values:[relayMode==='queue'?'0:0':'0'],text:'Legacy sentence'}).openingPrompts).toBeUndefined();
 });
 it('rejects malformed candidate archives within the existing envelope',()=>{
  for(const choices of [[],[['a','b','c']],Array(12).fill(['same','same','other']),Array(12).fill(['a','b',12]),Array(12).fill(['a','b','c\u0000']),Array(12).fill(['a','b','x'.repeat(121)])]){
   const s=drawrelay.create(players,5);Object.assign(s,{openingPrompts:choices});
   expect(()=>validateRelayState(s,90)).toThrow('接龙存档无效');
  }
 });
 it.each(['rounds','queue'] as const)('keeps worst-case %s state and projections within existing size limits',relayMode=>{
  let s=drawrelay.create(players,5,{relayMode,relaySeconds:0});
  const stroke=encodeRelayStroke(Array.from({length:48},(_,i)=>[i*21,i*16]),6,2);
  for(let step=0;step<12;step++)for(let book=0;book<12;book++){
   const seat=(book+step)%12,marker=relayMode==='queue'?`${book}:${step}`:String(step);
   const draft=relayMode==='queue'?s.queue!.drafts[book]!:s.drafts[seat];
   if(step%2)draft.strokes=Array(96).fill(stroke);else draft.text='🦊'.repeat(120);
   s=drawrelay.apply(s,players[seat].id,{action:'submit',values:[marker]});
   expect(bytes(drawrelay.view(s,players[(seat+1)%12].id))).toBeLessThan(64000);
  }
  validateRelayState(s,0,relayMode);
  expect(bytes(s)).toBeLessThan(1500000);
  expect(s.finished).toBe(true);
  expect(drawrelay.view(s,players[0].id).board.openingPrompts).toBeUndefined();
 });
});
