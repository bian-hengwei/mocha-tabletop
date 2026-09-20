import { expect, it } from 'vitest';
import { century, centuryScore, type CenturyState, type SpiceOrder } from '../src/core/games/century';
import type { Command, Player } from '../src/core/types';

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const players = (count: number): Player[] => Array.from({ length: count }, (_, i) => ({ id: `caravan-${i}`, name: `Caravan ${i + 1}`, avatar: '🦊' }));

// A deliberately simple legal player wins orders using only the two starting
// merchants. This exercises long games, conserved coin supplies and the final
// round without injecting an almost-finished state.
function command(state: CenturyState, targets: Array<string | undefined>): Command {
  const caravan = state.caravans[state.current];
  const actions = century.view(state, state.players[state.current].id).actions;
  let target = state.goals.find(order => order.id === targets[state.current]);
  if (!target) {
    const effort = (order: SpiceOrder) => order.cost.reduce((n, amount, tier) => n + Math.max(0, amount - caravan.cubes[tier]) * (tier + 1), 0);
    target = [...state.goals].sort((a, b) => effort(a) - effort(b))[0];
    targets[state.current] = target.id;
  }
  const upgradeColor = () => {
    for (let tier = 3; tier > 0; tier--) if (caravan.cubes[tier] < target.cost[tier]) {
      for (let lower = tier - 1; lower >= 0; lower--) if (caravan.cubes[lower] > target.cost[lower]) return lower;
    }
    return -1;
  };
  if (state.phase === 'upgrade') {
    const color = upgradeColor();
    return color >= 0 ? { action: 'upgrade', values: [String(color)] } : { action: 'done', values: [] };
  }
  if (state.phase === 'discard') {
    const discard = actions[0];
    const expendable = discard.choices.filter(choice => {
      const [color, index] = choice.id.split(':').map(Number);
      return index >= target.cost[color];
    });
    return { action: 'discard', values: expendable.slice(0, discard.min).map(choice => choice.id) };
  }
  const claim = actions.find(action => action.id === 'claim');
  if (claim) return { action: 'claim', values: [claim.choices[0].id] };
  const upgrade = caravan.hand.find(card => card.type === 'upgrade');
  if (upgrade && upgradeColor() >= 0) return { action: 'play', values: [upgrade.id] };
  const gain = caravan.hand.find(card => card.type === 'gain');
  if (gain && sum(caravan.cubes) < 10) return { action: 'play', values: [gain.id] };
  return { action: 'rest', values: [] };
}

it.each([2, 3, 4, 5])('finishes a %i-player Century match with its real market and orders', count => {
  let state = century.create(players(count), 137 + count);
  const targets: Array<string | undefined> = [];
  for (let step = 0; step < 5000 && !state.finished; step++) {
    const actor = state.players[state.current].id;
    state = JSON.parse(JSON.stringify(century.apply(state, actor, command(state, targets))));
    for (const caravan of state.caravans) {
      expect(caravan.cubes.every(n => Number.isInteger(n) && n >= 0)).toBe(true);
      expect(sum(caravan.cubes)).toBeLessThanOrEqual(state.phase === 'discard' ? 12 : 10);
    }
    const orders = [...state.orders, ...state.goals, ...state.caravans.flatMap(caravan => caravan.orders)];
    expect(orders).toHaveLength(36);
    expect(new Set(orders.map(order => order.id)).size).toBe(36);
    expect(state.gold + state.caravans.reduce((n, caravan) => n + caravan.gold, 0)).toBe(count * 2);
    expect(state.silver + state.caravans.reduce((n, caravan) => n + caravan.silver, 0)).toBe(count * 2);
  }
  expect(state.finished, `stalled at round ${state.round}`).toBe(true);
  expect(state.finalRound).toBe(true);
  expect(state.current).toBe(count - 1);
  const high = Math.max(...state.caravans.map(centuryScore));
  expect(state.winners).toEqual([state.players[state.caravans.map(centuryScore).lastIndexOf(high)].id]);
  for (const p of state.players) expect(century.view(state, p.id).actions).toEqual([]);
}, 30000);
