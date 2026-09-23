import {describe,it,expect} from 'vitest';
import {applyRoomSocial,emptySocial,socialView,supportsRoomSocial,CHAT_HISTORY,SOCIAL_COOLDOWN,SOCIAL_DURATION,forgetSocialActor} from '../src/core/roomSocial';
import type {RoomInfo} from '../src/core/room';
import {GAMES,type GameKind} from '../src/core/types';
const player={id:'player01',name:'狼人杀 <b>',avatar:'🦊',ready:true,connected:true};
const room:RoomInfo={code:'ABC234',kind:'gems',mode:'cloud',hostID:player.id,players:[player],spectators:[{id:'watcher1',name:'Observer',avatar:'🐱',connected:true}],pending:[],revision:7,started:false};
describe('room communication boundary',()=>{
 it('explicitly supports eight games and blocks four constrained-information games',()=>{
  const allowed=['gems','bombs','sushi','century','uno','doudizhu','guandan','mahjong'];
  for(const kind of Object.keys(GAMES) as GameKind[])expect(supportsRoomSocial(kind),kind).toBe(allowed.includes(kind));
 });
 it.each(['cloud','lan'] as const)('preserves room/game state and original strings in %s',mode=>{
  const r={...room,mode},before=structuredClone(r),empty=emptySocial();
  const next=applyRoomSocial(empty,r,player.id,{type:'chat',text:'  狼人杀 <script>test</script>\n中文  '},'message-1',10000);
  expect(next.messages[0]).toMatchObject({player:{id:player.id,name:player.name},text:'狼人杀 <script>test</script>\n中文',at:10000});
  expect(r).toEqual(before);expect(empty).toEqual(emptySocial());expect(next.revision).toBe(1);
  expect(Object.keys(socialView(next,r,10000)).sort()).toEqual(['messages','reactions','revision']);
 });
 it.each(['codenames','werewolf','avalon','undercover'] as const)('rejects both channels and masks old state for %s',kind=>{
  const state=applyRoomSocial(emptySocial(),room,player.id,{type:'chat',text:'old'},'old',10000);
  for(const command of [{type:'chat',text:'secret'},{type:'reaction',reaction:'cow'}])expect(()=>applyRoomSocial(state,{...room,kind},player.id,command,'blocked',20000)).toThrow('不开放');
  expect(socialView(state,{...room,kind},10000).messages).toEqual([]);
 });
 it.each(['watcher1','stranger','bot_test'])('rejects non-player %s',actor=>{
  expect(()=>applyRoomSocial(emptySocial(),room,actor,{type:'chat',text:'spoiler'},'bad',10000)).toThrow('在座玩家');
 });
 it('rejects bots even when seated',()=>{
  expect(()=>applyRoomSocial(emptySocial(),{...room,players:[{...player,bot:{difficulty:'easy'}}]},player.id,{type:'reaction',reaction:'cow'},'bad',1)).toThrow();
 });
 it.each([null,[],{}, {type:'chat',text:''},{type:'chat',text:'   '},{type:'chat',text:123},{type:'chat',text:'x'.repeat(281)},{type:'chat',text:'a\u0000b'},{type:'chat',text:'a\u0085b'},{type:'chat',text:'a\u202eb'},{type:'chat',text:'hello',playerID:'other'},{type:'reaction',reaction:'https://evil.test/pic.gif'},{type:'reaction',reaction:'cow',text:'secret'}])('rejects malformed payload without mutation: %j',command=>{
  const state=emptySocial();expect(()=>applyRoomSocial(state,room,player.id,command,'bad',10000)).toThrow();expect(state).toEqual(emptySocial());
 });
 it('deduplicates requests independently of cooldown and room revisions',()=>{
  const state=applyRoomSocial(emptySocial(),room,player.id,{type:'chat',text:'hello'},'once',10000);
  expect(applyRoomSocial(state,room,player.id,{type:'chat',text:'changed'},'once',10001)).toBe(state);
  expect(()=>applyRoomSocial(state,room,player.id,{type:'reaction',reaction:'cow'},'twice',10001)).toThrow('太快');
  expect(applyRoomSocial(state,room,player.id,{type:'reaction',reaction:'cow'},'twice',10000+SOCIAL_COOLDOWN).reactions).toHaveLength(1);
 });
 it('caps history and request memory and allows only one live reaction per player',()=>{
  let state=emptySocial();for(let i=0;i<200;i++)state=applyRoomSocial(state,room,player.id,{type:'chat',text:String(i)},`m-${i}`,i*SOCIAL_COOLDOWN);
  expect(state.messages).toHaveLength(CHAT_HISTORY);expect(state.messages[0].text).toBe('120');expect(state.seen[player.id]).toHaveLength(128);
  state=applyRoomSocial(state,room,player.id,{type:'reaction',reaction:'cow'},'r-1',250000);
  state=applyRoomSocial(state,room,player.id,{type:'reaction',reaction:'cow'},'r-2',252000);
  expect(state.messages).toHaveLength(CHAT_HISTORY);expect(state.reactions).toHaveLength(1);
  expect(socialView(state,room,252000+SOCIAL_DURATION).reactions).toEqual([]);
  forgetSocialActor(state,player.id);expect(state.seen[player.id]).toBeUndefined();expect(state.reactions).toEqual([]);
 });
});
