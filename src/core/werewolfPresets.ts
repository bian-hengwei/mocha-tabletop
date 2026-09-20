import type { GameOptions } from './types';

export type WolfRole = 'wolf' | 'villager' | 'seer' | 'witch' | 'hunter' | 'guard' | 'idiot' | 'wolfKing';
export const WOLF_ROLE_LABELS: Record<WolfRole, string> = { wolf: '狼人', villager: '平民', seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫', idiot: '白痴', wolfKing: '狼王' };
export const WEREWOLF_PRESETS = [
  { id: 'auto', name: '随人数自动配置', min: 6, max: 18, description: '按人数配置狼人、平民与神职；8 人起加入猎人，12 人起加入守卫。' },
  { id: 'classic9', name: '9 人预女猎', min: 9, max: 9, description: '3 狼人、3 平民、预言家、女巫、猎人。适合熟悉警长与神职配合。' },
  { id: 'idiot', name: '12 人预女猎白', min: 12, max: 12, description: '4 狼人、4 平民、预言家、女巫、猎人、白痴。白痴翻牌免于放逐，随后失去投票权。' },
  { id: 'classic', name: '12 人预女猎守', min: 12, max: 12, description: '4 狼人、4 平民、预言家、女巫、猎人、守卫。守卫加入夜间攻防。' },
  { id: 'wolfKing', name: '12 人狼王守卫', min: 12, max: 12, description: '3 狼人、狼王、4 平民、预言家、女巫、猎人、守卫。狼王出局可开枪，被毒或自爆除外。' },
  { id: 'hunter', name: '灵活人数 · 预女猎', min: 8, max: 18, description: '按人数分配狼人和平民，神职固定为预言家、女巫、猎人。' },
  { id: 'guard', name: '灵活人数 · 预女守', min: 8, max: 18, description: '按人数分配狼人和平民，神职固定为预言家、女巫、守卫。' },
] as const;

export function werewolfPresetLimits(preset: GameOptions['werewolfPreset'] = 'auto'): { min: number; max: number } {
  const config = WEREWOLF_PRESETS.find(p => p.id === preset);
  if (!config) throw new Error('狼人角色预设无效');
  return { min: config.min, max: config.max };
}

/** Fixed boards follow the published NetEase standard/advanced configurations. */
export function werewolfPreset(n: number, preset: NonNullable<GameOptions['werewolfPreset']> = 'auto'): WolfRole[] {
  const { min, max } = werewolfPresetLimits(preset);
  if (!Number.isInteger(n) || n < 6 || n > 18) throw new Error('狼人杀需要 6–18 人');
  if (n < min || n > max) throw new Error(min === max ? `此角色预设需要 ${min} 位玩家` : '预女猎或预女守需要至少 8 位玩家');
  const roles: WolfRole[] = [...Array(Math.floor(n / 3)).fill('wolf'), 'seer', 'witch'];
  if (preset === 'wolfKing') roles[0] = 'wolfKing';
  if (['hunter', 'classic9', 'classic', 'idiot', 'wolfKing'].includes(preset) || preset === 'auto' && n >= 8) roles.push('hunter');
  if (['guard', 'classic', 'wolfKing'].includes(preset) || preset === 'auto' && n >= 12) roles.push('guard');
  if (preset === 'idiot') roles.push('idiot');
  return [...roles, ...Array(n - roles.length).fill('villager')];
}

export const isWolfRole = (role: WolfRole) => role === 'wolf' || role === 'wolfKing';
export const hasDeathShot = (role: WolfRole) => role === 'hunter' || role === 'wolfKing';
