import {describe,it,expect} from 'vitest';
import {BOT_GAMES,supportsBots,chooseBotCommand} from '../src/core/bots';
import {changeBots,nextBotSeat} from '../src/core/roomBots';
import {createMatch,validProfile,validateMatchForRoom,type RoomInfo} from '../src/core/room';
import {modules} from '../src/core/registry';
import {GAMES} from '../src/core/types';
const host={id:'host0000',name:'Human',avatar:'🦊',ready:true,connected:true};
const lobby=():RoomInfo=>({code:'ABC234',kind:'uno',mode:'cloud',hostID:host.id,players:[host],pending:[],started:false,revision:1});
describe('mixed human/bot room contract',()=>{
 it('supports one human with nine bots, configured independently, without exceeding the actual game limit',()=>{
  const room=lobby();for(let i=0;i<9;i++)room.players=changeBots(room,host.id,{type:'addBot',difficulty:i%2?'hard':'easy'});
  expect(room.players).toHaveLength(10);expect(new Set(room.players.map(p=>p.id)).size).toBe(10);expect(room.players.filter(p=>p.bot?.difficulty==='hard')).toHaveLength(4);
  expect(()=>changeBots(room,host.id,{type:'addBot',difficulty:'normal'})).toThrow('已满');
 });
 it('supports all eight games at their actual minimum and maximum tables',()=>{
  for(const kind of BOT_GAMES)for(const count of new Set([GAMES[kind].min,GAMES[kind].max])){
   const room={...lobby(),kind};for(let i=1;i<count;i++)room.players=changeBots(room,host.id,{type:'addBot',difficulty:'normal'});
   const match=createMatch(kind,room.players);expect(modules[kind].view(match.game,host.id).finished).toBe(false);
   expect(validateMatchForRoom(match,room).game.players).toEqual(room.players);
  }
 });
 it('excludes discussion games and prevents forged robot credentials',()=>{
  for(const kind of ['werewolf','avalon','codenames','undercover'] as const){expect(supportsBots(kind)).toBe(false);expect(()=>changeBots({...lobby(),kind},host.id,{type:'addBot',difficulty:'normal'})).toThrow('真人交流');}
  const room=lobby(),bot=changeBots(room,host.id,{type:'addBot',difficulty:'normal'})[1];expect(()=>validProfile({...bot,avatar:'🦊'})).toThrow('身份');
  expect(validProfile({...host,bot:{difficulty:'hard'}})).not.toHaveProperty('bot');
 });
 it('checks saved bot identity and settings while retaining compatibility with human-only rooms',()=>{
  const room={...lobby(),kind:'gems' as const};room.players=changeBots(room,host.id,{type:'addBot',difficulty:'hard'});const match=createMatch('gems',room.players);
  expect(validateMatchForRoom(JSON.parse(JSON.stringify(match)),room).revision).toBe(1);match.game.players[1].bot.difficulty='easy';expect(()=>validateMatchForRoom(match,room)).toThrow('人机设置');
 });
 it('uses only the seat view for decisions and has deterministic retries',()=>{
  const room={...lobby(),kind:'sushi' as const};room.players=changeBots(room,host.id,{type:'addBot',difficulty:'hard'});const match=createMatch('sushi',room.players),bot=room.players[1];
  const view=modules.sushi.view(match.game,bot.id),before=structuredClone(view);
  const command=chooseBotCommand(view,bot.id,'hard',4);expect(command).toEqual(chooseBotCommand(view,bot.id,'hard',4));expect(view).toEqual(before);
  match.game.hands[0].reverse();expect(chooseBotCommand(modules.sushi.view(match.game,bot.id),bot.id,'hard',4)).toEqual(command);
  room.started=true;expect(nextBotSeat(room,match)?.id).toBe(bot.id);
 });
});

describe('human review between rounds',()=>{
 it('waits for the human host to review a Color Dash round score',()=>{
  const room=lobby();room.players=changeBots(room,host.id,{type:'addBot',difficulty:'hard'});room.started=true;const match=createMatch('uno',room.players);
  match.game.phase='roundEnd';match.game.roundWinner=room.players[1].id;
  expect(modules.uno.view(match.game,host.id).actions.map(a=>a.id)).toContain('nextRound');expect(nextBotSeat(room,match)).toBeUndefined();
 });
 it('does not reopen a Kittens response just because a passed bot still has Nope',()=>{
  const room={...lobby(),kind:'bombs' as const};room.players=changeBots(room,host.id,{type:'addBot',difficulty:'normal'});room.started=true;const match=createMatch('bombs',room.players),bot=room.players[1];
  match.game.hands[bot.id]=[{id:'only-nope',kind:'nope',title:'否决'}];match.game.phase={kind:'response',effect:{actor:host.id,cards:[{id:'favor',kind:'favor',title:'索取'}],target:bot.id,cancelled:false,passed:[bot.id]}};
  expect(modules.bombs.view(match.game,bot.id).actions.map(a=>a.id)).toEqual(['nope']);expect(nextBotSeat(room,match)).toBeUndefined();
 });
});

it('holds a bot-owned Guan Dan round score until the host continues',async()=>{
 const {continueBotRound}=await import('../src/core/roomBots');
 const room={...lobby(),kind:'guandan' as const};for(let i=0;i<3;i++)room.players=changeBots(room,host.id,{type:'addBot',difficulty:'normal'});room.started=true;
 const match=createMatch('guandan',room.players);match.game.phase='roundEnd';match.game.current=1;match.game.previousOrder=[0,2,1,3];
 expect(nextBotSeat(room,match)).toBeUndefined();expect(()=>continueBotRound(room,match,room.players[2].id)).toThrow('房主');
 const next=continueBotRound(room,match,host.id);expect(next.game.round).toBe(2);expect(match.game.round).toBe(1);expect(next.game.phase).not.toBe('roundEnd');
 expect(()=>continueBotRound(room,next,host.id)).toThrow('没有');
});
