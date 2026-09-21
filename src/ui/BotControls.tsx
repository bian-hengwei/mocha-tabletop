import {Bot,Share2,Trash2} from 'lucide-react';
import {BOT_DIFFICULTIES} from '../core/bots';
import type {BotDifficulty} from '../core/bots/types';
import type {RoomPlayer} from '../core/room';
import {t,useLocale} from '../i18n';
import './bots.css';

const difficultyLabels:Record<BotDifficulty,string>={easy:'简单',normal:'普通',hard:'困难'};
export const botDifficultyLabel=(difficulty:BotDifficulty)=>t(difficultyLabels[difficulty]);
function DifficultyOptions(){return <>{BOT_DIFFICULTIES.map(d=><option key={d} value={d}>{botDifficultyLabel(d)}</option>)}</>;}

export function BotSeatControls({player,onDifficulty,onRemove}:{player:RoomPlayer;onDifficulty:(id:string,difficulty:BotDifficulty)=>void;onRemove:(id:string)=>void}){
 useLocale();
 return <div className="bot-seat-controls"><select aria-label={`${player.name} · ${t('人机难度')}`} value={player.bot!.difficulty} onChange={e=>onDifficulty(player.id,e.target.value as BotDifficulty)}><DifficultyOptions/></select><button className="icon" aria-label={`${t('移除人机')} ${player.name}`} onClick={()=>onRemove(player.id)}><Trash2 size={16}/></button></div>;
}

export function AddSeatChoices({onInvite,onAdd}:{onInvite:()=>void;onAdd:(difficulty:BotDifficulty)=>void}){
 useLocale();
 return <div className="add-seat-choices"><button onClick={onInvite}><Share2 size={21}/><span>{t('邀请朋友')}</span></button>{BOT_DIFFICULTIES.map(d=><button key={d} onClick={()=>onAdd(d)}><Bot size={21}/><span>{t(`${difficultyLabels[d]}人机`)}</span></button>)}</div>;
}

export function BotRosterSummary({players}:{players:RoomPlayer[]}){
 const locale=useLocale(),bots=players.filter(p=>p.bot).length;
 if(!bots)return null;
 return <span className="bot-roster-summary">{locale==='zh'?`${players.length-bots} 人 · ${bots} 机`:`${players.length-bots} human${players.length-bots===1?'':'s'} · ${bots} bot${bots===1?'':'s'}`}</span>;
}
