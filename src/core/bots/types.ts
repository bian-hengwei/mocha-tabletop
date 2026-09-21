import type { Command, GameView } from '../types';
export type BotDifficulty = 'easy' | 'normal' | 'hard';
/** Policies receive only the same redacted view as a human in this seat. */
export type BotPolicy = (view: GameView, selfID: string, difficulty: BotDifficulty, rng: () => number) => Command | undefined;
