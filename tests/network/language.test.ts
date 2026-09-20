import {describe,it,expect} from 'vitest';
import {normalizeGameOptions,createMatch,validateMatchForRoom,applyMatch,viewMatch,type RoomInfo} from '../../src/core/room';
import {GAMES,type GameKind} from '../../src/core/types';
const players=Array.from({length:7},(_,i)=>({id:`player0${i}`,name:`Player ${i}`,avatar:'🦊',ready:true,connected:true}));
describe('persisted room language',()=>{
 it.each(Object.keys(GAMES) as GameKind[])('preserves English for %s without introducing unrelated options',kind=>{expect(normalizeGameOptions(kind,{language:'en'},players[0].id)?.language).toBe('en');if(kind!=='werewolf')expect(normalizeGameOptions(kind,{language:'en'},players[0].id)).toEqual({language:'en'});});
 it.each(['fr',null,{},12])('rejects unsupported language %j',language=>{expect(()=>normalizeGameOptions('gems',{language},players[0].id)).toThrow('语言');});
 it.each(['standard','judge','deal'] as const)('restores %s council with room language and legacy engine metadata',werewolfMode=>{const options=normalizeGameOptions('werewolf',{werewolfMode,language:'en'},players[0].id);const r:RoomInfo={code:'ABC234',kind:'werewolf',mode:'lan',hostID:players[0].id,options,players,pending:[],started:true,revision:1};const match=createMatch('werewolf',players,options);expect(validateMatchForRoom(JSON.parse(JSON.stringify(match)),r).options?.language).toBe('en');expect(()=>validateMatchForRoom(match,{...r,options:{...options,language:'zh'}})).toThrow('模式');});
 it('rejects oversized optional input at the authoritative boundary without changing state',()=>{const match=createMatch('gems',players.slice(0,2));const view=viewMatch(match,'gems',players[0].id),a=view.view.actions[0],before=JSON.stringify(match);expect(()=>applyMatch(match,'gems',players.slice(0,2),players[0].id,{action:a.id,values:a.choices.slice(0,a.min).map(c=>c.id),text:'a'.repeat(33)},'too-long',view.actionRevision)).toThrow('操作无效');expect(JSON.stringify(match)).toBe(before);});
});
