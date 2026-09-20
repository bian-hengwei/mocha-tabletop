import { describe, expect, it } from 'vitest';
import { standardWerewolf, werewolf, werewolfVictory, type WerewolfState } from '../src/core/games/werewolf';
import { werewolfHosted, type HostedWerewolfState } from '../src/core/games/werewolfHosted';
import { WEREWOLF_PRESETS, werewolfPreset, isWolfRole, type WolfRole } from '../src/core/werewolfPresets';
import { normalizeGameOptions, roomLimits, createMatch, validateMatchForRoom, type RoomInfo } from '../src/core/room';
import type { GameOptions, Player } from '../src/core/types';

const players = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `expanded-wolf-${i}`, name: `玩家 ${i + 1}`, avatar: '🦊' }));
const newPresets = ['classic9', 'classic', 'idiot', 'wolfKing'] as const;
const find = (s: { roles: Record<string, WolfRole> }, role: WolfRole) => Object.keys(s.roles).find(id => s.roles[id] === role)!;
const restore = <T>(state: T): T => JSON.parse(JSON.stringify(state));
const standard = (preset: GameOptions['werewolfPreset'] = 'wolfKing') => standardWerewolf.create(players(preset === 'classic9' ? 9 : 12), 47, { werewolfPreset: preset });
const hosted = (preset: GameOptions['werewolfPreset'] = 'wolfKing') => werewolfHosted.create(players(preset === 'classic9' ? 10 : 13), 47, { werewolfPreset: preset, werewolfMode: 'judge', moderatorID: players(1)[0].id });
const act = (s: WerewolfState, id: string, action: string, value?: string) => restore(standardWerewolf.apply(s, id, { action, values: value === undefined ? [] : [value] }));
const judge = (s: HostedWerewolfState, action: string, value = 'skip') => restore(werewolfHosted.apply(s, s.options.moderatorID, { action, values: [value] }));
function standardNight(state: WerewolfState, victim = 'skip', potion = 'skip', inspect = 'skip', signup = 'no') {
  let s = state;
  for (const id of [...s.alive]) {
    const a = standardWerewolf.view(s, id).actions[0];
    expect(s.stage).toBe('nightFirst');
    s = act(s, id, a.id, a.id === 'wolf' ? victim : a.id === 'inspect' ? inspect : a.id === 'guard' ? 'skip' : undefined);
  }
  for (const id of [...s.alive]) {
    const a = standardWerewolf.view(s, id).actions[0];
    expect(s.stage).toBe('nightSecond');
    s = act(s, id, a.id, a.id === 'potion' ? potion : undefined);
  }
  if (s.stage === 'signup') for (const id of [...s.alive]) s = act(s, id, 'signup', signup);
  return s;
}
function standardExile(state: WerewolfState, target: string) {
  let s = state;
  if (s.stage === 'discussion') for (const id of [...s.alive]) s = act(s, id, 'ready');
  const voters = s.alive.filter(id => standardWerewolf.view(s, id).actions.some(a => a.id === 'vote'));
  for (const id of voters) s = act(s, id, 'vote', target);
  return s;
}
function hostedNight(state: HostedWerewolfState, victim = 'skip', potion = 'skip', inspect = 'skip', finishDawn = true) {
  let s = state;
  while (['guard', 'wolves', 'witch', 'seer'].includes(s.stage)) {
    const a = werewolfHosted.view(s, s.options.moderatorID).actions[0];
    s = judge(s, a.id, s.stage === 'wolves' ? victim : s.stage === 'witch' ? potion : s.stage === 'seer' ? inspect : 'skip');
  }
  if (!finishDawn) return s;
  if (s.stage === 'sheriff') s = judge(s, 'judge-sheriff');
  return judge(s, 'judge-dawn', 'confirm');
}

