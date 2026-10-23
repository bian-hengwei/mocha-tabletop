import {describe, expect, it} from 'vitest';
import {codenames} from '../src/core/games/codenames';
import {createMatch, normalizeGameOptions, optionsKey, validateMatchForRoom, type RoomInfo} from '../src/core/room';
import type {Player} from '../src/core/types';

const players=(n:number):Player[]=>Array.from({length:n},(_,i)=>({id:`random-team-${i}`,name:`Player ${i}`,avatar:'🦊'}));
const room=(players:Player[],options:ReturnType<typeof normalizeGameOptions>):RoomInfo=>({
 code:'RANDOM',kind:'codenames',mode:'cloud',hostID:players[0].id,options,
 players:players.map(p=>({...p,ready:true,connected:true})),pending:[],started:true,revision:1
});

describe('Codenames random teams and captains',()=>{
 it('keeps the default seat-alternating setup and first captains unchanged',()=>{
  const roster=players(7),s=codenames.create(roster,42);
  expect(s.teams).toEqual(['red','blue','red','blue','red','blue','red']);
  expect(s.captains).toEqual([roster[0].id,roster[1].id]);
  expect(s.history).toContain('按座位交替分红蓝队，每队首位玩家担任队长。');
 });

 it('reproduces random assignments from one seed and balances every supported player count',()=>{
  for(const count of [4,5,6,7,8,9,10,11,12]){
   const roster=players(count),a=codenames.create(roster,1971,{codenamesRandomTeams:true}),b=codenames.create(roster,1971,{codenamesRandomTeams:true});
   expect(b).toEqual(a);
   const redCount=a.teams.filter(team=>team==='red').length;
   expect(redCount).toBe(Math.ceil(count/2));
   expect(a.teams).toHaveLength(count);
   expect(new Set(a.teams).size).toBe(2);
   expect(a.captains).toHaveLength(2);
   expect(new Set(a.captains).size).toBe(2);
   for(const captainID of a.captains){
    const index=roster.findIndex(p=>p.id===captainID);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(a.teams[index]).toBe(captainID===a.captains[0]?'red':'blue');
   }
  }
 });

 it('preserves player order and IDs while keeping identities private from operatives',()=>{
  const roster=players(9),s=codenames.create(roster,43,{codenamesRandomTeams:true});
  expect(s.players.map(p=>p.id)).toEqual(roster.map(p=>p.id));
  for(const p of roster){
   const view=codenames.view(s,p.id);
   for(const card of view.board.cards)expect(Object.hasOwn(card,'identity')).toBe(s.captains.includes(p.id));
  }
  expect(codenames.view(s,'spectator',true).board.cards.every((card:{identity?:unknown})=>!Object.hasOwn(card,'identity'))).toBe(true);
 });

 it('varies teams and captains across seeds without changing the word deal',()=>{
  const roster=players(7),assignments=new Set(),captains=new Set();
  for(const seed of [1,2,3,4,5,6,7,8]){
   const random=codenames.create(roster,seed,{codenamesRandomTeams:true});
   expect(random.cards).toEqual(codenames.create(roster,seed).cards);
   assignments.add(JSON.stringify(random.teams));captains.add(JSON.stringify(random.captains));
  }
  expect(assignments.size).toBeGreaterThan(1);expect(captains.size).toBeGreaterThan(1);
 });

 it('does not reassign teams or captains while a match runs',()=>{
  const roster=players(8),s=codenames.create(roster,77,{codenamesRandomTeams:true});
  const captainID=s.players.find((_,i)=>s.teams[i]===s.turn&&s.captains.includes(roster[i].id))!.id;
  const next=codenames.apply(s,captainID,{action:'clue',values:['1'],text:'Trail'});
  expect(next.teams).toEqual(s.teams);
  expect(next.captains).toEqual(s.captains);
  expect(next.players.map(p=>p.id)).toEqual(roster.map(p=>p.id));
 });
});

describe('random-team room checkpoints',()=>{
 it('normalizes the option only for Codenames and changes its room option key',()=>{
  expect(normalizeGameOptions('codenames',{},players(4)[0].id)).toBeUndefined();
  expect(normalizeGameOptions('codenames',{codenamesRandomTeams:false},players(4)[0].id)).toBeUndefined();
  expect(normalizeGameOptions('codenames',{codenamesRandomTeams:true},players(4)[0].id)).toEqual({codenamesRandomTeams:true});
  expect(optionsKey('codenames',{},players(4)[0].id)).not.toBe(optionsKey('codenames',{codenamesRandomTeams:true},players(4)[0].id));
  expect(()=>normalizeGameOptions('gems',{codenamesRandomTeams:true},players(4)[0].id)).toThrow();
  for(const value of ['true',1,null,[]])expect(()=>normalizeGameOptions('codenames',{codenamesRandomTeams:value},players(4)[0].id)).toThrow();
 });

 it('retains random-team checkpoints through recovery and rejects tampered assignments',()=>{
  const roster=players(9),options=normalizeGameOptions('codenames',{codenamesRandomTeams:true},roster[0].id),r=room(roster,options),match=createMatch('codenames',roster,options);
  const recovered=validateMatchForRoom(JSON.parse(JSON.stringify(match)),r);
  expect(recovered.game.teams).toEqual(match.game.teams);
  expect(recovered.game.captains).toEqual(match.game.captains);
  const badTeams=structuredClone(match);
  badTeams.game.teams.fill('blue');
  expect(()=>validateMatchForRoom(badTeams,r)).toThrow('随机分队');
  for(const teams of [null,{},['red'],match.game.teams.map((team:string)=>team==='blue'?'neutral':team)]){
   const malformed=structuredClone(match);malformed.game.teams=teams;
   expect(()=>validateMatchForRoom(malformed,r)).toThrow('随机分队');
  }
  const badCaptains=structuredClone(match);badCaptains.game.captains[0]='missing-player';
  expect(()=>validateMatchForRoom(badCaptains,r)).toThrow('随机队长');
 });
});
