import { describe, expect, it } from 'vitest';
import { doudizhu, guandan, type PokerCard, type PokerState } from '../src/core/games/poker';
import { mahjong, mahjongTiles, type MahjongMode, type MahjongState, type Tile } from '../src/core/games/mahjong';
import { classicBot } from '../src/core/bots/classic';
import type { BotDifficulty } from '../src/core/bots/types';
import { seeded, type Command, type Player } from '../src/core/types';

const players: Player[] = Array.from({ length: 4 }, (_, index) => ({
  id: `classic-bot-${index}`,
  name: `Bot ${index}`,
  avatar: '🐶',
}));

const difficulties: BotDifficulty[] = ['easy', 'normal', 'hard'];
const modes: MahjongMode[] = ['guangdong', 'sichuan', 'bloodflow', 'laizi', 'bloodflowAny', 'bloodflowThree', 'redBloodflow', 'redBattle', 'guangdongFan', 'guangdongGhost'];
const cards = (ranks: number[], suits?: number[]): PokerCard[] =>
  ranks.map((rank, index) => ({ id: `fixed-${index}`, rank, suit: suits?.[index] ?? index % 4 }));

function botCommand(player: Player, view: Parameters<typeof classicBot>[0], difficulty: BotDifficulty, seed: number) {
  const command = classicBot(view, player.id, difficulty, seeded(seed));
  expect(command).toBeDefined();
  return command as Command;
}

function activePlayer(state: PokerState | MahjongState): { player: Player; command: (difficulty: BotDifficulty, seed: number) => Command } {
  if ('mode' in state) {
    const player = players.find(candidate => mahjong.view(state, candidate.id).actions.length);
    expect(player).toBeDefined();
    const selected = player as Player;
    return {
      player: selected,
      command: (difficulty, seed) => botCommand(selected, mahjong.view(state, selected.id), difficulty, seed),
    };
  }
  const game = state.kind === 'guandan' ? guandan : doudizhu;
  const player = players.find(candidate => game.view(state, candidate.id).actions.length);
  expect(player).toBeDefined();
  const selected = player as Player;
  return {
    player: selected,
    command: (difficulty, seed) => botCommand(selected, game.view(state, selected.id), difficulty, seed),
  };
}

function assertPokerConservation(state: PokerState) {
  const all = [...state.hands.flat(), ...state.played, ...(state.landlord < 0 ? state.bottom : [])];
  expect(all).toHaveLength(state.kind === 'guandan' ? 108 : 54);
  expect(new Set(all.map(card => card.id))).toHaveLength(all.length);
}

function assertMahjongConservation(state: MahjongState) {
  const all = [
    ...state.hands.flat(),
    ...state.wall,
    ...state.melds.flat().flatMap(meld => meld.tiles),
    ...state.discards.flat(),
    ...(state.winningTiles??[]),
    ...(state.indicator?[state.indicator]:[]),
  ];
  expect(all).toHaveLength(mahjongTiles(state.mode).length);
  expect(new Set(all.map(tile => tile.id))).toHaveLength(all.length);
  expect(state.scores.reduce((total, score) => total + score, 0)).toBe(0);
}

function runDoudizhu(difficulty: BotDifficulty, seed: number) {
  let state = doudizhu.create(players.slice(0, 3), seed);
  let steps = 0;
  while (!state.finished && steps++ < 2000) {
    const actor = activePlayer(state);
    const command = actor.command(difficulty, seed * 100003 + steps);
    state = doudizhu.apply(state, actor.player.id, command);
    if (steps % 25 === 0) state = JSON.parse(JSON.stringify(state));
  }
  expect(steps).toBeLessThan(2000);
  expect(state.finished).toBe(true);
  expect(state.winners.length).toBeGreaterThan(0);
  assertPokerConservation(state);
}

function runGuandan(difficulty: BotDifficulty, seed: number) {
  let state = guandan.create(players, seed);
  let steps = 0;
  let tributeReturns = 0;
  while (!state.finished && steps++ < 30000) {
    const actor = activePlayer(state);
    const command = actor.command(difficulty, seed * 100003 + steps);
    if (command.action === 'return') tributeReturns++;
    state = guandan.apply(state, actor.player.id, command);
    if (steps % 50 === 0) {
      state = JSON.parse(JSON.stringify(state));
      assertPokerConservation(state);
    }
  }
  expect(steps).toBeLessThan(30000);
  expect(state.finished).toBe(true);
  expect(state.level).toBe(14);
  expect(state.round).toBeGreaterThan(1);
  expect(state.winners).toHaveLength(2);
  assertPokerConservation(state);
  return tributeReturns;
}

function runMahjong(mode: MahjongMode, difficulty: BotDifficulty, seed: number) {
  let state = mahjong.create(players, seed, { mahjongMode: mode });
  let steps = 0;
  while (!state.finished && steps++ < 1600) {
    const actor = activePlayer(state);
    const command = actor.command(difficulty, seed * 100003 + steps);
    state = mahjong.apply(state, actor.player.id, command);
    if (steps % 25 === 0) {
      state = JSON.parse(JSON.stringify(state));
      assertMahjongConservation(state);
    }
  }
  expect(steps).toBeLessThan(1600);
  expect(state.finished).toBe(true);
  expect(state.scores.reduce((total, score) => total + score, 0)).toBe(0);
  assertMahjongConservation(state);
}