describe('recognizable fixed Werewolf boards', () => {
  it('uses exact published compositions and rejects every off-size request', () => {
    const expected: Record<string, WolfRole[]> = {
      classic9: ['wolf','wolf','wolf','villager','villager','villager','seer','witch','hunter'],
      classic: ['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','guard'],
      idiot: ['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot'],
      wolfKing: ['wolfKing','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','guard'],
    };
    for (const preset of newPresets) {
      const n = preset === 'classic9' ? 9 : 12;
      expect(werewolfPreset(n, preset).sort()).toEqual(expected[preset].sort());
      for (let size = 6; size <= 18; size++) if (size !== n) expect(() => werewolfPreset(size, preset)).toThrow();
      for (const mode of ['standard', 'judge', 'deal'] as const) {
        const ps = players(n + (mode === 'judge' ? 1 : 0));
        const options: GameOptions = { werewolfMode: mode, werewolfPreset: preset, ...(mode !== 'standard' ? { moderatorID: ps[0].id } : {}) };
        const canonical = normalizeGameOptions('werewolf', options, ps[0].id);
        expect(canonical?.werewolfPreset).toBe(preset);
        expect(roomLimits('werewolf', canonical)).toEqual({ min: ps.length, max: ps.length });
        const s = werewolf.create(ps, 44, canonical);
        expect(Object.values(s.roles).sort()).toEqual(expected[preset].sort());
        if (mode === 'judge') expect(s.roles[ps[0].id]).toBeUndefined();
        const match = createMatch('werewolf', ps, canonical);
        const room: RoomInfo = { code: 'EXPAND', kind: 'werewolf', mode: 'cloud', hostID: ps[0].id, options: canonical, players: ps.map(p => ({ ...p, ready: true, connected: true })), pending: [], started: true, revision: 1 };
        expect(validateMatchForRoom(restore(match), room).game.roles).toEqual(match.game.roles);
        const corrupted = restore(match);
        const alteredRole = Object.keys(corrupted.game.roles)[0];
        corrupted.game.roles[alteredRole] = corrupted.game.roles[alteredRole] === 'wolf' ? 'villager' : 'wolf';
        expect(() => validateMatchForRoom(corrupted, room)).toThrow('身份牌配置');
      }
    }
    expect(new Set(WEREWOLF_PRESETS.map(p => p.id)).size).toBe(WEREWOLF_PRESETS.length);
  });
  it('finishes each fixed board in standard and judge modes using only offered actions and restored saves', () => {
    for (const preset of newPresets) {
      let s = standard(preset);
      const wolves = Object.keys(s.roles).filter(id => isWolfRole(s.roles[id]));
      for (const wolf of wolves) {
        s = standardNight(s);
        s = standardExile(s, wolf);
        if (s.stage === 'hunter' && !s.winner) s = act(s, s.hunterID!, 'shoot', 'skip');
      }
      expect(s.winner).toContain('好人获胜');
      let h = hosted(preset);
      for (const wolf of Object.keys(h.roles).filter(id => isWolfRole(h.roles[id]))) {
        h = hostedNight(h);
        h = judge(h, 'judge-exile', wolf);
        if (h.stage === 'hunter') h = judge(h, 'judge-shoot');
      }
      expect(h.winner).toContain('好人获胜');
    }
  });
  it('preserves new boards on redeal without exposing other roles to the dealer', () => {
    for (const preset of newPresets) {
      const ps = players(preset === 'classic9' ? 9 : 12);
      let s = werewolfHosted.create(ps, 7, { werewolfMode: 'deal', moderatorID: ps[0].id, werewolfPreset: preset });
      s = judge(s, 'redeal', 'confirm');
      expect(Object.values(s.roles).sort()).toEqual(werewolfPreset(ps.length, preset).sort());
      expect(s.dealNumber).toBe(2);
      for (const p of ps) expect(werewolfHosted.view(s, p.id).board.players.filter((p: any) => p.role)).toHaveLength(1);
    }
  });
});

