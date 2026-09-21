import type { Action, Choice, Command, GameView } from '../types';
import type { BotDifficulty, BotPolicy } from './types';

type Card = { id: string; kind?: string; color?: string; value?: number | string; points?: number; tier?: number; bonus?: string; cost?: number[]; type?: string; gain?: number[]; upgrades?: number };
type GemPlayer = { id: string; tokens: number[]; bonuses: number[]; score: number; reservedCount: number; bought: Card[]; nobles: { cost: number[] }[] };
type GemsBoard = { phase: string; hand: Card[]; market: Card[]; bank: number[]; nobles: { id: string; cost: number[] }[]; players: GemPlayer[]; finalRound: boolean };
type BombPlayer = { id: string; alive: boolean; count: number };
type BombBoard = { phase: string; hand: Card[]; players: BombPlayer[]; current: string; deckCount: number; turnsRemaining: number; response?: { actor: string; cards: Card[]; target: string | null; requested: string | null; cancelled: boolean } };
type SushiPlayer = { id: string; table: Card[]; score: number; puddings: number; handCount: number };
type SushiBoard = { hand: Card[]; selected: string[] | null; round: number; players: SushiPlayer[] };
type SpiceCard = Card & { type: 'gain' | 'upgrade' | 'trade'; gain: number[]; cost: number[]; upgrades: number };
type CenturyBoard = { phase: string; hand: SpiceCard[]; played: SpiceCard[]; cubes: number[]; orders: { points: number }[]; active: SpiceCard | null; remaining: number; market: { card: SpiceCard; bonus: number[] }[]; goals: { id: string; cost: number[]; points: number }[]; players: { id: string; cubes: number[]; orderCount: number; score: number }[]; finalRound: boolean };
type UnoCard = Card & { color: string; value: number | string };
type UnoBoard = { phase: string; hand: UnoCard[]; top?: UnoCard; color: string; drawn: string | null; players: { id: string; handCount: number; score: number }[]; mode: string; roundNumber: number };

const colors = ['white', 'blue', 'green', 'red', 'black'];
const spiceValue = [1, 2, 4, 7];
const action = (view: GameView, id: string) => view.actions.find(candidate => candidate.id === id);
const command = (candidate: Action | undefined, values: string[] = []): Command | undefined => candidate ? { action: candidate.id, values } : undefined;
const randomChoice = (choices: Choice[], rng: () => number) => choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))];
const first = (candidate: Action | undefined) => candidate?.choices[0];
const choose = <T>(items: T[], score: (item: T) => number, rng: () => number, noise = 0): T | undefined => {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const item of items) {
    const value = score(item) + (noise ? rng() * noise : 0);
    if (value > bestScore) { best = item; bestScore = value; }
  }
  return best;
};
const countKind = (cards: Card[], kind: string) => cards.filter(card => card.kind === kind).length;
const countColor = (cards: UnoCard[], color: string) => cards.filter(card => card.color === color).length;
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const colorIndex = (color: string) => colors.indexOf(color);
const actionChoice = (candidate: Action | undefined, id: string) => candidate?.choices.find(choice => choice.id === id);
const bombUtility = (card: Card | undefined) => card?.kind === 'defuse' ? 100 : card?.kind === 'nope' ? 60 : card?.kind === 'attack' ? 30 : card?.kind === 'skip' ? 20 : card?.kind === 'future' ? 12 : 0;
const gemDeficit = (player: GemPlayer | undefined, card: Card) => {
  const colored = sum((card.cost ?? []).map((cost, index) => Math.max(0, cost - (player?.bonuses[index] ?? 0) - (player?.tokens[index] ?? 0))));
  return Math.max(0, colored - (player?.tokens[5] ?? 0));
};

