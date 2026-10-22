import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {guandan,type PokerState} from '../src/core/games/poker';
import type {Player} from '../src/core/types';

const players:Player[]=Array.from({length:4},(_,i)=>({id:`a-player-${i}`,name:`Player ${i}`,avatar:'🐶'}));
const trace=JSON.parse(readFileSync(new URL('./fixtures/guandan-seed2-actual-a-loss.json',import.meta.url),'utf8')) as {
  command:{action:'play';values:string[]};before:PokerState;
};

function assertCards(s:PokerState){
  const all=[...s.hands.flat(),...s.played,...s.bottom];
  expect(all).toHaveLength(108);expect(new Set(all.map(c=>c.id)).size).toBe(108);
}

function boundary(level:number,levels:[number,number],order:number[],finalSeat=2){
  const s=guandan.create(players,4);s.level=level;s.levels=[...levels];s.order=[...order];s.current=finalSeat;s.phase='play';s.last=null;
  for(let i=0;i<4;i++){if(i===finalSeat)continue;s.played.push(...s.hands[i]);s.hands[i]=[];}
  const final=s.hands[finalSeat][0];s.played.push(...s.hands[finalSeat].slice(1));s.hands[finalSeat]=[final];assertCards(s);
  return {s,final};
}

describe('Guan Dan actual A finish',()=>{
  it('replays the legal seed-2 trace into round end at level A instead of finishing on level 10',()=>{
    const before=structuredClone(trace.before);expect(before.level).toBe(10);expect(before.levels).toEqual([14,10]);expect(before.order).toEqual([0,1]);assertCards(before);
    const after=guandan.apply(before,before.players[before.current].id,trace.command);
    expect(after.finished).toBe(false);expect(after.phase).toBe('roundEnd');expect(after.level).toBe(14);expect(after.levels).toEqual([14,10]);expect(after.order).toEqual([0,1,2,3]);expect(after.previousOrder).toEqual([0,1,2,3]);expect(after.history.at(-1)).toBe('升级 +2');assertCards(after);
    const restored=JSON.parse(JSON.stringify(after)) as PokerState;expect(guandan.view(restored,restored.players[restored.current].id).finished).toBe(false);expect(guandan.view(restored,restored.players[restored.current].id).actions.map(a=>a.id)).toEqual(['nextRound']);
  });

  it('requires actual A, keeps a sub-A current deal unsettled and restores next deal to the team A',()=>{
    const {s,final}=boundary(10,[14,10],[0]);const after=guandan.apply(s,players[2].id,{action:'play',values:[final.id]});
    expect(after.finished).toBe(false);expect(after.phase).toBe('roundEnd');expect(after.levels).toEqual([14,10]);expect(after.level).toBe(14);
  });

  it('finishes on a currently played A when the winner is first and partner is not last',()=>{
    const {s,final}=boundary(14,[14,10],[0]);const after=guandan.apply(s,players[2].id,{action:'play',values:[final.id]});
    expect(after.finished).toBe(true);expect(after.winners).toEqual([players[0].id,players[2].id]);expect(after.level).toBe(14);
  });

  it('does not finish a stored-A team while playing the opponent A without its own A stored',()=>{
    const {s,final}=boundary(14,[13,14],[0]);const after=guandan.apply(s,players[2].id,{action:'play',values:[final.id]});
    expect(after.finished).toBe(false);expect(after.phase).toBe('roundEnd');expect(after.levels).toEqual([14,14]);expect(after.level).toBe(14);
  });

  it('does not finish an actual A when the partner finishes last',()=>{
    const {s,final}=boundary(14,[14,10],[0,1],3);const after=guandan.apply(s,players[3].id,{action:'play',values:[final.id]});
    expect(after.finished).toBe(false);expect(after.phase).toBe('roundEnd');expect(after.order).toEqual([0,1,3,2]);expect(after.levels).toEqual([14,10]);
  });

  it('caps advancement at A then deals and enters tribute at A',()=>{
    const {s,final}=boundary(10,[14,10],[0]);const roundEnd=guandan.apply(s,players[2].id,{action:'play',values:[final.id]});
    const next=guandan.apply(roundEnd,players[2].id,{action:'nextRound',values:[]});
    expect(next.finished).toBe(false);expect(next.round).toBe(roundEnd.round+1);expect(next.levels).toEqual([14,10]);expect(next.level).toBe(14);expect(['tribute','play']).toContain(next.phase);assertCards(next);
    if(next.phase==='tribute'){const actor=next.players[next.current].id;expect(guandan.view(next,actor).actions.map(a=>a.id)).toContain('return');}
  });
});
