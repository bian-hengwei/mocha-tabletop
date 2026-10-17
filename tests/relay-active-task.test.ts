import {describe,it,expect} from 'vitest';
import {drawrelay,encodeRelayStroke,validateRelayState,type DrawRelayState} from '../src/core/games/drawrelay';
const players=(count:number)=>Array.from({length:count},(_,i)=>({id:`player_${i}`,name:`Person ${i}`,avatar:'🦊'}));
const stroke=encodeRelayStroke([[120,600],[500,120],[880,600]],3,2);
function pass(state:DrawRelayState,book:number){
 const step=state.books[book].length,id=state.players[(book+step)%state.players.length].id,values=[`${book}:${step}`];
 const s=drawrelay.apply(state,id,step%2?{action:'stroke',values:[...values,stroke]}:{action:'draft',values,text:`Opening ${book}`});
 return drawrelay.apply(s,id,{action:'submit',values});
}
describe('relay active task stability',()=>{
 it.each([3,6,12])('keeps the initial %i-player task when an earlier album arrives, including legacy checkpoints',count=>{
  let s=drawrelay.create(players(count),1,{relayMode:'queue'});
  // Existing checkpoints may omit every effective selection until the first task switch.
  s.queue!.selected={};const before=structuredClone(s);
  expect(drawrelay.view(s,'player_1').board.taskID).toBe('1:0');
  s=pass(s,0);
  expect(before.queue!.selected).toEqual({});
  expect(drawrelay.view(s,'player_1').board.tasks.map((task:{id:string})=>task.id)).toEqual(['0:1','1:0']);
  expect(drawrelay.view(s,'player_1').board.taskID).toBe('1:0');
  expect(drawrelay.view(s,'player_1').board.previous).toBeUndefined();
  s=JSON.parse(JSON.stringify(s));validateRelayState(s,90,'queue');
  expect(drawrelay.view(s,'player_1').board.taskID).toBe('1:0');
  s=drawrelay.apply(s,'player_1',{action:'draft',values:['1:0'],text:'My unswitched draft'});
  s=drawrelay.apply(s,'player_1',{action:'submit',values:['1:0']});
  expect(drawrelay.view(s,'player_1').board.taskID).toBe('0:1');
  expect(drawrelay.view(s,'player_1').board.previous.text).toBe('Opening 0');
 });
 it('preserves drawing selection, explicit switches and separate drafts through arrivals and reload',()=>{
  let s=drawrelay.create(players(6),1,{relayMode:'queue'});
  s=pass(s,3);s=pass(s,2);s=pass(s,2); // player 4 now owns drawing 3:1 and guess 2:2, plus 4:0.
  s=drawrelay.apply(s,'player_4',{action:'task',values:['3:1']});
  s=drawrelay.apply(s,'player_4',{action:'stroke',values:['3:1',stroke]});
  for(let i=0;i<4;i++)s=pass(s,0); // a lower-numbered guess arrives while the drawing is active.
  s=JSON.parse(JSON.stringify(s));validateRelayState(s,90,'queue');
  expect(drawrelay.view(s,'player_4').board.taskID).toBe('3:1');
  expect(drawrelay.view(s,'player_4').board.draft.strokes).toEqual([stroke]);
  s=drawrelay.apply(s,'player_4',{action:'task',values:['0:4']});
  s=drawrelay.apply(s,'player_4',{action:'draft',values:['0:4'],text:'Independent guess'});
  s=drawrelay.apply(s,'player_4',{action:'task',values:['3:1']});
  expect(drawrelay.view(s,'player_4').board.draft.strokes).toEqual([stroke]);
  s=drawrelay.apply(s,'player_4',{action:'submit',values:['3:1']});
  expect(drawrelay.view(s,'player_4').board.taskID).toBe('0:4');
  expect(drawrelay.view(s,'player_4').board.draft.text).toBe('Independent guess');
  expect(()=>drawrelay.apply(s,'player_4',{action:'stroke',values:['3:1',stroke]})).toThrow('接龙已换页');
  expect(JSON.stringify(drawrelay.view(s,'',true))).not.toContain('Independent guess');
 });
 it('selects an arriving task only when the recipient has no pending task',()=>{
  let s=drawrelay.create(players(3),1,{relayMode:'queue'});s=pass(s,1);
  expect(drawrelay.view(s,'player_1').board.draft).toBeUndefined();
  s=pass(s,0);
  expect(drawrelay.view(s,'player_1').board.taskID).toBe('0:1');
  expect(s.queue!.selected.player_1).toBe(0);
 });
});
