import { t } from '../i18n';
function tx<T>(value: T): T | string { return typeof value === 'string' ? t(value) : value; }
import { useEffect, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import type { Action, Command, GameView } from '../core/types';
import { SUSHI_INFO, sushiPlateScore, type SushiCard } from '../core/games/sushi';
import { SPICES, SPICE_SYMBOLS, spiceCardTitle, spiceText, type SpiceCard, type SpiceOrder } from '../core/games/century';
import { UNO_LABEL, unoTitle, type UnoCard } from '../core/games/uno';
import './new-games-table.css';
import './new-games-viewport.css';
import {useCardDoubleTap} from './useCardDoubleTap';
import { IllustratedTile } from './IllustratedTile';
import { ColorCardArt, SpiceCube } from './NewGameArt';
type Props = {
    view: GameView;
    selfID: string;
    command: (c: Command) => void;
    open: (a: Action, selected?: string[]) => void;
};
function Controls({ view, command, open, omit = [] }: Props & {
    omit?: string[];
}) { return <div className="ng-controls">{tx(view.actions.filter(a => !omit.includes(a.id) && !a.id.startsWith('wild:')).map(a => <button type="button" key={a.id} className="ng-action" aria-label={t(a.title)} onClick={() => a.choices.length ? open(a) : command({ action: a.id, values: [] })}>{view.kind==='century'&&a.id==='rest'?t("休整"):tx(a.title)}</button>))}</div>; }
function Header({ view, selfID }: { view: GameView; selfID: string }) {
 const board=view.board;
 const ordinaryTurn=!view.finished&&(view.kind==='sushi'?!board.selected:board.current===selfID&&(view.kind==='century'?board.phase==='action':board.phase==='play'&&!board.drawn));
 return ordinaryTurn?null:<header className="ng-heading"><strong role="status">{t(view.instruction)}</strong></header>;
}
function Scoreboard({ view, selfID }: {
    view: GameView;
    selfID: string;
}) { return <div className="ng-players">{tx(view.board.players.map((p: any) => <div className={`ng-player ${p.id === selfID ? 'ng-self' : ''} ${p.id === view.board.current ? 'ng-current' : ''}`} key={p.id}><span className="ng-avatar">{tx(p.avatar)}</span><div><b>{p.name}{tx(p.id === selfID ? ' · 你' : '')}</b><small>{tx(view.kind === 'sushi' ? `${view.finished ? '已结算' : p.ready ? '✓ 已选' : '选牌中'} · 布丁 ${p.puddings + (view.finished ? 0 : p.table.filter((c: SushiCard) => c.kind === 'pudding').length)}` : view.kind === 'century' ? `${p.orderCount} 单 · 金 ${p.gold} / 银 ${p.silver}` : `${p.handCount} 张手牌`)}{view.kind==='uno'&&p.handCount===1?' · UNO!':''}</small></div><strong>{tx(p.score)}<small>{" " + t("分")}</small></strong></div>))}</div>; }
const sushiIllustrations = { tempura:0, sashimi:1, dumpling:2, maki1:3, maki2:4, maki3:5, egg:6, salmon:7, squid:8, wasabi:9, pudding:10, chopsticks:11 };
const sushiAccents = { tempura:'#a86b3d', sashimi:'#b76258', dumpling:'#9a8454', maki1:'#577769', maki2:'#577769', maki3:'#577769', egg:'#b18f44', salmon:'#c17960', squid:'#7f9093', wasabi:'#718551', pudding:'#a27a50', chopsticks:'#776357' };
function SushiFace({ card, selected, onClick, onPointerDown, order, small = false }: {
 card:SushiCard; selected?:boolean; onClick?:(event:MouseEvent<HTMLButtonElement>)=>void; onPointerDown?:(event:PointerEvent<HTMLButtonElement>)=>void; order?:number; small?:boolean;
}) {
 const info=SUSHI_INFO[card.kind];
 return <button type="button" disabled={!onClick} aria-label={t(info.title)+t('：')+t(info.detail)} aria-pressed={onClick?!!selected:undefined} className={`ng-sushi-card ${selected?'ng-selected':''} ${small?'ng-small':''}`} style={{'--sushi-accent':sushiAccents[card.kind]} as CSSProperties} onClick={onClick} onPointerDown={onPointerDown}>
  <span className="ng-sushi-illustration"><IllustratedTile kind="sushi" index={sushiIllustrations[card.kind]}/></span>
  <b>{t(info.title)}</b>{!small&&<small>{t(info.detail)}</small>}
  {order!==undefined&&<span className="ng-order">{order}</span>}
 </button>;
}
function SushiTable(props: Props) { const { view, command, selfID } = props, b = view.board, [selected, setSelected] = useState<string[]>([]), pick = view.actions.find(a => a.id === 'pick'); useEffect(() => setSelected([]), [b.round, b.step, selfID, !!b.selected]); const taps=useCardDoubleTap([selfID,b.round,b.step,!!b.selected].join(':')); const shown = b.selected || selected; const toggle = (id: string) => setSelected(old => old.includes(id) ? old.filter(v => v !== id) : old.length < (pick?.max || 1) ? [...old, id] : [id]); const valid = pick && selected.length >= pick.min && selected.length <= pick.max; return <div className="ng-table ng-sushi"><div className="ng-sushi-overview"><Header view={view} selfID={selfID}/><Scoreboard view={view} selfID={selfID}/>{b.players.some((p: any)=>p.table.length>0)&&<section className="ng-plates">{tx(b.players.map((p: any) => <article className="ng-panel" key={p.id}><h3>{tx(p.avatar)} {p.name}<small>{t("盘面") + " "}{tx(sushiPlateScore(p.table))}{" " + t("分 · 卷数另算")}</small></h3><div className="ng-plate">{tx(p.table.length ? p.table.map((c: SushiCard) => <SushiFace key={c.id} card={c} small/>) : <p className="ng-hint">{t("等待大家同时揭晓第一道")}</p>)}</div></article>))}</section>}</div><section className="ng-panel ng-sushi-hand-panel"><h3>{t("你的手牌") + " "}<small>{t(`${b.hand.length} 张 · 仅你可见`)}</small></h3><div className="ng-hand" tabIndex={0} aria-label={t("手牌可左右滑动")}>{tx((b.hand as SushiCard[]).map(c => <SushiFace key={c.id} card={c} selected={shown.includes(c.id)} order={shown.includes(c.id) ? shown.indexOf(c.id) + 1 : undefined} onPointerDown={taps.onPointerDown} onClick={pick ? event => {if(taps.isDoubleTap(c.id,event)&&pick.max===1){command({action:'pick',values:[c.id]});setSelected([]);}else toggle(c.id);} : undefined}/>))}</div>{view.actions.length>0&&<div className="ng-controls ng-sushi-confirm">{tx(pick && <button className="ng-action" type="button" disabled={!valid} onClick={() => { command({ action: 'pick', values: selected }); setSelected([]); }}>{selected.length?`${t("确认")} ${t(`${selected.length} 张`)}`:t("确认选牌")}{pick.max === 2 ? ' · 🥢 ×2' : ''}</button>)}<Controls {...props} omit={['pick']}/></div>}</section></div>; }
const unoColors: Record<string, string> = { red: '#b73d48', yellow: '#936b19', green: '#2d826b', blue: '#376da6', wild: '#665482' };
function UnoFace({ card, onClick, onPointerDown, drawn=false, selected=false }: {
 card:UnoCard; onClick?:(event:MouseEvent<HTMLButtonElement>)=>void; onPointerDown?:(event:PointerEvent<HTMLButtonElement>)=>void; drawn?:boolean; selected?:boolean;
}) {
 const rank=typeof card.value==='number'?card.value:({skip:'⊘',reverse:'⇄',draw2:'+2',wild:'✦',wild4:'+4'}[card.value]);
 return <button type="button" disabled={!onClick} aria-pressed={onClick?selected:undefined} className={`ng-uno-card ${drawn?'ng-drawn':''} ${selected?'ng-uno-selected':''} ${card.color==='wild'?'ng-wild-card':''}`} style={{'--uno-color':unoColors[card.color]} as CSSProperties} onClick={onClick} onPointerDown={onPointerDown} aria-label={t(unoTitle(card))}>
  <ColorCardArt color={unoColors[card.color]} wild={card.color==='wild'}/>
  <span className="ng-uno-corner" aria-hidden="true">{rank}</span>
  <strong>{rank}</strong>
  {drawn&&<span className="ng-drawn-label">{t('刚抽到')}</span>}
 </button>;
}
function UnoTable(props: Props) {
 const {view,selfID,open,command}=props,b=view.board,play=view.actions.find(a=>a.id==='play'),challenge=b.privateChallenge?.challenger===selfID?b.privateChallenge:null;
 const [selectedID,setSelectedID]=useState<string|null>(null),[selectedColor,setSelectedColor]=useState<string|null>(null);
 const handIDs=(b.hand as UnoCard[]).map(c=>c.id).join('|');
 useEffect(()=>{setSelectedID(null);setSelectedColor(null);},[selfID,b.roundNumber,b.round,b.phase,b.current,b.drawn,b.top?.id,handIDs]);
 const taps=useCardDoubleTap([selfID,b.roundNumber,b.phase,b.current,b.drawn,b.top?.id,handIDs].join(':'));
 const actionFor=(c:UnoCard)=>c.color==='wild'?view.actions.find(a=>a.id===`wild:${c.id}`):play?.choices.some(choice=>choice.id===c.id)?play:undefined;
 const playableCount=(b.hand as UnoCard[]).filter(card=>!!actionFor(card)).length;
 const selectedCard=(b.hand as UnoCard[]).find(c=>c.id===selectedID),selectedAction=selectedCard? actionFor(selectedCard):undefined;
 const valid=!!selectedAction&&(selectedCard?.color!=='wild'||!!selectedAction.choices.find(c=>c.id===selectedColor));
 const choose=(id:string)=>{setSelectedID(old=>old===id?null:id);setSelectedColor(null);};
 const submit=()=>{if(!valid||!selectedCard||!selectedAction)return;command({action:selectedAction.id,values:[selectedCard.color==='wild'?selectedColor!:selectedCard.id]});setSelectedID(null);setSelectedColor(null);};
 const selectCard=(card:UnoCard,event:MouseEvent<HTMLButtonElement>)=>{
  const action=actionFor(card);if(!action)return;
  if(taps.isDoubleTap(card.id,event)){
   if(card.color==='wild'){setSelectedID(card.id);setSelectedColor(null);}
   else{command({action:action.id,values:[card.id]});setSelectedID(null);setSelectedColor(null);}
  }else choose(card.id);
 };
 const playerName=(id:string)=>b.players.find((p:any)=>p.id===id)?.name||id;
 return <div className={`ng-table ng-uno ${challenge?'ng-reviewing':''}`}><div className="ng-uno-overview"><Header view={view} selfID={selfID}/><Scoreboard view={view} selfID={selfID}/><div className="ng-edition"><span>{t(`第 ${b.roundNumber} 轮`)}</span><span>{b.mode==='single'?t('单局竞速'):t('累计 500 分获胜')}</span><span>{t(b.challengeEnabled===false?'+4 质疑已关闭':'+4 质疑已开启')}</span></div>
  {challenge&&<section className="ng-panel ng-challenge" aria-label={t('质疑核验 · 仅你可见')}><h3>{t('质疑核验 · 仅你可见')}</h3><p className="ng-hint">{playerName(challenge.actor)} · {t('出 +4 时的手牌')} · {t('原颜色')} {t(UNO_LABEL[challenge.previousColor])}</p><strong className="ng-challenge-result">{t(challenge.wasLegal?'出牌合法，质疑失败':'持有原颜色，质疑成功')}</strong><p className="ng-hint">{t(challenge.wasLegal?'你已抽 6 张，确认后跳过。':'对方已抽 4 张，你继续正常回合。')}</p><div className="ng-hand">{(challenge.hand as UnoCard[]).map(c=><UnoFace key={c.id} card={c}/>)}</div><div className="ng-controls"><button className="ng-action" onClick={()=>command({action:'confirmChallenge',values:[]})}>{t('看完了，继续')}</button></div></section>}
  {(b.phase==='roundEnd'||view.finished)&&b.roundWinner&&<section className="ng-panel ng-round-result"><h3>{t('本轮结算')}</h3><strong>{playerName(b.roundWinner)} · +{b.roundPoints} {t('分')}</strong></section>}
  <section className="ng-uno-center ng-panel"><div><h3>{t('当前弃牌')}</h3><UnoFace card={b.top}/></div><div className="ng-uno-status"><span className="ng-color-badge" style={{background:unoColors[b.color]}}>{t(UNO_LABEL[b.color])}</span><strong>{t(b.direction===1?'顺时针 →':'← 逆时针')}</strong><small>{t('抽牌堆')} {t(`${b.deckCount} 张`)}</small><Controls {...props} omit={['play','confirmChallenge','draw','pass']}/></div></section>

  </div>
  <section className="ng-panel ng-uno-hand-panel"><h3>{t('你的手牌')}<small>{t(`${b.hand.length} 张`)}</small></h3><div className="ng-hand ng-uno-hand" tabIndex={0} aria-label={t('手牌可左右滑动')}>{(b.hand as UnoCard[]).map(c=><UnoFace card={c} key={c.id} drawn={b.drawn===c.id} selected={selectedID===c.id&&!!selectedAction} onPointerDown={taps.onPointerDown} onClick={actionFor(c)?e=>selectCard(c,e):undefined}/>)}</div>
  {b.phase==='play'&&b.current===selfID&&<div className="ng-uno-playbar"><div className="ng-uno-selection" aria-live="polite">{selectedCard&&selectedAction?<><strong>{t(unoTitle(selectedCard))}</strong>{selectedCard.color==='wild'&&<div className="ng-uno-colors" role="group" aria-label={t('选择出牌颜色')}>{selectedAction.choices.map(c=><button key={c.id} type="button" aria-pressed={selectedColor===c.id} className={selectedColor===c.id?'selected':''} style={{'--uno-color':unoColors[c.id]} as CSSProperties} onClick={()=>setSelectedColor(c.id)}>{t(c.title)}</button>)}</div>}</>:null}</div><div className="ng-uno-play-actions">{playableCount>0&&<button type="button" className="ng-action ng-uno-play" disabled={!valid} onClick={submit}>{t('出牌')}</button>}{view.actions.filter(a=>['draw','pass'].includes(a.id)).map(a=><button type="button" className={`ng-action ${playableCount?'ng-uno-secondary':'ng-uno-only-action'}`} key={a.id} onClick={()=>{setSelectedID(null);setSelectedColor(null);command({action:a.id,values:[]});}}>{t(a.title)}</button>)}</div></div>}
  </section>

 </div>;
}
function Cubes({ values }: {
    values: number[];
}) { return <div className="ng-cubes">{tx(values.map((n, i) => <span key={i} title={tx(SPICES[i])}><i><SpiceCube color={i}/></i><b>{tx(n)}</b><small>{tx(SPICES[i])}</small></span>))}</div>; }
function SpiceLine({ text }: { text: string }) {
 const compact=SPICES.reduce((value,name)=>value.replaceAll(t(name),''),t(text));
 return <span aria-label={t(text)}><span aria-hidden="true">{compact.split(/(🟡|🔴|🟢|🟤)/u).map((part,index)=>{const color=SPICE_SYMBOLS.indexOf(part);return color<0?<span key={index}>{part}</span>:<SpiceCube key={index} color={color}/>;})}</span></span>;
}
function merchantIllustration(card: SpiceCard) {
 return card.type==='upgrade'?2:card.type==='trade'?3:card.id.startsWith('start')?0:1;
}
function CenturyTable(props: Props) {
    const { view, selfID, open } = props, b = view.board;
    const [section, setSection] = useState('market');
    const pending=!view.finished&&b.current===selfID&&b.phase!=='action';
    const choice = (actionID: string, id: string) => { const a = view.actions.find(a => a.id === actionID); return a?.choices.some(c => c.id === id) ? () => actionID === "play" ? props.command({action: "play", values: [id]}) : open(a, [id]) : undefined; };
    return <div className="ng-table ng-century"><div className="ng-century-overview"><Header view={view} selfID={selfID}/><Scoreboard view={view} selfID={selfID}/><nav className="ng-century-tabs" aria-label={t("桌面区域")}>{[["market","商人市场"],["orders","公开订单"],["caravans","商队"],["used","已用商人"]].map(([id,label])=><button type="button" key={id} aria-pressed={section===id} onClick={()=>setSection(id)}>{t(label)}</button>)}</nav><section className="ng-panel ng-century-page" hidden={section!=="orders"}><h3>{t("公开订单")}<small>{t("目标")} {b.goalTarget}</small><small aria-label={`${t("金币余")} ${b.gold} ${t("· 银币余")} ${b.silver}`}>🟡 {b.gold} · ⚪ {b.silver}</small></h3><div className="ng-market" tabIndex={0} aria-label={t("公开订单")}>{tx((b.goals as SpiceOrder[]).map((o, i) => { const onClick = choice('claim', o.id); return <button type="button" className="ng-spice-card ng-goal" key={o.id} disabled={!onClick} onClick={onClick}><span className="ng-spice-illustration"><IllustratedTile kind="century" index={i%2?5:4}/></span><small className="ng-order-bonus">{tx(i === 0 && b.gold ? '🟡 金币 +3' : ((i === 1 && b.gold) || (i === 0 && !b.gold)) && b.silver ? '⚪ 银币 +1' : '订单')}</small><strong>{tx(o.points)}<small>{" " + t("分")}</small></strong><span className="ng-order-cost"><SpiceLine text={spiceText(o.cost)}/></span>{tx(onClick && <b>{t("完成订单 →")}</b>)}</button>; }))}</div></section><section className="ng-panel ng-century-page" hidden={section!=="market"}><h3>{t("商人市场")}</h3><div className="ng-market" tabIndex={0} aria-label={t("商人市场")}>{tx(b.market.map((slot: {
            card: SpiceCard;
            bonus: number[];
        }, i: number) => { const onClick = choice('acquire', slot.card.id); return <button type="button" className="ng-spice-card ng-merchant-card" key={slot.card.id} disabled={!onClick} onClick={onClick}><small className="ng-route-price">{tx(i === 0 ? '免费招募' : `支付 ${i} 枚任选香料`)}</small><span className="ng-spice-illustration"><IllustratedTile kind="century" index={merchantIllustration(slot.card)}/></span><b><SpiceLine text={spiceCardTitle(slot.card)}/></b>{slot.bonus.some(Boolean)&&<small className="ng-merchant-bonus">{t("附赠：")}<SpiceLine text={spiceText(slot.bonus)}/></small>}</button>; }))}</div></section><section className="ng-plates ng-century-page" hidden={section!=="caravans"}>{tx(b.players.filter((p: any) => p.id !== selfID).map((p: any) => <article className="ng-panel" key={p.id}><h3>{tx(p.avatar)} {p.name}{" " + t("的商队")}</h3><Cubes values={p.cubes}/></article>))}</section><section className="ng-panel ng-century-page" hidden={section!=="used"}><h3>{t("你的已用商人")}<small>{t(`${b.played.length} 张`)}</small></h3><div className="ng-market" tabIndex={0} aria-label={t("你的已用商人")}>{(b.played as SpiceCard[]).map(card=><div className="ng-spice-card" key={card.id}><span className="ng-spice-illustration"><IllustratedTile kind="century" index={merchantIllustration(card)}/></span><b><SpiceLine text={spiceCardTitle(card)}/></b></div>)}</div></section></div><div className="ng-century-hand-dock"><aside className={`ng-pocket ${pending?'ng-pocket-active':''}`} aria-label={t("你的商队")}><span>{t("你的商队")}<small>{b.cubes.reduce((sum: number, value: number) => sum + value, 0)} / 10</small></span><Cubes values={b.cubes}/>{pending&&<div className="ng-pending-actions">{b.active&&<p><SpiceLine text={spiceCardTitle(b.active)}/>{b.phase==='upgrade'&&t(` · 还可升级 ${b.remaining} 次`)}</p>}<Controls {...props} omit={['play','acquire','claim']}/></div>}</aside>{!pending&&<section className="ng-panel ng-century-hand-panel"><h3>{t("你的商队") + " "}<small>{tx(b.cubes.reduce((n: number, v: number) => n + v, 0))}{" " + t("/ 10 枚")}</small></h3><Cubes values={b.cubes}/>{!pending&&<Controls {...props} omit={['play', 'acquire', 'claim']}/>}<h3>{t("可用商人") + " "}<small>{t(`${b.hand.length} 张`)}</small></h3><div className="ng-market" tabIndex={0} aria-label={t("可用商人")}>{tx((b.hand as SpiceCard[]).map(c => { const onClick = choice('play', c.id); return <button type="button" aria-label={t(spiceCardTitle(c))} className="ng-spice-card ng-merchant-card" key={c.id} disabled={!onClick} onClick={onClick}><span className="ng-spice-illustration"><IllustratedTile kind="century" index={merchantIllustration(c)}/></span><b><SpiceLine text={spiceCardTitle(c)}/></b></button>; }))}</div></section>}</div></div>;
}
export function NewGamesTable(props: Props) { return props.view.kind === 'sushi' ? <SushiTable {...props}/> : props.view.kind === 'uno' ? <UnoTable {...props}/> : <CenturyTable {...props}/>; }
