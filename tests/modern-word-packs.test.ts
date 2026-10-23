import {beforeEach,describe,expect,it} from 'vitest';
import {codenames} from '../src/core/games/codenames';
import {drawguess} from '../src/core/games/drawguess';
import {drawrelay} from '../src/core/games/drawrelay';
import {makeRelayOpeningPrompts} from '../src/core/games/relayPrompts';
import {undercover} from '../src/core/games/undercover';
import {MODERN_DRAW_WORDS,MODERN_ODD_WORD_PAIRS,MODERN_SIGNAL_WORDS,SIGNAL_WORDS} from '../src/core/games/wordBank';
import {createMatch,normalizeGameOptions,validateMatchForRoom} from '../src/core/room';
import {modules} from '../src/core/registry';
import {createPractice,readPractice,writePractice} from '../src/local/practice';
import type {GameKind,Player} from '../src/core/types';

const players=Array.from({length:4},(_,i)=>({id:`player_${i}`,name:`Player ${i}`,avatar:'🦊'}));
const entries=new Map<string,string>();
const storage={getItem:(key:string)=>entries.get(key)||null,setItem:(key:string,value:string)=>entries.set(key,value),removeItem:(key:string)=>entries.delete(key)};

beforeEach(()=>{
 entries.clear();
 Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
});

