import {applyMatch,roomLimits,viewMatch,type MatchState,type RoomInfo,type RoomPlayer} from './room';
import {supportsBots,validBotDifficulty,chooseBotCommand} from './bots';

export const BOT_TURN_DELAY=700;
export type BotControl = {type:'addBot';difficulty:unknown}|{type:'setBotDifficulty';playerID:unknown;difficulty:unknown}|{type:'removeBot';playerID:unknown};

/** Room-owned seats have no credential and can never authenticate as a human. */
export function changeBots(room:RoomInfo,actor:string,command:BotControl):RoomPlayer[] {
 if(actor!==room.hostID||room.started)throw new Error('只有房主能在准备室设置人机');
 if(!supportsBots(room.kind))throw new Error('此游戏需要真人交流，不支持人机');
 let players:RoomPlayer[];
 if(command.type==='addBot'){
  const difficulty=validBotDifficulty(command.difficulty);
  if(room.players.length>=roomLimits(room.kind,room.options).max)throw new Error('房间已满');
  let number=1;while(room.players.some(p=>p.name===`Mocha ${number}`))number++;
  players=[...room.players,{id:`bot_${crypto.randomUUID()}`,name:`Mocha ${number}`,avatar:'🤖',bot:{difficulty},ready:true,connected:true}];
 }else{
  const target=room.players.find(p=>p.id===command.playerID&&p.bot);
  if(!target)throw new Error('人机席位不存在');
  if(command.type==='removeBot')players=room.players.filter(p=>p.id!==target.id);
  else {const difficulty=validBotDifficulty(command.difficulty);players=room.players.map(p=>p.id===target.id?{...p,bot:{difficulty}}:p);}
 }
 // A changed opponent/level requires humans to confirm readiness again.
 return players.map(p=>({...p,ready:!!p.bot||p.id===room.hostID}));
}

/** Between rounds, let a human review the score before continuing. */
export function nextBotSeat(room:RoomInfo,match:MatchState):RoomPlayer|undefined {
 if(!room.started||!supportsBots(room.kind))return;
 // Rotate simultaneous responders so one bot cannot monopolize the scheduler.
 for(let offset=0;offset<room.players.length;offset++){
  const p=room.players[(match.revision+offset)%room.players.length];if(!p.bot)continue;
  const view=viewMatch(match,room.kind,p.id).view;
  // A passed Kittens responder may still hold Nope; do not reopen their response
  // window just because the human players have not finished responding yet.
  if(room.kind==='bombs'&&view.board.phase==='response'&&(view.board.response as {passed?:string[]}|undefined)?.passed?.includes(p.id))continue;
  if(!view.finished&&view.actions.some(a=>a.id!=='cancel'&&a.id!=='nextRound'))return p;
 }
}

/** The host acknowledges a bot-owned between-round continuation, never a play. */
export function continueBotRound(room:RoomInfo,match:MatchState,actor:string):MatchState {
 if(actor!==room.hostID||!room.started)throw new Error('只有房主能开始下一轮');
 const player=room.players.find(p=>p.bot&&viewMatch(match,room.kind,p.id).view.actions.some(a=>a.id==='nextRound'));
 if(!player)throw new Error('当前没有待开始的下一轮');
 return applyMatch(match,room.kind,room.players,player.id,{action:'nextRound',values:[]},`bot-round:${match.revision}`,match.actorRevisions[player.id]);
}

/** Exactly one authoritative transition; callers persist and publish before scheduling more. */
export function stepBot(room:RoomInfo,match:MatchState):MatchState {
 const player=nextBotSeat(room,match);if(!player?.bot)return match;
 const {view,actionRevision}=viewMatch(match,room.kind,player.id);
 const command=chooseBotCommand(view,player.id,player.bot.difficulty,match.revision);
 if(!command)throw new Error('人机暂时无法行动，请重试');
 return applyMatch(match,room.kind,room.players,player.id,command,`bot:${match.revision}:${player.id}`,actionRevision);
}
