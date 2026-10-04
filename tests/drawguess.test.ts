import {describe,expect,it} from 'vitest';
import {drawguess,advanceDrawGuessClock} from '../src/core/games/drawguess';
import {advanceMatchClock,createMatch,viewMatch} from '../src/core/room';
import type {Player} from '../src/core/types';

const players:Player[]=[
 {id:'draw-player-0',name:'Aster',avatar:'🦊'},
 {id:'draw-player-1',name:'Birch',avatar:'🐼'},
 {id:'draw-player-2',name:'Cedar',avatar:'🐱'}
];
describe('you draw, I guess',()=>{
 it('keeps prompts and answers out of other players and spectator views',()=>{
  let game=drawguess.create(players,7,{language:'en'});game=advanceDrawGuessClock(game,100);
  const drawer=drawguess.view(game,players[0].id),other=drawguess.view(game,players[1].id),spectator=drawguess.view(game,'',true);
  expect(drawer.actions[0].choices).toHaveLength(3);expect(other.actions).toEqual([]);expect(JSON.stringify(other)).not.toContain('apple');expect(JSON.stringify(spectator)).not.toContain('apple');
  game=drawguess.apply(game,players[0].id,{action:'choose',values:[drawer.actions[0].choices[0].id]});
  expect(drawguess.view(game,players[1].id).board.answer).toBeUndefined();expect(drawguess.view(game,'',true).board.answer).toBeUndefined();
 });
 it('does not echo a correct answer until reveal, then awards both players',()=>{
  let game=advanceDrawGuessClock(drawguess.create(players,8,{language:'en'}),100);const choice=drawguess.view(game,players[0].id).actions[0].choices[0];game=drawguess.apply(game,players[0].id,{action:'choose',values:[choice.id]});game=advanceDrawGuessClock(game,100);game=drawguess.apply(game,players[1].id,{action:'guess',values:[],text:choice.title});
  const beforeReveal=drawguess.view(game,players[2].id);expect(beforeReveal.board.answer).toBe(choice.title);expect(beforeReveal.board.guesses[0].text).toBe('');expect(beforeReveal.log.join(' ')).not.toContain(choice.title);expect(beforeReveal.board.players[0].score).toBe(1);expect(beforeReveal.board.players[1].score).toBe(2);
 });
 it('only a trusted clock helper advances time; public actions cannot send timeout',()=>{
  const match=createMatch('drawguess',players,{language:'en'});const started=advanceMatchClock(match,'drawguess',players,100);expect(started.revision).toBeGreaterThan(match.revision);const drawer=viewMatch(started,'drawguess',players[0].id);expect(()=>drawguess.apply(started.game,players[0].id,{action:'timeout',values:[]})).toThrow();const timed=advanceMatchClock(started,'drawguess',players,30100);expect(timed.game.phase).toBe('draw');expect(drawer.view.actions[0].id).toBe('choose');
 });
 it('bounds strokes and only accepts them from the active drawer',()=>{
  let game=advanceDrawGuessClock(drawguess.create(players,3),0);const word=drawguess.view(game,players[0].id).actions[0].choices[0];game=drawguess.apply(game,players[0].id,{action:'choose',values:[word.id]});expect(()=>drawguess.apply(game,players[1].id,{action:'stroke',values:['1,2','3,4'],text:'#112233'})).toThrow();game=drawguess.apply(game,players[0].id,{action:'stroke',values:['1,2','3,4'],text:'#112233'});expect(drawguess.view(game,players[1].id).board.strokes).toHaveLength(1);expect(()=>drawguess.apply(game,players[0].id,{action:'stroke',values:['1001,2','3,4'],text:'#112233'})).toThrow();
 });
});