function gemsBot(view: GameView, selfID: string, difficulty: BotDifficulty, rng: () => number): Command | undefined {
  const board = view.board as unknown as GemsBoard;
  const phase = board.phase;
  if (phase === 'payment') return command(action(view, 'pay_auto'));
  if (phase === 'noble') {
    const noble = choose(action(view, 'noble')?.choices ?? [], choice => {
      const target = board.nobles.find(item => item.id === choice.id);
      return target ? -sum(target.cost) : 0;
    }, rng, difficulty === 'easy' ? 2 : 0);
    return command(action(view, 'noble'), noble ? [noble.id] : []);
  }
  if (phase === 'discard') {
    const discard = action(view, 'discard');
    const mine = board.players.find(player => player.id === selfID);
    const values = [...(discard?.choices ?? [])].sort((a, b) => {
      const ai = colorIndex(a.id.split(':')[0]), bi = colorIndex(b.id.split(':')[0]);
      return (mine?.tokens[bi] ?? 0) - (mine?.tokens[ai] ?? 0);
    }).slice(0, discard?.min ?? 0).map(choice => choice.id);
    return command(discard, values);
  }
  const mine = board.players.find(player => player.id === selfID);
  const cardScore = (card: Card) => {
    const cost = card.cost ?? [];
    const deficit = gemDeficit(mine, card);
    const nobleFit = board.nobles.reduce((total, noble) => total + (card.bonus ? (noble.cost[colorIndex(card.bonus)] ?? 0) : 0), 0);
    return (card.points ?? 0) * 14 + (card.tier ?? 1) * 2 + nobleFit * 2 - deficit * 3 - sum(cost) * 0.15;
  };
  const buy = action(view, 'buy');
  if (buy) {
    const card = choose(buy.choices, choice => cardScore([...board.market, ...board.hand].find(card => card.id === choice.id) ?? { id: '' }), rng, difficulty === 'easy' ? 15 : 0);
    if (card) return command(buy, [card.id]);
  }
  const reserve = action(view, 'reserve');
  if (reserve && difficulty !== 'easy') {
    const opponents = board.players.filter(player => player.id !== selfID);
    const choice = choose(reserve.choices.filter(item => !item.id.startsWith('deck:')), item => {
      const card = board.market.find(candidate => candidate.id === item.id) ?? { id: '' };
      const threatened = opponents.some(player => gemDeficit(player, card) === 0);
      return cardScore(card) + (threatened ? 18 : 0) - gemDeficit(mine, card) * 8;
    }, rng);
    const card = choice && board.market.find(candidate => candidate.id === choice.id);
    if (card) {
      const deficit = gemDeficit(mine, card);
      const threatened = opponents.some(player => gemDeficit(player, card) === 0);
      const valuable = (card.points ?? 0) >= (difficulty === 'hard' ? 3 : 4);
      const nearAffordable = deficit <= (difficulty === 'hard' ? 2 : 1);
      if (valuable && nearAffordable && (board.finalRound || threatened || (card.points ?? 0) >= 5)) return command(reserve, [card.id]);
    }
  }
  const targetCosts = [...board.market, ...board.hand].sort((a, b) => cardScore(b) - cardScore(a)).slice(0, difficulty === 'hard' ? 3 : 1);
  const need = colors.map((_, index) => targetCosts.reduce((total, card) => total + Math.max(0, (card.cost?.[index] ?? 0) - (mine?.bonuses[index] ?? 0) - (mine?.tokens[index] ?? 0)), 0));
  const distinct = action(view, 'take_distinct');
  if (distinct) {
    const values = [...distinct.choices].sort((a, b) => need[colorIndex(b.id)] - need[colorIndex(a.id)] || Number(rng() > .5) - Number(rng() < .5)).slice(0, distinct.min).map(choice => choice.id);
    return command(distinct, values);
  }
  const pair = action(view, 'take_pair');
  if (pair) {
    const choice = choose(pair.choices, item => need[colorIndex(item.id)] + (difficulty === 'hard' ? (mine?.bonuses[colorIndex(item.id)] ?? 0) * .2 : 0), rng, difficulty === 'easy' ? 1 : 0);
    return command(pair, choice ? [choice.id] : []);
  }
  return command(action(view, 'reserve'), first(action(view, 'reserve')) ? [first(action(view, 'reserve'))!.id] : []) ?? command(action(view, 'pass'));
}

