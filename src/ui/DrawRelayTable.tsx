import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Eye,EyeOff,Send,BookOpen} from 'lucide-react';
import {RELAY_MAX_STROKES,type RelayEntry} from '../core/games/drawrelay';
import type {Command,GameView,Player} from '../core/types';
import {t,useLocale} from '../i18n';
import {useDialog} from './useDialog';
import {DrawRelayCanvas} from './DrawRelayCanvas';
import {DrawingTools} from './DrawingTools';
import './draw-relay-table.css';

type Props={view:GameView;selfID:string;command:(command:Command)=>void;onReplay?:()=>void};
type Task={id:string;book:number;step:number;kind:'drawing'|'text'};
function Entry({entry}:{entry:RelayEntry}){return entry.skipped?<div className="relay-skipped">{t('上一步未完成')}</div>:entry.kind==='drawing'?<DrawRelayCanvas strokes={entry.strokes||[]}/>:<blockquote className="relay-sentence">{entry.text}</blockquote>;}
function Editor({view,command,selfID,onBusy}:{view:GameView;command:Props['command'];selfID:string;onBusy:(busy:boolean)=>void}){
 const b=view.board,draft=b.draft as RelayEntry,marker=b.taskID??String(b.step),values=[marker];
 const [text,setText]=useState(draft.text||''),[submitWanted,setSubmitWanted]=useState(false),[color,setColor]=useState(0),[width,setWidth]=useState(1),[clearOpen,setClearOpen]=useState(false),[canvasVersion,setCanvasVersion]=useState(0);
 const [sending,setSending]=useState<string|null>(null),[saveFailed,setSaveFailed]=useState(false),[composing,setComposing]=useState(false),sendRef=useRef(command);sendRef.current=command;
 const clearDialog=useDialog<HTMLDivElement>(clearOpen,()=>setClearOpen(false));
 const drawing=draft.kind==='drawing',saved=draft.text||'',valid=drawing?!!draft.strokes?.length:!!text.trim();
 useEffect(()=>{onBusy(!drawing&&(text!==saved||sending!==null||composing));},[drawing,text,saved,sending,composing,onBusy]);
 useEffect(()=>()=>onBusy(false),[onBusy]);
 useEffect(()=>{if(sending!==null&&sending===saved){setSending(null);setSaveFailed(false);}},[saved,sending]);
 useEffect(()=>{if(sending===null)return;const timer=setTimeout(()=>{setSending(null);setSaveFailed(true);setSubmitWanted(false);},5000);return()=>clearTimeout(timer);},[sending]);
 useEffect(()=>{if(drawing||b.submitted||composing)return;if(text===saved){if(submitWanted){setSubmitWanted(false);sendRef.current({action:'submit',values:[marker]});}return;}if(sending!==null||saveFailed)return;const timer=setTimeout(()=>{setSending(text);sendRef.current({action:'draft',values:[marker],text});},submitWanted?0:350);return()=>clearTimeout(timer);},[text,saved,drawing,submitWanted,b.submitted,marker,sending,saveFailed,composing]);
 return <><div className={`relay-work ${drawing?'draw':'write'}`}>
 {b.previous&&<section className="relay-previous"><Entry entry={b.previous}/></section>}
 <section className="relay-draft">{drawing?<div className="relay-paper"><DrawRelayCanvas key={`${marker}:${selfID}:${canvasVersion}`} strokes={draft.strokes||[]} enabled={!b.submitted&&(draft.strokes?.length||0)<RELAY_MAX_STROKES} color={color} width={width} onStroke={encoded=>command({action:'stroke',values:[marker,encoded]})}/></div>:<label className="relay-writing"><textarea aria-label={t(b.step?'你的描述':'开场句')} placeholder={t(b.step?'你的描述':'开场句')} value={text} rows={2} maxLength={240} disabled={b.submitted} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setText([...e.currentTarget.value].slice(0,120).join(''));}} onChange={e=>{setSaveFailed(false);setText([...e.target.value].slice(0,120).join(''));}} autoComplete="off"/><span className="relay-draft-status"><small role="status">{t(saveFailed?'草稿尚未保存':text===saved?'草稿已保存':'正在保存草稿')}</small><small>{[...text].length}/120</small></span>{saveFailed&&<button type="button" onClick={()=>setSaveFailed(false)}>{t('重试保存')}</button>}</label>}</section></div>
 {!b.submitted?<footer className="relay-submit">{drawing?<DrawingTools color={color} width={width} onColor={setColor} onWidth={setWidth} onUndo={draft.strokes?.length?()=>command({action:'undo',values}):undefined} onClear={draft.strokes?.length?()=>setClearOpen(true):undefined}/>:<span/>}<button className="primary" disabled={!valid||submitWanted||composing} onClick={()=>drawing||text===saved?command({action:'submit',values}):setSubmitWanted(true)}><Send size={17}/><span>{t('传递')}</span></button></footer>:<p className="relay-wait" role="status">{t('已提交，等待其他玩家')}</p>}
 {clearOpen&&<div className="modal-shade"><div ref={clearDialog} className="panel relay-clear-dialog" role="dialog" aria-modal="true" aria-label={t('清空这幅画？')} tabIndex={-1}><h2>{t('清空这幅画？')}</h2><p>{t('清空后不能恢复')}</p><div><button onClick={()=>setClearOpen(false)}>{t('保留画作')}</button><button className="primary" onClick={()=>{command({action:'clear',values});setCanvasVersion(value=>value+1);setClearOpen(false);}}>{t('确认清空')}</button></div></div></div>}
 </>;
}
export function DrawRelayTable({view,selfID,command,onReplay}:Props){
 useLocale();const b=view.board,[revealed,setRevealed]=useState(false),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now());const players=b.players as (Player&{ready:boolean})[],tasks=(b.tasks||[]) as Task[];
 useEffect(()=>{setRevealed(false);setBusy(false);},[selfID]);
 useEffect(()=>{if(!b.deadlineAt)return;const timer=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(timer);},[b.deadlineAt]);
 const seconds=Math.max(0,Math.ceil((b.deadlineAt-now)/1000)),gallery=b.gallery as {book:number;page:number;entry:RelayEntry}|undefined;
 return <section className={`relay-table ${gallery?'gallery':''} ${b.stage==='draw'?'drawing':''}`}><header className="relay-heading"><div><BookOpen size={18}/><span>{gallery?t('画册'):b.mode==='queue'?`${t('待办')} ${tasks.length}`:`${b.step+1} / ${b.totalSteps}`}</span></div>
 {!gallery&&b.mode==='queue'&&tasks.length>0&&revealed&&<select aria-label={t('待办任务')} value={b.taskID} disabled={busy} onChange={e=>command({action:'task',values:[e.target.value]})}>{tasks.map(task=><option key={task.id} value={task.id}>#{task.book+1} · {t(task.step===0?'开场句':task.kind==='drawing'?'画图':'猜图')}</option>)}</select>}
 {!!b.seconds&&!gallery&&<strong className={`relay-time ${seconds<=10&&b.deadlineAt?'urgent':''}`}>{b.deadlineAt?`${seconds}s`:'—'}</strong>}
 {!gallery&&!view.spectating&&revealed&&<button aria-label={t('隐藏接龙页')} disabled={busy} onClick={()=>setRevealed(false)}><EyeOff size={18}/></button>}</header>
 {gallery?<><div className="relay-gallery-controls"><select aria-label={t('更换画册')} value={gallery.book} disabled={view.spectating} onChange={e=>command({action:'album',values:[e.target.value]})}>{players.map((p,i)=><option key={p.id} value={i}>{i+1}. {p.name}</option>)}</select><span>{gallery.page+1} / {b.totalSteps}</span></div><article className="relay-gallery-page"><header><span>{players.find(p=>p.id===gallery.entry.author)?.avatar} {players.find(p=>p.id===gallery.entry.author)?.name}</span></header><Entry entry={gallery.entry}/></article><footer className="relay-gallery-footer"><button aria-label={t('上一页')} disabled={view.spectating||gallery.page===0} onClick={()=>command({action:'page',values:[String(gallery.page-1)]})}><ArrowLeft size={18}/></button>{onReplay&&<button onClick={onReplay}>{t('再玩接龙')}</button>}<button aria-label={t('下一页')} disabled={view.spectating||gallery.page===b.totalSteps-1} onClick={()=>command({action:'page',values:[String(gallery.page+1)]})}><ArrowRight size={18}/></button></footer></>:view.spectating?<div className="relay-sealed"><BookOpen size={42}/><p>{t('等待玩家完成接龙')}</p></div>:!revealed?<div className="relay-sealed"><BookOpen size={42}/><button className="primary" onClick={()=>setRevealed(true)}><Eye size={18}/>{t('查看我的接龙页')}</button></div>:!b.draft?<div className="relay-sealed"><p role="status">{t('暂无待办')}</p><small>{t('新任务到达后会自动显示')}</small></div>:<Editor key={`${selfID}:${b.taskID??b.step}`} view={view} command={command} selfID={selfID} onBusy={setBusy}/>}
 </section>;
}
