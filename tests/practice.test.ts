import {beforeEach,describe,expect,it} from 'vitest';
import {BOT_GAMES,BOT_DIFFICULTIES,chooseBotCommand} from '../src/core/bots';
import {modules} from '../src/core/registry';
import {GAMES} from '../src/core/types';
import {createPractice,applyPractice,practiceView,hasPracticeBotTurn,stepPracticeBot,continuePracticeRound,practiceBotRoundWaiting,readPractice,writePractice,restartPractice} from '../src/local/practice';
import {makeRecord,readHistory,saveRecord} from '../src/local/storage';
const human={id:'human-0001',name:'Human',avatar:'🦊'};
const entries=new Map<string,string>();
beforeEach(()=>{entries.clear();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>entries.get(key)||null,setItem:(key:string,value:string)=>entries.set(key,value),removeItem:(key:string)=>entries.delete(key)}});});
describe('local solo configuration',()=>{
 it.each(BOT_GAMES)('starts %s at every supported count and difficulty and progresses legal actions',kind=>{
  for(let count=GAMES[kind].min;count<=GAMES[kind].max;count++)for(const difficulty of BOT_DIFFICULTIES){
   let p=createPractice(kind,count,human,{language:'en'},difficulty,314);
   expect(p.players).toHaveLength(count);expect(p.players.filter(player=>!player.bot)).toHaveLength(1);
   expect(p.players.slice(1).every(player=>player.bot?.difficulty===difficulty)).toBe(true);
   for(let turn=0;turn<12&&!practiceView(p).finished;turn++){
    const before=structuredClone(p);
    if(hasPracticeBotTurn(p))p=stepPracticeBot(p);
    else if(practiceBotRoundWaiting(p))p=continuePracticeRound(p);
    else {const cmd=chooseBotCommand(practiceView(p),p.players[0].id,difficulty,p.revision!);expect(cmd).toBeDefined();p=applyPractice(p,cmd!);}
    expect(p.revision).toBe(before.revision!+1);
   }
   writePractice(p);expect(readPractice()).toEqual(p);
  }
 });
 it('rejects unsupported discussion bots, invalid counts and difficulty',()=>{
  for(const kind of ['avalon','werewolf','undercover','codenames'] as const)expect(()=>createPractice(kind,GAMES[kind].min,human,undefined,'normal')).toThrow('真人交流');
  for(const count of [1,11,2.5,NaN])expect(()=>createPractice('uno',count,human)).toThrow('人数');
  expect(()=>createPractice('uno',2,human,undefined,'expert' as 'easy')).toThrow('难度');
 });
 it('honors selected discussion counts and counts the moderator separately',()=>{
  for(const kind of ['avalon','undercover','codenames'] as const){const p=createPractice(kind,GAMES[kind].max,human);expect(p.players).toHaveLength(GAMES[kind].max);expect(p.players.every(player=>!player.bot)).toBe(true);}
  const p=createPractice('werewolf',13,human,{werewolfMode:'judge',werewolfPreset:'wolfKing'});
  expect(p.players).toHaveLength(13);expect(practiceView(p).board.isModerator).toBe(true);
  expect(()=>createPractice('werewolf',12,human,{werewolfMode:'judge',werewolfPreset:'wolfKing'})).toThrow('人数');
 });
});
it('always views and acts as the human in solo, rejects invalid commands atomically',()=>{
 const p=createPractice('sushi',5,human,undefined,'hard',7),before=structuredClone(p);
 const forged={...p,viewer:p.players[2].id};expect(practiceView(forged)).toEqual(practiceView(p));
 const cmd=chooseBotCommand(practiceView(p),p.players[0].id,'easy',1)!;
 const next=applyPractice(forged,cmd);expect(modules.sushi.view(next.game,p.players[0].id).board.selected).toBeTruthy();expect(modules.sushi.view(next.game,p.players[2].id).board.selected).toBeFalsy();
 expect(()=>applyPractice(p,{action:'pick',values:['unknown-card']})).toThrow();expect(p).toEqual(before);
});
it('resumes legacy pass & play and switches its inspected seat',()=>{
 const p=createPractice('gems',3,human);delete p.mode;delete p.revision;p.viewer=p.players[1].id;writePractice(p);
 expect(readPractice()).toEqual(p);expect(practiceView(p)).toEqual(modules.gems.view(p.game,p.players[1].id));
 expect(hasPracticeBotTurn(p)).toBe(false);expect(stepPracticeBot(p)).toBe(p);
});
it('resumes and replays solo with the same roster, difficulty and rules',()=>{
 const p=createPractice('uno',7,human,{unoMode:'single',unoChallenge:false,language:'en'},'hard',91);p.viewer=p.players[2].id;writePractice(p);
 const saved=readPractice()!;expect(saved.viewer).toBe(saved.players[0].id);
 const replay=restartPractice(saved,5);expect(replay.id).not.toBe(saved.id);expect(replay.players).toEqual(saved.players);expect(replay.options).toEqual(saved.options);expect(replay.mode).toBe('solo');expect(replay.difficulty).toBe('hard');expect(practiceView(replay).finished).toBe(false);
});
it('rejects corrupt or expired saves and reports storage failure',()=>{
 const p=createPractice('sushi',3,human,undefined,'easy');
 for(const corrupt of [{...p,mode:'invalid'},{...p,kind:'invalid'},{...p,revision:0},{...p,players:p.players.slice(1)},{...p,difficulty:'hard'},{...p,options:{language:'invalid'}},{...p,mode:'pass'}]){localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice:corrupt}));expect(readPractice()).toBeNull();}
 localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now()-8*86400000,practice:p}));expect(readPractice()).toBeNull();
 writePractice(null);expect(readPractice()).toBeNull();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('denied');}});expect(readPractice()).toBeNull();expect(()=>writePractice(p)).toThrow('denied');
});
it('pauses bot-owned round continuation for human acknowledgement and allows retry',()=>{
 const p=createPractice('guandan',4,human,undefined,'normal',15);
 const game=p.game as {phase:string;current:number;previousOrder:number[];round:number};game.phase='roundEnd';game.current=1;game.previousOrder=[0,2,1,3];
 expect(hasPracticeBotTurn(p)).toBe(false);expect(practiceBotRoundWaiting(p)).toBe(true);
 const next=continuePracticeRound(p);expect((next.game as typeof game).round).toBe(2);expect(game.round).toBe(1);
 const ready=createPractice('sushi',3,human,undefined,'normal',1);expect(hasPracticeBotTurn({...ready,botError:true})).toBe(false);expect(hasPracticeBotTurn({...ready,botError:false})).toBe(true);
});
it('plays an entire five-seat solo Sushi match and stores a distinct private-free solo result',()=>{
 let p=createPractice('sushi',5,human,undefined,'normal',246);let steps=0;
 while(!practiceView(p).finished&&steps++<500){
  if(hasPracticeBotTurn(p))p=stepPracticeBot(p);
  else if(practiceBotRoundWaiting(p))p=continuePracticeRound(p);
  else {const cmd=chooseBotCommand(practiceView(p),p.players[0].id,'normal',p.revision!);expect(cmd).toBeDefined();p=applyPractice(p,cmd!);}
 }
 const view=practiceView(p);expect(view.finished).toBe(true);expect(view.board.roundScores).toHaveLength(3);
 const record=makeRecord(view,p.id,p.players[0].id,p.players[0],'solo')!;expect(record.botCount).toBe(4);expect(record.playerCount).toBe(5);expect(saveRecord(record)).toBe(true);expect(saveRecord(record)).toBe(false);expect(readHistory()[0].mode).toBe('solo');expect(record).not.toHaveProperty('game');expect(record).not.toHaveProperty('hand');
});
