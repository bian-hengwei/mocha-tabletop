import {describe,it,expect} from 'vitest';
import {mahjong,type MahjongMode,type MahjongState} from '../src/core/games/mahjong';
const players=['a','b','c','d'].map(id=>({id,name:id,avatar:'🐶'}));
const waiting=[0,1,2,3,4,5,9,10,11,12,13,14,6];
const hand=(values:number[],prefix:string)=>values.map((value,i)=>({id:`${prefix}${i}`,value}));
function setup(mode:MahjongMode='guangdong'){
 const s=mahjong.create(players,77,{mahjongMode:mode});s.phase='discard';s.missing={0:2,1:2,2:2,3:2};
 s.hands=[hand([...waiting,26],'a'),...['b','c','d'].map(p=>hand(waiting,p))];s.drawn='a13';return s;
}
const act=(s:MahjongState,i:number,action:string,values:string[]=[])=>mahjong.apply(s,players[i].id,{action,values});
describe('Mahjong automatic forced passes',()=>{
 it.each(['guangdong','sichuan','bloodflow','laizi'] as const)('advances %s with one draw and no manual pass',mode=>{
  const s=setup(mode),before=structuredClone(s),next=act(s,0,'discard',['a13']);
  expect(s).toEqual(before);expect(next.pending).toBeNull();expect(next.phase).toBe('discard');expect(next.current).toBe(1);
  expect(next.wall).toHaveLength(s.wall.length-1);expect(next.hands[1]).toHaveLength(14);expect(next.turn).toBe(s.turn+1);
  expect(next.discards[0]).toEqual([{id:'a13',value:26}]);expect(players.flatMap(p=>mahjong.view(next,p.id).actions).some(a=>a.id==='pass')).toBe(false);
 });
 it('waits only for a real pung/kong choice, then passes immediately when declined',()=>{
  const s=setup();s.hands[1]=hand([26,26,26,0,1,2,3,4,5,9,10,11,12],'b');
  let next=act(s,0,'discard',['a13']);expect(next.phase).toBe('respond');expect(next.wall).toEqual(s.wall);
  expect(mahjong.view(next,'b').actions.map(a=>a.id)).toEqual(['pass','pong','kong']);
  expect(mahjong.view(next,'c').actions).toEqual([]);expect(mahjong.view(next,'d').actions).toEqual([]);
  expect(mahjong.view(next,'a').board.pending.responses).toBeUndefined();
  next=act(next,1,'pass');expect(next.current).toBe(1);expect(next.wall).toHaveLength(s.wall.length-1);
 });
 it('keeps every simultaneous win decision and never auto-declines one',()=>{
  let s=setup();s.hands[0][13].value=6;s.hands[3]=hand([6,6,0,1,2,9,10,11,18,19,20,27,28],'d');
  s=act(s,0,'discard',['a13']);s=act(s,3,'pong');expect(s.phase).toBe('respond');
  s=act(s,1,'hu');expect(s.finished).toBe(false);s=act(s,2,'hu');
  expect(s.wins.map(w=>w.player)).toEqual([1,2]);expect(s.melds[3]).toEqual([]);
 });
 it('skips illegal missing-suit claims and locked-hand pungs',()=>{
  for(const mode of ['sichuan','bloodflow'] as const){const s=setup(mode);s.hands[1]=hand([26,26,...waiting.slice(0,11)],'b');
   const next=act(s,0,'discard',['a13']);expect(next.phase).toBe('discard');expect(next.current).toBe(1);
  }
  const s=setup('bloodflow');s.won=[1];s.hands[0][13].value=8;s.hands[1]=hand([8,8,0,1,2,3,4,9,10,11,12,13,14],'b');
  expect(act(s,0,'discard',['a13']).phase).toBe('discard');
 });
 it('completes an unopposed added kong without response clicks',()=>{
  const s=setup();s.hands[0]=hand([26,0,1,2,3,4,5,9,10,11,12],'a');s.drawn='a10';
  s.melds[0]=[{type:'pong',from:2,tiles:hand([26,26,26],'meld')}];
  const next=act(s,0,'added:26',['26']);expect(next.pending).toBeNull();expect(next.current).toBe(0);
  expect(next.melds[0][0].type).toBe('kong');expect(next.wall).toHaveLength(s.wall.length-1);expect(next.scores).toEqual([3,-1,-1,-1]);
 });
 it('settles an exhausted wall instead of leaving a forced-pass window',()=>{
  const s=setup();s.wall=[];const next=act(s,0,'discard',['a13']);expect(next.finished).toBe(true);expect(next.pending).toBeNull();
 });
 it('preserves old saved response windows and settles after one valid pass',()=>{
  const s=setup();const tile=s.hands[0].pop()!;s.discards[0]=[tile];s.pending={tile,from:0,responses:{}};s.phase='respond';
  const restored=JSON.parse(JSON.stringify(s));expect(mahjong.view(restored,'b').actions.map(a=>a.id)).toEqual(['pass']);
  const next=act(restored,1,'pass');expect(next.phase).toBe('discard');expect(next.current).toBe(1);expect(next.pending).toBeNull();
 });
});