function bombsBot(view: GameView, selfID: string, difficulty: BotDifficulty, rng: () => number): Command | undefined {
  const board = view.board as unknown as BombBoard;
  if (board.phase === 'bomb') return command(action(view, 'defuse')) ?? command(action(view, 'explode'));
  if (board.phase === 'insert') {
    const insert = action(view, 'insert');
    const position = difficulty === 'hard' && board.deckCount > 2 ? String(Math.max(1, Math.floor(board.deckCount * .65))) : insert?.choices.at(-1)?.id;
    return command(insert, position ? [position] : []);
  }
  if (board.phase === 'response') {
    const response = board.response;
    const no = action(view, 'nope');
    const threatensMe = response?.target === selfID && !response.cancelled && difficulty === 'hard';
    if (threatensMe && no) return command(no, [no.choices[0].id]);
    return command(action(view, 'pass'));
  }
  if (board.phase === 'future') return command(action(view, 'done'));
  if (board.phase === 'give') {
    const give = action(view, 'give');
    const least = choose(give?.choices ?? [], choice => -bombUtility(board.hand.find(item => item.id === choice.id)), rng, difficulty === 'easy' ? 2 : 0);
    return command(give, least ? [least.id] : []);
  }
  if (board.phase === 'target') {
    const target = action(view, 'target');
    const choice = choose(target?.choices ?? [], item => board.players.find(player => player.id === item.id)?.count ?? 0, rng, difficulty === 'easy' ? 10 : 0);
    return command(target, choice ? [choice.id] : []);
  }
  if (board.phase === 'request') {
    const request = action(view, 'request');
    const preferred = ['defuse', 'nope', 'attack', 'skip'].find(kind => actionChoice(request, kind));
    return command(request, preferred ? [preferred] : first(request) ? [first(request)!.id] : []);
  }
  const play = action(view, 'play');
  const priority = difficulty === 'easy' ? ['skip', 'attack', 'future', 'favor', 'shuffle'] : difficulty === 'normal' ? ['attack', 'favor', 'future', 'skip', 'shuffle'] : ['attack', 'favor', 'future', 'skip', 'shuffle'];
  const playable = priority.map(kind => play?.choices.find(choice => board.hand.find(card => card.id === choice.id)?.kind === kind)).find(Boolean);
  if (playable) return command(play, [playable.id]);
  const triple = action(view, 'triple');
  if (triple && difficulty === 'hard') return command(triple, [triple.choices[0].id]);
  const pair = action(view, 'pair');
  if (pair && difficulty !== 'easy') return command(pair, [pair.choices[0].id]);
  return command(action(view, 'draw'));
}

function sushiValue(card: Card, table: Card[], hand: Card[], difficulty: BotDifficulty): number {
  const kind = card.kind ?? '';
  const own = countKind(table, kind);
  const inHand = countKind(hand, kind);
  const pendingWasabi = table.reduce((pending, item) => item.kind === 'wasabi' ? pending + 1 : ['egg', 'salmon', 'squid'].includes(item.kind ?? '') ? Math.max(0, pending - 1) : pending, 0);
  if (kind === 'squid') return 9 + (pendingWasabi ? 8 : 0);
  if (kind === 'salmon') return 6 + (pendingWasabi ? 6 : 0);
  if (kind === 'egg') return 3 + (pendingWasabi ? 3 : 0);
  if (kind === 'wasabi') return hand.some(item => ['egg', 'salmon', 'squid'].includes(item.kind ?? '')) ? 8 : 1;
  if (kind === 'dumpling') return [1, 2, 3, 4, 5, 5][Math.min(5, own + 1)] * 2;
  if (kind === 'tempura') return own % 2 ? 9 : (inHand > 1 ? 4 : 0);
  if (kind === 'sashimi') return own % 3 === 2 ? 12 : (inHand + own >= 3 ? 4 : 0);
  if (kind.startsWith('maki')) return Number(kind.slice(-1)) * (difficulty === 'hard' ? 2.4 : 1.4);
  if (kind === 'pudding') return difficulty === 'easy' ? 2 : 5;
  if (kind === 'chopsticks') return hand.length >= 4 && difficulty !== 'easy' ? 5 : 0;
  return 0;
}

function sushiBot(view: GameView, selfID: string, difficulty: BotDifficulty, rng: () => number): Command | undefined {
  const board = view.board as unknown as SushiBoard;
  if (board.selected) return undefined;
  const pick = action(view, 'pick');
  if (!pick) return undefined;
  const me = board.players.find(player => player.id === selfID);
  const table = me?.table ?? [];
  const choices = [...pick.choices].sort((a, b) => sushiValue(board.hand.find(card => card.id === b.id) ?? { id: '' }, table, board.hand, difficulty) - sushiValue(board.hand.find(card => card.id === a.id) ?? { id: '' }, table, board.hand, difficulty));
  if (difficulty === 'easy') return command(pick, [randomChoice(pick.choices, rng).id]);
  if (difficulty === 'hard' && pick.max === 2) {
    const orderedPairs = pick.choices.flatMap(firstChoice => pick.choices.filter(secondChoice => secondChoice.id !== firstChoice.id).map(secondChoice => [firstChoice, secondChoice] as const));
    const pair = choose(orderedPairs, ([firstChoice, secondChoice]) => {
      const firstCard = board.hand.find(card => card.id === firstChoice.id) ?? { id: '' };
      const secondCard = board.hand.find(card => card.id === secondChoice.id) ?? { id: '' };
      return sushiValue(firstCard, table, board.hand, difficulty) + sushiValue(secondCard, [...table, firstCard], board.hand, difficulty) + (firstCard.kind === 'wasabi' && ['egg', 'salmon', 'squid'].includes(secondCard.kind ?? '') ? 12 : 0);
    }, rng);
    if (pair) return command(pick, pair.map(choice => choice.id));
  }
  const values = [choices[0]?.id].filter((id): id is string => Boolean(id));
  if (pick.max === 2 && choices[1] && difficulty === 'hard' && sushiValue(board.hand.find(card => card.id === choices[1].id) ?? { id: '' }, table, board.hand, difficulty) >= 6) values.push(choices[1].id);
  return command(pick, values);
}

