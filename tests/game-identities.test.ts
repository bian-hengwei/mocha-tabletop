import { describe, expect, it } from 'vitest';
import { modules } from '../src/core/registry';
import { GAMES, type GameKind, type Player } from '../src/core/types';
import { avalon, avalonTeamSizes } from '../src/core/games/avalon';
import { undercover } from '../src/core/games/undercover';
import { standardWerewolf, type WerewolfState } from '../src/core/games/werewolf';
import { uno } from '../src/core/games/uno';
import { codenames } from '../src/core/games/codenames';

// Network validation rejects these IDs, but imported engine checkpoints must
// still treat player identifiers as data, including after JSON restoration.
const specialIDs = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'toLocaleString'];
const players = (count: number): Player[] => Array.from({ length: count }, (_,i) => ({
  id: specialIDs[i] ?? `player-${i}`, name: `Player ${i + 1}`, avatar: '🦊'
}));
const restore = <T>(state: T): T => JSON.parse(JSON.stringify(state));

describe('player identifiers remain data in rule engines', () => {
  it.each(Object.keys(GAMES) as GameKind[])('%s starts at both capacity boundaries with serializable private views', kind => {
    for (const count of new Set([GAMES[kind].min, GAMES[kind].max])) {
      const seats = players(count), state = restore(modules[kind].create(seats, 7));
      const views = seats.map(p => modules[kind].view(state, p.id));
      expect(views.some(view => view.actions.length > 0)).toBe(true);
      for (const view of views) expect(restore(view)).toEqual(view);
    }
  });

  it('completes Avalon approval, secret missions and assassination after restoring each vote', () => {
    let state = avalon.create(players(6), 19);
    for (let quest = 0; quest < 3; quest++) {
      const team = state.players.slice(0, avalonTeamSizes(6)[quest]).map(p => p.id);
      state = avalon.apply(state, state.players[state.leader].id, { action: 'propose', values: team });
      for (const p of state.players) {
        expect(avalon.view(state, p.id).actions[0]?.id).toBe('approve');
        state = restore(avalon.apply(state, p.id, { action: 'approve', values: ['yes'] }));
      }
      expect(state.stage).toBe('mission');
      for (const id of team) state = restore(avalon.apply(state, id, { action: 'mission', values: ['success'] }));
    }
    expect(state.stage).toBe('assassinate');
    const assassin = state.players.find(p => state.roles[p.id] === 'assassin')!;
    const merlin = state.players.find(p => state.roles[p.id] === 'merlin')!;
    state = avalon.apply(state, assassin.id, { action: 'assassinate', values: [merlin.id] });
    expect(state.winner).toContain('梅林被刺杀');
  });

  it('supports Undercover secret voting, cancellation and tallying special target IDs', () => {
    let state = undercover.create(players(3), 42);
    for (const p of state.players) state = restore(undercover.apply(state, p.id, { action: 'ready', values: [] }));
    while (state.phase === 'describe') state = undercover.apply(state, state.players[state.order[state.speaker]].id, { action: 'described', values: [] });
    for (const p of state.players) {
      const view = undercover.view(state, p.id);
      expect(view.board.ownVote).toBeNull();
      expect(view.board.players.every((entry: { voted: boolean }) => !entry.voted)).toBe(true);
    }
    const odd = state.players.find((_, i) => state.roles[i] === 'odd')!;
    const common = state.players.filter(p => p.id !== odd.id);
    state = undercover.apply(state, common[0].id, { action: 'vote', values: [odd.id] });
    expect(undercover.view(state, common[0].id).board.ownVote).toBe(odd.id);
    state = restore(undercover.apply(state, common[0].id, { action: 'cancel_vote', values: [] }));
    expect(undercover.view(state, common[0].id).board.ownVote).toBeNull();
    for (const p of state.players) state = restore(undercover.apply(state, p.id, { action: 'vote', values: [p.id === odd.id ? common[0].id : odd.id] }));
    expect(state.finished).toBe(true);
    expect(state.winnerRole).toBe('common');
    expect(state.lastVotes[common[0].id]).toBe(odd.id);
  });

  it('completes Werewolf nights, records inspections and counts votes after checkpoint restores', () => {
    let state = standardWerewolf.create(players(6), 1);
    const seer = state.players.find(p => state.roles[p.id] === 'seer')!;
    const inspected = state.players.find(p => p.id !== seer.id)!;
    const wolves = state.players.filter(p => state.roles[p.id] === 'wolf').map(p => p.id);
    function apply(id: string, action: string, values: string[] = []) {
      state = restore(standardWerewolf.apply(state, id, { action, values }));
    }
    function completeStage(stage: WerewolfState['stage']) {
      for (const p of state.players) {
        if (state.stage !== stage) break;
        const action = standardWerewolf.view(state, p.id).actions[0];
        if (!action) continue;
        apply(p.id, action.id, action.id === 'inspect' ? [inspected.id] : action.id === 'signup' ? ['no'] : action.min ? ['skip'] : []);
      }
    }
    for (const wolf of wolves) {
      completeStage('nightFirst');
      expect(Object.hasOwn(state.investigations, inspected.id)).toBe(true);
      completeStage('nightSecond');
      if (state.stage === 'signup') completeStage('signup');
      completeStage('discussion');
      expect(state.stage).toBe('vote');
      for (const p of state.players) if (state.alive.includes(p.id)) apply(p.id, 'vote', [wolf]);
      expect(state.alive).not.toContain(wolf);
    }
    expect(state.winner).toContain('好人获胜');
  });

  it('never invents an UNO call and can record and clear a call by __proto__', () => {
    let state = uno.create(players(3), 7, { unoMode: 'single' });
    expect(uno.view(state, state.players[0].id).board.players.every((p: { calledUno: boolean }) => !p.calledUno)).toBe(true);
    state.current = 0; state.phase = 'play'; state.color = 'red'; state.drawn = null;
    state.discard = [{ id: 'top', color: 'red', value: 3 }];
    state.hands[0] = [{ id: 'play', color: 'red', value: 2 }, { id: 'last', color: 'red', value: 1 }];
    state = uno.apply(state, '__proto__', { action: 'play', values: ['play'] });
    state = restore(uno.apply(state, '__proto__', { action: 'callUno', values: [] }));
    expect(uno.view(state, '__proto__').board.players[0].calledUno).toBe(true);
    state.current = 0;
    state = uno.apply(state, '__proto__', { action: 'play', values: ['last'] });
    expect(state.finished).toBe(true);
    expect(uno.view(state, '__proto__').board.players[0].calledUno).toBe(false);
  });
});

it('describes Codenames compensation as a captain decision before guessing resumes', () => {
  let state = codenames.create(players(4), 11);
  const captain = state.players.find((p, i) => state.captains.includes(p.id) && state.teams[i] === state.turn)!;
  state = codenames.apply(state, captain.id, { action: 'clue', values: ['1'], text: '线索' });
  state = codenames.apply(state, captain.id, { action: 'invalid_clue', values: [] });
  for (const p of state.players) {
    const view = codenames.view(state, p.id);
    expect(view.instruction).toContain('队长选择补偿揭晓');
    expect(view.instruction).not.toContain('不限次数');
  }
});
