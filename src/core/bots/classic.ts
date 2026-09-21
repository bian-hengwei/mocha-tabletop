import type { Action, Choice, Command, GameView } from '../types';
import type { BotDifficulty, BotPolicy } from './types';
import {
  beats,
  classifyPoker,
  combinationKey,
  levelRank,
  pokerPower,
  type Combination,
  type PokerCard,
  type PokerKind,
} from '../games/poker';
import { tileSuit, winningHand, type Tile } from '../games/mahjong';

interface PokerPlayerView {
  id: string;
  name: string;
  count: number;
  team?: number | null;
  landlord?: boolean;
}

interface PokerBoard {
  hand: PokerCard[];
  phase: string;
  level: number;
  bid: number;
  last: { player: number; cards: PokerCard[]; combo: Combination } | null;
  players: PokerPlayerView[];
}

interface MahjongMeldView {
  type: 'pong' | 'kong' | 'concealed';
  tiles: Tile[];
  count?: number;
  from: number;
}

interface MahjongPlayerView {
  id: string;
  name: string;
  count: number;
  score: number;
  won: boolean;
  missing?: number;
  discards: Tile[];
  melds: MahjongMeldView[];
}

interface MahjongBoard {
  hand: Tile[];
  phase: string;
  mode: 'guangdong' | 'sichuan' | 'bloodflow' | 'laizi';
  wallCount: number;
  drawn: string | null;
  wildValue: number;
  pending: { tile: Tile; from: number; rob: boolean } | null;
  players: MahjongPlayerView[];
}

interface PokerCandidate {
  cards: PokerCard[];
  combo: Combination;
}

interface MahjongDiscardCandidate {
  tile: Tile;
  after: Tile[];
  waits: number;
  structure: number;
}

const pokerAction = (view: GameView, id: string) => view.actions.find(item => item.id === id);
const randomChoice = <T>(items: T[], rng: () => number): T | undefined =>
  items.length ? items[Math.min(items.length - 1, Math.floor(rng() * items.length))] : undefined;

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return [[]];
  if (items.length < size) return [];
  if (size === 1) return items.map(item => [item]);
  const result: T[][] = [];
  for (let index = 0; index <= items.length - size; index++) {
    for (const tail of combinations(items.slice(index + 1), size - 1)) result.push([items[index], ...tail]);
  }
  return result;
}

function groupedByRank(hand: PokerCard[]): Map<number, PokerCard[]> {
  const groups = new Map<number, PokerCard[]>();
  for (const card of [...hand].sort((a, b) => a.rank - b.rank || a.suit - b.suit)) {
    const group = groups.get(card.rank) ?? [];
    group.push(card);
    groups.set(card.rank, group);
  }
  return groups;
}

function isGuandanWild(card: PokerCard, kind: PokerKind, level: number): boolean {
  return kind === 'guandan' && card.suit === 1 && card.rank === levelRank(level);
}

function fillRanks(
  hand: PokerCard[],
  ranks: readonly number[],
  kind: PokerKind,
  level: number,
  suit?: number,
): PokerCard[] | null {
  const remaining = [...hand];
  const picked: PokerCard[] = [];
  const take = (rank: number, natural: boolean): PokerCard | undefined => {
    const index = remaining.findIndex(card =>
      natural
        ? card.rank === rank && (suit === undefined || card.suit === suit) && !isGuandanWild(card, kind, level)
        : isGuandanWild(card, kind, level),
    );
    if (index < 0) return undefined;
    return remaining.splice(index, 1)[0];
  };
  for (const rank of ranks) {
    const card = take(rank, true) ?? take(rank, false);
    if (!card) return null;
    picked.push(card);
  }
  return picked;
}

