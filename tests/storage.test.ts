import {beforeEach,expect,it} from 'vitest';
import {makeRecord,saveRecord,readHistory,deleteRecord,readProfile} from '../src/local/storage';
import type {GameView,Player} from '../src/core/types';
import { standardWerewolf } from '../src/core/games/werewolf';
import {drawguess,advanceDrawGuessClock} from '../src/core/games/drawguess';
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

it('records legal DrawGuess winners, other participants and shared highest scores',()=>{
 const scenarios=[
  {guessers:[1,0,0],scores:[5,3,1],results:['win','loss','loss']},
  {guessers:[1,2,1],scores:[1,5,3],results:['loss','win','loss']},
  {guessers:[1,2,0],scores:[3,3,3],results:['draw','draw','draw']},
  {guessers:[1,0,0,1],scores:[5,5,1,1],results:['draw','draw','loss','loss']}
 ];
 for(const [index,scenario] of scenarios.entries()){
  const roster=scenario.guessers.map((_,i)=>({...player,id:`history-draw-${i}`}));
  let game=drawguess.create(roster,17,{language:'en',drawRounds:1});
  for(const guesser of scenario.guessers){
   const drawer=roster[game.drawer].id,choice=drawguess.view(game,drawer).actions[0].choices[0];
   game=drawguess.apply(game,drawer,{action:'choose',values:[choice.id]});
   game=drawguess.apply(game,roster[guesser].id,{action:'guess',values:[],text:choice.title});
   game=advanceDrawGuessClock(game,100);game=advanceDrawGuessClock(game,game.revealUntil+1);
  }
  expect(game.finished).toBe(true);expect(game.scores).toEqual(scenario.scores);
  for(const [seat,p] of roster.entries()){
   const terminal=drawguess.view(game,p.id),record=makeRecord(terminal,`draw-${index}-${seat}`,p.id,p,'cloud')!;
   expect(record.result).toBe(scenario.results[seat]);expect(record.score).toBe(scenario.scores[seat]);
   expect(record.playerCount).toBe(roster.length);expect(JSON.stringify(record)).not.toContain('answer');
   expect(saveRecord(record)).toBe(true);expect(saveRecord(record)).toBe(false);
   deleteRecord(record.id);expect(saveRecord(record)).toBe(false);
  }
  expect(makeRecord(drawguess.view(game,'not-a-participant'),`draw-${index}-outsider`,'not-a-participant',player,'lan')?.result).toBe('completed');
 }
});

it('does not infer DrawGuess results from missing winners or an absent participant',()=>{
 const roster=[player,{...player,id:'history-draw-other'}];
 for(const winnerIDs of [undefined,[],['history-draw-other']])expect(makeRecord(view({players:[],winnerIDs,winners:[player.id]},'drawguess'),'absent',player.id,player,'practice')?.result).toBe('completed');
 for(const winnerIDs of [undefined,[]])expect(makeRecord(view({players:roster,winnerIDs},'drawguess'),'missing',player.id,player,'cloud')?.result).toBe('completed');
 expect(makeRecord(view({isModerator:true,players:roster,winnerIDs:[player.id]},'drawguess'),'moderator',player.id,player,'cloud')?.result).toBe('host');
 expect(makeRecord(view({players:roster,winnerIDs:[player.id]},'drawrelay'),'relay',player.id,player,'practice')?.result).toBe('completed');
});

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

it('labels bot results, preserves old human results, and deduplicates bot matches',()=>{
 const bot:Player={id:'bot-test-01',name:'Mocha 1',avatar:'🤖',bot:{difficulty:'hard'}};
 const record=makeRecord(view({players:[player,bot],winners:[player.id]}),'bot-match',player.id,player,'cloud')!;
 expect(record.botCount).toBe(1);expect(record.playerCount).toBe(2);expect(saveRecord(record)).toBe(true);expect(readHistory()[0].botCount).toBe(1);expect(saveRecord(record)).toBe(false);
 deleteRecord(record.id);expect(saveRecord(record)).toBe(false);
 const legacy=makeRecord(view({players:[player],winners:[player.id]}),'human-match',player.id,player,'cloud')!;expect(legacy.botCount).toBeUndefined();saveRecord(legacy);expect(readHistory()[0]).toEqual(legacy);
});
