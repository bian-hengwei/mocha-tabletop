import {beforeEach,expect,it} from 'vitest';
import {makeRecord,saveRecord,readHistory,deleteRecord,readProfile} from '../src/local/storage';
import type {GameView,Player} from '../src/core/types';
import { standardWerewolf } from '../src/core/games/werewolf';
const entries=new Map<string,string>();
const storage={getItem:(k:string)=>entries.get(k)||null,setItem:(k:string,v:string)=>entries.set(k,v),removeItem:(k:string)=>entries.delete(k)};
const player:Player={id:'player-0001',name:'小猫',avatar:'🐱'};
const view=(board:Record<string,any>,kind:GameView['kind']='gems'):GameView=>({kind,phase:'结束',instruction:'本局结束',finished:true,actions:[],sections:[],log:[],board});
beforeEach(()=>{entries.clear();Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});});
it('migrates existing profile and safely ignores invalid storage',()=>{storage.setItem('mocha-profile',JSON.stringify(player));expect(readProfile()).toEqual(player);storage.setItem('mocha-profile','{broken');expect(readProfile()).toBeNull();storage.setItem('mocha-history-v1','[bad');expect(readHistory()).toEqual([]);});
it('records only a finished personal result and no secret hand',()=>{const v=view({winners:[player.id],players:[{...player,score:17}],hand:['secret']});const record=makeRecord(v,'match-a',player.id,player,'cloud')!;expect(record.result).toBe('win');expect(record.score).toBe(17);expect(JSON.stringify(record)).not.toContain('secret');expect(makeRecord({...v,finished:false},'x',player.id,player,'cloud')).toBeNull();});
it('deduplicates completion across refresh and keeps deletions deleted',()=>{const record=makeRecord(view({winners:[player.id]}),'match-a',player.id,player,'cloud')!;expect(saveRecord(record)).toBe(true);expect(saveRecord(record)).toBe(false);expect(readHistory()).toHaveLength(1);deleteRecord(record.id);expect(readHistory()).toEqual([]);expect(saveRecord(record)).toBe(false);expect(saveRecord({...record,id:'match-b'})).toBe(true);deleteRecord();expect(readHistory()).toEqual([]);expect(saveRecord({...record,id:'match-b'})).toBe(false);});
it('handles teams, shared winners, and moderator records',()=>{expect(makeRecord(view({winner:'邪恶获胜 · 梅林被刺杀',ownRole:'梅林'},'avalon'),'a',player.id,player,'cloud')?.result).toBe('loss');expect(makeRecord(view({winner:'狼人获胜 · 屠边成功',ownRole:'狼人'},'werewolf'),'b',player.id,player,'cloud')?.result).toBe('win');expect(makeRecord(view({isModerator:true,winner:'好人获胜'},'werewolf'),'c',player.id,player,'cloud')?.result).toBe('host');expect(makeRecord(view({winners:[player.id,'other']}),'d',player.id,player,'cloud')?.result).toBe('draw');});
it('reports storage failures rather than claiming success',()=>{Object.defineProperty(globalThis,'localStorage',{value:{...storage,setItem:()=>{throw Error('quota');}},configurable:true});expect(()=>saveRecord(makeRecord(view({}),'a',player.id,player,'cloud')!)).toThrow('quota');});

it('records a shared team victory as a win rather than a draw',()=>{for(const kind of ['codenames','undercover'] as const)expect(makeRecord(view({winners:[player.id,'teammate']},kind),'team',player.id,player,'cloud')?.result).toBe('win');});

it('records Wolf King team results correctly for current views and legacy views without role keys',()=>{
 const roster=Array.from({length:12},(_,i)=>({...player,id:`history-wolf-${i}`,name:`玩家${i}`}));
 for(const preset of ['wolfKing','idiot'] as const){
  const game=standardWerewolf.create(roster,51,{werewolfPreset:preset});
  for(const wolfVictory of [true,false]){
   game.winner=wolfVictory?'狼人获胜 · 屠边成功':'好人获胜 · 狼人全部出局';
   for(const p of roster){
    const v=standardWerewolf.view(game,p.id),wolfTeam=game.roles[p.id]==='wolf'||game.roles[p.id]==='wolfKing';
    for(const legacy of [false,true]){
     const terminal=structuredClone(v);if(legacy)delete terminal.board.ownRoleKey;
     const record=makeRecord(terminal,`${preset}-${wolfVictory}-${p.id}-${legacy}`,p.id,p,'cloud')!;
     expect(record.result).toBe(wolfTeam===wolfVictory?'win':'loss');
     expect(saveRecord(record)).toBe(true);
     expect(readHistory()[0].result).toBe(record.result);
     expect(Object.keys(record)).not.toContain('roles');
    }
   }
  }
 }
});