function centuryBot(view: GameView, _selfID: string, difficulty: BotDifficulty, rng: () => number): Command | undefined {
  const board = view.board as unknown as CenturyBoard;
  const goalNeed = (color: number) => board.goals.reduce((total, goal) => total + Math.max(0, goal.cost[color] - (board.cubes[color] ?? 0)), 0);
  if (board.phase === 'discard') {
    const discard = action(view, 'discard');
    const values = [...(discard?.choices ?? [])].sort((a, b) => goalNeed(Number(a.id.split(':')[0])) - goalNeed(Number(b.id.split(':')[0]))).slice(0, discard?.min ?? 0).map(choice => choice.id);
    return command(discard, values);
  }
  if (board.phase === 'pay') {
    const pay = action(view, 'pay');
    const choice = choose(pay?.choices ?? [], item => -goalNeed(Number(item.id)) - spiceValue[Number(item.id)], rng, difficulty === 'easy' ? 2 : 0);
    return command(pay, choice ? [choice.id] : []);
  }
  if (board.phase === 'upgrade') {
    const upgrade = action(view, 'upgrade');
    const choice = choose(upgrade?.choices ?? [], item => spiceValue[Number(item.id) + 1] + goalNeed(Number(item.id) + 1) * (difficulty === 'hard' ? 2 : 1), rng, difficulty === 'easy' ? 5 : 0);
    return command(upgrade, choice ? [choice.id] : []) ?? command(action(view, 'done'));
  }
  if (board.phase === 'trade') {
    const repeat = action(view, 'repeat');
    if (repeat && board.active) {
      const gain = sum(board.active.gain.map((value, index) => value * spiceValue[index]));
      const cost = sum(board.active.cost.map((value, index) => value * spiceValue[index]));
      if (gain > cost || difficulty === 'hard') return command(repeat);
    }
    return command(action(view, 'done'));
  }
  const claim = action(view, 'claim');
  if (claim) {
    const choice = choose(claim.choices, item => board.goals.find(goal => goal.id === item.id)?.points ?? 0, rng, difficulty === 'easy' ? 8 : 0);
    if (choice) return command(claim, [choice.id]);
  }
  const cardScore = (card: SpiceCard) => {
    const gain = sum(card.gain.map((value, index) => value * spiceValue[index]));
    const cost = sum(card.cost.map((value, index) => value * spiceValue[index]));
    const target = card.gain.reduce((total, value, index) => total + value * goalNeed(index), 0);
    const usable = card.type !== 'trade' || card.cost.every((value, index) => value <= (board.cubes[index] ?? 0));
    return gain - cost + target * (difficulty === 'hard' ? .8 : .25) + (card.type === 'upgrade' ? 5 : 0) + (card.type === 'gain' ? 3 : 0) + (card.type === 'trade' ? usable ? 7 : -14 : 0);
  };
  const play = action(view, 'play');
  const playChoice = play && choose(play.choices, item => cardScore(board.hand.find(card => card.id === item.id) ?? { id: '', type: 'gain', gain: [0, 0, 0, 0], cost: [0, 0, 0, 0], upgrades: 0 }), rng, difficulty === 'easy' ? 12 : 0);
  const rest = action(view, 'rest');
  if (rest && board.played.length > 0 && !playChoice) return command(rest);
  const acquire = action(view, 'acquire');
  const acquireChoice = acquire && choose(acquire.choices, item => {
    const slot = board.market.find(entry => entry.card.id === item.id);
    return slot ? cardScore(slot.card) + sum(slot.bonus.map((value, index) => value * spiceValue[index])) - board.market.indexOf(slot) * 2 : -Infinity;
  }, rng, difficulty === 'easy' ? 15 : 0);
  const playScore = playChoice ? cardScore(board.hand.find(card => card.id === playChoice.id) ?? { id: '', type: 'gain', gain: [0, 0, 0, 0], cost: [0, 0, 0, 0], upgrades: 0 }) : -Infinity;
  const recruitScore = acquireChoice ? (() => { const slot = board.market.find(entry => entry.card.id === acquireChoice.id); return slot ? cardScore(slot.card) : -Infinity; })() : -Infinity;
  if (acquireChoice && board.played.length === 0 && board.hand.length < 4 && recruitScore > playScore + (difficulty === 'hard' ? 3 : 8)) return command(acquire, [acquireChoice.id]);
  if (playChoice) return command(play, [playChoice.id]);
  if (rest && board.played.length > 0) return command(rest);
  if (acquireChoice) return command(acquire, [acquireChoice.id]);
  return command(rest) ?? command(acquire, first(acquire) ? [first(acquire)!.id] : []);
}

