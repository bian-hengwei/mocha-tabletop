import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {History,X,ChevronLeft,ChevronRight} from 'lucide-react';
import {t} from '../i18n';
import type {Action,Command,GameView,Player} from '../core/types';
import {MAHJONG_MODES,tileTitle,type Tile,type Meld,type MahjongMode,type MahjongAssistance} from '../core/games/mahjong';
import {MahjongAssist} from './MahjongAssist';
import {MahjongArt} from './ClassicCardArt';
import {useDialog} from './useDialog';
import './mahjong-table.css';

type Seat=Player&{count:number;score:number;won:boolean;missing?:number;discards:Tile[];melds:Meld[];hand?:Tile[]};
type Board={exchangeRule?:'none'|'sameThree'|'anyThree'|'any';locked?:boolean;indicator?:Tile;rulesVersion?:number;assistance?:MahjongAssistance|null;hand:Tile[];players:Seat[];current:string;phase:string;mode:MahjongMode;wallCount:number;drawn:string|null;wildValue:number;turn:number;pending:{tile:Tile;from:number;rob:boolean}|null;wins:{player:number;tile:Tile;points:number;selfDraw:boolean;gained?:number;patterns?:{name:string;multiplier:number}[]}[]};
type Props={view:GameView;selfID:string;command:(c:Command)=>void;open:(a:Action,selected?:string[])=>void};
type Discard={tile:Tile;player:number};
const directions=['self','right','across','left'];
function TileFace({tile,back=false}:{tile?:Tile;back?:boolean}){
 return <span className={`mj-face ${back?'mj-back':''}`} role={back?undefined:'img'} aria-label={tile?t(tileTitle(tile)):undefined} aria-hidden={back||undefined}><MahjongArt value={tile?.value} back={back}/></span>;
}
/** Public river deltas also capture discards when the engine immediately skips forced passes. */
function useDiscards(b:Board,selfID:string){
 const previous=useRef<{selfID:string;turn:number;ids:Set<string>}|null>(null);
 const [queue,setQueue]=useState<Discard[]>([]),[latest,setLatest]=useState<Discard|null>(null);
 const signature=b.players.map(p=>p.discards.map(c=>c.id).join(',')).join('|');
 useLayoutEffect(()=>{
  const ids=new Set(b.players.flatMap(p=>p.discards.map(c=>c.id))),old=previous.current;
  if(old&&old.selfID===selfID&&b.turn>=old.turn){
   const added=b.players.flatMap((p,player)=>p.discards.filter(tile=>!old.ids.has(tile.id)).map(tile=>({tile,player})));
   if(added.length){setQueue(q=>[...q,...added]);setLatest(added.at(-1)!);}
  }else{setQueue([]);setLatest(b.pending&&!b.pending.rob?{tile:b.pending.tile,player:b.pending.from}:null);}
  previous.current={selfID,turn:b.turn,ids};
 },[signature,selfID,b.turn]);
 const flight=queue[0];
 useEffect(()=>{if(!flight)return;const timer=window.setTimeout(()=>setQueue(q=>q.slice(1)),1150);return()=>clearTimeout(timer);},[flight]);
 return {flight,latest,queued:queue.slice(1).map(d=>d.tile.id)};
}
function River({player,position,latest,flying,queued,onInspect}:{player:Seat;position:string;latest?:string;flying?:string;queued:string[];onInspect:()=>void}){
 return <section className={`mj-river river-${position}`} aria-label={`${player.name} · ${t('牌河')}`}>
  <div className="mj-river-grid">{player.discards.slice(-12).map(tile=><span className={`mj-river-cell ${tile.id===latest?'is-latest':''} ${tile.id===flying?'is-landing':''} ${queued.includes(tile.id)?'is-awaiting':''}`} key={tile.id} data-tile-id={tile.id}><TileFace tile={tile}/></span>)}</div>
  {player.discards.length>0&&<button className="mj-river-count" onClick={onInspect} aria-label={`${player.name} · ${t('查看牌河')} (${player.discards.length})`}>{player.discards.length}<span aria-hidden="true"> ↗</span></button>}
 </section>;
}
function DiscardFlight({discard,position,name}:{discard:Discard;position:string;name:string}){
 const ref=useRef<HTMLDivElement>(null),[travel,setTravel]=useState<CSSProperties>({});
 useLayoutEffect(()=>{
  const node=ref.current,table=node?.closest('.mj-table'),arena=node?.parentElement;
  if(!node||!table||!arena)return;
  const measure=()=>{
   const box=arena.getBoundingClientRect(),target=arena.querySelector(`[data-tile-id="${discard.tile.id}"]`)?.getBoundingClientRect();
   const source=table.querySelector(position==='self'?'.mj-hand-panel':`.mj-rack-${position}`)?.getBoundingClientRect();
   setTravel({'--from-x':`${source?source.x+source.width/2-box.x-box.width/2:0}px`,'--from-y':`${source?source.y+source.height/2-box.y-box.height/2:0}px`,'--to-x':`${target?target.x+target.width/2-box.x-box.width/2:0}px`,'--to-y':`${target?target.y+target.height/2-box.y-box.height/2:0}px`} as CSSProperties);
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(arena);return()=>observer.disconnect();
 },[discard.tile.id,position]);
 return <div ref={ref} className={`mj-flight from-${position}`} style={travel} role="status"><small>{name}</small><TileFace tile={discard.tile}/><b>{t(tileTitle(discard.tile))}</b></div>;
}
export function MahjongTable({view,selfID,command,open}:Props){
 const b=view.board as Board,meIndex=Math.max(0,b.players.findIndex(p=>p.id===selfID)),me=b.players[meIndex];
 const position=(i:number)=>directions[(i-meIndex+4)%4];
 const selectAction=view.actions.find(a=>a.id==='discard'||a.id==='exchange');
 const [selected,setSelected]=useState<string[]>([]),[historyOpen,setHistoryOpen]=useState(false),[riverSeat,setRiverSeat]=useState<number|null>(null);
 const historyRef=useDialog<HTMLElement>(historyOpen,()=>setHistoryOpen(false)),riverRef=useDialog<HTMLElement>(riverSeat!==null,()=>setRiverSeat(null));
 const handRef=useRef<HTMLDivElement>(null);
 const signature=b.hand.map(c=>c.id).join('|'),context=[selfID,b.current,b.phase,b.turn,signature].join(':');
 useEffect(()=>{setSelected([]);},[context]);
 useEffect(()=>{setHistoryOpen(false);setRiverSeat(null);},[selfID]);
 // Sorting the visible hand never changes tile identifiers or rules-engine state.
 const drawn=selectAction?.id==='exchange'||b.phase==='que'?null:b.drawn;
 const hand=[...b.hand.filter(c=>c.id!==drawn),...b.hand.filter(c=>c.id===drawn)];
 useEffect(()=>{if(drawn&&handRef.current)handRef.current.scrollLeft=handRef.current.scrollWidth;},[drawn,selfID]);
 const {flight,latest,queued}=useDiscards(b,selfID);
 const exchangeValid=selectAction?.id==='exchange'&&selected.length>=selectAction.min&&selected.length<=selectAction.max&&selected.every(id=>selectAction.choices.some(c=>c.id===id))&&(b.exchangeRule==='any'||b.exchangeRule==='anyThree'||new Set(b.hand.filter(c=>selected.includes(c.id)).map(c=>Math.floor(c.value/9))).size===1);
 const send=(c:Command)=>{command(c);setSelected([]);};
 const choose=(id:string)=>{
  if(selectAction?.id==='discard'&&selected.includes(id)){send({action:'discard',values:[id]});return;}
  setSelected(old=>old.includes(id)?old.filter(x=>x!==id):selectAction?.id==='discard'?[id]:old.length<(selectAction?.max??0)?[...old,id]:old);
 };
 const clear=()=>setSelected([]);
 const claims=view.actions.filter(a=>a!==selectAction);
 const readyTiles=new Set(b.assistance?.discards.filter(option=>option.waits.length>0).map(option=>option.tile.id));
 const instruction=b.phase==='exchange'?(b.exchangeRule==='any'?'任意张数':b.exchangeRule==='anyThree'?'任意三张':'同花色三张'):b.phase==='que'?'选择定缺':me.won&&(b.locked||b.mode==='bloodflow')?'已胡牌：只打新摸牌':'';
 return <div className={`classic-table mj-table game-table-mahjong ${view.spectating?'mj-spectating':''} ${view.finished?'mj-finished':''}`} onKeyDown={e=>{if(e.key==='Escape'&&!historyOpen&&riverSeat===null)clear();}}>
  <header className="mj-edition"><span className="mj-mode-name">{t(MAHJONG_MODES[b.mode])}</span>{b.wildValue>=0&&<span className="mj-wild-indicator" title={b.indicator?`${t('指示牌')} · ${t(tileTitle(b.indicator))}`:undefined}>{t('鬼牌')}<TileFace tile={{id:'wild',value:b.wildValue}}/></span>}<button className="mj-history" aria-label={`${t('胡牌记录')} (${b.wins.length})`} onClick={()=>setHistoryOpen(true)}><History size={16}/><span>{b.wins.length}</span></button></header>
  <div className="mj-arena" onClick={clear}>
   {b.players.map((p,i)=><section key={p.id} className={`mj-seat seat-${position(i)} ${p.id===b.current&&!view.finished?'current':''} ${!view.spectating&&p.id===selfID?'self':''}`}><span className="mj-avatar">{p.avatar}</span><div><b title={p.name}>{p.name}</b><small><span>{t(['东','南','西','北'][i])}</span> · {p.score>0?'+':''}{p.score} {t('分')}</small>{p.missing!==undefined&&<small>{t('缺')} {t(['万','筒','条'][p.missing])}</small>}{p.won&&<small>{t('已胡牌')}</small>}</div>{p.id===b.current&&!view.finished&&<i aria-label={t('行动中')}/>}</section>)}
   <div className="mj-opponents" aria-hidden="true">{b.players.map((p,i)=>(view.spectating||i!==meIndex)&&<div key={p.id} className={`mj-rack mj-rack-${position(i)}`}>{Array.from({length:p.count},(_,j)=><TileFace key={j} back/>)}</div>)}</div>
   <div className="mj-public" role="region" aria-label={t('公共牌池')}>
    {b.players.map((p,i)=><River key={p.id} player={p} position={position(i)} latest={latest?.tile.id} flying={flight?.tile.id} queued={queued} onInspect={()=>setRiverSeat(i)}/>)}
    <div className="mj-center"><div className="mj-compass" aria-label={t('座位方位')}>{[2,3,1,0].map(offset=><span key={offset} className={`wind-${directions[offset]} ${(meIndex+offset)%4===b.players.findIndex(p=>p.id===b.current)?'active':''}`}>{t(['东','南','西','北'][(meIndex+offset)%4]).slice(0,1)}</span>)}<b>{b.wallCount}<small>{t('余牌')}</small></b></div>{b.pending&&<div className="mj-pending"><TileFace tile={b.pending.tile}/><span>{t(b.pending.rob?'抢杠响应':'等待响应')}</span></div>}</div>
   </div>
   {b.players.map((p,i)=><div key={p.id} className={`mj-melds meld-${position(i)}`} tabIndex={p.melds.length?0:undefined} aria-label={`${p.name} · ${t('副露')}`}>{p.melds.map((m,j)=><div key={j} aria-label={`${p.name} · ${t(m.type==='concealed'?'暗杠':'副露')}`}>{m.tiles.length?m.tiles.map(tile=><TileFace key={tile.id} tile={tile}/>):[0,1,2,3].map(k=><TileFace key={k} back/>)}</div>)}</div>)}
   {flight&&<DiscardFlight key={flight.tile.id} discard={flight} position={position(flight.player)} name={b.players[flight.player].name}/>}
  </div>
  {!view.spectating&&<section className="mj-hand-panel">
   <div className="mj-hand-toolbar"><div className="mj-hints"><div className="mj-status" aria-live="polite">{t(instruction)}</div>{b.assistance&&<MahjongAssist key={context} data={b.assistance} selected={selected[0]}/>}</div><div className="mj-actions">
    {selectAction?.id==='exchange'&&<button className="mj-action" disabled={!exchangeValid} onClick={()=>send({action:'exchange',values:selected})}>{t('确认换牌')} {selected.length}{b.exchangeRule==='any'?'':'/3'}</button>}
    {claims.map(a=>a.id==='que'?a.choices.map(c=><button className="mj-action mj-suit" key={c.id} onClick={()=>send({action:a.id,values:[c.id]})}><MahjongArt value={Number(c.id)*9}/><span>{t(c.title)}</span></button>):<button className={`mj-action ${a.id==='hu'?'mj-win':''} ${a.id==='pass'?'mj-pass':''}`} key={a.id} onClick={()=>a.choices.length?open(a):send({action:a.id,values:[]})}>{t(a.title)}</button>)}
   </div></div>
   <div ref={handRef} className="mj-hand-scroll" role="group" tabIndex={0} aria-label={t('我的手牌')}><div className="mj-hand">{hand.map(tile=><button key={tile.id} data-tile-id={tile.id} className={`mj-tile ${selected.includes(tile.id)?'selected':''} ${tile.id===drawn?'drawn':''} ${tile.value===b.wildValue?'mj-wild':''} ${readyTiles.has(tile.id)?'can-ready':''}`} aria-label={t(tileTitle(tile))} aria-pressed={selected.includes(tile.id)} aria-description={[tile.id===drawn?t('新摸牌'):'',readyTiles.has(tile.id)?t('打出后听牌'):''].filter(Boolean).join(' · ')||undefined} disabled={!selectAction?.choices.some(c=>c.id===tile.id)} onClick={()=>choose(tile.id)}><TileFace tile={tile}/>{readyTiles.has(tile.id)&&<span className="mj-ready-mark" aria-hidden="true">{t('听')}</span>}</button>)}</div></div>
  </section>}
  {view.finished&&<section className="mj-results"><header><h3>{t('本局结束')}</h3><span>{t(view.instruction)}</span></header><div className="mj-result-list">{b.players.map(p=><div key={p.id} className="mj-result-player"><p>{p.avatar} <b>{p.name}</b><strong>{p.score>0?'+':''}{p.score} {t('分')}</strong></p><div className="mj-reveal" tabIndex={0} aria-label={`${p.name} · ${t('剩余手牌')}`}>{p.hand?.map(tile=><TileFace key={tile.id} tile={tile}/>)}</div></div>)}</div></section>}
  {historyOpen&&<div className="modal-shade" onClick={e=>{if(e.target===e.currentTarget)setHistoryOpen(false);}}><section ref={historyRef} className="panel mj-dialog" role="dialog" aria-modal="true" aria-label={t('胡牌记录')} tabIndex={-1}><header><h2>{t('胡牌记录')}</h2><button className="icon" aria-label={t('关闭')} onClick={()=>setHistoryOpen(false)}><X/></button></header><div className="mj-dialog-content">{b.wins.length?b.wins.map((w,i)=><p className="mj-win-row" key={i}><span>{b.players[w.player].name} · {t(w.selfDraw?'自摸':'胡牌')}<br/>{w.gained===undefined?w.points:`+${w.gained}`} {t('分')}{w.patterns&&<small className="mahjong-win-patterns">{w.patterns.map(p=>`${t(p.name)} ×${p.multiplier}`).join(' · ')}</small>}</span><TileFace tile={w.tile}/></p>):<p>{t('本局还没有胡牌')}</p>}</div></section></div>}
  {riverSeat!==null&&<div className="modal-shade" onClick={e=>{if(e.target===e.currentTarget)setRiverSeat(null);}}><section ref={riverRef} className="panel mj-dialog" role="dialog" aria-modal="true" aria-label={t('牌河')} tabIndex={-1}><header><h2>{b.players[riverSeat].name} · {t('牌河')}</h2><button className="icon" aria-label={t('关闭')} onClick={()=>setRiverSeat(null)}><X/></button></header><div className="mj-dialog-content"><div className="mj-all-discards">{b.players[riverSeat].discards.map(tile=><TileFace key={tile.id} tile={tile}/>)}</div></div><footer><button className="icon" aria-label={t('上一家')} onClick={()=>setRiverSeat((riverSeat+3)%4)}><ChevronLeft/></button><span>{t(['东','南','西','北'][riverSeat])} · {b.players[riverSeat].discards.length}</span><button className="icon" aria-label={t('下一家')} onClick={()=>setRiverSeat((riverSeat+1)%4)}><ChevronRight/></button></footer></section></div>}
 </div>;
}
