import { describe, expect, it } from 'vitest';
import { cardsBot } from '../src/core/bots/cards';
import { seeded, type GameModule, type Player } from '../src/core/types';
import { gems } from '../src/core/games/gems';
import { bombs, type BombCard, type BombKind } from '../src/core/games/bombs';
import { sushi, type SushiCard, type SushiKind } from '../src/core/games/sushi';
import { century } from '../src/core/games/century';
import { uno, type UnoCard } from '../src/core/games/uno';

type Difficulty = 'easy' | 'normal' | 'hard';
type Run = { game: GameModule; playerCount: number; seed: number; limit: number; options?: { unoMode?: 'single' | 'match' } };

const players = (count: number): Player[] => Array.from({ length: count }, (_, index) => ({ id: `bot-${index}`, name: `Bot ${index}`, avatar: '🐱' }));
const bombCard = (kind: BombKind, id: string = kind): BombCard => ({ id, kind, title: kind });
const sushiCard = (kind: SushiKind, id = kind): SushiCard => ({ id, kind });
const unoCard = (id: string, color: UnoCard['color'], value: UnoCard['value']): UnoCard => ({ id, color, value });

function playToTerminal(run: Run, difficulty: Difficulty) {
  const roster = players(run.playerCount);
  let state = run.game.create(roster, run.seed, run.options);
  const rng = roster.map((_, index) => seeded(run.seed * 101 + index));
  let steps = 0;
  for (; !run.game.view(state, roster[0].id).finished && steps < run.limit; steps++) {
    const candidate = roster.map((player, index) => {
      const view = run.game.view(state, player.id);
      // Undefined is an already-passed optional responder, not a failed decision.
      return { player, index, view, command: cardsBot(view, player.id, difficulty, rng[index]) };
    }).find(item => item.command);
    expect(candidate, `${run.game.view(state, roster[0].id).kind} needs a non-optional bot command`).toBeDefined();
    const legal = candidate!.view.actions.find(action => action.id === candidate!.command!.action);
    expect(legal).toBeDefined();
    expect(candidate!.command!.values.length).toBeGreaterThanOrEqual(legal!.min);
    expect(candidate!.command!.values.length).toBeLessThanOrEqual(legal!.max);
    expect(candidate!.command!.values.every(value => legal!.choices.some(choice => choice.id === value))).toBe(true);
    state = run.game.apply(state, candidate!.player.id, candidate!.command!);
  }
  expect(run.game.view(state, roster[0].id).finished, `${run.game.view(state, roster[0].id).kind} did not finish in ${steps} steps`).toBe(true);
}