function unoBot(view: GameView, selfID: string, difficulty: BotDifficulty, rng: () => number): Command | undefined {
  const board = view.board as unknown as UnoBoard;
  if (board.phase === 'roundEnd') return command(action(view, 'nextRound'));
  if (board.phase === 'unoCall') return command(action(view, 'callUno'));
  if (board.phase === 'unoCatch') return command(difficulty === 'easy' && rng() < .5 ? action(view, 'passUno') : action(view, 'catchUno'));
  if (board.phase === 'wild4') return command(difficulty === 'hard' && rng() < .35 ? action(view, 'challenge4') : action(view, 'accept4'));
  if (board.phase === 'challengeResult') return command(action(view, 'confirmChallenge'));
  if (board.phase === 'color') {
    const color = choose(action(view, 'color')?.choices ?? [], choice => countColor(board.hand, choice.id), rng, difficulty === 'easy' ? 3 : 0);
    return command(action(view, 'color'), color ? [color.id] : []);
  }
  const colorForWild = (candidate: Action) => choose(candidate.choices, choice => countColor(board.hand, choice.id), rng, difficulty === 'easy' ? 3 : 0);
  const normal = action(view, 'play');
  const scoreCard = (card: UnoCard) => {
    const sameColor = countColor(board.hand, card.color);
    const effect = typeof card.value === 'number' ? 0 : card.value === 'draw2' ? 7 : card.value === 'skip' || card.value === 'reverse' ? 4 : 2;
    const end = board.hand.length <= 3 ? 8 : 0;
    return effect + end - sameColor * .2 + (card.color === board.color ? 1 : 0);
  };
  const options: Array<{ candidate: Action; card: UnoCard }> = [];
  if (normal) for (const choice of normal.choices) { const card = board.hand.find(item => item.id === choice.id); if (card) options.push({ candidate: normal, card }); }
  for (const candidate of view.actions.filter(item => item.id.startsWith('wild:'))) {
    const card = board.hand.find(item => item.id === candidate.id.slice(5));
    if (card) options.push({ candidate, card });
  }
  if (options.length) {
    const picked = choose(options, option => scoreCard(option.card) + (option.card.value === 'wild4' ? (difficulty === 'hard' ? 5 : 1) : 0), rng, difficulty === 'easy' ? 12 : 0)!;
    if (picked.candidate.id.startsWith('wild:')) {
      const color = colorForWild(picked.candidate);
      return command(picked.candidate, color ? [color.id] : []);
    }
    return command(picked.candidate, [picked.card.id]);
  }
  return command(action(view, 'draw')) ?? command(action(view, 'pass'));
}

/** A redacted-view policy for the five card games. It never receives game state. */
export const cardsBot: BotPolicy = (view, selfID, difficulty, rng) => {
  if (view.finished || !view.actions.length) return undefined;
  switch (view.kind) {
    case 'gems': return gemsBot(view, selfID, difficulty, rng);
    case 'bombs': return bombsBot(view, selfID, difficulty, rng);
    case 'sushi': return sushiBot(view, selfID, difficulty, rng);
    case 'century': return centuryBot(view, selfID, difficulty, rng);
    case 'uno': return unoBot(view, selfID, difficulty, rng);
    default: return undefined;
  }
};
