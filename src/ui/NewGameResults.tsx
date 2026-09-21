import {Crown} from 'lucide-react';
import {t} from '../i18n';
import type {GameView} from '../core/types';
import './new-game-results.css';

interface ResultPlayer {
 id:string;
 name:string;
 avatar:string;
 score:number;
 puddings?:number;
 orderCount?:number;
 gold?:number;
 silver?:number;
}

export function NewGameResults({view,selfID}:{view:GameView;selfID:string}) {
 const players=view.board.players as ResultPlayer[];
 const winners=view.board.winners as string[];
 const rounds=(view.board.roundScores??[]) as number[][];
 const rows=players.map((player,index)=>({player,index})).sort((a,b)=>
  Number(winners.includes(b.player.id))-Number(winners.includes(a.player.id))||b.player.score-a.player.score||a.index-b.index);
 return <section className={`ng-final-results ng-final-${view.kind}`} aria-label={t('最终得分')}>
  <header><h2>{t('最终得分')}</h2><p>{t('胜者')}{t('：')} {players.filter(p=>winners.includes(p.id)).map(p=>p.name).join('、')}</p></header>
  <ol className="ng-final-grid" tabIndex={0} aria-label={t('所有玩家的最终得分')}>
   {rows.map(({player:p,index})=>{
    const winner=winners.includes(p.id);
    // The stored round totals already include every round-scoring rule. The
    // difference from the final total is the authoritative pudding adjustment.
    const puddingPoints=p.score-rounds.reduce((sum,round)=>sum+(round[index]??0),0);
    return <li key={p.id} className={`ng-final-player ${winner?'winner':''} ${p.id===selfID?'self':''}`}>
     <div className="ng-final-player-heading">{winner?<Crown size={16} role="img" aria-label={t('胜者')}/>:<span className="ng-final-avatar" aria-hidden="true">{p.avatar}</span>}<b>{p.name}{p.id===selfID&&<small>{' · '}{t('你')}</small>}</b><strong>{p.score}<small>{t('分')}</small></strong></div>
     {view.kind==='sushi'&&<dl className="ng-final-details">
      {rounds.map((round,i)=><div key={i}><dt>{t(['第 1 轮','第 2 轮','第 3 轮'][i])}</dt><dd>{round[index]??0}</dd></div>)}
      {rounds.length===3?<div className="ng-final-pudding"><dt>{t('布丁')}<small> ×{p.puddings}</small></dt><dd>{puddingPoints>0?'+':''}{puddingPoints}</dd></div>:<div><dt>{t('布丁')}</dt><dd>{p.puddings}</dd></div>}
     </dl>}
     {view.kind==='century'&&<dl className="ng-final-details"><div><dt>{t('订单数')}</dt><dd>{p.orderCount}</dd></div><div><dt>{t('金币')}</dt><dd>{p.gold}</dd></div><div><dt>{t('银币')}</dt><dd>{p.silver}</dd></div></dl>}
    </li>;
   })}
  </ol>
 </section>;
}
