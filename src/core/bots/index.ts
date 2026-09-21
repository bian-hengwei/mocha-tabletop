import {seeded, type GameKind, type GameView, type Command} from '../types';
import type {BotDifficulty} from './types';
import {classicBot} from './classic';
import {cardsBot} from './cards';

export const BOT_GAMES: readonly GameKind[] = ['doudizhu','guandan','mahjong','gems','bombs','sushi','century','uno'];
export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ['easy','normal','hard'];
export function supportsBots(kind:GameKind){return BOT_GAMES.includes(kind);}
export function validBotDifficulty(value:unknown):BotDifficulty {
 if(!BOT_DIFFICULTIES.includes(value as BotDifficulty))throw new Error('人机难度无效');
 return value as BotDifficulty;
}
export function chooseBotCommand(view:GameView,selfID:string,difficulty:BotDifficulty,revision:number):Command|undefined {
 if(view.finished||!supportsBots(view.kind))return;
 // Stable across reconnects and alarm retries, without deriving randomness from secrets.
 let seed=revision;for(const c of selfID)seed=Math.imul(seed,31)+c.charCodeAt(0)|0;
 const policy=['doudizhu','guandan','mahjong'].includes(view.kind)?classicBot:cardsBot;
 return policy(view,selfID,difficulty,seeded(seed));
}