describe('白痴 (Idiot) complete lifecycle', () => {
  it('survives exile, reveals publicly, loses voting and badge rights, but continues speaking/night participation', () => {
    let s = standardNight(standard('idiot'));
    const idiot = find(s, 'idiot'), other = find(s, 'villager');
    s.sheriff = idiot;
    s = standardExile(s, idiot);
    expect(s.alive).toContain(idiot);
    expect(s.idiotRevealed).toBe(idiot);
    expect(s.sheriff).toBeNull();
    expect(s.badgeOwner).toBeNull();
    expect(s.stage).toBe('nightFirst');
    for (const p of s.players) {
      const visible = standardWerewolf.view(s, p.id).board.players.find((p: any) => p.id === idiot);
      expect(visible.role).toBe('白痴');
      expect(visible.revealedIdiot).toBe(true);
    }
    s = standardNight(s);
    expect(standardWerewolf.view(s, idiot).actions.map(a => a.id)).toEqual(['ready']);
    for (const id of [...s.alive]) s = act(s, id, 'ready');
    expect(standardWerewolf.view(s, idiot).actions).toEqual([]);
    expect(standardWerewolf.view(s, other).actions[0].choices.some(c => c.id === idiot)).toBe(false);
    expect(() => act(s, idiot, 'vote', other)).toThrow();
    expect(() => act(s, other, 'vote', idiot)).toThrow();
    s = standardExile(s, 'skip');
    expect(s.stage).toBe('nightFirst'); // No deadlock waiting for the lost vote.
    s = standardNight(s, idiot);
    expect(s.alive).not.toContain(idiot);
  });
  it('does not save an unflipped idiot from poison or a hunter shot, and counts them as a god for victory', () => {
    let s = standard('idiot'), idiot = find(s, 'idiot');
    s = standardNight(s, 'skip', 'poison:' + idiot);
    expect(s.alive).not.toContain(idiot);
    expect(s.idiotRevealed).toBeUndefined();
    s = standardNight(standard('idiot')); idiot = find(s, 'idiot');
    s = standardExile(s, find(s, 'hunter'));
    s = act(s, s.hunterID!, 'shoot', idiot);
    expect(s.alive).not.toContain(idiot);
    expect(werewolfVictory(['wolf','villager','idiot'])).toBeNull();
    expect(werewolfVictory(['wolf','villager'])).toContain('屠边');
  });
  it('excludes a revealed idiot from PK voters without preventing the runoff from resolving', () => {
    let s = standardNight(standard('idiot'));
    const idiot = find(s, 'idiot');
    s = standardExile(s, idiot); s = standardNight(s);
    for (const id of [...s.alive]) s = act(s, id, 'ready');
    const targets = s.alive.filter(id => id !== idiot).slice(0, 2), voters = s.alive.filter(id => id !== idiot);
    for (let i = 0; i < voters.length; i++) s = act(s, voters[i], 'vote', i < 4 ? targets[0] : i < 8 ? targets[1] : 'skip');
    expect(s.stage).toBe('pk');
    for (const id of [...s.alive]) s = act(s, id, 'ready');
    expect(standardWerewolf.view(s, idiot).actions).toEqual([]);
    for (const id of s.alive.filter(id => id !== idiot && !targets.includes(id))) s = act(s, id, 'vote', 'skip');
    expect(s.stage).toBe('nightFirst');
  });
  it('judge mode publishes the flip only after recording exile and blocks later exile/badge selection', () => {
    let s = hostedNight(hosted('idiot'));
    const idiot = find(s, 'idiot'), villager = find(s, 'villager');
    expect(werewolfHosted.view(s, villager).board.players.find((p: any) => p.id === idiot).role).toBeUndefined();
    s.sheriff = idiot;
    s = judge(s, 'judge-exile', idiot);
    expect(s.alive).toContain(idiot); expect(s.sheriff).toBeNull();
    expect(werewolfHosted.view(s, villager).board.players.find((p: any) => p.id === idiot).role).toBe('白痴');
    s = hostedNight(s);
    expect(werewolfHosted.view(s, s.options.moderatorID).actions.find(a => a.id === 'judge-exile')!.choices.some(c => c.id === idiot)).toBe(false);
    expect(() => judge(s, 'judge-exile', idiot)).toThrow();
    s.sheriff = villager;
    s = judge(s, 'judge-exile', villager);
    expect(s.stage).toBe('badge');
    expect(werewolfHosted.view(s, s.options.moderatorID).actions[0].choices.some(c => c.id === idiot)).toBe(false);
    s = judge(s, 'judge-badge');
    s = hostedNight(s, 'skip', 'poison:' + idiot);
    expect(s.alive).not.toContain(idiot);
  });
});

