import {describe,it,expect} from 'vitest';
import {werewolf} from '../src/core/games/werewolf';
import {werewolfHosted,type HostedWerewolfState} from '../src/core/games/werewolfHosted';
import type {Player} from '../src/core/types';
const players=(n:number):Player[]=>Array.from({length:n},(_,i)=>({id:`p${i}`,name:`玩家${i}`,avatar:'🦊'}));
const create=(n=12)=>werewolf.create(players(n+1),13,{werewolfMode:'judge',moderatorID:'p0'});
const act=(s:HostedWerewolfState,action:string,value:string)=>werewolf.apply(s,'p0',{action,values:[value]});
const find=(s:HostedWerewolfState,r:string)=>s.participants.find(p=>s.roles[p.id]===r)!.id;
function night(state:HostedWerewolfState,knife='skip',potion='skip',guard='skip'){
 let s=state;for(let i=0;i<5&&['guard','wolves','witch','seer'].includes(s.stage);i++){
  const a=werewolf.view(s,'p0').actions[0];s=act(s,a.id,s.stage==='guard'?guard:s.stage==='wolves'?knife:s.stage==='witch'?potion:'skip');
 }return s;
}
describe('moderator-led Werewolf',()=>{
 it('excludes judge from identities and accepts 6–18 actual players',()=>{
  for(let n=6;n<=18;n++){const s=create(n);expect(s.players).toHaveLength(n+1);expect(s.participants).toHaveLength(n);expect(s.roles.p0).toBeUndefined();expect(werewolf.view(s,'p0').board.ownRole).toBe('法官');expect(werewolf.view(s,'p0').board.players.every((p:any)=>p.role)).toBe(true);}
  expect(()=>werewolf.create(players(6),1,{werewolfMode:'judge',moderatorID:'p0'})).toThrow();expect(()=>werewolf.create(players(8),1,{werewolfMode:'judge',moderatorID:'missing'})).toThrow();
 });
 it('players only see themselves and cannot act, even if they copy judge actions',()=>{
  const s=create();for(const p of s.participants){const v=werewolf.view(s,p.id);expect(v.actions).toEqual([]);expect(v.board.players.filter((p:any)=>p.role)).toHaveLength(1);expect(v.board.moderatorOnly).toBeUndefined();expect(v.board.ownKnowledge).toHaveLength(1);const before=JSON.stringify(s);expect(()=>werewolf.apply(s,p.id,{action:'judge-guard',values:['skip']})).toThrow();expect(JSON.stringify(s)).toBe(before);}
 });
 it('night activity has identical player projections and first deaths wait for judge announcement',()=>{
  let s=create(),target=find(s,'villager');const baseline=s.participants.map(p=>werewolf.view(s,p.id));
  s=night(s,target);expect(s.stage).toBe('sheriff');expect(s.participants.map(p=>werewolf.view(s,p.id))).toEqual(baseline);expect(werewolf.view(s,'p0').board.moderatorOnly.pendingDeaths).toEqual([target]);s=act(s,'judge-sheriff','skip');expect(s.alive).toContain(target);s=act(s,'judge-dawn','confirm');expect(s.alive).not.toContain(target);expect(s.stage).toBe('day');
 });
 it('handles guard+save, guard repeat, and poisoned hunter',()=>{
  let s=create(),victim=find(s,'villager'),hunter=find(s,'hunter'),guard=find(s,'guard');s=night(s,victim,'save',victim);s=act(s,'judge-sheriff','skip');s=act(s,'judge-dawn','confirm');expect(s.alive).not.toContain(victim);expect(s.antidote).toBe(false);s=act(s,'judge-exile','skip');expect(s.stage).toBe('guard');expect(werewolf.view(s,'p0').actions[0].choices.some(c=>c.id===victim)).toBe(false);s=night(s,'skip','poison:'+hunter,guard);s=act(s,'judge-dawn','confirm');expect(s.stage).toBe('day');expect(s.alive).not.toContain(hunter);expect(s.hunterID).toBeNull();
 });
 it('hunter and badge remain judge-controlled',()=>{
  let s=create(),hunter=find(s,'hunter'),wolf=find(s,'wolf'),seer=find(s,'seer');s=night(s,hunter);s=act(s,'judge-sheriff',hunter);s=act(s,'judge-dawn','confirm');expect(s.stage).toBe('hunter');expect(werewolf.view(s,hunter).actions).toEqual([]);s=act(s,'judge-shoot',wolf);expect(s.stage).toBe('badge');s=act(s,'judge-badge',seer);expect(s.sheriff).toBe(seer);expect(s.stage).toBe('day');
 });
 it('supports double police-election explosions and still settles both nights',()=>{
  let s=create();const wolves=s.participants.filter(p=>s.roles[p.id]==='wolf').map(p=>p.id),villager=find(s,'villager');s=night(s,villager);s=act(s,'judge-election-explode',wolves[0]);expect(s.stage).toBe('dawn');s=act(s,'judge-dawn','confirm');expect(s.night).toBe(2);expect(s.alive).not.toContain(villager);s=night(s);expect(s.stage).toBe('sheriff');s=act(s,'judge-election-explode',wolves[1]);s=act(s,'judge-dawn','confirm');expect(s.night).toBe(3);s=night(s);expect(s.stage).toBe('dawn');expect(s.electionPending).toBe(false);
 });
 it('can finish every supported count entirely from judge operations',()=>{
  for(let n=6;n<=18;n++){let s=create(n);const wolves=s.participants.filter(p=>s.roles[p.id]==='wolf').map(p=>p.id);for(const wolf of wolves){s=night(s);if(s.stage==='sheriff')s=act(s,'judge-sheriff','skip');s=act(s,'judge-dawn','confirm');s=act(s,'judge-exile',wolf);s=JSON.parse(JSON.stringify(s));}expect(s.winner).toContain('好人获胜');for(const p of s.participants)expect(werewolf.view(s,p.id).board.players.filter((x:any)=>x.role)).toHaveLength(1);}
 });
});
describe('deal-only Werewolf',()=>{
 it('host plays but never receives extra identity information and redeals only with confirmation',()=>{
  let s=werewolf.create(players(9),23,{werewolfMode:'deal',moderatorID:'p0'});expect(s.participants).toHaveLength(9);expect(s.roles.p0).toBeTruthy();for(const p of s.players){const v=werewolf.view(s,p.id);expect(v.board.players.filter((x:any)=>x.role)).toHaveLength(1);expect(v.board.moderatorOnly).toBeUndefined();expect(v.actions.map(a=>a.id)).toEqual(p.id==='p0'?['redeal']:[]);}
  const before=JSON.stringify(s);expect(()=>werewolf.apply(s,'p0',{action:'redeal',values:[]})).toThrow();expect(()=>werewolf.apply(s,'p1',{action:'redeal',values:['confirm']})).toThrow();expect(JSON.stringify(s)).toBe(before);s=act(s,'redeal','confirm');expect(s.dealNumber).toBe(2);expect(s.roles).not.toEqual(JSON.parse(before).roles);expect(s.options.werewolfMode).toBe('deal');
 });
});
