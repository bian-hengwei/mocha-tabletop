import type {Player} from '../core/types';
import {t} from '../i18n';
import './sushi-results.css';

type ResultPlayer=Player&{score:number;puddings:number};
type Props={players:ResultPlayer[];roundScores:number[][];winners:string[];selfID:string};

export function SushiResults({players,roundScores,winners,selfID}:Props){
  const rows=players.map((player,index)=>{
    const rounds=[0,1,2].map(round=>roundScores[round]?.[index]);
    const pudding=rounds.every(Number.isFinite)?player.score-rounds.reduce((sum,score)=>sum+score,0):null;
    return {player,rounds,pudding};
  }).sort((a,b)=>b.player.score-a.player.score||b.player.puddings-a.player.puddings);
  return <div className="sushi-results">
    <table aria-label={t('得分明细')}>
      <thead><tr><th scope="col">{t('玩家')}</th>{[1,2,3].map(round=><th scope="col" key={round}>{t(`第 ${round} 轮`)}</th>)}<th scope="col">{t('布丁')}</th><th scope="col">{t('总分')}</th></tr></thead>
      <tbody>{rows.map(({player,rounds,pudding})=><tr key={player.id} className={player.id===selfID?'sushi-result-self':undefined}>
        <th scope="row"><span>{player.name}</span>{(player.id===selfID||winners.includes(player.id))&&<small>{[player.id===selfID?t('你'):'',winners.includes(player.id)?t('胜者'):''].filter(Boolean).join(' · ')}</small>}</th>
        {rounds.map((score,index)=><td key={index}>{score??'—'}</td>)}
        <td>{pudding===null?'—':pudding>0?`+${pudding}`:pudding}</td><td className="sushi-result-total">{player.score}</td>
      </tr>)}</tbody>
    </table>
    <p>{t('每轮得分已含寿司卷，布丁在终局另计。')}</p>
  </div>;
}
