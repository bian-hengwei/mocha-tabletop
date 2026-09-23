import {PlayerAvatar} from './RoomSocial';
import {useEffect,useRef,useState,type CSSProperties,type MouseEvent} from 'react';
import {t} from '../i18n';
import {Check,History,MoveHorizontal,X,Layers,ChevronDown,ChevronUp} from 'lucide-react';
import type {Action,Command,GameView} from '../core/types';
import {combinationKey,legalPokerCombinations,pokerTitle,rankName,type PokerCard,type Combination,type PokerTablePlay} from '../core/games/poker';
import {MAHJONG_MODES,tileTitle,type Tile} from '../core/games/mahjong';
import {MahjongAssist} from './MahjongAssist';
import {MahjongArt,PokerArt} from './ClassicCardArt';
import {useDialog} from './useDialog';
import {useCardDoubleTap} from './useCardDoubleTap';
import {GuandanResults} from './GuandanResults';
import './classic-table.css';
import './table-layout.css';
import {MahjongTable} from './MahjongTable';
import './mahjong-table.css';
import './poker-table.css';
import {usePokerDragSelection} from './usePokerDragSelection';
import {PokerPlayMotion,usePokerPlayMotion,pokerFlightKey} from './PokerPlayMotion';
const EMPTY_PLAYS:PokerTablePlay[]=[];
type Props={view:GameView;selfID:string;command:(c:Command)=>void;open:(a:Action,selected?:string[])=>void;onReplay?:()=>void;replayLabel?:string};
function Face({card,mahjong,mini=false}:{card:PokerCard|Tile;mahjong:boolean;mini?:boolean}){
 const label=t(mahjong?tileTitle(card as Tile):pokerTitle(card as PokerCard));
 return <span className={`classic-face ${mahjong?'tile-face':'poker-face'} ${mini?'mini':''}`} role="img" aria-label={label} title={label}>{mahjong?<MahjongArt value={(card as Tile).value}/>:<PokerArt rank={(card as PokerCard).rank} suit={(card as PokerCard).suit}/>}</span>;
}
function Back({mahjong=false}:{mahjong?:boolean}){return <span className={`classic-face mini card-back ${mahjong?'tile-face':'poker-face'}`} aria-hidden="true">{mahjong?<MahjongArt back/>:<PokerArt back/>}</span>;}
export function ClassicTable(props:Props){return props.view.kind==='mahjong'?<MahjongTable {...props}/>:<PokerTable {...props}/>;}
function PokerTable({view,selfID,command,open,onReplay,replayLabel}:Props){
 const [counterOpen,setCounterOpen]=useState(()=>!window.matchMedia('(max-height:500px) and (orientation:landscape)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-height:500px) and (orientation:landscape)');const changed=()=>{if(media.matches)setCounterOpen(false);};media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
 const [declarationOpen,setDeclarationOpen]=useState(false),declarationRef=useDialog<HTMLElement>(declarationOpen,()=>setDeclarationOpen(false));
 const [historyOpen,setHistoryOpen]=useState(false),historyRef=useDialog<HTMLElement>(historyOpen,()=>setHistoryOpen(false));
 const b=view.board,isMahjong=view.kind==='mahjong',hand=b.hand as (PokerCard|Tile)[],[selected,setSelected]=useState<string[]>([]),[declaration,setDeclaration]=useState('');
 const selectAction=view.actions.find(a=>['play','discard','exchange','return'].includes(a.id));
 const handScrollRef=useRef<HTMLDivElement>(null),handRef=useRef<HTMLDivElement>(null);
 const [hiddenHand,setHiddenHand]=useState(false);
 useEffect(()=>{
  const rail=handScrollRef.current,handNode=handRef.current;if(!rail||!handNode)return;
  const update=()=>setHiddenHand(rail.scrollWidth>rail.clientWidth+2);
  const observer=new ResizeObserver(update);observer.observe(rail);observer.observe(handNode);update();
  return()=>observer.disconnect();
 },[view.kind,b.phase,view.finished]);
 const arenaRef=useRef<HTMLDivElement>(null);
 const motion=usePokerPlayMotion(arenaRef,(b.tablePlays||EMPTY_PLAYS) as PokerTablePlay[],b.round,selfID);
 const signature=hand.map(c=>c.id).join('|');
 useEffect(()=>setSelected([]),[selfID,b.current,b.phase,b.turn,b.round,signature]);
 const dragging=usePokerDragSelection(handScrollRef,selected,setSelected,selectAction?.choices.map(c=>c.id)||[],selectAction?.max||0,[selfID,b.current,b.phase,b.round,signature].join(':'));
 const taps=useCardDoubleTap([selfID,b.current,b.phase,b.turn,b.round,signature].join(':'));
 const chosen=hand.filter(c=>selected.includes(c.id));
 const combinations=!isMahjong&&chosen.length?legalPokerCombinations(chosen as PokerCard[],view.kind as 'doudizhu'|'guandan',b.level,b.last?.combo):[];
 useEffect(()=>{setDeclaration('');setDeclarationOpen(false);},[selected.join('|'),selfID,b.current,b.phase,b.round]);
 const combo=combinations.find(c=>combinationKey(c)===declaration)||combinations[0];
 const invalidPlay=selectAction?.id==='play'&&chosen.length&&!combo
  ?legalPokerCombinations(chosen as PokerCard[],view.kind as 'doudizhu'|'guandan',b.level).length?'这组牌压不过上家':'牌型不成立'
  :'';
 const combinationLabel=(c:Combination)=>t(c.type)+(c.bomb>=100?'':` · ${t(rankName(view.kind==='guandan'&&c.power===17?(b.level===2?15:b.level):view.kind==='guandan'&&c.power>=18?c.power-2:c.power))}`);
 const valid=!!selectAction&&selected.length>=selectAction.min&&selected.length<=selectAction.max&&selected.every(id=>selectAction.choices.some(c=>c.id===id))&&(selectAction.id!=='play'||!!combo)&&(selectAction.id!=='exchange'||new Set((chosen as Tile[]).map(c=>Math.floor(c.value/9))).size===1);
 const toggle=(id:string)=>setSelected(old=>old.includes(id)?old.filter(x=>x!==id):selectAction?.max===1?[id]:old.length<(selectAction?.max||0)?[...old,id]:old);
 const selectCard=(id:string,event:MouseEvent<HTMLButtonElement>)=>{
  const repeat=taps.isDoubleTap(id,event);
  if(isMahjong&&selectAction?.id==='discard'&&repeat&&selectAction.choices.some(c=>c.id===id)){
   setSelected([]);command({action:'discard',values:[id]});
  }else toggle(id);
 };
 const playing=!view.finished&&b.phase!=='roundEnd';
 const meIndex=Math.max(0,b.players.findIndex((p:any)=>p.id===selfID)),me=b.players[meIndex];
 const position=(i:number)=>{const offset=(i-meIndex+b.players.length)%b.players.length;return offset===0?'self':offset===1?'right':offset===b.players.length-1?'left':'across';};
 const rows=1,columns=hand.length;
 const wind=(offset:number)=>t(['东','南','西','北'][(meIndex+offset+4)%4]).slice(0,1);
 const isEnd=view.finished||b.phase==='roundEnd';
 const waitingForPlay=!isMahjong&&!isEnd&&b.phase==='play'&&b.current!==selfID;
 const instruction=waitingForPlay?`等待 ${b.players.find((p:{id:string;name:string})=>p.id===b.current).name}`:view.instruction;
 const submit=()=>{command({action:selectAction!.id,values:selected,...(selectAction!.id==='play'&&combo?{text:combinationKey(combo)}:{})});setSelected([]);};
 if(view.kind==='guandan'&&!playing)return <GuandanResults key={`${b.round}:${view.finished}`} view={view} selfID={selfID} onNext={view.actions.some(a=>a.id==='nextRound')?()=>command({action:'nextRound',values:[]}):undefined} onReplay={onReplay} replayLabel={replayLabel}/>;
 return <div className={`classic-table ${isMahjong?'mahjong-table':'poker-table'} game-table-${view.kind} ${view.finished||b.phase==='roundEnd'?'is-finished':''}`}>
  <header className="classic-edition"><span><i/>{t(isMahjong?MAHJONG_MODES[b.mode as keyof typeof MAHJONG_MODES]:view.kind==='guandan'?'双副牌 · 对家合作':'经典叫分 · 三人局')}</span><strong>{isMahjong?`${t('余牌')} ${b.wallCount}`:view.kind==='guandan'?`${t('级牌')} ${rankName(b.level===2?15:b.level)} · ${t('轮次')} ${b.round}`:`${t('底分')} ${b.bid} · ×${b.multiplier}`}</strong></header>
  {!isEnd&&<><div className="classic-arena" ref={arenaRef}>
   <div className="classic-seats">{b.players.map((p:any,i:number)=><section key={p.id} data-player={p.id} className={`classic-seat seat-${position(i)} ${playing&&p.id===b.current?'current':''} ${p.id===selfID?'self':''}`}><PlayerAvatar id={p.id} avatar={p.avatar} className="classic-avatar"/><div><b title={p.name}>{p.name}{p.id===selfID?` · ${t('我')}`:''}</b><small><strong>{t(`${p.count} 张`)}</strong> · {p.score} {t('分')}</small><small>{p.landlord?t('地主'):view.kind==='doudizhu'&&b.phase!=='bid'?t('农民'):view.kind==='guandan'?`${t('队伍')} ${p.team+1}`:isMahjong?t(['东','南','西','北'][i]):''}{isMahjong&&p.missing!==undefined?` · ${t('缺')} ${t(['万','筒','条'][p.missing])}`:''}{p.won?` · ${t('已胡牌')}`:''}{p.rank>0?` · ${t('名次')} ${p.rank}`:''}</small></div>{playing&&p.id===b.current&&<span className="seat-turn-label">{t('行动中')}</span>}<span className="seat-turn-light" aria-hidden="true"/>{!isMahjong&&b.phase==='bid'&&b.bids[i]!==null&&<span className="seat-call">{b.bids[i]===0?t('不叫'):`${t('叫分')} ${b.bids[i]}`}</span>}</section>)}</div>
   {!isMahjong&&<section className="classic-felt" aria-label={t('出牌区')}>
    <div className="classic-table-mark"><span>♧</span>MOCHA<span>{view.kind==='guandan'?'PARTNERS CLUB':'CLASSIC CLUB'}</span></div>
    {(b.tablePlays as PokerTablePlay[]||[]).map(play=><div key={`${b.round}:${play.player}:${play.serial}`} className={`poker-seat-play play-${position(play.player)} ${b.last?.player===play.player&&play.combo?'poker-play-area has-play latest-play':''} ${!b.last?'previous-trick':''} ${motion.flights.some(f=>f.key===pokerFlightKey(b.round,play))?'in-flight':''}`} role="group" aria-label={b.players[play.player].name} data-player={b.players[play.player].id} data-serial={play.serial}>
     <p className="played-caption"><span>{play.combo?combinationLabel(play.combo):t('不出')}</span><span className="played-owner">{b.players[play.player].name}</span></p>
     {play.cards.length>0&&<div className="played-scroll" tabIndex={0} aria-label={`${b.players[play.player].name} · ${t(b.last?'本轮出牌':'上一轮出牌')}`}><div className="classic-cards played">{play.cards.map(card=><Face key={card.id} card={card} mahjong={false} mini/>)}</div></div>}
    </div>)}
    {!b.tablePlays?.length&&<p className="table-prompt">{t(b.phase==='tribute'?'进贡还贡':waitingForPlay?instruction:view.spectating?'观战中 · 仅显示公开信息':b.phase==='bid'?'每人依次叫 1–3 分或不叫':'自由领出，选择一组手牌')}</p>}
    {view.kind==='doudizhu'?<div className="classic-bottom"><small>{t('底牌')}</small>{b.bottom.length?b.bottom.map((c:PokerCard)=><Face key={c.id} card={c} mahjong={false} mini/>):[0,1,2].map(i=><Back key={i}/>)}</div>:<p className="classic-team-levels">{t('两队级数')} <b>{rankName(b.levels[0]===2?15:b.levels[0])}</b><i/> <b>{rankName(b.levels[1]===2?15:b.levels[1])}</b><small>{t('红桃级牌为逢人配')}</small></p>}
   </section>}
   {isMahjong&&<div className="opponent-racks" aria-hidden="true">{b.players.map((p:{id:string;count:number},i:number)=>p.id!==selfID&&<div key={p.id} className={`opponent-rack rack-${position(i)}`}>{Array.from({length:Math.min(p.count,14)},(_,j)=><Back key={j} mahjong/>)}</div>)}</div>}
   {isMahjong&&<section className="mahjong-public" aria-label={t('公共牌池')}>
    <div className="mahjong-center"><div className="mahjong-compass" aria-label={t('座位方位')}><span>{wind(2)}</span><span>{wind(3)}</span><b>{b.wallCount}</b><span>{wind(1)}</span><span>{wind(0)}</span></div>{b.pending?<div className="mahjong-latest"><small>{b.players[b.pending.from].name}</small><Face card={b.pending.tile} mahjong/><b>{t(b.pending.rob?'抢杠响应':'最新打出')}</b></div>:<span className="mahjong-center-mark">MOCHA<br/>MAHJONG</span>}</div>
    <div className="mahjong-rivers">{b.players.map((p:any,i:number)=><section key={p.id} className={`river-seat river-${position(i)} ${b.pending?.from===i?'latest-river':''}`}><header><b title={p.name}>{t(['东','南','西','北'][i])}</b><span>{t('牌河')} {p.discards.length}</span></header><div className="mahjong-melds">{p.melds.map((m:any,j:number)=><div key={j} aria-label={t(m.type==='concealed'?'暗杠':'副露')}>{m.tiles.length?m.tiles.map((tile:Tile)=><Face key={tile.id} card={tile} mahjong mini/>):[0,1,2,3].map(k=><Back key={k} mahjong/>)}</div>)}</div><div className="classic-cards river" tabIndex={p.discards.length?0:undefined} aria-label={`${p.name} · ${t('牌河')}`}>{p.discards.map((tile:Tile)=><Face key={tile.id} card={tile} mahjong mini/>)}</div></section>)}</div>
   </section>}
   <PokerPlayMotion {...motion}/>
  </div>
  {b.counter&&<section className={`poker-counter ${counterOpen?'expanded':''}`} aria-label={t('记牌器')}><button type="button" className="counter-toggle" aria-expanded={counterOpen} aria-label={t(counterOpen?'收起记牌器':'展开记牌器')} onClick={()=>setCounterOpen(!counterOpen)}><Layers size={15}/><span>{t('记牌器')}</span>{counterOpen?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button>{counterOpen&&<div className="counter-ranks" aria-label={t('显示除自己手牌外尚未打出的牌数')}>{(b.counter as {rank:number;count:number}[]).map(({rank,count})=><div key={rank} className={`${!count?'exhausted':''} ${rank===17?'red-joker':''}`} aria-label={`${t(rankName(rank))}: ${count}`}><span>{rank>=16?t(rank===17?'大':'小'):rankName(rank)}</span><b>{count}</b></div>)}</div>}</section>}
  {!view.spectating&&<><section className="classic-hand-panel">
   <header><h3><span className="hand-avatar">{me.avatar}</span>{t('我的手牌')} <small>{hand.length}</small><span className="hand-score">{me.score} {t('分')}</span></h3>{(selectAction?.id==='exchange'||selectAction?.id==='return')?<span className="hand-gesture hand-scroll-cue">{hiddenHand&&<MoveHorizontal size={13} aria-hidden="true"/>}{t(selectAction.id==='exchange'?'同花色三张':'选择还贡牌')}</span>:hiddenHand&&<span className="hand-gesture hand-scroll-cue"><MoveHorizontal size={13} aria-hidden="true"/>{t('横滑看牌 · 长按滑选')}</span>}</header>
   <div className={`classic-hand-scroll ${dragging?'drag-selecting':''}`} ref={handScrollRef} tabIndex={0} aria-label={t(hiddenHand?'手牌可左右滑动':'我的手牌')}><div className="classic-cards classic-hand" ref={handRef} style={{'--hand-columns':columns,'--hand-total':hand.length,'--hand-rows':rows} as CSSProperties} aria-label={t('我的手牌')}>{hand.map(c=><button type="button" key={c.id} data-poker-card={c.id} className={`classic-card ${selected.includes(c.id)?'selected':''} ${isMahjong&&c.id===b.drawn?'drawn':''} ${!isMahjong&&view.kind==='guandan'&&(c as PokerCard).suit===1&&(c as PokerCard).rank===(b.level===2?15:b.level)||isMahjong&&(c as Tile).value===b.wildValue?'wild-card':''}`} aria-label={t(isMahjong?tileTitle(c as Tile):pokerTitle(c as PokerCard))} aria-pressed={selected.includes(c.id)} disabled={!selectAction?.choices.some(x=>x.id===c.id)} onPointerDown={taps.onPointerDown} onClick={e=>selectCard(c.id,e)}><Face card={c} mahjong={isMahjong}/><span className="card-selected-mark" aria-hidden="true">✓</span>{isMahjong&&c.id===b.drawn&&<span className="drawn-marker" aria-hidden="true"/>}</button>)}</div></div>
   <div className="classic-action-panel"><div className={`classic-selection ${view.actions.length?'actionable':''}`} aria-live="polite">{invalidPlay?t(invalidPlay):selected.length?`${t('已选')} ${selected.length} · ${t(combo?.type||(valid?'可以确认':'请调整选牌'))}`:t(isMahjong&&me?.won&&b.mode==='bloodflow'?'已胡牌：只打新摸牌':instruction)}</div>
    <div className="classic-controls">{selectAction&&<><button className="compact primary" disabled={!valid} onClick={submit}>{t(selectAction.id==='play'?'出牌':selectAction.id==='discard'?'打出':selectAction.id==='exchange'?'确认换牌':'确认还贡')}{selected.length?` (${selected.length})`:''}</button>{!isMahjong&&selectAction.id==='play'&&<button className="compact" disabled={!b.hint?.length} onClick={()=>setSelected(b.hint)}>{t(b.hint?.length?'提示':'无可压过的牌')}</button>}<button className="compact" disabled={!selected.length} onClick={()=>setSelected([])}>{t('清空选择')}</button>{selectAction.id==='play'&&combinations.length>1&&<button className="compact declaration-button" aria-label={t('出牌牌型')} aria-haspopup="dialog" aria-expanded={declarationOpen} onClick={()=>setDeclarationOpen(true)}>{t('牌型')}</button>}</>}{view.actions.filter(a=>a!==selectAction).map(a=>a.id==='bid'?a.choices.map(c=><button key={c.id} className="compact primary" onClick={()=>command({action:a.id,values:[c.id]})}>{c.id==='0'?t('不叫'):`${t('叫分')} ${c.id}`}</button>):<button key={a.id} className={`compact ${['hu','nextRound'].includes(a.id)?'primary':''}`} onClick={()=>a.choices.length?open(a):command({action:a.id,values:[]})}>{t(a.title)}</button>)}{isMahjong&&b.assistance&&<MahjongAssist key={[selfID,b.current,b.phase,b.turn,signature].join(':')} data={b.assistance} selected={selected[0]}/>}{isMahjong&&b.wins.length>0&&<button className="compact history-button" aria-label={`${t('胡牌记录')} (${b.wins.length})`} onClick={()=>setHistoryOpen(true)}><History size={15}/><span>{b.wins.length}</span></button>}</div>
   </div>
  </section></>}</>}
  {isEnd&&<section className="classic-results"><header><h3>{t(view.finished?'本局结束':'本轮结算')}</h3></header>{view.finished&&<p className="classic-result-outcome">{t(view.instruction)}</p>}<div className="classic-result-grid">{b.players.map((p:{id:string;name:string;avatar:string;score:number;team?:number|null;rank?:number;won?:boolean;hand?:(Tile|PokerCard)[]})=><div className="classic-result-player" key={p.id}><p><span><PlayerAvatar id={p.id} avatar={p.avatar}/> {p.name}</span><strong>{p.score>0?'+':''}{p.score} {t('分')}</strong></p>{(p.team!=null||p.rank||p.won)&&<small>{[p.team!=null?`${t('队伍')} ${p.team+1}`:'',p.rank?`${t('名次')} ${p.rank}`:p.won?t('已胡牌'):''].filter(Boolean).join(' · ')}</small>}{p.hand?.length?<div className="classic-reveal" tabIndex={0} aria-label={`${p.name} · ${t('手牌可左右滑动')}`}>{p.hand.map(c=><Face key={c.id} card={c} mahjong={isMahjong} mini/>)}</div>:null}</div>)}</div><footer className="classic-result-controls">{view.actions.map(a=><button key={a.id} className="compact primary" onClick={()=>a.choices.length?open(a):command({action:a.id,values:[]})}>{t(a.title)}</button>)}{isMahjong&&b.wins.length>0&&<button className="compact history-button" aria-label={`${t('胡牌记录')} (${b.wins.length})`} onClick={()=>setHistoryOpen(true)}><History size={15}/><span>{b.wins.length}</span></button>}</footer></section>}
  {declarationOpen&&<div className="modal-shade" onClick={e=>{if(e.target===e.currentTarget)setDeclarationOpen(false);}}><section ref={declarationRef} className="panel classic-declaration-dialog" role="dialog" aria-modal="true" aria-label={t('出牌牌型')} tabIndex={-1}><header><h2>{t('出牌牌型')}</h2><button className="icon" aria-label={t('关闭')} onClick={()=>setDeclarationOpen(false)}><X size={18}/></button></header><div className="classic-declaration-options">{combinations.map(c=><button key={combinationKey(c)} className={combo&&combinationKey(combo)===combinationKey(c)?'primary':''} aria-pressed={!!combo&&combinationKey(combo)===combinationKey(c)} onClick={()=>{setDeclaration(combinationKey(c));setDeclarationOpen(false);}}>{combo&&combinationKey(combo)===combinationKey(c)&&<Check size={16} aria-hidden="true"/>}{t(c.type)}{c.bomb>=100?'':` · ${t(rankName(view.kind==='guandan'&&c.power===17?(b.level===2?15:b.level):view.kind==='guandan'&&c.power>=18?c.power-2:c.power))}`}</button>)}</div></section></div>}
  {isMahjong&&historyOpen&&<div className="modal-shade" onClick={e=>{if(e.target===e.currentTarget)setHistoryOpen(false);}}><section ref={historyRef} className="panel classic-history" role="dialog" aria-modal="true" aria-label={t('胡牌记录')} tabIndex={-1}><header><h2>{t('胡牌记录')}</h2><button className="icon" aria-label={t('关闭')} onClick={()=>setHistoryOpen(false)}><X size={18}/></button></header><div className="classic-history-list">{b.wins.map((w:any,i:number)=><p key={i}><span>{b.players[w.player].name} · {t(w.selfDraw?'自摸':'胡牌')} · {w.points} {t('分')}</span><Face card={w.tile} mahjong mini/></p>)}</div></section></div>}
 </div>;
}
