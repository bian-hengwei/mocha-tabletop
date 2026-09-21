import {useState} from 'react';
import {Crown,Layers,X} from 'lucide-react';
import type {GameView} from '../core/types';
import {pokerTitle,rankName,type PokerCard} from '../core/games/poker';
import {t} from '../i18n';
import {PokerArt} from './ClassicCardArt';
import {useDialog} from './useDialog';
import './guandan-results.css';
interface ResultPlayer {id:string;name:string;avatar:string;rank:number;team:number;score:number;count:number;hand:PokerCard[]}
type Props={view:GameView;selfID:string;onNext?:()=>void;onReplay?:()=>void;replayLabel?:string};
export function GuandanResults({view,selfID,onNext,onReplay,replayLabel='再来一局'}:Props){
 const [handsOpen,setHandsOpen]=useState(false),dialog=useDialog<HTMLElement>(handsOpen,()=>setHandsOpen(false));
 const board=view.board as {players:ResultPlayer[];levels:number[];winners:string[];round:number};
 const players=[...board.players].sort((a,b)=>(a.rank||5)-(b.rank||5));
 return <section className="classic-results gd-results" aria-label={t(view.finished?'本局结束':'本轮结算')}>
  <header className="gd-result-heading"><h2>{view.finished&&<Crown size={20} aria-hidden="true"/>}{t(view.finished?'本局结束':'本轮结算')}</h2><p>{view.finished?t(view.instruction):`${t('轮次')} ${board.round}`}</p></header>
  <div className="gd-result-levels" aria-label={t('两队级数')}>{board.levels.map((level,i)=><div key={i}><span>{t('队伍')} {i+1}</span><b>{rankName(level===2?15:level)}</b><small>{t('级牌')}</small></div>)}</div>
  <div className="gd-result-standings"><table aria-label={t('得分明细')}><thead><tr><th scope="col">{t('名次')}</th><th scope="col">{t('玩家名')}</th><th scope="col">{t('队伍')}</th><th scope="col">{t('本轮得分')}</th><th scope="col">{t('手牌')}</th></tr></thead><tbody>{players.map(p=><tr key={p.id} className={`${p.id===selfID?'gd-result-self ':''}${view.finished&&board.winners.includes(p.id)?'gd-result-winner':''}`}><td>{p.rank||'—'}</td><th scope="row"><span aria-hidden="true">{p.avatar}</span>{p.name}{p.id===selfID&&<small className="gd-result-you"> · {t('我')}</small>}{view.finished&&board.winners.includes(p.id)&&<Crown size={14} aria-label={t('胜者')}/>}</th><td>{p.team+1}</td><td>{p.score}</td><td>{p.count}</td></tr>)}</tbody></table></div>
  <footer className="gd-result-actions"><button className="compact" onClick={()=>setHandsOpen(true)}><Layers size={16}/>{t('查看剩余手牌')}</button>{view.finished?(onReplay?<button className="compact primary" onClick={onReplay}>{t(replayLabel)}</button>:<p>{t('等待房主再开一局')}</p>):onNext?<button className="compact primary" onClick={onNext}>{t('开始下一轮')}</button>:<p>{t('等待开始下一轮')}</p>}</footer>
  {handsOpen&&<div className="modal-shade"><section ref={dialog} className="panel gd-hand-dialog" role="dialog" aria-modal="true" aria-label={t('剩余手牌')} tabIndex={-1}><header><h2>{t('剩余手牌')}</h2><button className="icon" aria-label={t('关闭')} onClick={()=>setHandsOpen(false)}><X size={20}/></button></header><div className="gd-hand-list">{players.map(p=><section key={p.id}><h3>{p.avatar} {p.name}<small>{t(`${p.count} 张`)}</small></h3>{p.hand.length?<div className="classic-reveal">{p.hand.map(card=><span className="classic-face poker-face mini" role="img" aria-label={t(pokerTitle(card))} key={card.id}><PokerArt rank={card.rank} suit={card.suit}/></span>)}</div>:<p>{t('手牌已出完')}</p>}</section>)}</div></section></div>}
 </section>;
}
