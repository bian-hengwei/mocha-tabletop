import {describe, expect, it} from 'vitest';
import {avalon, type AvalonState} from '../src/core/games/avalon';
const players=Array.from({length:10},(_,i)=>({id:`p${i}`,name:`Player ${i+1}`,avatar:'🦊'}));
function approval(){const state=avalon.create(players,111);return avalon.apply(state,players[state.leader].id,{action:'propose',values:['p0','p1','p2']});}
function mission(){let state=approval();for(const p of players)state=avalon.apply(state,p.id,{action:'approve',values:['yes']});return state;}
const view=(state:AvalonState,id='p0')=>avalon.view(state,id);

describe('private Avalon submission receipts',()=>{
 it.each(['yes','no'])('confirms an accepted %s approval without displaying the choice',choice=>{
  const state=approval(),opponent=view(state,'p1'),observer=avalon.view(state,'',true);
  const next=avalon.apply(state,'p0',{action:'approve',values:[choice]});
  expect(view(next).instruction).toBe('表决已提交');expect(view(next).actions).toEqual([]);
  expect(view(next,'p1')).toEqual(opponent);expect(avalon.view(next,'',true)).toEqual(observer);
  expect(view(JSON.parse(JSON.stringify(next)))).toEqual(view(next));
 });
 it('only acknowledges a mission card for its sender, with identical text for either value',()=>{
  const state=mission(),evil=state.team.find(id=>['assassin','morgana','minion'].includes(state.roles[id]))!;
  expect(evil).toBeTruthy();const others=players.filter(p=>p.id!==evil).map(p=>view(state,p.id));
  for(const choice of ['success','fail']){
   const next=avalon.apply(state,evil,{action:'mission',values:[choice]});
   expect(view(next,evil).instruction).toBe('任务牌已提交');expect(view(next,evil).actions).toEqual([]);
   expect(players.filter(p=>p.id!==evil).map(p=>view(next,p.id))).toEqual(others);
   expect(avalon.view(next,'',true)).toEqual(avalon.view(state,'',true));
   expect(view(JSON.parse(JSON.stringify(next)),evil).instruction).toBe('任务牌已提交');
  }
 });
 it('never acknowledges a spectator or a non-team member',()=>{
  const state=mission(),next=avalon.apply(state,'p0',{action:'mission',values:['success']});
  expect(view(next,'p9').instruction).toBe('等待其他玩家');expect(view(next,'p9').actions).toEqual([]);
  expect(avalon.view(next,'',true).instruction).toBe('等待其他玩家');
 });
 it('clears approval receipts when the team is approved and mission receipts after resolution',()=>{
  let state=approval();for(const p of players)state=avalon.apply(state,p.id,{action:'approve',values:['yes']});
  expect(state.stage).toBe('mission');expect(view(state).instruction).toBe('轮到你了');
  for(const id of state.team)state=avalon.apply(state,id,{action:'mission',values:['success']});
  expect(state.stage).toBe('propose');expect(players.every(p=>!view(state,p.id).instruction.includes('已提交'))).toBe(true);
 });
 it('clears receipts after rejection, terminal fifth rejection and a newly dealt game',()=>{
  let state=approval();for(const p of players)state=avalon.apply(state,p.id,{action:'approve',values:['no']});
  expect(state.stage).toBe('propose');expect(view(state).instruction).not.toContain('已提交');
  state.rejections=4;state=avalon.apply(state,players[state.leader].id,{action:'propose',values:['p0','p1','p2']});
  for(const p of players)state=avalon.apply(state,p.id,{action:'approve',values:['no']});
  expect(state.winner).toBeTruthy();expect(view(state).instruction).toBe('本局结束');
  expect(view(avalon.create(players,222)).instruction).not.toContain('已提交');
 });
});
