import type {Player} from '../core/types';
import {t} from '../i18n';
import './century-results.css';

type ResultPlayer=Player&{score:number;orderCount:number;gold:number;silver:number};
type Props={players:ResultPlayer[];winners:string[];selfID:string;goalTarget:number};

export function CenturyResults({players,winners,selfID,goalTarget}:Props){
  const rows=[...players].sort((a,b)=>b.score-a.score||Number(winners.includes(b.id))-Number(winners.includes(a.id)));
  return <div className="century-results">
    <table aria-label={t('得分明细')}>
      <thead><tr><th scope="col">{t('玩家名称')}</th><th scope="col">{t('订单数')}</th><th scope="col">{t('金币数')}</th><th scope="col">{t('银币数')}</th><th scope="col">{t('总分')}</th></tr></thead>
      <tbody>{rows.map(player=><tr key={player.id} className={player.id===selfID?'century-result-self':undefined}>
        <th scope="row"><span>{player.name}</span>{(player.id===selfID||winners.includes(player.id))&&<small>{[player.id===selfID?t('你'):'',winners.includes(player.id)?t('胜者'):''].filter(Boolean).join(' · ')}</small>}</th>
        <td>{player.orderCount}</td><td>{player.gold}</td><td>{player.silver}</td><td className="century-result-total">{player.score}</td>
      </tr>)}</tbody>
    </table>
    <p>{t('触发末轮的订单数')}：{goalTarget}</p>
  </div>;
}