function addPokerCandidate(
  cards: PokerCard[],
  kind: PokerKind,
  level: number,
  target: Combination | null,
  result: PokerCandidate[],
  seen: Set<string>,
): void {
  if (!cards.length || new Set(cards.map(card => card.id)).size !== cards.length) return;
  const key = cards.map(card => card.id).sort().join('|');
  for (const combo of classifyPoker(cards, kind, level)) {
    if (!beats(combo, target)) continue;
    const identity = `${key}:${combinationKey(combo)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push({ cards: [...cards], combo });
  }
}

function doudizhuCandidates(hand: PokerCard[], target: Combination | null): PokerCandidate[] {
  const result: PokerCandidate[] = [];
  const seen = new Set<string>();
  const add = (cards: PokerCard[]) => addPokerCandidate(cards, 'doudizhu', 2, target, result, seen);
  const groups = groupedByRank(hand);
  const ranks = [...groups.keys()].sort((a, b) => a - b);

  for (const rank of ranks) {
    const group = groups.get(rank)!;
    for (let count = 1; count <= group.length; count++) add(group.slice(0, count));
  }

  for (const rank of ranks.filter(rank => groups.get(rank)!.length >= 3)) {
    const triple = groups.get(rank)!.slice(0, 3);
    for (const other of ranks.filter(item => item !== rank)) {
      add([...triple, groups.get(other)![0]]);
      if (groups.get(other)!.length >= 2) add([...triple, ...groups.get(other)!.slice(0, 2)]);
    }
  }

  for (const rank of ranks.filter(rank => groups.get(rank)!.length === 4)) {
    const quad = groups.get(rank)!;
    for (const pair of combinations(ranks.filter(item => item !== rank), 2)) {
      add([...quad, groups.get(pair[0])![0], groups.get(pair[1])![0]]);
      if (pair.every(item => groups.get(item)!.length >= 2)) {
        add([...quad, ...groups.get(pair[0])!.slice(0, 2), ...groups.get(pair[1])!.slice(0, 2)]);
      }
    }
  }

  for (let length = 5; length <= 12; length++) {
    for (let start = 3; start + length - 1 <= 14; start++) {
      const sequence = Array.from({ length }, (_, index) => start + index);
      if (!sequence.every(rank => groups.get(rank)?.length)) continue;
      add(sequence.flatMap(rank => groups.get(rank)!.slice(0, 1)));
    }
  }
  for (let length = 3; length <= 10; length++) {
    for (let start = 3; start + length - 1 <= 14; start++) {
      const sequence = Array.from({ length }, (_, index) => start + index);
      if (!sequence.every(rank => (groups.get(rank)?.length ?? 0) >= 2)) continue;
      add(sequence.flatMap(rank => groups.get(rank)!.slice(0, 2)));
    }
  }
  for (let length = 2; length <= 6; length++) {
    for (let start = 3; start + length - 1 <= 14; start++) {
      const sequence = Array.from({ length }, (_, index) => start + index);
      if (!sequence.every(rank => (groups.get(rank)?.length ?? 0) >= 3)) continue;
      const core = sequence.flatMap(rank => groups.get(rank)!.slice(0, 3));
      add(core);
      const rest = ranks.filter(rank => !sequence.includes(rank));
      for (const wings of combinations(rest, length)) {
        add([...core, ...wings.map(rank => groups.get(rank)![0])]);
        if (wings.every(rank => groups.get(rank)!.length >= 2)) {
          add([...core, ...wings.flatMap(rank => groups.get(rank)!.slice(0, 2))]);
        }
      }
    }
  }
  return result;
}

function guandanSequence(start: number, length: number): number[] {
  return Array.from({ length }, (_, index) => {
    const value = start + index;
    return value === 1 ? 14 : value === 2 ? 15 : value;
  });
}

function guandanCandidates(hand: PokerCard[], level: number, target: Combination | null): PokerCandidate[] {
  const result: PokerCandidate[] = [];
  const seen = new Set<string>();
  const add = (cards: PokerCard[]) => addPokerCandidate(cards, 'guandan', level, target, result, seen);
  const groups = groupedByRank(hand);
  const ranks = [...groups.keys()].sort((a, b) => a - b);

  for (const rank of ranks) {
    const group = groups.get(rank)!;
    for (let count = 1; count <= group.length; count++) add(group.slice(0, count));
  }
  for (const rank of ranks.filter(rank => groups.get(rank)!.length >= 3)) {
    const triple = groups.get(rank)!.slice(0, 3);
    for (const other of ranks.filter(item => item !== rank && groups.get(item)!.length >= 2)) {
      add([...triple, ...groups.get(other)!.slice(0, 2)]);
    }
  }

  for (let start = 1; start <= 10; start++) {
    for (const copies of [1, 2, 3]) {
      const sequence = copies === 1
        ? guandanSequence(start, 5)
        : copies === 2 ? guandanSequence(start, 3) : guandanSequence(start, 2);
      const expanded = sequence.flatMap(rank => Array(copies).fill(rank));
      const cards = fillRanks(hand, expanded, 'guandan', level);
      if (cards) add(cards);
      if (copies === 1) {
        for (const suit of [0, 1, 2, 3]) {
          const flush = fillRanks(hand, sequence, 'guandan', level, suit);
          if (flush) add(flush);
        }
      }
    }
  }
  return result;
}

function pokerCandidates(hand: PokerCard[], kind: PokerKind, level: number, target: Combination | null): PokerCandidate[] {
  return kind === 'doudizhu' ? doudizhuCandidates(hand, target) : guandanCandidates(hand, level, target);
}

function handStrength(hand: PokerCard[], kind: PokerKind, level: number): number {
  const groups = groupedByRank(hand);
  let score = 0;
  for (const [rank, group] of groups) {
    const power = pokerPower(rank, kind, level);
    score += power * group.length * 0.08;
    if (group.length >= 4) score += 8 + group.length;
    else if (group.length === 3) score += 5;
    else if (group.length === 2) score += 2.5;
  }
  for (let rank = 3; rank < 14; rank++) {
    if ((groups.get(rank)?.length ?? 0) && (groups.get(rank + 1)?.length ?? 0)) score += 1.2;
  }
  return score;
}

function bidValue(hand: PokerCard[], difficulty: BotDifficulty, rng: () => number): number {
  const groups = groupedByRank(hand);
  let score = 0;
  for (const [rank, group] of groups) {
    if (rank === 17) score += 9;
    else if (rank === 16) score += 7;
    else if (rank === 15) score += 4;
    else if (rank === 14) score += 2.5;
    else if (rank === 13) score += 1.5;
    if (group.length >= 4) score += 10;
    if (group.length === 3) score += 3;
  }
  if (groups.get(16)?.length && groups.get(17)?.length) score += 8;
  if (difficulty === 'easy') return score >= 19 ? 3 : score >= 15 ? 2 : score >= 11 ? 1 : 0;
  if (difficulty === 'normal') return score >= 17 ? 3 : score >= 13 ? 2 : score >= 9 ? 1 : 0;
  const grouping = handStrength(hand, 'doudizhu', 2);
  return score + grouping * 0.12 + rng() * 0.5 >= 16 ? 3 : score + grouping * 0.12 >= 13 ? 2 : score >= 9 ? 1 : 0;
}

function candidateScore(
  candidate: PokerCandidate,
  hand: PokerCard[],
  kind: PokerKind,
  level: number,
  difficulty: BotDifficulty,
): number {
  const ids = new Set(candidate.cards.map(card => card.id));
  const remaining = hand.filter(card => !ids.has(card.id));
  if (!remaining.length) return 10000;
  const quality = handStrength(remaining, kind, level);
  if (difficulty === 'normal') return quality - candidate.combo.power * 0.08 - candidate.combo.bomb * 5;
  return quality
    + candidate.cards.length * 0.25
    - candidate.combo.power * 0.035
    - candidate.combo.bomb * 3.5
    - new Set(remaining.map(card => card.rank)).size * 0.08;
}

function choosePokerCandidate(
  candidates: PokerCandidate[],
  hand: PokerCard[],
  kind: PokerKind,
  level: number,
  difficulty: BotDifficulty,
  rng: () => number,
): PokerCandidate | undefined {
  if (!candidates.length) return undefined;
  if (difficulty === 'easy') return randomChoice(candidates, rng);
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = candidateScore(candidate, hand, kind, level, difficulty) + (difficulty === 'hard' ? rng() * 0.01 : 0);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function pokerBot(view: GameView, selfID: string, difficulty: BotDifficulty, rng: () => number): Command | undefined {
  const board = view.board as unknown as PokerBoard;
  const self = board.players.find(player => player.id === selfID);
  const bid = pokerAction(view, 'bid');
  if (bid) {
    const wanted = bidValue(board.hand, difficulty, rng);
    const choice = bid.choices
      .filter(item => Number(item.id) > board.bid)
      .filter(item => Number(item.id) <= wanted)
      .sort((a, b) => Number(b.id) - Number(a.id))[0];
    return { action: bid.id, values: [choice?.id ?? bid.choices[0].id] };
  }
  if (pokerAction(view, 'nextRound')) return { action: 'nextRound', values: [] };

  const returnAction = pokerAction(view, 'return');
  if (returnAction) {
    const kind: PokerKind = view.kind === 'guandan' ? 'guandan' : 'doudizhu';
    const choice = difficulty === 'easy'
      ? randomChoice(returnAction.choices, rng)
      : [...returnAction.choices].sort((a, b) => {
          const ca = board.hand.find(card => card.id === a.id);
          const cb = board.hand.find(card => card.id === b.id);
          return pokerPower(cb?.rank ?? 0, kind, board.level) - pokerPower(ca?.rank ?? 0, kind, board.level);
        })[0];
    return { action: returnAction.id, values: [choice?.id ?? returnAction.choices[0].id] };
  }

  const play = pokerAction(view, 'play');
  if (!play) return pokerAction(view, 'pass') ? { action: 'pass', values: [] } : undefined;
  const kind: PokerKind = view.kind === 'guandan' ? 'guandan' : 'doudizhu';
  const candidates = pokerCandidates(board.hand, kind, board.level, board.last?.combo ?? null);
  const chosen = choosePokerCandidate(candidates, board.hand, kind, board.level, difficulty, rng);
  if (!chosen) return pokerAction(view, 'pass') ? { action: 'pass', values: [] } : undefined;

  if (board.last && difficulty !== 'easy') {
    const lastPlayer = board.players[board.last.player];
    const sameTeam = view.kind === 'guandan'
      ? self?.team === lastPlayer.team
      : Boolean(self?.landlord) === Boolean(lastPlayer.landlord);
    if (sameTeam) return pokerAction(view, 'pass') ? { action: 'pass', values: [] } : undefined;
  }
  if (board.last && difficulty === 'easy' && rng() < 0.18) {
    return pokerAction(view, 'pass') ? { action: 'pass', values: [] } : undefined;
  }
  return {
    action: play.id,
    values: chosen.cards.map(card => card.id),
    text: combinationKey(chosen.combo),
  };
}

function tileUsefulness(tile: Tile, hand: Tile[], wildValue: number): number {
  if (tile.value === wildValue) return 100;
  const count = hand.filter(item => item.value === tile.value).length;
  if (tile.value >= 27) return count >= 2 ? count * 8 : 0.5;
  const suit = tileSuit(tile.value);
  const inSuit = hand.filter(item => tileSuit(item.value) === suit);
  const position = tile.value % 9;
  let neighbors = 0;
  for (const distance of [1, 2]) {
    if (position - distance >= 0 && inSuit.some(item => item.value % 9 === position - distance)) neighbors += 3 / distance;
    if (position + distance <= 8 && inSuit.some(item => item.value % 9 === position + distance)) neighbors += 3 / distance;
  }
  return count * 6 + neighbors + inSuit.length * 0.15;
}

function mahjongStructure(hand: Tile[], meldCount: number, wildValue: number): number {
  const counts = new Map<number, number>();
  for (const tile of hand) counts.set(tile.value, (counts.get(tile.value) ?? 0) + 1);
  let score = 0;
  for (const [value, count] of counts) {
    score += count >= 3 ? 10 : count === 2 ? 6 : 1;
    if (value >= 27 && count === 1) score -= 2;
    if (value === wildValue) score += 8;
  }
  for (let suit = 0; suit < 3; suit++) {
    const values = [...new Set(hand.filter(tile => tileSuit(tile.value) === suit).map(tile => tile.value % 9))]
      .sort((a, b) => a - b);
    for (let index = 1; index < values.length; index++) {
      if (values[index] - values[index - 1] === 1) score += 2.5;
      if (values[index] - values[index - 1] === 2) score += 1;
    }
  }
  return score + meldCount * 5 + hand.length * 0.05;
}

function chooseExchange(board: MahjongBoard, difficulty: BotDifficulty, rng: () => number): string[] {
  const groups: Tile[][] = [];
  for (const suit of [0, 1, 2]) {
    const tiles = board.hand.filter(tile => tileSuit(tile.value) === suit);
    if (tiles.length >= 3) groups.push(...combinations(tiles, 3));
  }
  if (!groups.length) return [];
  if (difficulty === 'easy') return (randomChoice(groups, rng) ?? groups[0]).map(tile => tile.id);
  let best = groups[0];
  let bestScore = -Infinity;
  for (const group of groups) {
    const ids = new Set(group.map(tile => tile.id));
    const remaining = board.hand.filter(tile => !ids.has(tile.id));
    const score = mahjongStructure(remaining, 0, board.wildValue)
      - group.reduce((total, tile) => total + tileUsefulness(tile, board.hand, board.wildValue), 0) * 0.15
      + (difficulty === 'hard' ? board.hand.filter(tile => tileSuit(tile.value) === tileSuit(group[0].value)).length * -0.4 : 0);
    if (score > bestScore) {
      best = group;
      bestScore = score;
    }
  }
  return best.map(tile => tile.id);
}

function chooseMissingSuit(board: MahjongBoard, difficulty: BotDifficulty, rng: () => number): string {
  const choices = [0, 1, 2];
  if (difficulty === 'easy') return String(randomChoice(choices, rng) ?? choices[0]);
  let best = choices[0];
  let bestScore = -Infinity;
  for (const suit of choices) {
    const remaining = board.hand.filter(tile => tileSuit(tile.value) !== suit);
    const score = difficulty === 'hard'
      ? mahjongStructure(remaining, 0, board.wildValue) - board.hand.filter(tile => tileSuit(tile.value) === suit).length * 1.2
      : -board.hand.filter(tile => tileSuit(tile.value) === suit).length;
    if (score > bestScore) {
      best = suit;
      bestScore = score;
    }
  }
  return String(best);
}

function visibleTileCount(board: MahjongBoard, selfID: string, value: number): number {
  let count = board.hand.filter(tile => tile.value === value).length;
  for (const player of board.players) {
    count += player.discards.filter(tile => tile.value === value).length;
    count += player.melds.flatMap(meld => meld.tiles).filter(tile => tile.value === value).length;
    if (player.id === selfID) continue;
  }
  return count;
}

function discardCandidates(
  board: MahjongBoard,
  selfID: string,
  choices: Choice[],
  meldCount: number,
): MahjongDiscardCandidate[] {
  return choices.map(choice => {
    const tile = board.hand.find(item => item.id === choice.id);
    if (!tile) return null;
    const after = board.hand.filter(item => item.id !== tile.id);
    let waits = 0;
    const limit = board.mode === 'sichuan' || board.mode === 'bloodflow' ? 27 : 34;
    for (let value = 0; value < limit; value++) {
      const unseen = 4 - visibleTileCount(board, selfID, value);
      if (unseen <= 0) continue;
      if (winningHand([...after, { id: 'probe', value }], meldCount, board.wildValue)) waits += unseen;
    }
    return { tile, after, waits, structure: mahjongStructure(after, meldCount, board.wildValue) };
  }).filter((candidate): candidate is MahjongDiscardCandidate => candidate !== null);
}

function chooseMahjongDiscard(
  board: MahjongBoard,
  selfID: string,
  discard: Action,
  meldCount: number,
  difficulty: BotDifficulty,
  rng: () => number,
): Command | undefined {
  if (difficulty === 'easy') {
    const choice = randomChoice(discard.choices, rng);
    return choice ? { action: discard.id, values: [choice.id] } : undefined;
  }
  const candidates = discardCandidates(board, selfID, discard.choices, meldCount);
  if (!candidates.length) return undefined;
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = difficulty === 'hard'
      ? candidate.waits * 10 + candidate.structure - tileUsefulness(candidate.tile, board.hand, board.wildValue) * 0.25
      : candidate.structure - tileUsefulness(candidate.tile, board.hand, board.wildValue) * 0.5;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return { action: discard.id, values: [best.tile.id] };
}

function mahjongBot(view: GameView, selfID: string, difficulty: BotDifficulty, rng: () => number): Command | undefined {
  const board = view.board as unknown as MahjongBoard;
  const self = board.players.find(player => player.id === selfID);
  const meldCount = self?.melds.length ?? 0;
  const exchange = pokerAction(view, 'exchange');
  if (exchange) {
    const values = chooseExchange(board, difficulty, rng);
    return values.length === exchange.min ? { action: exchange.id, values } : undefined;
  }
  const que = pokerAction(view, 'que');
  if (que) return { action: que.id, values: [chooseMissingSuit(board, difficulty, rng)] };
  const hu = pokerAction(view, 'hu');
  if (hu) return { action: hu.id, values: [] };

  if (board.pending?.rob) return pokerAction(view, 'pass') ? { action: 'pass', values: [] } : undefined;
  const kong = pokerAction(view, 'kong');
  if (kong && difficulty !== 'easy') return { action: kong.id, values: [] };
  const pong = pokerAction(view, 'pong');
  if (pong && difficulty !== 'easy') {
    const tile = board.pending?.tile;
    if (!tile || tileUsefulness(tile, board.hand, board.wildValue) >= 5 || rng() < 0.35) {
      return { action: pong.id, values: [] };
    }
  }
  if (difficulty === 'easy' && board.pending) {
    const choices = [kong, pong, pokerAction(view, 'pass')].filter((item): item is Action => Boolean(item));
    const choice = randomChoice(choices, rng);
    return choice ? { action: choice.id, values: [] } : undefined;
  }
  if (pokerAction(view, 'pass')) return { action: 'pass', values: [] };

  const concealed = view.actions.find(action => action.id.startsWith('concealed:'));
  if (concealed) {
    const shouldKong = difficulty === 'hard' ? board.wallCount > 6 && rng() < 0.85 : board.wallCount > 10;
    if (shouldKong) return { action: concealed.id, values: [concealed.choices[0].id] };
  }
  const added = view.actions.find(action => action.id.startsWith('added:'));
  if (added && (difficulty === 'hard' ? board.wallCount > 4 : board.wallCount > 8)) {
    return { action: added.id, values: [added.choices[0].id] };
  }
  const discard = pokerAction(view, 'discard');
  if (discard) return chooseMahjongDiscard(board, selfID, discard, meldCount, difficulty, rng);
  return undefined;
}

/** Redacted-view policy for the three classic games. It never receives authoritative state. */
export const classicBot: BotPolicy = (view, selfID, difficulty, rng) => {
  if (view.finished || !view.actions.length) return undefined;
  if (view.kind === 'doudizhu' || view.kind === 'guandan') return pokerBot(view, selfID, difficulty, rng);
  if (view.kind === 'mahjong') return mahjongBot(view, selfID, difficulty, rng);
  return undefined;
};