describe('modern life word packs',()=>{
 it('keeps the four original banks at the requested scale and without duplicates',()=>{
  expect(MODERN_SIGNAL_WORDS.length).toBe(82);
  expect(MODERN_ODD_WORD_PAIRS).toHaveLength(40);
  expect(MODERN_DRAW_WORDS).toHaveLength(40);
  expect(new Set(MODERN_SIGNAL_WORDS.map(([zh])=>zh)).size).toBe(MODERN_SIGNAL_WORDS.length);
  expect(new Set(MODERN_SIGNAL_WORDS.map(([,en])=>en)).size).toBe(MODERN_SIGNAL_WORDS.length);
  expect(new Set(MODERN_DRAW_WORDS.map(([en])=>en)).size).toBe(MODERN_DRAW_WORDS.length);
  expect(MODERN_SIGNAL_WORDS).toContainEqual(['视频会议','Video meeting']);
  expect(MODERN_SIGNAL_WORDS).toContainEqual(['视频通话','Video chat']);
  expect(MODERN_SIGNAL_WORDS).toContainEqual(['免密支付','Password-free payment']);
  expect(MODERN_SIGNAL_WORDS).toContainEqual(['昵称','Nickname']);
  expect(MODERN_SIGNAL_WORDS).not.toContainEqual(['昵称','Username']);
  const drawWords=new Set(MODERN_DRAW_WORDS.map(([en])=>en));
  for(const word of ['Blind box','Plush keychain','Camping canopy','Frisbee','Instant camera','Bubble tea','Collectible figure','Gaming chair'])expect(drawWords).toContain(word);
  for(const word of ['Noise-canceling headphones','Podcast microphone','Smart scale'])expect(drawWords).not.toContain(word);
  expect(drawWords).not.toContain('Wireless earbuds');
  for(const pair of MODERN_ODD_WORD_PAIRS){expect(pair).toHaveLength(2);expect(pair[0]).not.toEqual(pair[1]);}
  expect(JSON.stringify([MODERN_SIGNAL_WORDS,MODERN_ODD_WORD_PAIRS,MODERN_DRAW_WORDS])).not.toMatch(/202\d|latest|trending/i);
 });

 it('defaults every word game to classic on the same seed',()=>{
  expect(codenames.create(players,71).wordPack).toBe('classic');
  expect(undercover.create(players,71).wordPack).toBe('classic');
  expect(drawguess.create(players,71).wordPack).toBe('classic');
  expect(drawrelay.create(players,71,{relayMode:'queue'}).wordPack).toBe('classic');
  expect(new Set(codenames.create(players,71).cards.map(card=>card.word))).toEqual(new Set(codenames.create(players,71).cards.map(card=>card.word)));
 });

 it('deals only modern entries in the language fixed by the match',()=>{
  const signal=codenames.create(players,19,{language:'en',wordPack:'modern'});
  const modernSignal=new Set(MODERN_SIGNAL_WORDS.map(([,en])=>en));
  expect(signal.cards.every(card=>modernSignal.has(card.word))).toBe(true);
  expect(new Set(signal.cards.map(card=>card.word))).toEqual(new Set(signal.cards.map(card=>card.word)));

  const odd=undercover.create(players,19,{language:'en',wordPack:'modern'});
  const modernOddWords=new Set(MODERN_ODD_WORD_PAIRS.flatMap(pair=>pair.map(([,en])=>en)));
  expect(odd.words.every(word=>modernOddWords.has(word))).toBe(true);

  const drawing=drawguess.create(players,19,{language:'en',wordPack:'modern'});
  const modernDraw=new Set(MODERN_DRAW_WORDS.map(([en])=>en));
  expect(drawing.choices.every(choice=>modernDraw.has(choice.en))).toBe(true);

  const relay=drawrelay.create(players,19,{language:'en',wordPack:'modern',relayMode:'queue'});
  const prompts=relay.openingPrompts!.flat();
  expect(prompts).toHaveLength(12);
  const modernEnglish=new Set(makeRelayOpeningPrompts(10,19,'en','modern').flat());
  expect(prompts.every(prompt=>modernEnglish.has(prompt))).toBe(true);

  const classic=codenames.create(players,19,{language:'zh'});
  expect(classic.cards.every(card=>SIGNAL_WORDS.some(([zh])=>zh===card.word))).toBe(true);
 });

 it('keeps private modern words hidden and fixes language until recovery',()=>{
  const signal=codenames.create(players,23,{language:'en',wordPack:'modern'});
  expect(codenames.view(signal,players[2].id).board.cards.every((card:any)=>!Object.hasOwn(card,'identity'))).toBe(true);

  const odd=undercover.create(players,23,{language:'en',wordPack:'modern'}),oddView=undercover.view(odd,players[0].id);
  const otherWord=odd.words[odd.roles[0]==='common'?1:0];
  expect(JSON.stringify(oddView)).not.toContain(otherWord);

  let drawing=drawguess.create(players,23,{language:'en',wordPack:'modern'});
  const choice=drawguess.view(drawing,players[0].id).actions[0].choices[0];
  drawing=drawguess.apply(drawing,players[0].id,{action:'choose',values:[choice.id]});
  expect(JSON.stringify(drawguess.view(drawing,players[1].id))).not.toContain(choice.title);
  expect(drawguess.view(drawing,players[0].id).board.answer).toBe(choice.title);
  expect(drawing.language).toBe('en');

  const relay=drawrelay.create(players,23,{language:'en',wordPack:'modern'});
  const own=relay.openingPrompts![0],other=relay.openingPrompts![1];
  const relayView=JSON.stringify(drawrelay.view(relay,players[0].id));
  expect(own.every(prompt=>relayView.includes(prompt))).toBe(true);
  expect(other.every(prompt=>!relayView.includes(prompt))).toBe(true);
 });

 it('restores modern pack choices for all four games and treats old checkpoints as classic',()=>{
  const profile=players[0];
  for(const kind of ['codenames','undercover','drawguess','drawrelay'] as GameKind[]){
   const practice=createPractice(kind,4,profile,{language:'en',wordPack:'modern',...(kind==='drawrelay'?{relayMode:'queue' as const}:{})},undefined,41);
   writePractice(practice);
   expect(readPractice()).toMatchObject({kind,options:{language:'en',wordPack:'modern'}});
   entries.clear();
  }
  for(const kind of ['codenames','undercover','drawguess','drawrelay'] as GameKind[]){
   const legacy=createPractice(kind,4,profile,{language:'zh',...(kind==='drawrelay'?{relayMode:'queue' as const}:{})},undefined,41);
   delete (legacy.game as {wordPack?: 'classic'|'modern'}).wordPack;delete legacy.options?.wordPack;
   writePractice(legacy);
   const restored=readPractice();
   expect(restored).not.toBeNull();
   const board=modules[kind].view(restored!.game,restored!.viewer).board;
   expect(board.wordPack).toBe('classic');
   entries.clear();
  }
 });

 it('validates pack and language at the room authority boundary',()=>{
  const room={code:'ABC234',kind:'codenames' as const,mode:'cloud' as const,hostID:players[0].id,players:players.map(player=>({...player,ready:true,connected:true})),pending:[],started:true,revision:1,options:{language:'en' as const,wordPack:'modern' as const}};
  const match=createMatch('codenames',players,room.options);
  expect(validateMatchForRoom(match,room).game.wordPack).toBe('modern');
  expect(()=>normalizeGameOptions('codenames',{wordPack:'future'},players[0].id)).toThrow('词包无效');
  expect(()=>normalizeGameOptions('gems',{wordPack:'modern'},players[0].id)).toThrow('词包无效');
  expect(()=>validateMatchForRoom({...match,game:{...match.game,wordPack:'classic'}},room)).toThrow('词包与房间不一致');
 });
});
