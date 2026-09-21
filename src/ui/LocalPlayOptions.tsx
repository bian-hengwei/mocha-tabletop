import {Bot,Gamepad2} from 'lucide-react';
import {BOT_DIFFICULTIES,supportsBots} from '../core/bots';
import type {BotDifficulty} from '../core/bots/types';
import type {GameKind} from '../core/types';
import {t,useLocale} from '../i18n';
import {botDifficultyLabel} from './BotControls';
import './local-play.css';
export function LocalPlayOptions({kind,count,limits,difficulty,moderator=false,onCount,onDifficulty,onStart}:{kind:GameKind;count:number;limits:{min:number;max:number};difficulty:BotDifficulty;moderator?:boolean;onCount:(count:number)=>void;onDifficulty:(difficulty:BotDifficulty)=>void;onStart:(difficulty?:BotDifficulty)=>void}){
 useLocale();const bots=supportsBots(kind);
 return <section className="local-play-options" aria-label={t('单机游玩')}><h3>{t('单机游玩')}</h3><div className="local-play-fields"><label>{t('总人数')}{moderator&&<small>{t('含法官席位')}</small>}<select aria-label={t('单机总人数')} value={count} disabled={limits.min===limits.max} onChange={e=>onCount(Number(e.target.value))}>{Array.from({length:limits.max-limits.min+1},(_,i)=>limits.min+i).map(n=><option key={n} value={n}>{n}</option>)}</select></label>{bots&&<label>{t('人机难度')}<select aria-label={t('单机人机难度')} value={difficulty} onChange={e=>onDifficulty(e.target.value as BotDifficulty)}>{BOT_DIFFICULTIES.map(d=><option key={d} value={d}>{botDifficultyLabel(d)}</option>)}</select></label>}</div><div className="local-play-actions"><button className="compact" onClick={()=>onStart()}><Gamepad2 size={17}/>{t('同屏试玩')}</button>{bots&&<button className="compact primary" onClick={()=>onStart(difficulty)}><Bot size={17}/>{t('单人人机')}</button>}</div>{bots&&<p>{t('单人人机：其余座位均为所选难度的人机')}</p>}</section>;
}