describe('狼王 (Wolf King) complete lifecycle', () => {
  it('belongs to the wolf team for attack, teammates, inspection and both victory rules', () => {
    let s = standard(), king = find(s, 'wolfKing'), wolf = find(s, 'wolf'), villager = find(s, 'villager');
    expect(standardWerewolf.view(s, king).actions[0].id).toBe('wolf');
    expect(standardWerewolf.view(s, wolf).board.ownKnowledge.find((k: any) => k.id === 'wolves').detail).toContain(s.players.find(p => p.id === king)!.name);
    expect(standardWerewolf.view(s, king).board.ownRoleKey).toBe('wolfKing');
    expect(standardWerewolf.view(s, villager).board.players.find((p: any) => p.id === king).role).toBeUndefined();
    s = standardNight(s, villager, 'skip', king);
    expect(s.alive).not.toContain(villager);
    expect(s.investigations[king]).toBe('狼人');
    expect(werewolfVictory(['wolfKing','villager','seer'])).toBeNull();
    expect(werewolfVictory(['wolfKing','villager'],'parity')).toContain('人数平衡');
    expect(werewolfVictory(['wolfKing','villager'])).toContain('屠边');
    let h = hosted(), hk = find(h, 'wolfKing');
    h.alive = h.alive.filter(id => h.roles[id] !== 'wolf');
    h = hostedNight(h, 'skip', 'skip', hk);
    expect(h.checks.at(-1)?.result).toBe('狼人');
    expect(werewolfHosted.view(h, hk).board.ownKnowledge[0].detail).toBe('狼人阵营'); // Lone king still receives the wolf night step.
  });
  it.each([['hunter', 'wolfKing'], ['wolfKing', 'hunter']] as const)('resolves %s → %s shot chains before continuation and transfers a dead sheriff badge once', (first, second) => {
    let s = standardNight(standard());
    const shooter = find(s, first), chained = find(s, second), target = find(s, 'villager');
    s.sheriff = chained;
    s = standardExile(s, shooter);
    expect(s.hunterID).toBe(shooter); expect(s.stage).toBe('hunter');
    expect(standardWerewolf.view(s, shooter).actions[0].title).toBe('开枪');
    s = act(s, shooter, 'shoot', chained);
    expect(s.stage).toBe('hunter'); expect(s.hunterID).toBe(chained);
    s = act(s, chained, 'shoot', target);
    expect(s.stage).toBe('badge'); expect(s.badgeOwner).toBe(chained);
    for (const id of [shooter, chained]) expect(standardWerewolf.view(s, find(s, 'seer')).board.players.find((p: any) => p.id === id).role).toBeUndefined();
    expect(s.log.some(line => line.includes('猎人带走') || line.includes('狼王带走'))).toBe(false);
    s = act(s, chained, 'badge', 'skip');
    expect(s.stage).toBe('nightFirst'); expect(s.night).toBe(2);
  });
  it('blocks poisoned and self-exploded wolf guns, including same-night knife plus poison', () => {
    for (const victimIsKing of [false, true]) {
      let s = standard(), king = find(s, 'wolfKing');
      s = standardNight(s, victimIsKing ? king : 'skip', 'poison:' + king);
      expect(s.alive).not.toContain(king); expect(s.hunterID).toBeNull(); expect(s.stage).toBe('discussion');
    }
    let s = standardNight(standard()), king = find(s, 'wolfKing');
    s = act(s, king, 'explode');
    expect(s.stage).toBe('nightFirst'); expect(s.hunterID).toBeNull();
    let h = hostedNight(hosted()), hk = find(h, 'wolfKing');
    h = judge(h, 'judge-explode', hk);
    expect(h.hunterID).toBeNull(); expect(['guard','wolves','witch','seer']).toContain(h.stage);
  });
  it.each([['hunter', 'wolfKing'], ['wolfKing', 'hunter']] as const)('night knife on %s and poison on %s allows only the unpoisoned gun', (knifed, poisoned) => {
    let s = standard(), shooter = find(s, knifed), poisonedID = find(s, poisoned);
    s = standardNight(s, shooter, 'poison:' + poisonedID);
    expect(s.stage).toBe('hunter'); expect(s.hunterID).toBe(shooter);
    expect(s.alive).not.toContain(poisonedID);
    expect(standardWerewolf.view(s, poisonedID).actions).toEqual([]);
    s = act(s, shooter, 'shoot', 'skip');
    expect(s.stage).toBe('discussion'); expect(s.hunterID).toBeNull();
    let h = hosted(), hs = find(h, knifed), hp = find(h, poisoned);
    h = hostedNight(h, hs, 'poison:' + hp);
    expect(h.stage).toBe('hunter'); expect(h.hunterID).toBe(hs);
    h = judge(h, 'judge-shoot');
    expect(h.stage).toBe('day'); expect(h.hunterID).toBeNull();
  });
  it('cannot recover a self-explosion gun at dawn after self-knifing during the sheriff election', () => {
    let s = standard(), king = find(s, 'wolfKing');
    s = standardNight(s, king, 'skip', 'skip', 'yes');
    expect(s.stage).toBe('electionSpeech');
    s = act(s, king, 'explode');
    expect(s.hunterID).toBeNull(); expect(s.stage).toBe('nightFirst'); expect(s.night).toBe(2);
    let h = hosted(), hk = find(h, 'wolfKing');
    h = hostedNight(h, hk, 'skip', 'skip', false);
    expect(h.stage).toBe('sheriff');
    h = judge(h, 'judge-election-explode', hk);
    expect(werewolfHosted.view(h, h.options.moderatorID).board.moderatorOnly.pendingDeaths).toEqual([]);
    h = judge(h, 'judge-dawn', 'confirm');
    expect(h.hunterID).toBeNull(); expect(h.night).toBe(2);
  });
  it('ends when the last wolf king dies, without granting a gun that could reverse the result', () => {
    let s = standardNight(standard());
    s.alive = s.alive.filter(id => s.roles[id] !== 'wolf');
    s = standardExile(s, find(s, 'wolfKing'));
    expect(s.winner).toContain('好人获胜'); expect(s.hunterID).toBeNull();
    let h = hostedNight(hosted());
    h.alive = h.alive.filter(id => h.roles[id] !== 'wolf');
    h = judge(h, 'judge-exile', find(h, 'wolfKing'));
    expect(h.winner).toContain('好人获胜'); expect(h.stage).toBe('finished');
  });
  it.each([['hunter', 'wolfKing'], ['wolfKing', 'hunter']] as const)('judge mode resolves %s → %s shots without public identity leaks', (first, second) => {
    let h = hostedNight(hosted());
    const one = find(h, first), two = find(h, second), villager = find(h, 'villager');
    h = judge(h, 'judge-exile', one);
    expect(h.hunterID).toBe(one);
    expect(werewolfHosted.view(h, one).actions).toEqual([]);
    h = judge(h, 'judge-shoot', two);
    expect(h.hunterID).toBe(two);
    h = judge(h, 'judge-shoot');
    expect(h.hunterID).toBeNull();
    for (const id of [one, two]) expect(werewolfHosted.view(h, villager).board.players.find((p: any) => p.id === id).role).toBeUndefined();
  });
});
