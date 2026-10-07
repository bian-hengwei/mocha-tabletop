import {describe,it,expect} from 'vitest';
import {drawrelay,encodeRelayStroke,validateRelayState,advanceRelayClock,pauseRelayClock,type DrawRelayState} from '../src/core/games/drawrelay';
import {drawguess} from '../src/core/games/drawguess';
import {codenames} from '../src/core/games/codenames';
import {createMatch,applyMatch} from '../src/core/room';
const players=(n:number)=>Array.from({length:n},(_,i)=>({id:`feedback_${i}`,name:`Person ${i}`,avatar:'🦊'}));
const stroke=encodeRelayStroke([[12,12],[32,32]],15,4);
const pass=(state:DrawRelayState,book:number)=>{let s=state;const step=s.books[book].length,id=s.players[(book+step)%s.players.length].id,values=[`${book}:${step}`];s=drawrelay.apply(s,id,step%2?{action:'stroke',values:[...values,stroke]}:{action:'draft',values,text:`secret-${book}-${step}`});return drawrelay.apply(s,id,{action:'submit',values});};
describe('independent Draw & Guess queue',()=>{
 it('accumulates two drawings and one guess while other albums progress independently',()=>{
  let s=drawrelay.create(players(6),1,{relayMode:'queue'});s=pass(s,0);s=pass(s,5);for(let k=0;k<3;k++)s=pass(s,3);for(let k=0;k<2;k++)s=pass(s,4);
  const v=drawrelay.view(s,'feedback_0');expect(v.board.tasks.map((t:{id:string})=>t.id)).toEqual(['3:3','4:2','5:1']);expect(v.board.tasks.map((t:{kind:string})=>t.kind)).toEqual(['drawing','text','drawing']);
  expect(s.books[1]).toHaveLength(0);expect(s.books[2]).toHaveLength(0);
  s=drawrelay.apply(s,'feedback_0',{action:'task',values:['4:2']});expect(drawrelay.view(s,'feedback_0').board.stage).toBe('guess');
  s=drawrelay.apply(s,'feedback_0',{action:'draft',values:['4:2'],text:'saved draft'});s=drawrelay.apply(s,'feedback_0',{action:'task',values:['5:1']});s=drawrelay.apply(s,'feedback_0',{action:'task',values:['4:2']});expect(drawrelay.view(s,'feedback_0').board.draft.text).toBe('saved draft');
  validateRelayState(JSON.parse(JSON.stringify(s)),90,'queue');expect(advanceRelayClock(s,999999)).toBe(s);expect(pauseRelayClock(s,999999)).toBe(s);
 });
 it('protects inactive predecessors and rejects stale, foreign, malformed commands atomically',()=>{
  let s=drawrelay.create(players(6),1,{relayMode:'queue'});s=pass(s,0);s=pass(s,5);for(let i=0;i<3;i++)s=pass(s,3);
  const v=drawrelay.view(s,'feedback_0');expect(v.board.previous.text).toBe('secret-3-2');expect(JSON.stringify(v)).not.toContain('secret-5-0');expect(JSON.stringify(drawrelay.view(s,'',true))).not.toContain('secret-');
  const before=JSON.stringify(s);for(const c of [{action:'draft',values:['0:0'],text:'stale'},{action:'submit',values:['1:0']},{action:'stroke',values:['3:3','bad']},{action:'task',values:['3:3','5:1']}])expect(()=>drawrelay.apply(s,'feedback_0',c)).toThrow();expect(JSON.stringify(s)).toBe(before);
 });
 it('completes each album with alternating authors and reveals only after every album finishes',()=>{
  let s=drawrelay.create(players(4),2,{relayMode:'queue'});for(let b=0;b<4;b++)for(let step=0;step<4;step++){s=pass(s,b);if(b<3||step<3)expect(drawrelay.view(s,'feedback_0').board.gallery).toBeUndefined();validateRelayState(s,90,'queue');}
  expect(s.finished).toBe(true);for(let b=0;b<4;b++)expect(s.books[b].map(e=>e.author)).toEqual(Array.from({length:4},(_,step)=>`feedback_${(b+step)%4}`));expect(drawrelay.view(s,'feedback_0').board.gallery).toBeDefined();
 });
 it('keeps independent actor revisions and deduplicates retransmitted drafts',()=>{const ps=players(3);let m=createMatch('drawrelay',ps,{relayMode:'queue'});const revision=m.actorRevisions[ps[1].id];m=applyMatch(m,'drawrelay',ps,ps[0].id,{action:'draft',values:['0:0'],text:'first'},'draft0',m.actorRevisions[ps[0].id]);expect(m.actorRevisions[ps[1].id]).toBe(revision);m=applyMatch(m,'drawrelay',ps,ps[1].id,{action:'draft',values:['1:0'],text:'second'},'draft1',revision);expect(applyMatch(m,'drawrelay',ps,ps[1].id,{action:'draft',values:['1:0'],text:'second'},'draft1',revision)).toBe(m);});
});
describe('drawing tools and personal notes',()=>{
 it('supports new widths, eraser strokes and undo, while accepting legacy stroke colors',()=>{
  const ps=players(3);let s=drawguess.create(ps,1);s=drawguess.apply(s,ps[0].id,{action:'choose',values:[s.choices[0].id]});
  for(const width of [4,9,18,30,48])s=drawguess.apply(s,ps[0].id,{action:'stroke',values:['10,10','20,20'],text:`#ffffff:${width}`});
  expect(s.strokes.map(c=>c.width)).toEqual([4,9,18,30,48]);s=drawguess.apply(s,ps[0].id,{action:'undo',values:[]});expect(s.strokes).toHaveLength(4);
  s=drawguess.apply(s,ps[0].id,{action:'stroke',values:['10,10','10,10'],text:'#123456'});expect(s.strokes.at(-1)?.color).toBe('#123456');const before=structuredClone(s);expect(()=>drawguess.apply(s,ps[0].id,{action:'stroke',values:['10,10'],text:'#ffffff:1000'})).toThrow();expect(s).toEqual(before);
 });
 it('cycles notes on first use, restores them, and sends them only to their owner',()=>{
  let s=codenames.create(players(6),1);const actor=s.players[2].id,card=s.cards[0].id,turn=s.turn;
  for(const mark of [1,2,undefined]){s=codenames.apply(s,actor,{action:'mark',values:[card]});s=JSON.parse(JSON.stringify(s));expect(codenames.view(s,actor).board.marks[card]).toBe(mark);for(const p of s.players.filter(p=>p.id!==actor))expect(codenames.view(s,p.id).board.marks).toEqual({});expect(codenames.view(s,'',true).board.marks).toEqual({});expect(s.turn).toBe(turn);expect(s.guesses).toBe(0);}
  expect(()=>codenames.apply(s,s.captains[0],{action:'mark',values:[card]})).toThrow();s.cards[0].revealed=true;expect(()=>codenames.apply(s,actor,{action:'mark',values:[card]})).toThrow();
 });
});
