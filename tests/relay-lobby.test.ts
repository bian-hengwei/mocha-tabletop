import {describe,it,expect} from 'vitest';
import {createMatch,normalizeGameOptions,roomLimits,validateLobbySeats,validateMatchForRoom,type RoomInfo} from '../src/core/room';
import {createPractice} from '../src/local/practice';
const players=Array.from({length:12},(_,i)=>({id:`player_${i}`,name:`Player ${i}`,avatar:'🦊'}));
describe('relay lobby planned player count',()=>{
 it('canonicalizes all supported targets without changing relay mode or duration',()=>{
  for(let count=3;count<=12;count++)for(const relayMode of ['queue','rounds'] as const){
   const options=normalizeGameOptions('drawrelay',{relayPlayers:count,relayMode,relaySeconds:60},players[0].id);
   expect(options).toEqual({relayPlayers:count,relayMode,relaySeconds:60});expect(roomLimits('drawrelay',options)).toEqual({min:count,max:count});
   expect(createMatch('drawrelay',players.slice(0,count),options).game.players).toHaveLength(count);
  }
 });
 it('rejects malformed counts and counts attached to other games',()=>{
  for(const relayPlayers of [null,'4',true,2,13,3.5,NaN,Infinity])expect(()=>normalizeGameOptions('drawrelay',{relayPlayers},players[0].id)).toThrow('本局人数');
  expect(()=>normalizeGameOptions('uno',{relayPlayers:4},players[0].id)).toThrow('本局人数');
 });
 it('keeps omitted legacy targets flexible and practice independent',()=>{
  expect(roomLimits('drawrelay',normalizeGameOptions('drawrelay',{relayMode:'queue'},players[0].id))).toEqual({min:3,max:12});
  expect(createMatch('drawrelay',players.slice(0,4),{relayMode:'queue'}).game.players).toHaveLength(4);
  const practice=createPractice('drawrelay',6,players[0],{relayMode:'queue'});expect(practice.players).toHaveLength(6);expect(practice.options?.relayPlayers).toBeUndefined();
 });
 it('rejects reductions below occupied seats and mismatched match creation/checkpoints',()=>{
  expect(()=>validateLobbySeats('drawrelay',{relayPlayers:3},4)).toThrow('离线座位');
  expect(()=>createMatch('drawrelay',players.slice(0,4),{relayPlayers:6})).toThrow('本局人数');
  const room:RoomInfo={kind:'drawrelay',code:'ABCDEF',hostID:players[0].id,mode:'lan',started:true,revision:1,players:players.slice(0,4).map(p=>({...p,ready:true,connected:true})),pending:[],options:{relayPlayers:4}};
  const match=createMatch('drawrelay',room.players,room.options);expect(validateMatchForRoom(match,room).options?.relayPlayers).toBe(4);
  const legacyMatch=createMatch('drawrelay',room.players);expect(()=>validateMatchForRoom(legacyMatch,{...room,options:{relayPlayers:6}})).toThrow();
  expect(()=>validateMatchForRoom({...legacyMatch,options:{relayPlayers:6}},{...room,options:{relayPlayers:6}})).toThrow('入座人数与本局人数不一致');
 });
});
