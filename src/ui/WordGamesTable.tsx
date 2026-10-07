import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Eye, EyeOff, KeyRound, MessageCircle, Skull, UserRound, Fingerprint, Check, FileKey, Send } from 'lucide-react';
import type { Action, Command, GameView } from '../core/types';
import { t, useLocale } from '../i18n';
import './word-games-table.css';
import './word-viewport.css';
import {useDialog} from './useDialog';
import { IllustratedTile } from './IllustratedTile';
type Props={view:GameView;selfID:string;command:(c:Command)=>void;open:(a:Action,selected?:string[])=>void};
const teamText=(team:string)=>t(team==='red'?'红队':'蓝队');
const identityText=(identity:string)=>identity==='red'||identity==='blue'?teamText(identity):t(identity==='assassin'?'危险目标':'路人');
function WordHelp({title,children}:{title:string;children:ReactNode}){const [shown,setShown]=useState(false),ref=useDialog<HTMLDivElement>(shown,()=>setShown(false));return <><button className="wg-help-button" onClick={()=>setShown(true)}>{title}</button>{shown&&<div className="modal-shade wg-help-shade"><div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="panel wg-help-panel"><header><h2>{title}</h2><button className="wg-button" onClick={()=>setShown(false)} aria-label={t('关闭')}>×</button></header>{children}</div></div>}</>;}
function useWordPages(total:number,kind:'words'|'players',follow?:{index:number;key:string}){
 const [compact,setCompact]=useState(()=>({narrow:window.innerWidth<650,short:window.innerHeight<500}));
 const [page,setPage]=useState(0);
 useLayoutEffect(()=>{
  const resize=()=>setCompact({narrow:window.innerWidth<650,short:window.innerHeight<500});
  window.addEventListener('resize',resize);
  return()=>window.removeEventListener('resize',resize);
 },[]);
 const size=compact.narrow||compact.short?(kind==='words'?(compact.narrow&&!compact.short?9:10):4):total;
 const pages=Math.max(1,Math.ceil(total/size)),current=Math.max(0,Math.min(page,pages-1));
 const followIndex=follow?.index,followKey=follow?.key;
 useLayoutEffect(()=>{
  if(followIndex!==undefined&&followIndex>=0&&followIndex<total)setPage(Math.floor(followIndex/size));
 },[followKey,followIndex,size,total]);
 return {page:current,size,start:current*size,end:(current+1)*size,controls:pages>1?<nav className="wg-pages" aria-label={t('翻页')}><button aria-label={t('上一页')} disabled={!current} onClick={()=>setPage(current-1)}>‹</button><span aria-live="polite" aria-atomic="true">{current+1} / {pages}</span><button aria-label={t('下一页')} disabled={current===pages-1} onClick={()=>setPage(current+1)}>›</button></nav>:null};
}
function SecretSignals({view,selfID,command,open}:Props){
 const composing=useRef(false);const [marking,setMarking]=useState(false);
 const b=view.board,[keyState,setKeyState]=useState({viewer:'',shown:false}),[clue,setClue]=useState(''),[count,setCount]=useState('1'),[error,setError]=useState('');
 useLayoutEffect(()=>{setKeyState({viewer:selfID,shown:false});setMarking(false);},[selfID]);
 const pages=useWordPages(b.cards.length,'words');
 const showKey=keyState.viewer===selfID&&keyState.shown,canClue=view.actions.some(a=>a.id==='clue'),guess=view.actions.find(a=>a.id==='guess'),stop=view.actions.find(a=>a.id==='stop');
 useLayoutEffect(()=>{composing.current=false;setClue('');setCount('1');setError('');},[selfID,b.round,canClue]);
 const send=()=>{if(composing.current)return;setError('');try{command({action:'clue',values:[count],text:clue});}catch(e){setError((e as Error).message);}};
 const clueKeyDown=(event:KeyboardEvent<HTMLInputElement>)=>{if(event.key==='Enter'&&(composing.current||event.nativeEvent.isComposing||event.nativeEvent.keyCode===229))event.preventDefault();};
 return <div className="wg-table wg-signals"><header className="wg-heading wg-illustrated-heading"><IllustratedTile kind="covers" index={3} fit="slice" className="wg-heading-art"/><div><small className="wg-turn-status">{t('回合')} {b.round}</small><h2>{view.finished?`${t('胜方')} · ${teamText(b.winnerTeam)}`:teamText(b.turn)}</h2></div><div className="wg-role-controls">{!view.spectating&&<span className={`wg-role wg-${b.myTeam}`}>{teamText(b.myTeam)} · {t(b.isCaptain?'队长':'队员')}</span>}{b.isCaptain&&!view.finished&&<button type="button" className="wg-button wg-key-toggle" aria-pressed={showKey} onClick={()=>setKeyState({viewer:selfID,shown:!showKey})}>{showKey?<EyeOff size={15}/>:<Eye size={15}/>} {t(showKey?'收起密钥':'查看密钥')}</button>}</div></header>
 <div className="wg-operation-layout"><aside className="wg-command-zone"><div className="wg-teams">{['red','blue'].map(team=><section key={team} className={`wg-team wg-${team} ${b.turn===team&&!view.finished?'wg-active':''}`}><header><strong>{teamText(team)}</strong><span>{t('剩余')} <b>{b.remaining[team]}</b></span></header><div>{b.players.filter((p:any)=>p.team===team).map((p:any)=><span className={`wg-member ${p.id===selfID?'wg-me':''}`} key={p.id}>{p.avatar} {p.name}{p.captain&&<KeyRound size={12} aria-label={t('队长')}/>}</span>)}</div></section>)}</div>
 {!canClue&&(!view.finished||b.clue)&&<section className="wg-clue-panel"><div><small>{t('当前线索')}</small><strong>{b.clue?b.clue.word:t(view.instruction)}{b.clue&&<span>{b.clue.count==='unlimited'?'∞':b.clue.count}</span>}</strong></div>{b.phase==='guess'&&!view.finished&&<div className="wg-guess-status"><span>{t('还可猜')} <b>{b.limit===null?'∞':b.limit-b.guesses}</b></span>{stop?<button className="wg-button" onClick={()=>command({action:'stop',values:[]})}>{t('结束猜测')}</button>:guess&&<small>{t('至少猜一个词后才能结束')}</small>}</div>}</section>}
 {canClue&&<form className="wg-clue-form" onSubmit={e=>{e.preventDefault();send();}}><label>{t('线索词')}<input value={clue} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={clueKeyDown} onChange={e=>{setClue(e.target.value);setError('');}} maxLength={32} placeholder={t('例如：天空')} autoComplete="off" autoCapitalize="none"/></label><label>{t('线索数量')}<select value={count} onChange={e=>setCount(e.target.value)}>{Array.from({length:10},(_,i)=><option key={i} value={i}>{i}</option>)}<option value="unlimited">∞ {t('不限')}</option></select></label><button className="wg-button wg-primary wg-clue-submit" disabled={!clue.trim()} type="submit" aria-label={t('发送线索')}><span className="wg-submit-label">{t('发送线索')}</span><Send className="wg-submit-icon" size={19} aria-hidden="true"/></button>{(count==='0'||count==='unlimited')&&<small className="wg-clue-guidance">{t(count==='0'?'不相关 · 不限猜测次数':'不限猜测次数')}</small>}{error&&<p className="wg-error" role="alert">{t(error)}</p>}</form>}
 <div className="wg-extra-actions">{view.actions.filter(a=>['invalid_clue','penalty_cover','skip_penalty'].includes(a.id)).map(a=><button type="button" className="wg-button" key={a.id} onClick={()=>open(a)}>{t(a.title)}</button>)}</div>
 </aside><section className="wg-board-zone">

 {view.actions.some(a=>a.id==='mark')&&<button type="button" className="wg-button wg-mark-toggle" aria-pressed={marking} onClick={()=>setMarking(!marking)}>{t(marking?'完成标记':'个人标记')}</button>}
 <div className="wg-word-grid">{b.cards.slice(pages.start,pages.end).map((card:any)=>{const identity=card.revealed||showKey||view.finished?card.identity:null,enabled=marking?view.actions.find(a=>a.id==='mark')?.choices.some(c=>c.id===card.id):guess?.choices.some(c=>c.id===card.id),mark=b.marks?.[card.id];return <button type="button" key={card.id} className={`wg-word ${identity?'wg-'+identity:'wg-unknown'} ${card.revealed?'wg-revealed':''} ${enabled?'wg-selectable':''}`} disabled={!enabled} onClick={()=>marking?command({action:'mark',values:[card.id]}):guess&&open(guess,[card.id])} aria-label={`${card.word} · ${identity?identityText(identity):t('未揭晓')}${mark?` · ${t(mark===1?'候选':'排除')}`:''}${enabled?` · ${t(marking?'更改标记':'确认猜词')}`:''}`}><span className="wg-card-emblem" aria-hidden="true">{identity==='assassin'?<Skull/>:identity==='red'||identity==='blue'?<b>{teamText(identity).slice(0,1)}</b>:identity==='neutral'?<UserRound/>:<Fingerprint/>}</span><span className="wg-cell-index">{Number(card.id.split('-')[1])+1}</span><strong>{card.word}</strong>{mark&&!card.revealed&&<span className="wg-personal-mark" aria-hidden="true">{mark===1?'?':'×'}</span>}{card.revealed&&<span className="wg-revealed-mark" aria-hidden="true"><Check size={12}/></span>}</button>;})}</div>
 {pages.controls}</section></div><WordHelp title={t('查看本桌规则')}><p>{t('两队交替行动，队长只能用一个词和一个数字给线索。先手找出 9 个词，后手找出 8 个词。队长不可参与点选。')}</p><p>{t('猜中己方词可以继续，最多猜线索数量加一次；猜到路人或对方词立即结束回合。猜中危险目标立即失败。先找齐己方词的一队获胜，也可能在对方回合获胜。')}</p><p>{t('0 和不限线索均不限制猜测次数，但仍须至少猜一次。线索不可是未揭晓的牌面词或其变形，也不可暗示位置、拼写或发音；含义是否合法由在场玩家共同判断。')}</p><p>{t('队长密钥属于私密信息。同屏试玩时，切换座位前请先收起密钥。')}</p><p>{t('词库语言')}：{t(b.language==='en'?'英文':'中文')}</p></WordHelp></div>;
}
function OddWordOut({view,selfID,command}:Props){
 const b=view.board,[peek,setPeek]=useState(false),[read,setRead]=useState(false);
 useLayoutEffect(()=>{setPeek(false);setRead(false);},[selfID,b.word]);
 const ready=view.actions.find(a=>a.id==='ready');
 return <div className="wg-table wg-odd wg-word-dealer"><header className="wg-heading"><h2>{t('秘密发词')}</h2><span>{b.players.filter((p:{ready:boolean})=>p.ready).length} / {b.players.length}</span></header>
 {!view.spectating&&<section className="wg-secret-panel"><button type="button" className={`wg-secret ${peek?'wg-open':''}`} onClick={()=>{setPeek(!peek);setRead(true);}} aria-label={t(peek?'收起我的词':'查看我的词')} aria-pressed={peek}><IllustratedTile kind="covers" index={4} className="wg-secret-art"/>{peek?<><strong>{b.word}</strong><EyeOff size={20}/></>:<><FileKey size={32}/><strong>{t('查看我的词')}</strong></>}</button>{ready&&<button type="button" className="wg-button wg-primary" disabled={!read} onClick={()=>{command({action:'ready',values:[]});setPeek(false);}}>{t('记住了')}</button>}</section>}
 <div className="wg-dealt-players">{b.players.map((p:{id:string;name:string;avatar:string;ready:boolean})=><span key={p.id}><i>{p.avatar}</i><b>{p.name}</b>{p.ready?<Check size={16} aria-label={t('已看词')}/>:<span aria-label={t('等待看词')}>·</span>}</span>)}</div>
 <WordHelp title={t('查看本桌规则')}><p>{t('每人收到一个秘密词。多数人拿到相同词，少数人拿到相近的另一词；你只知道自己的词，不知道阵营。请用一句话轮流描述，不直接说出词本身。')}</p><p>{t('描述、讨论和投票在线下进行。重新开局可再次发词。')}</p><p>{t('3–6 人有 1 位异词玩家，7–10 人有 2 位，11–12 人有 3 位。不含白板。')}</p></WordHelp></div>;
}
export function WordGamesTable(props:Props){useLocale();return props.view.kind==='codenames'?<SecretSignals {...props}/>:<OddWordOut {...props}/>;}
