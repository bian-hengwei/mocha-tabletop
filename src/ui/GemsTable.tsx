import { t } from '../i18n';
function tx<T>(value: T): T | string { return typeof value === 'string' ? t(value) : value; }
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, ChevronLeft, ChevronRight, Crown, Layers3, LockKeyhole, ShoppingBag, X } from 'lucide-react';
import type { Action, Command, GameView } from '../core/types';
import { GEM_COLORS } from '../core/games/gems';
import { CardArt, GemArt, GEM_NAMES, GEM_TONES } from './Art';
import './gems-table.css';
import { useDialog } from './useDialog';
type Props = {
    view: GameView;
    selfID: string;
    command: (c: Command) => void;
    open: (a: Action, values?: string[]) => void;
    onShowResults?: () => void;
};
export function GemCost({ values }: {
    values: number[];
}) { return <div className="g-cost">{tx(values.map((n, i) => n > 0 && <span key={i} aria-label={tx(`${GEM_NAMES[i]} ${n}`)}><GemArt color={i}/><b>{tx(n)}</b></span>))}</div>; }
export function DevelopmentCard({ card, onClick, mini = false }: {
    card: any;
    onClick?: () => void;
    mini?: boolean;
}) {
    const color = GEM_COLORS.indexOf(card.bonus);
    return <button type="button" disabled={!onClick} className={`development-card ${mini ? 'mini' : ''}`} onClick={onClick} aria-label={`${t(GEM_NAMES[color])} ${card.points} ${t("分")} · ${t("费用")} ${card.cost.map((n: number, i: number) => n ? `${t(GEM_NAMES[i])} ${n}` : "").filter(Boolean).join(", ") || t("免费")}`} style={{ '--gem-tone': GEM_TONES[color] } as CSSProperties}><CardArt card={card}/><div className="development-top"><b>{tx(card.points || '')}</b><GemArt color={color}/></div><GemCost values={card.cost}/></button>;
}
function StockNumbers({ tokens, bonuses, labeled=false }: {
    tokens: number[];
    bonuses: number[];
    labeled?:boolean;
}) { return <div className={`stock-numbers ${labeled?'stock-labeled':''}`} aria-label={t("宝石库存与已购牌数量")}>{tx(tokens.map((n, i) => <div key={i}>{labeled&&<small className="stock-resource-label">{t(GEM_NAMES[i])}</small>}<GemArt color={i}/><b aria-label={`${t(GEM_NAMES[i])} ${n} ${t("枚筹码")}`}>{tx(n)}</b>{tx(i < 5 ? <span aria-label={`${t(GEM_NAMES[i])} ${bonuses[i]} ${t("张发展牌")}`}><Layers3 />{tx(bonuses[i])}{labeled&&<> {t('永久奖励')}</>}</span> : <span className="gold-placeholder"/>)}</div>))}</div>; }
export function GemsTable({ view, selfID, command, open, onShowResults }: Props) {
    const b = view.board, own = b.players.find((p: any) => p.id === selfID);
    const [tier, setTier] = useState(1);
    const bankRef = useRef<HTMLDivElement>(null);
    const trayRef = useRef<HTMLDivElement>(null);
    const paymentID = b.payment?.card.id;
    useEffect(() => {
        const tray = trayRef.current;
        if (!tray) return;
        if (!paymentID) { tray.scrollLeft = 0; return; }
        const revealPayment = () => { tray.scrollLeft = tray.scrollWidth; };
        const observer = new ResizeObserver(revealPayment);
        observer.observe(tray);
        for (const child of tray.children) observer.observe(child);
        revealPayment();
        return () => observer.disconnect();
    }, [paymentID, selfID]);

    const [bankScroll, setBankScroll] = useState({before: false, after: false});
    const updateBankScroll = () => {
        const el = bankRef.current;
        if (el) setBankScroll({before: el.scrollLeft > 2, after: el.scrollLeft + el.clientWidth < el.scrollWidth - 2});
    };
    useEffect(() => {
        const el = bankRef.current;
        if (!el) return;
        const observer = new ResizeObserver(updateBankScroll);
        observer.observe(el);
        updateBankScroll();
        return () => observer.disconnect();
    }, []);
    const scrollBank = (direction: number) => bankRef.current?.scrollBy({left: direction * Math.max(52, bankRef.current.clientWidth - 52)});
    const [picked, setPicked] = useState<number[]>([]), [card, setCard] = useState<any>(null), [merchantID, setMerchantID] = useState<string | null>(null);
    const merchant = b.players.find((p: any) => p.id === merchantID);
    const distinct = view.actions.find(a => a.id === 'take_distinct'), pair = view.actions.find(a => a.id === 'take_pair');
    const isPair = picked.length === 2 && picked[0] === picked[1];
    const selectedAction = isPair ? pair : distinct;
    const selectionValid = !!selectedAction && (isPair || picked.length === selectedAction.min && new Set(picked).size === picked.length);
    const showTakeOptions = !!distinct && !selectionValid;
    const distinctRule = distinct ? t(`取 ${distinct.min} 色，各 1 枚`) : '';
    const pairRule = pair ? t('或同色连点取 2（库存 ≥4）') : '';
    const distinctRuleShort = distinct ? t(`${distinct.min} 色`) : '';
    const pairRuleShort = pair ? `${t('同色')} ×2` : '';
    const takeOptionsLabel = distinct ? `${t('选择宝石')}: ${distinctRule}${pairRule ? ` · ${pairRule}` : ''}` : undefined;
    useEffect(() => { setPicked([]); setCard(null); setMerchantID(null); }, [b.current, b.phase, selfID, view.finished]);
    const cardDialog = useDialog(!!card, () => setCard(null));
    const inventoryDialog = useDialog(!!merchant, () => setMerchantID(null));
    const choose = (i: number) => {
        if (!distinct?.choices.some(c => c.id === GEM_COLORS[i]))
            return;
        setPicked(old => {
            if (old.length === 1 && old[0] === i && pair?.choices.some(c => c.id === GEM_COLORS[i]))
                return [i, i];
            if (old.includes(i))
                return old.filter(x => x !== i);
            if (old.length === 2 && old[0] === old[1])
                return [old[0], i];
            return old.length < (distinct?.max || 3) ? [...old, i] : [...old.slice(1), i];
        });
    };
    const actFor = (action: string, c: any) => view.actions.find(a => a.id === action && a.choices.some(x => x.id === c.id));
    const reserve = view.actions.find(a => a.id === 'reserve');
    const cardNote = (() => {
        if (!card || actFor('buy', card)) return '';
        if (b.payment?.card.id === card.id) return '在底部确认支付，或取消购买';
        if (b.players.some((p: {bought: {id: string}[]}) => p.bought.some(c => c.id === card.id))) return '这张发展牌已经购入';
        if (view.finished) return '本局已结束';
        if (view.spectating) return '观战中 · 仅显示公开信息';
        const inMarket = b.market.some((c: {id: string}) => c.id === card.id);
        const inHand = b.hand.some((c: {id: string}) => c.id === card.id);
        if (!inMarket && !inHand) return '这是其他玩家的预留牌';
        if (b.current !== selfID) return '等待你的回合';
        if (b.phase === 'payment') return '请先确认或取消当前购买';
        if (b.phase !== 'action') return view.instruction;
        const reserveFull = inMarket && own.reservedCount >= 3;
        return reserveFull ? '筹码不足，暂时无法购买；预留位置已满' : '筹码不足，暂不能购买。永久奖励和黄金已计入。';
    })();
    return <div className="g-table">
  <div className="g-merchants">{tx(b.players.map((p: any) => <button className={`g-merchant ${p.id === b.current ? 'active' : ''}`} key={p.id} aria-label={tx(`查看 ${p.name} 的公开库存`)} onClick={() => setMerchantID(p.id)}><div className="merchant-head"><span>{tx(p.avatar)}</span><b>{p.name}{tx(p.id === selfID ? ' · 我' : '')}</b><strong><Crown />{tx(p.score)}</strong><small title={t("已购牌")}><Layers3 />{tx(p.bought.length)}</small><small title={t("预留牌")}><LockKeyhole />{tx(p.reservedCount)}</small><small title={t("贵族")}><Crown />{tx(p.nobles.length)}</small></div><StockNumbers tokens={p.tokens} bonuses={p.bonuses}/></button>))}</div>
  <div className="g-playfield"><aside className="g-nobles" aria-label={t("贵族")}>{tx(b.nobles.map((n: any, i: number) => <button className="g-noble" key={n.id} aria-label={`${t("贵族")} ${i + 1} · 3 ${t("分")} · ${n.cost.map((v: number, c: number) => v ? `${t(GEM_NAMES[c])} ${v} ${t("张发展牌")}` : "").filter(Boolean).join(", ")}`} onClick={() => {
                const a = view.actions.find(a => a.id === 'noble');
                if (a?.choices.some(c => c.id === n.id))
                    open(a, [n.id]);
            }}><Crown /><b>{t("3")}</b><GemCost values={n.cost}/></button>))}</aside>
   <div className="g-market"><nav className="g-tier-tabs" aria-label={t("市场")} >{[1,2,3].map(level=><button key={level} aria-label={`${t("等级")} ${level}`} aria-pressed={tier===level} onClick={()=>setTier(level)}><Layers3 size={15}/><span><span className="g-tier-word">{t("等级")} </span>{level}</span></button>)}</nav>{tx([3, 2, 1].map(t => <div className={`g-market-row ${tier===t?"g-tier-active":""}`} key={t}><button className={`g-deck level-${t}`} aria-label={tx(`预留 ${t} 级盲牌`)} disabled={!reserve?.choices.some(c => c.id === `deck:${t}`)} onClick={() => reserve?.choices.some(c => c.id === `deck:${t}`) && open(reserve, [`deck:${t}`])}><Layers3 /><span>{tx('•'.repeat(t))}</span><small>{tx(b.decks[t - 1])}</small></button>{tx(b.market.filter((c: any) => c.tier === t).map((c: any) => <DevelopmentCard key={c.id} card={c} onClick={() => setCard(c)}/>))}{!b.market.some((c: {tier: number}) => c.tier === t) && <p className="g-empty-market">{tx("本级市场已售罄")}</p>}</div>))}</div>
   <aside className="g-bank" aria-label={t("公共供应")}><h3 className="g-bank-title">{t("公共供应")}</h3><div className="g-bank-gems" ref={bankRef} onScroll={updateBankScroll} tabIndex={0} aria-label={t("宝石银行，可左右滑动")}>{tx(b.bank.map((n: number, i: number) => { const count = picked.filter(x => x === i).length; return <button key={i} className={`g-bank-gem ${count ? 'selected' : ''} ${n === 0 ? 'empty' : ''}`} aria-pressed={count > 0} aria-label={`${t(GEM_NAMES[i])} ${n} ${t("枚筹码")}${count ? ` · ${t("已选")} ${count}` : ""}`} disabled={i === 5 || !distinct?.choices.some(c => c.id === GEM_COLORS[i])} onClick={() => choose(i)}><GemArt color={i}/><b>{tx(n)}</b>{tx(count > 0 && <span className="gem-picked">{tx(count)}</span>)}</button>; }))}</div><div className="g-bank-actions">{(bankScroll.before || bankScroll.after) && <nav className="g-bank-pages" aria-label={t("宝石银行翻页")}><button type="button" aria-label={t("上一组宝石")} disabled={!bankScroll.before} onClick={() => scrollBank(-1)}><ChevronLeft size={18}/></button><button type="button" aria-label={t("下一组宝石")} disabled={!bankScroll.after} onClick={() => scrollBank(1)}><ChevronRight size={18}/></button></nav>}{view.finished ? (onShowResults && <button type="button" className="compact g-show-results" onClick={onShowResults}>{t("得分明细")}</button>) : b.payment || view.spectating ? null : <div className="g-take"><button className={`compact primary ${showTakeOptions ? 'g-take-prompt' : ''}`} disabled={!selectionValid} aria-label={showTakeOptions ? takeOptionsLabel : undefined} title={showTakeOptions ? takeOptionsLabel : undefined} onClick={() => {
            if (selectedAction) {
                command({ action: selectedAction.id, values: isPair ? [GEM_COLORS[picked[0]]] : picked.map(i => GEM_COLORS[i]) });
                setPicked([]);
            }
        }}>{showTakeOptions && distinct ? <span className="g-take-options"><span>{distinctRuleShort}</span>{pair && <span>{pairRuleShort}</span>}</span> : <><Check size={14}/>{tx(picked.length ? `拿取 ${picked.length}` : '拿取')}</>}</button>{tx(<button className="icon" disabled={!picked.length} aria-label={t("清空宝石选择")} onClick={() => setPicked([])}><X size={14}/></button>)}</div>}</div></aside>
  </div>
  {!view.spectating&&<div className="g-own-tray" ref={trayRef}><button className="g-own-stock" aria-label={t("查看我的全部库存")} onClick={() => setMerchantID(selfID)}><span>{t("我的库存")}</span><StockNumbers tokens={own.tokens} bonuses={own.bonuses}/></button><div className="g-reserved"><span><LockKeyhole size={12}/>{tx(b.hand.length)}{t("/3")}</span>{tx(b.hand.map((c: any) => <DevelopmentCard key={c.id} card={c} mini onClick={() => setCard(c)}/>))}</div>{tx(b.payment && <div className="g-payment" aria-label={t("待购买的发展牌和自动支付筹码")}><button type="button" className="icon g-payment-inventory" aria-label={t("查看我的全部库存")} title={t("我的库存")} onClick={() => setMerchantID(selfID)}><ShoppingBag size={18}/></button>{tx(b.payment.auto.every((n: number) => n === 0) ? <span className="g-free-payment">{t("免费")}</span> : <GemCost values={b.payment.auto}/>)}<DevelopmentCard card={b.payment.card} mini onClick={() => setCard(b.payment.card)}/></div>)}</div>}
  {tx(card && <div className="modal-shade" onClick={() => setCard(null)}><section ref={cardDialog} tabIndex={-1} className="g-card-inspector" role="dialog" aria-modal="true" aria-label={t("发展牌")} onClick={e => e.stopPropagation()}><button className="icon close" aria-label={t("关闭牌面")} onClick={() => setCard(null)}><X /></button><DevelopmentCard card={card}/><div className="g-card-buttons">{tx((['buy', 'reserve'] as const).map(id => { const a = actFor(id, card); return a && <button key={id} className="compact primary" onClick={() => { command({ action: id, values: [card.id] }); setCard(null); }}>{tx(id === 'buy' ? <ShoppingBag size={16}/> : <LockKeyhole size={16}/>)} {tx(id === 'buy' ? '查看支付' : '预留')}</button>; }))}</div>{cardNote && <p className="g-card-note">{t(cardNote)}</p>}</section></div>)}
  {tx(merchant && <div className="modal-shade" onClick={() => setMerchantID(null)}><section ref={inventoryDialog} tabIndex={-1} className="g-inventory panel" role="dialog" aria-modal="true" aria-label={tx(`${merchant.name} 的公开库存`)} onClick={e => e.stopPropagation()}><header><h2>{tx(merchant.avatar)} {merchant.name}</h2><span className="inventory-score"><Crown size={17}/>{tx(merchant.score)}</span><button className="icon" aria-label={t("关闭公开库存")} onClick={() => setMerchantID(null)}><X /></button></header><div className="inventory-body"><div className="inventory-summary"><h3>{t("宝石库存")}</h3><StockNumbers tokens={merchant.tokens} bonuses={merchant.bonuses} labeled/><h3>{t("预留牌") + " "}<small>{tx(merchant.reservedCount)}{t("/3")}</small></h3><div className="inventory-reserved">{tx((merchant.id === selfID ? b.hand.map((c: any) => ({ public: true, card: c, id: c.id, tier: c.tier })) : merchant.reservedCards || []).map((r: any) => r.public ? <DevelopmentCard key={r.id} card={r.card} onClick={() => { setCard(r.card); setMerchantID(null); }}/> : <div className="g-hidden-card" key={r.id}><LockKeyhole size={20}/><span>{tx('•'.repeat(r.tier))}</span></div>))}{tx(merchant.reservedCount === 0 && <span className="inventory-empty">{t("—")}</span>)}</div><div className="inventory-nobles"><h3>{t("贵族") + " "}<small>{tx(merchant.nobles.length)}</small></h3>{tx(merchant.nobles.map((n: any) => <div className="g-noble" key={n.id}><Crown /><b>{t("3")}</b><GemCost values={n.cost}/></div>))}</div></div><div className="inventory-purchases"><h3>{t("已购牌") + " "}<small>{tx(merchant.bought.length)}</small></h3><div className="purchased-columns">{tx(GEM_COLORS.slice(0, 5).map((color, i) => <div key={color}><header><GemArt color={i}/><b>{tx(merchant.bonuses[i])}</b></header>{tx(merchant.bought.filter((c: any) => c.bonus === color).map((c: any) => <DevelopmentCard key={c.id} card={c} mini onClick={() => { setCard(c); setMerchantID(null); }}/>))}</div>))}</div></div></div></section></div>)}
 </div>;
}