describe('classic bot decisions', () => {
  it.each(difficulties)('makes legal Dou Dizhu bids and opening plays (%s)', difficulty => {
    let state = doudizhu.create(players.slice(0, 3), 1);
    const first = activePlayer(state);
    const bid = first.command(difficulty, 11);
    expect(bid.action).toBe('bid');
    expect(['0', '1', '2', '3']).toContain(bid.values[0]);
    state = doudizhu.apply(state, first.player.id, bid);

    state.phase = 'play';
    state.landlord = 0;
    state.current = 0;
    state.last = null;
    state.hands[0] = cards([3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
    const view = doudizhu.view(state, players[0].id);
    const play = classicBot(view, players[0].id, difficulty, seeded(12)) as Command;
    expect(play.action).toBe('play');
    for (const id of play.values) expect(view.board.hand.some((card: PokerCard) => card.id === id)).toBe(true);
    state = doudizhu.apply(state, players[0].id, play);
    expect(state.last).not.toBeNull();
  });

  it.each(difficulties)('bids aggressively with a strong Dou Dizhu hand (%s)', difficulty => {
    const state = doudizhu.create(players.slice(0, 3), 5);
    state.hands[0] = cards([16, 17, 15, 15, 14, 14, 13, 13, 12, 12, 11, 11, 10, 10, 9, 9, 8]);
    const command = classicBot(doudizhu.view(state, players[0].id), players[0].id, difficulty, seeded(6)) as Command;
    expect(command).toEqual({ action: 'bid', values: ['3'] });
  });

  it('normal and hard farmers avoid beating their partner', () => {
    const state = doudizhu.create(players.slice(0, 3), 9);
    state.phase = 'play';
    state.landlord = 0;
    state.current = 1;
    state.hands[0] = cards([9, 9, 9]);
    state.hands[1] = cards([6]);
    state.hands[2] = cards([4]);
    state.last = {
      player: 2,
      cards: cards([3]),
      combo: { type: '单张', power: 3, size: 1, bomb: 0 },
    };
    for (const difficulty of ['normal', 'hard'] as const) {
      const command = classicBot(doudizhu.view(state, players[1].id), players[1].id, difficulty, seeded(7)) as Command;
      expect(command).toEqual({ action: 'pass', values: [] });
    }
  });

  it('declares a legal Guan Dan interpretation instead of relying on strongest defaults', () => {
    const state = guandan.create(players, 3);
    state.phase = 'play';
    state.current = 0;
    state.last = null;
    state.hands[0] = [...cards([3, 4, 5, 6, 7], [0, 0, 0, 0, 0]), { id: 'fixed-spare', rank: 9, suit: 2 }];
    const view = guandan.view(state, players[0].id);
    for (const difficulty of ['normal', 'hard'] as const) {
      const command = classicBot(view, players[0].id, difficulty, seeded(8)) as Command;
      expect(command.action).toBe('play');
      expect(command.text).toMatch(/^(单张|对子|三张|三带二|顺子|三连对|钢板|炸弹|同花顺|四大天王):\d+:\d+:\d+$/u);
      expect(() => guandan.apply(state, players[0].id, command)).not.toThrow();
    }
  });

  it('selects same-suit Mahjong exchange and a valid missing suit', () => {
    let state = mahjong.create(players, 4, { mahjongMode: 'sichuan' });
    const first = activePlayer(state);
    const exchange = first.command('hard', 13);
    expect(exchange.action).toBe('exchange');
    const view = mahjong.view(state, first.player.id);
    const hand: Tile[] = view.board.hand;
    const suits = new Set(exchange.values.map(id => Math.floor(hand.find(tile => tile.id === id)!.value / 9)));
    expect(suits.size).toBe(1);
    state = mahjong.apply(state, first.player.id, exchange);

    state.phase = 'que';
    state.missing = {};
    const que = classicBot(mahjong.view(state, players[0].id), players[0].id, 'normal', seeded(14)) as Command;
    expect(que.action).toBe('que');
    expect(['0', '1', '2']).toContain(que.values[0]);
    state = mahjong.apply(state, players[0].id, que);
    expect(state.missing[0]).toBe(Number(que.values[0]));
  });

  it('is deterministic for the same view and seeded rng', () => {
    const state = guandan.create(players, 15);
    const view = guandan.view(state, players[0].id);
    expect(classicBot(view, players[0].id, 'easy', seeded(16)))
      .toEqual(classicBot(view, players[0].id, 'easy', seeded(16)));
  });
});

describe('classic bot simulations', () => {
  it.each(difficulties)('finishes seeded Dou Dizhu games (%s)', difficulty => {
    for (const seed of [1, 2, 3, 4]) runDoudizhu(difficulty, seed);
  }, 30000);

  it.each(difficulties)('finishes complete Guan Dan matches through A (%s)', difficulty => {
    for (const seed of [1, 2]) {
      const returns = runGuandan(difficulty, seed);
      expect(returns).toBeGreaterThanOrEqual(0);
    }
  }, 60000);

  it.each(modes)('finishes every difficulty in Mahjong %s', mode => {
    for (const difficulty of difficulties) {
      for (const seed of [1, 2, 3]) runMahjong(mode, difficulty, seed);
    }
  }, 60000);
});