describe('redacted card bots', () => {
  it('uses only currently offered commands and never cancels a locked Sushi selection', () => {
    let state = sushi.create(players(3), 13);
    const first = sushi.view(state, 'bot-0');
    const picked = cardsBot(first, 'bot-0', 'hard', seeded(3))!;
    expect(first.actions.some(action => action.id === picked.action && picked.values.every(value => action.choices.some(choice => choice.id === value)))).toBe(true);
    state = sushi.apply(state, 'bot-0', picked);
    expect(cardsBot(sushi.view(state, 'bot-0'), 'bot-0', 'hard', seeded(3))).toBeUndefined();
  });

  it('keeps a sole Defuse over a cat card and skips optional-only Nope responses', () => {
    const state = bombs.create(players(2), 8);
    state.phase = { kind: 'give', actor: 'bot-1', target: 'bot-0' };
    state.hands['bot-0'] = [bombCard('defuse', 'defuse'), bombCard('moonCat', 'cat'), bombCard('nope', 'nope')];
    expect(cardsBot(bombs.view(state, 'bot-0'), 'bot-0', 'hard', seeded(1))).toEqual({ action: 'give', values: ['cat'] });

    state.phase = { kind: 'response', effect: { actor: 'bot-1', cards: [bombCard('favor')], target: 'bot-0', cancelled: false, passed: ['bot-0'] } };
    expect(bombs.view(state, 'bot-0').actions.map(action => action.id)).toEqual(['nope']);
    expect(cardsBot(bombs.view(state, 'bot-0'), 'bot-0', 'normal', seeded(2))).toBeUndefined();
    expect(cardsBot(bombs.view(state, 'bot-0'), 'bot-0', 'hard', seeded(2))?.action).toBe('nope');
  });

  it('defuses bombs rather than deliberately exploding', () => {
    const state = bombs.create(players(2), 8);
    state.current = 'bot-0';
    state.phase = { kind: 'bomb', card: bombCard('bomb', 'test-bomb') };
    expect(cardsBot(bombs.view(state, 'bot-0'), 'bot-0', 'normal', seeded(1))).toEqual({ action: 'defuse', values: [] });
  });

  it('uses an independently payable Gem purchase and does not reserve a remote market card', () => {
    let payable = gems.create(players(2), 3);
    const card = payable.market[0][0];
    payable.merchants[0].tokens = [...card.cost, 0];
    const buy = gems.view(payable, 'bot-0').actions.find(action => action.id === 'buy')!;
    payable = gems.apply(payable, 'bot-0', { action: 'buy', values: [buy.choices.find(choice => choice.id === card.id)!.id] });
    expect(cardsBot(gems.view(payable, 'bot-0'), 'bot-0', 'hard', seeded(2))).toEqual({ action: 'pay_auto', values: [] });

    const remote = gems.create(players(2), 4);
    remote.market = remote.market.map(tier => tier.map(marketCard => ({ ...marketCard, points: 7, tier: 3, cost: [5, 5, 5, 5, 5] })));
    expect(cardsBot(gems.view(remote, 'bot-0'), 'bot-0', 'hard', seeded(3))?.action).toBe('take_distinct');
  });

  it('chooses real UNO color majorities and ordered hard Sushi wasabi-nigiri picks', () => {
    const unoState = uno.create(players(2), 6, { unoMode: 'single' });
    unoState.current = 0;
    unoState.phase = 'play';
    unoState.color = 'red';
    unoState.discard = [unoCard('top', 'red', 1)];
    unoState.hands[0] = [unoCard('wild', 'wild', 'wild'), unoCard('blue-1', 'blue', 1), unoCard('blue-2', 'blue', 2), unoCard('yellow', 'yellow', 1)];
    expect(cardsBot(uno.view(unoState, 'bot-0'), 'bot-0', 'hard', seeded(4))).toEqual({ action: 'wild:wild', values: ['blue'] });
    unoState.phase = 'color';
    expect(cardsBot(uno.view(unoState, 'bot-0'), 'bot-0', 'hard', seeded(4))).toEqual({ action: 'color', values: ['blue'] });

    const sushiState = sushi.create(players(2), 9);
    sushiState.table[0] = [sushiCard('chopsticks', 'chopsticks')];
    sushiState.hands[0] = [sushiCard('wasabi', 'wasabi'), sushiCard('squid', 'squid'), sushiCard('egg', 'egg')];
    expect(cardsBot(sushi.view(sushiState, 'bot-0'), 'bot-0', 'hard', seeded(5))).toEqual({ action: 'pick', values: ['wasabi', 'squid'] });
  });

  it('rests Century merchants before accumulating an unbounded hand of recruits', () => {
    const state = century.create(players(2), 12);
    state.caravans[0].played = [...state.caravans[0].hand];
    state.caravans[0].hand = [];
    expect(cardsBot(century.view(state, 'bot-0'), 'bot-0', 'hard', seeded(6))).toEqual({ action: 'rest', values: [] });
  });

  it.each(['easy', 'normal', 'hard'] as const)('completes seeded %s all-bot games through terminal states', difficulty => {
    for (const run of [
      { game: gems, playerCount: 3, seed: 11, limit: 2500 },
      { game: bombs, playerCount: 3, seed: 12, limit: 2500 },
      { game: sushi, playerCount: 4, seed: 13, limit: 500 },
      { game: century, playerCount: 3, seed: 14, limit: 5000 },
      { game: uno, playerCount: 3, seed: 15, limit: 18000, options: { unoMode: 'match' as const } },
    ]) playToTerminal(run, difficulty);
  });

  it.each(['easy', 'normal', 'hard'] as const)('remains live across min/max player counts and multiple seeds at %s', difficulty => {
    const ranges: Array<Omit<Run, 'playerCount' | 'seed'>> = [
      { game: gems, limit: 3000 }, { game: bombs, limit: 3000 }, { game: sushi, limit: 600 }, { game: century, limit: 6000 },
      { game: uno, limit: 24000, options: { unoMode: 'match' } },
    ];
    const counts = [[2, 4], [2, 5], [2, 5], [2, 5], [2, 10]];
    for (const [index, range] of ranges.entries()) for (const playerCount of counts[index]) for (const seed of [31 + index, 71 + index]) {
      playToTerminal({ ...range, playerCount, seed }, difficulty);
    }
  }, 30000); // Twenty complete matches per difficulty also run on shared CI CPUs.
});
