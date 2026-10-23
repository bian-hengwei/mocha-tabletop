import {describe,it,expect} from 'vitest';
import {OfflineRoom,readPairing} from '../../src/net/offlineRoom';
import {createMatch,applyMatch,viewRoomMatch} from '../../src/core/room';
const host={id:'offline-host',name:'Host',avatar:'🦊'},guest={id:'offline-guest',name:'Guest',avatar:'🐶'},third={id:'offline-third',name:'Third',avatar:'🐱'};
const request=(profile=guest,token='b'.repeat(48),spectator=false)=>({version:1 as const,type:'request' as const,id:crypto.randomUUID(),expiresAt:Date.now()+600000,profile,token,spectator,description:{type:'offer' as const,sdp:'v=0\r\na=candidate:1 1 udp 1 127.0.0.1 12345 typ host\r\n'}});
const command=(type:string,values:Record<string,unknown>={})=>({type,requestID:crypto.randomUUID(),...values});
describe('offline room authority',()=>{
 it('requires the retained credential and never exposes it in room snapshots',()=>{
  const authority=new OfflineRoom(host,'sushi',undefined,'a'.repeat(48));authority.admit(request());
  const original=structuredClone(authority.room);
  expect(()=>authority.admit(request(guest,'c'.repeat(48)))).toThrow('身份');expect(authority.room).toEqual(original);
  authority.admit(request());expect(authority.room.players).toHaveLength(2);
  expect(JSON.stringify(authority.room)).not.toContain('b'.repeat(48));
  const restored=OfflineRoom.restore({room:authority.room,tokens:authority.tokens},host,'a'.repeat(48));
  expect(restored.room.players[1].connected).toBe(false);restored.admit(request());expect(restored.room.players).toHaveLength(2);
 });
 it('checks authority, readiness, capacity and spectator permissions transactionally',()=>{
  const authority=new OfflineRoom(host,'sushi',undefined,'a'.repeat(48));authority.admit(request());authority.admit(request(third));
  const initial=structuredClone(authority.room);
  for(const type of ['start','replay','endGame','removePlayer','selectGame','addBot','setSpectators']){expect(()=>authority.control(guest.id,command(type,{kind:'gems',playerID:host.id,difficulty:'normal',allowed:false}))).toThrow();expect(authority.room).toEqual(initial);}
  expect(()=>authority.control(guest.id,command('start'))).toThrow();expect(authority.room).toEqual(initial);
  expect(()=>authority.control(host.id,command('start'))).toThrow();
  authority.control(guest.id,command('ready',{ready:true}));authority.control(third.id,command('ready',{ready:true}));
  authority.room.players.forEach(p=>p.connected=true);expect(authority.control(host.id,command('start')).start).toBe(true);
  expect(()=>authority.control(guest.id,command('leave'))).toThrow();
  authority.admit(request({id:'offline-watcher',name:'Watcher',avatar:'🦊'}));expect(authority.room.spectators).toHaveLength(1);
  expect(()=>authority.control('offline-watcher',command('ready',{ready:true}))).toThrow();
  expect(authority.control(host.id,command('setSpectators',{allowed:false})).removed).toEqual(['offline-watcher']);
  expect(authority.tokens['offline-watcher']).toBeUndefined();
  expect(()=>authority.admit(request({id:'another-watcher',name:'Another',avatar:'🦊'}))).toThrow('关闭');
 });
 it('deduplicates controls and uses the shared authoritative private view and action checks',()=>{
  const authority=new OfflineRoom(host,'sushi',undefined,'a'.repeat(48));authority.admit(request());authority.admit(request(third));
  const add=command('addBot',{difficulty:'normal'});authority.control(host.id,add);authority.control(host.id,add);expect(authority.room.players).toHaveLength(4);
  const room=authority.room,match=createMatch('sushi',room.players),view=viewRoomMatch(match,room,guest.id);
  expect(view.view.board.hand).toEqual(match.game.hands[1]);expect(view.view.board).not.toHaveProperty('hands');
  expect(()=>viewRoomMatch(match,room,'intruder')).toThrow();
  const copy=structuredClone(match);expect(()=>applyMatch(match,'sushi',room.players,guest.id,{action:'pick',values:['not-a-card']},'invalid',view.actionRevision)).toThrow();expect(match).toEqual(copy);
 });
 it('rejects malformed, oversized and candidate-free pairing files',()=>{
  expect(readPairing(JSON.stringify(request())).type).toBe('request');
  expect(()=>readPairing(JSON.stringify({...request(),expiresAt:Date.now()-1}))).toThrow('过期');
  for(const value of ['null','{}','bad','x'.repeat(50001),JSON.stringify({...request(),token:'short'}),JSON.stringify({...request(),description:{type:'offer',sdp:'v=0\r\n'}})])expect(()=>readPairing(value)).toThrow();
 });
});
