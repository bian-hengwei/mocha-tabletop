import {describe,it,expect} from 'vitest';
import {mahjong,type MahjongMode,type MahjongAssistance,type MahjongState} from '../src/core/games/mahjong';
const players=['a','b','c','d'].map(id=>({id,name:id,avatar:'🐶'}));
const tiles=(values:number[],prefix='own')=>values.map((value,i)=>({id:`${prefix}-${i}`,value}));
// 123/456 characters, 123/456 dots and a lone 7 characters: waits on 1/4/7 characters.
const waiting=[0,1,2,3,4,5,9,10,11,12,13,14,6];
function setup(mode:MahjongMode='guangdong'){
 const s=mahjong.create(players,11,{mahjongMode:mode});s.phase='discard';s.current=1;s.missing={0:2,1:2,2:2,3:2};s.hands[0]=tiles(waiting);s.melds=[[],[],[],[]];s.discards=[[],[],[],[]];s.wins=[];return s;
}
const assist=(s:MahjongState,i=0)=>mahjong.view(s,players[i].id).board.assistance as MahjongAssistance|null;
describe('private Mahjong assistance',()=>{
 it.each(['guangdong','sichuan','bloodflow','laizi'] as const)('finds independent expected waits in %s',mode=>{
  const s=setup(mode),before=structuredClone(s),result=assist(s)!;
  expect(result.waits.filter(w=>w.value!==33)).toEqual([0,3,6].map(value=>({value,unseen:3,discardMultiplier:1,selfDrawMultiplier:2})));
  expect(result.discards).toEqual([]);expect(s).toEqual(before);
  if(mode==='laizi')expect(result.waits.find(w=>w.value===33)).toEqual({value:33,unseen:4,discardMultiplier:null,selfDrawMultiplier:2});
 });
 it('deduplicates public records, counts own concealed kongs, and keeps exhausted waits',()=>{
  const s=setup(),publicTile={id:'public',value:6};s.discards[1]=[publicTile,...tiles([6,6],'river')];s.pending={tile:publicTile,from:1,responses:{}};
  s.wins=[{player:2,from:1,tile:publicTile,points:1,selfDraw:false},{player:3,from:1,tile:publicTile,points:1,selfDraw:false}];
  expect(assist(s)!.waits.find(w=>w.value===6)!.unseen).toBe(0);
  s.hands[0]=tiles([0,1,2,3,4,5,6,6,6,9]);s.melds[0]=[{type:'concealed',from:0,tiles:tiles([9,9,9,9],'kong')}];
  expect(assist(s)!.waits.some(w=>w.value===9)).toBe(false);
 });
 it('does not use wall, opponents’ hands or concealed kong identities',()=>{
  const s=setup();s.melds[2]=[{type:'concealed',from:2,tiles:tiles([6,6,6,6],'secret')}];const baseline=assist(s);
  s.wall=tiles([0,0,0,0],'wall');s.hands[1]=tiles([6,6,6,6],'secret-hand');s.melds[2][0].tiles=tiles([3,3,3,3],'other-secret');
  expect(assist(s)).toEqual(baseline);expect(JSON.stringify(mahjong.view(s,'a'))).not.toContain('secret');
  expect(mahjong.view(s,'outsider').board.assistance).toBeUndefined();
 });
 it('previews only legal discards and counts the discarded tile as seen',()=>{
  const s=setup('sichuan');s.current=0;s.hands[0].push({id:'drawn',value:26});s.drawn='drawn';
  const result=assist(s)!;expect(result.waits).toEqual([]);expect(result.discards.map(d=>d.tile.id)).toEqual(['drawn']);expect(result.discards[0].waits.map(w=>w.value)).toEqual([0,3,6]);
  s.mode='guangdong';s.hands[0]=tiles([...waiting,6]);s.drawn='own-13';
  expect(assist(s)!.discards.find(d=>d.tile.id==='own-13')!.waits.find(w=>w.value===6)!.unseen).toBe(2);
 });
 it('estimates table multipliers for pure seven pairs and agrees with actual settlement',()=>{
  const s=setup();s.hands[0]=tiles([0,0,2,2,4,4,6,6,7,7,8,8,1]);const wait=assist(s)!.waits.find(w=>w.value===1)!;
  expect(wait.discardMultiplier).toBe(8);expect(wait.selfDrawMultiplier).toBe(16);
  s.hands[0].push({id:'drawn',value:1});s.drawn='drawn';s.current=0;s.afterKong=true;
  expect(assist(s)!.currentWin).toEqual({multiplier:32,selfDraw:true});
  const won=mahjong.apply(s,'a',{action:'hu',values:[]});expect(won.wins.at(-1)!.points).toBe(32);
 });
 it('respects setup phases, missing suits, eliminated players and Blood Flow lock',()=>{
  const s=setup('sichuan');s.missing[0]=0;expect(assist(s)!.waits).toEqual([]);
  s.phase='exchange';expect(assist(s)).toBeNull();s.phase='que';expect(assist(s)).toBeNull();s.phase='discard';s.won=[0];expect(assist(s)).toBeNull();
  s.mode='bloodflow';s.missing[0]=2;s.current=0;s.hands[0].push({id:'drawn',value:6});s.drawn='drawn';s.selfWon=true;
  expect(assist(s)!.discards.map(d=>d.tile.id)).toEqual(['drawn']);expect(assist(s)!.currentWin).toBeNull();
  s.finished=true;expect(assist(s)).toBeNull();
 });
 it('supports meld hands and rob-kong scoring',()=>{
  const s=setup();s.hands[0]=tiles([0,1,2,3,4,5,9,10,11,6]);s.melds[0]=[{type:'pong',from:2,tiles:tiles([15,15,15],'meld')}];
  expect(assist(s)!.waits.map(w=>w.value)).toEqual([0,3,6]);s.phase='respond';s.pending={tile:{id:'added',value:6},from:1,rob:0,responses:{}};
  expect(assist(s)!.currentWin).toEqual({multiplier:2,selfDraw:false});
 });
});
