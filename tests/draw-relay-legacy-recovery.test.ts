import {beforeEach,describe,expect,it} from 'vitest';
import {drawrelay,type DrawRelayState} from '../src/core/games/drawrelay';
import {createMatch,validateMatchForRoom,viewMatch,type MatchState,type RoomInfo} from '../src/core/room';
import {createPractice,readPractice,writePractice} from '../src/local/practice';
import type {GameOptions,Player} from '../src/core/types';

const players:Player[]=Array.from({length:3},(_,i)=>({id:`legacy_relay_${i}`,name:`Player ${i}`,avatar:'🦊'}));
const entries=new Map<string,string>();
const storage={getItem:(key:string)=>entries.get(key)||null,setItem:(key:string,value:string)=>entries.set(key,value),removeItem:(key:string)=>entries.delete(key)};

beforeEach(()=>{
 entries.clear();
 Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
});

function progress(game:DrawRelayState,language:'zh'|'en',relayMode:'rounds'|'queue'):DrawRelayState{
 const roster=game.players;
 if(relayMode==='rounds'){
  for(const player of roster){
   game=drawrelay.apply(game,player.id,{action:'draft',values:['0'],text:`legacy-${language}-opening`});
   game=drawrelay.apply(game,player.id,{action:'submit',values:['0']});
  }
 }else{
  game=drawrelay.apply(game,roster[0].id,{action:'draft',values:['0:0'],text:`legacy-${language}-queue`});
  game=drawrelay.apply(game,roster[0].id,{action:'submit',values:['0:0']});
 }
 return game;
}

function legacyMatch(language:'zh'|'en',relayMode:'rounds'|'queue'):MatchState{
 const options:GameOptions={language,relayMode,...(relayMode==='rounds'?{relaySeconds:90}:{})};
 const match=createMatch('drawrelay',players,options);
 match.game=progress(match.game,language,relayMode);
 delete (match.game as {language?:'zh'|'en'}).language;
 delete (match.game as {wordPack?:'classic'|'modern'}).wordPack;
 return match;
}

function room(match:MatchState,mode:'lan'|'cloud'):RoomInfo{
 return {code:'ABC234',kind:'drawrelay',mode,hostID:players[0].id,options:match.options,players:players.map(player=>({...player,ready:true,connected:true})),pending:[],started:true,revision:1};
}

describe('Draw Relay legacy metadata recovery',()=>{
 it.each([
  ['zh','rounds','lan'],['en','rounds','lan'],
  ['zh','queue','lan'],['en','queue','lan'],
  ['zh','rounds','cloud'],['en','rounds','cloud'],
  ['zh','queue','cloud'],['en','queue','cloud']
 ] as const)('hydrates old %s %s checkpoints through %s validation',(language,relayMode,roomMode)=>{
  const legacy=legacyMatch(language,relayMode),prompts=structuredClone(legacy.game.openingPrompts),
   progress={step:legacy.game.step,books:structuredClone(legacy.game.books),drafts:structuredClone(legacy.game.drafts)};
  const restored=validateMatchForRoom(JSON.parse(JSON.stringify(legacy)),room(legacy,roomMode));
  expect(restored.game).toMatchObject({language,wordPack:'classic',...progress});
  expect(restored.game.queue).toEqual(legacy.game.queue);
  expect(restored.game.openingPrompts).toEqual(prompts);
  expect(viewMatch(restored,'drawrelay',players[0].id).view.board.language).toBe(language);
  expect(viewMatch(restored,'drawrelay',players[0].id).view.board.wordPack).toBe('classic');
 });

 it.each(['zh','en'] as const)('restores old %s practice prompts and progress from saved options',language=>{
  for(const relayMode of ['rounds','queue'] as const){
   const practice=createPractice('drawrelay',3,players[0],{language,relayMode,...(relayMode==='rounds'?{relaySeconds:90}:{})},undefined,607);
   practice.game=progress(practice.game as DrawRelayState,language,relayMode);
   const game=practice.game as DrawRelayState,prompts=structuredClone(game.openingPrompts),snapshot={step:game.step,books:structuredClone(game.books),drafts:structuredClone(game.drafts)},queue=structuredClone(game.queue);
   delete game.language;delete game.wordPack;
   writePractice(practice);
   const restored=readPractice(),restoredGame=restored?.game as DrawRelayState|undefined;
   expect(restoredGame).toMatchObject({language,wordPack:'classic',...snapshot});
   expect(restoredGame?.queue).toEqual(queue);
   expect(restoredGame?.openingPrompts).toEqual(prompts);
   entries.clear();
  }
 });

 it('rejects explicit language or pack mismatches instead of migrating them',()=>{
  const legacy=legacyMatch('en','rounds');
  const wrongLanguage=structuredClone(legacy);wrongLanguage.game.language='zh';
  expect(()=>validateMatchForRoom(wrongLanguage,room(legacy,'lan'))).toThrow('词语语言与房间不一致');
  const wrongPack=structuredClone(legacy);wrongPack.game.wordPack='modern';
  expect(()=>validateMatchForRoom(wrongPack,room(legacy,'lan'))).toThrow('词包与房间不一致');
 });
});
