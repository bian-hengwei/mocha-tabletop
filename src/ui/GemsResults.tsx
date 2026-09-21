import type {Player} from '../core/types';
import type {GemCard, Noble} from '../core/games/gems';
import {t} from '../i18n';
import './gems-results.css';

type ResultPlayer=Player&{score:number;bought:GemCard[];nobles:Noble[]};
type Props={players:ResultPlayer[];winners:string[];selfID:string};

export function GemsResults({players,winners,selfID}:Props){
  const rows=[...players].sort((a,b)=>b.score-a.score||Number(winners.includes(b.id))-Number(winners.includes(a.id)));
  return <div className="gems-results">
    <table aria-label={t('得分明细')}>
      <thead><tr><th scope="col">{t('玩家名称')}</th><th scope="col">{t('已购牌数')}</th><th scope="col">{t('贵族数')}</th><th scope="col">{t('总分')}</th></tr></thead>
      <tbody>{rows.map(player=><tr key={player.id} className={player.id===selfID?'gems-result-self':undefined}>
        <th scope="row"><span>{player.name}</span>{(player.id===selfID||winners.includes(player.id))&&<small>{[player.id===selfID?t('你'):'',winners.includes(player.id)?t('胜者'):''].filter(Boolean).join(' · ')}</small>}</th>
        <td>{player.bought.length}</td><td>{player.nobles.length}</td><td className="gems-result-total">{player.score}</td>
      </tr>)}</tbody>
    </table>
    <p>{t('15 分触发最后一轮；平分时已购牌较少者获胜。')}</p>
  </div>;
}
