import {SeatPagination,useSeatPage} from './SeatPagination';
import {formatGameText} from './gameText';
import { useDialog } from './useDialog';
import { t } from '../i18n';
function tx<T>(value: T): T | string { return typeof value === 'string' ? t(value) : value; }
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Check, ChevronRight, Crown, Eye, Gem, LockKeyhole, Moon, Shield, Skull, Sparkles, Swords, X } from 'lucide-react';
import type { Action, Command, GameView } from '../core/types';
import { GEM_COLORS } from '../core/games/gems';
import './action-sheet-viewport.css';
const colors = ['#ebe4ca', '#7fb9e8', '#7bc8a2', '#dd807e', '#7f8597', '#e8bd67'];
const names = ['白钻', '蓝宝石', '祖母绿', '红宝石', '黑玛瑙', '黄金'];
type BoardProps = {
    view: GameView;
    selfID: string;
    command: (cmd: Command) => void;
    open: (action: Action, selected?: string[]) => void;
};
export function Token({ color, count, onClick, selected = false, small = false, label }: {
    color: number;
    count?: number;
    onClick?: () => void;
    selected?: boolean;
    small?: boolean;
    label?: string;
}) {
    return <button type="button" aria-label={tx(label || `${names[color]}${count === undefined ? '' : ` ${count} 枚`}`)} onClick={onClick} disabled={!onClick} className={`token ${small ? 'small' : ''} ${selected ? 'selected' : ''}`} style={{ '--gem': colors[color] } as CSSProperties}><Gem size={small ? 12 : 20}/>{tx(count !== undefined && <b>{tx(count)}</b>)}</button>;
}
function Cost({ values }: {
    values: number[];
}) { return <div className="cost">{tx(values.map((n, i) => n > 0 && <span key={i} style={{ '--gem': colors[i] } as CSSProperties}><i />{tx(n)}</span>))}</div>; }
export function GemCard({ card, onClick, mini = false }: {
    card: any;
    onClick?: () => void;
    mini?: boolean;
}) {
    const color = GEM_COLORS.indexOf(card.bonus);
    return <button type="button" className={`gem-card ${mini ? 'mini' : ''}`} aria-label={tx(`${names[color]} ${card.points} 分，费用 ${card.cost.map((n: number, i: number) => n ? `${names[i]}${n}` : '').filter(Boolean).join('，')}`)} onClick={onClick} style={{ '--gem': colors[color], '--tier': card.tier } as CSSProperties}>
    <div className="card-sky"><span className="card-points">{tx(card.points || '·')}</span><Gem size={19}/><div className={`architecture tier-${card.tier}`}><i /><i /><i /></div></div><div className="card-bottom"><Cost values={card.cost}/><small>{tx(['矿场', '商路', '工坊'][card.tier - 1])}</small></div>
  </button>;
}
function PlayerStrip({ players, current, selfID, onInspect }: {
    players: any[];
    current?: string;
    selfID: string;
    onInspect?: (id: string) => void;
}) {
    return <div className="player-strip">{tx(players.map(p => <div key={p.id} role={onInspect ? 'button' : undefined} tabIndex={onInspect ? 0 : undefined} aria-label={tx(onInspect ? `查看 ${p.name} 的公开筹码和奖励` : undefined)} onClick={() => onInspect?.(p.id)} onKeyDown={e => {
                if (onInspect && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onInspect(p.id);
                }
            }} className={`player-chip ${p.id === current ? 'active' : ''} ${p.alive === false ? 'out' : ''}`}><span className="avatar">{tx(p.avatar)}</span><div><b>{p.name}{tx(p.id === selfID ? ' · 我' : '')}</b><small>{tx(p.score !== undefined ? `${p.score} 分 · 预留 ${p.reservedCount}` : p.alive === false ? '已出局' : `${p.count} 张手牌`)}</small></div>{tx(p.score !== undefined ? <div className="mini-bonuses">{tx(p.bonuses?.map((n: number, i: number) => <span key={i} style={{ color: colors[i] }}>{tx(n)}</span>))}</div> : p.id === current ? <span className="turn-dot"/> : null)}</div>))}</div>;
}
export function GemsBoard({ view, selfID, command, open }: BoardProps) {
    const b = view.board, own = b.players.find((p: any) => p.id === selfID);
    const [picked, setPicked] = useState<string[]>([]), [card, setCard] = useState<any>(null), [pair, setPair] = useState(false), [merchantID, setMerchantID] = useState<string | null>(null);
    const merchant = b.players.find((p: any) => p.id === merchantID);
    const action = view.actions.find(a => a.id === (pair ? 'take_pair' : 'take_distinct'));
    useEffect(() => { setPicked([]); setCard(null); }, [view.phase, b.current, b.phase, selfID]);
    const choose = (id: string) => {
        if (!action?.choices.some(c => c.id === id))
            return;
        setPicked(p => p.includes(id) ? p.filter(x => x !== id) : pair ? [id] : p.length < action.max ? [...p, id] : [...p.slice(1), id]);
    };
    const cardAction = (id: string) => view.actions.find(a => a.id === id && a.choices.some(c => c.id === card?.id));
    return <div className="gems-board">
    <PlayerStrip players={b.players} current={b.current} selfID={selfID} onInspect={setMerchantID}/>
    <div className="gems-playfield"><aside className="noble-lane"><small>{t("贵族来访")}</small>{tx(b.nobles.map((n: any, i: number) => <button className="noble" key={n.id} onClick={() => {
                const a = view.actions.find(a => a.id === 'noble');
                if (a?.choices.some(c => c.id === n.id))
                    open(a, [n.id]);
            }} aria-label={tx(`贵族 ${i + 1}，三分`)}><Crown size={18}/><b>{t("3")}</b><Cost values={n.cost}/></button>))}</aside>
    <div className="market">{tx([3, 2, 1].map(t => <div className="market-row" key={t}><button className={`tier-deck tier-${t}`} aria-label={tx(`预留 ${t} 级盲牌`)} onClick={() => {
                const a = view.actions.find(a => a.id === 'reserve');
                if (a?.choices.some(c => c.id === `deck:${t}`))
                    open(a, [`deck:${t}`]);
            }}><Gem size={23}/><span>{tx('•'.repeat(t))}</span><small>{tx(b.decks[t - 1])}</small></button>{tx(b.market.filter((c: any) => c.tier === t).map((c: any) => <GemCard card={c} key={c.id} onClick={() => setCard(c)}/>))}</div>))}</div>
    <aside className="bank"><div className="bank-mode"><button className={!pair ? 'on' : ''} onClick={() => { setPair(false); setPicked([]); }}>{t("异色")}</button><button className={pair ? 'on' : ''} onClick={() => { setPair(true); setPicked([]); }}>{t("同色 ×2")}</button></div><div className="bank-tokens">{tx(b.bank.map((n: number, i: number) => <Token key={i} color={i} count={n} selected={picked.includes(GEM_COLORS[i])} onClick={i < 5 && action?.choices.some(c => c.id === GEM_COLORS[i]) ? () => choose(GEM_COLORS[i]) : undefined}/>))}</div>{tx(picked.length > 0 && <button className="compact primary" disabled={picked.length !== (action?.min ?? 0)} onClick={() => { command({ action: action!.id, values: picked }); setPicked([]); }}><Check size={15}/>{t("拿取") + " "}{tx(pair ? 2 : picked.length)}</button>)}</aside></div>
    <div className="own-tray"><span className="tray-label">{t("我的筹码")}</span><div className="my-tokens">{tx(own.tokens.map((n: number, i: number) => <div key={i}><Token small color={i} count={n}/>{tx(i < 5 && <small>{t("+")}{tx(own.bonuses[i])}</small>)}</div>))}</div>{tx(b.payment ? <div className="reserved-hand" aria-label={t("待购买的发展牌和自动支付筹码")}><span>{tx(b.payment.auto.every((n: number) => n === 0) ? '免费' : '支付')}<Cost values={b.payment.auto}/></span><GemCard card={b.payment.card} mini onClick={() => setCard(b.payment.card)}/></div> : <div className="reserved-hand"><span>{t("预留") + " "}{tx(b.hand.length)}{t("/3")}</span>{tx(b.hand.map((c: any) => <GemCard card={c} mini key={c.id} onClick={() => setCard(c)}/>))}</div>)}</div>
    {tx(merchant && <div className="modal-shade" onClick={() => setMerchantID(null)}><section className="action-sheet" role="dialog" aria-label={tx(`${merchant.name} 的公开库存`)} onClick={e => e.stopPropagation()}><div className="sheet-heading"><div><small>{t("公开库存")}</small><h2>{tx(merchant.avatar)} {merchant.name}{" " + t("·") + " "}{tx(merchant.score)}{" " + t("分")}</h2></div><button className="icon" aria-label={t("关闭公开库存")} onClick={() => setMerchantID(null)}><X /></button></div><p>{t("发展牌") + " "}{tx(merchant.bought.length)}{" " + t("· 贵族") + " "}{tx(merchant.nobles.length)}{" " + t("· 预留") + " "}{tx(merchant.reservedCount)}</p><div className="my-tokens">{tx(merchant.tokens.map((n: number, i: number) => <div key={i}><Token color={i} count={n}/>{tx(i < 5 && <small>{t("永久 +")}{tx(merchant.bonuses[i])}</small>)}</div>))}</div>{tx(merchant.nobles.length > 0 && <div className="choices">{tx(merchant.nobles.map((n: any) => <div className="choice" key={n.id}><span><Crown size={14}/> {tx(n.id)}{" " + t("· 3 分")}</span><Cost values={n.cost}/></div>))}</div>)}</section></div>)}
    {tx(card && <div className="modal-shade" onClick={() => setCard(null)}><section className="card-inspect" onClick={e => e.stopPropagation()}><button className="icon close" aria-label={t("关闭牌面")} onClick={() => setCard(null)}><X /></button><GemCard card={card}/><div><p>{tx(['矿场', '商路', '工坊'][card.tier - 1])}</p><h2>{tx(names[GEM_COLORS.indexOf(card.bonus)])}</h2><p>{t("永久减免一枚同色宝石")}</p><div className="inline-actions">{tx(['buy', 'reserve'].map(id => { const a = cardAction(id); return a && <button key={id} className="compact primary" onClick={() => { command({ action: a.id, values: [card.id] }); setCard(null); }}>{tx(a.title)}<ChevronRight size={14}/></button>; }))}</div>{tx(!cardAction('buy') && !cardAction('reserve') && <small>{tx(b.payment?.card.id === card.id ? '请在桌面确认支付或取消' : view.finished ? '本局已结束' : '等待你的回合，或筹码不足')}</small>)}</div></section></div>)}
  </div>;
}
const symbols: Record<string, string> = { bomb: '💣', defuse: '✂️', attack: '⚡', skip: '↪', favor: '🐾', shuffle: '⤨', future: '🔮', nope: '✋', moonCat: '🌙', cloudCat: '☁️', leafCat: '🌿', starCat: '⭐', sunCat: '☀️' };
export function CatCard({ card, onClick, selected = false }: {
    card: any;
    onClick?: () => void;
    selected?: boolean;
}) { return <button type="button" onClick={onClick} className={`cat-card kind-${card.kind} ${selected ? 'selected' : ''}`} aria-label={tx(card.title)}><small>{tx(card.title)}</small><span className="cat-symbol">{tx(symbols[card.kind] || '🐱')}</span><b>{tx(card.kind.endsWith('Cat') ? '=^·ω·^=' : card.title)}</b></button>; }
export function BombsBoard({ view, selfID, command, open }: BoardProps) {
    const b = view.board, [selected, setSelected] = useState<string[]>([]);
    useEffect(() => setSelected([]), [b.phase, b.current, selfID]);
    const cards = b.hand.filter((c: any) => selected.includes(c.id)), single = cards[0];
    const singleAction = single && view.actions.find(a => ['play', 'nope', 'give'].includes(a.id) && a.choices.some(c => c.id === single.id));
    const combo = cards.length >= 2 && cards.every((c: any) => c.kind === single.kind) ? view.actions.find(a => a.id === (cards.length === 2 ? 'pair' : 'triple') && a.choices.some(c => c.id === single.kind)) : null;
    const play = () => {
        const a = cards.length === 1 ? singleAction : combo;
        if (a) {
            command({ action: a.id, values: [cards.length === 1 ? single.id : single.kind] });
            setSelected([]);
        }
    };
    const draw = view.actions.find(a => a.id === 'draw');
    const response = b.response;
    const requestedTitle = response?.requested ? view.actions.flatMap(a => a.choices).find(c => c.id === response.requested)?.title || ({ bomb: '闹闹牌', defuse: '安抚', attack: '加班', skip: '跳过', favor: '借一张', shuffle: '洗牌', future: '偷瞄三张', nope: '等等', moonCat: '月亮猫', cloudCat: '云朵猫', leafCat: '叶子猫', starCat: '星星猫', sunCat: '太阳猫' } as Record<string, string>)[response.requested] : null;
    return <div className="bombs-board"><PlayerStrip players={b.players} current={b.current} selfID={selfID}/><div className="cat-table"><div className="cat-table-label"><small>{t("最后留下来的猫")}</small><h2>{t("运气，也是实力。")}</h2>{tx(b.turnsRemaining > 1 && <span className="pill danger">{t("还需") + " "}{tx(b.turnsRemaining)}{" " + t("个回合")}</span>)}</div><button className={`draw-pile ${draw ? 'can-draw' : ''}`} onClick={() => draw && command({ action: 'draw', values: [] })} aria-label={tx(`抽牌，剩余 ${b.deckCount} 张`)} disabled={!draw}><span>{t("🐾")}</span><b>{tx(draw ? '抽一张' : '抽牌堆')}</b><small>{tx(b.deckCount)}</small></button><div className="discard-pile">{tx(b.discard[0] ? <CatCard card={b.discard[0]}/> : <div className="empty-card">{t("弃牌")}</div>)}</div>{tx(b.response && <div className="effect-note"><b>{tx(b.response.cards.length > 1 ? `${b.response.cards.length} 张同名组合` : b.response.cards[0].title)}{b.response.target ? ` → ${b.players.find((p: any) => p.id === b.response.target)?.name}` : ''}{tx(requestedTitle ? ` · 索要${requestedTitle}` : '')}</b><span>{tx(b.response.cancelled ? '效果已等等' : '等待大家响应')}</span><div className="response-dots">{tx(b.players.filter((p: any) => p.alive).map((p: any) => <span key={p.id} className={b.response.passed.includes(p.id) ? 'done' : ''} title={p.name}>{tx(p.avatar)}</span>))}</div></div>)}</div>
    {tx(b.privateFuture && <div className="future-peek"><small><Eye size={13}/>{" " + t("仅你可见 · 从牌堆顶部起")}</small><div>{tx(b.privateFuture.map((c: any) => <CatCard key={c.id} card={c}/>))}</div></div>)}
    <div className="hand-area"><div className="hand-caption"><span>{t("我的手牌 ·") + " "}{tx(b.hand.length)}</span>{tx(selected.length > 0 && <><button className="text-button" onClick={() => setSelected([])}>{t("取消")}</button><button className="compact primary" onClick={play} disabled={!(cards.length === 1 ? singleAction : combo)}>{tx(cards.length === 1 ? (singleAction?.title || '暂不可打出') : combo ? (cards.length === 2 ? '对子 · 随机拿牌' : '三张 · 指定牌名') : '选择同名牌')}<ChevronRight size={14}/></button></>)}</div><div className={`cat-hand ${b.hand.length > 10 ? 'long-hand' : ''}`} aria-label={t("我的手牌，可横向滑动")}>{tx(b.hand.map((c: any, i: number) => <div key={c.id} style={{ '--angle': `${(i - (b.hand.length - 1) / 2) * 2}deg` } as CSSProperties}><CatCard card={c} selected={selected.includes(c.id)} onClick={() => setSelected(p => p.includes(c.id) ? p.filter(x => x !== c.id) : p.length < 3 ? [...p, c.id] : [c.id])}/></div>))}</div></div>
  </div>;
}
// Equal-angle ellipse points crowd the short vertical sides at 13–18 players.
// Distribute large tables by measured arc length and retain the full seat hit areas.
function socialSeatPositions(count: number, aspect: number) {
    if (count <= 12)
        return Array.from({ length: count }, (_, i) => { const a = 2 * Math.PI * i / count - Math.PI / 2; return { left: 50 + 44 * Math.cos(a), top: 50 + 43 * Math.sin(a) }; });
    const rx = 47, ry = 43, steps = 720, points = [{ angle: -Math.PI / 2, distance: 0 }];
    let length = 0;
    for (let i = 1; i <= steps; i++) {
        const a = -Math.PI / 2 + (i - 1) * 2 * Math.PI / steps, b = -Math.PI / 2 + i * 2 * Math.PI / steps;
        length += Math.hypot(aspect * rx * (Math.cos(b) - Math.cos(a)), ry * (Math.sin(b) - Math.sin(a)));
        points.push({ angle: b, distance: length });
    }
    return Array.from({ length: count }, (_, i) => {
        const target = length * i / count, k = points.findIndex(p => p.distance >= target), before = points[Math.max(0, k - 1)], after = points[k];
        const fraction = after.distance === before.distance ? 0 : (target - before.distance) / (after.distance - before.distance);
        const angle = before.angle + (after.angle - before.angle) * fraction;
        return { left: 50 + rx * Math.cos(angle), top: 50 + ry * Math.sin(angle) };
    });
}
export function SocialBoard({ view, selfID, open }: BoardProps) {
    const b = view.board, [reveal, setReveal] = useState(false), avalon = view.kind === 'avalon';
    const seats=useSeatPage(b.players.length,selfID+view.kind);
    const tableRef = useRef<HTMLDivElement>(null), [aspect, setAspect] = useState(2);
    useLayoutEffect(() => {
        const node = tableRef.current;
        if (!node)
            return;
        const measure = () => {
            const box = node.getBoundingClientRect();
            if (box.height > 0)
                setAspect(box.width / box.height);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, []);
    const positions = useMemo(() => socialSeatPositions(b.players.length, aspect), [b.players.length, aspect]);
    useEffect(() => setReveal(false), [selfID, view.kind, view.finished]);
    const targetActions = view.actions.filter(a => a.choices.some(c => b.players.some((p: any) => p.id === c.id || c.id === `poison:${p.id}`)));
    return <div className={`social-board ${avalon ? 'avalon' : 'werewolf'} ${b.stage === 'night' ? 'night' : ''}`}>
    {tx(avalon ? <div className="quest-track">{tx(b.teamSizes.map((n: number, i: number) => <div key={i} className={`quest ${i === b.results.length ? 'current' : ''} ${b.results[i] === true ? 'success' : b.results[i] === false ? 'failed' : ''}`}><span>{tx(b.results[i] === true ? <Check size={19}/> : b.results[i] === false ? <X size={19}/> : i + 1)}</span><small>{tx(n)}{" " + t("人")}{tx(i === 3 && b.players.length >= 7 ? ' · 双败' : '')}</small></div>))}<div className="rejection-track"><span>{t("拒绝")}</span>{tx([0, 1, 2, 3, 4].map(i => <i key={i} className={i < b.rejections ? 'filled' : ''}/>))}</div></div> : <div className="night-counter"><Moon size={16}/><span>{t("第") + " "}{tx(b.night)} {tx(b.stage === 'night' ? '夜' : '天')}</span><small>{tx(b.players.filter((p: any) => p.alive).length)}{" " + t("人存活")}</small></div>)}
    <div className="round-table" ref={tableRef}><div className="table-emblem">{tx(avalon ? <Swords /> : <Moon />)}<b>{tx(view.phase)}</b><small>{tx(avalon ? `远征 ${b.quest} · ${b.teamSize} 人队伍` : b.stage === 'night' ? '请保管好自己的身份' : '面对面发言，手机上投票')}</small>{tx(b.winner && <h2>{tx(b.winner)}</h2>)}</div><div className={`seats count-${b.players.length}`}>{tx(b.players.map((p: any, i: number) => {
            if(i<seats.start||i>=seats.end)return null;
            const position = positions[i];
            return <button className={`seat ${p.id === selfID ? 'self' : ''} ${!p.alive ? 'out' : ''} ${p.team ? 'team' : ''} ${p.leader || p.sheriff ? 'leader' : ''}`} key={p.id} style={{ left: `${position.left}%`, top: `${position.top}%` } as CSSProperties} onClick={() => {
                    const a = targetActions.find(a => a.choices.some(c => c.id === p.id || c.id === `poison:${p.id}`));
                    if (a)
                        open(a, [a.choices.find(c => c.id === p.id || c.id === `poison:${p.id}`)!.id]);
                }} aria-label={`${t("座位")} ${i + 1} · ${p.name}${p.alive ? "" : ` · ${t("已出局")}`}`}><span className="seat-number">{tx(i + 1)}</span><span className="seat-avatar">{tx(p.alive ? p.avatar : <Skull size={22}/>)}</span>{tx((p.leader || p.sheriff) && <Crown className="seat-crown" size={15}/>)}<b>{p.name}</b><small>{tx(p.revealedIdiot ? '白痴 · 无投票权' : p.role && (view.finished || p.id !== selfID) ? p.role : p.candidate ? (['pk', 'vote'].includes(b.stage) ? 'PK' : '竞选中') : p.team ? '远征队员' : p.id === selfID ? '我' : '')}</small>{tx(Object.hasOwn(b.publicVotes || {}, p.id) && <span className="vote-mark">{tx(avalon ? (b.publicVotes[p.id] ? '✓' : '✕') : b.publicVotes[p.id] === 'skip' ? '弃票' : `→ ${b.players.findIndex((x: any) => x.id === b.publicVotes[p.id]) + 1}`)}</span>)}</button>;
        }))}</div></div><SeatPagination {...seats}/>
    <button className={`identity-card ${reveal ? 'revealed' : ''}`} onClick={() => setReveal(!reveal)} aria-label={tx(reveal ? '收起身份' : '查看我的身份')}>{tx(reveal ? <><b>{tx(b.ownRole)}</b><span>{b.ownKnowledge?.filter((k: any) => k.id !== selfID && k.id !== 'role').map((k: any) => `${k.id.startsWith('check:') ? k.title : t(k.title)}${k.detail ? ` · ${k.detailText ? formatGameText(k.detail,k.detailText) : ['wolves', 'evil', 'merlin'].includes(k.id) ? k.detail : t(k.detail)}` : ''}`).join(' / ') || t('没有额外情报')}</span><small>{t("轻点收起")}</small></> : <><LockKeyhole size={24}/><b>{t("我的身份")}</b><small>{t("轻点查看 · 注意遮挡")}</small></>)}</button>
  </div>;
}
export function ActionSheet({ action, selected, view, onClose, onSubmit }: {
    action: Action;
    selected: string[];
    view: GameView;
    onClose: () => void;
    onSubmit: (cmd: Command) => void;
}) {
    const dialogRef = useDialog(true, onClose);
    const [values, setValues] = useState(selected), [error, setError] = useState('');
    const fresh = view.actions.find(a => a.id === action.id), current = fresh || action;
    const valid = fresh && values.length >= fresh.min && values.length <= fresh.max && values.every(id => fresh.choices.some(c => c.id === id));
    useEffect(() => {
        if (!fresh) { onClose(); return; }
        setValues(old => {
            const next = old.filter(id => fresh.choices.some(choice => choice.id === id)).slice(0, fresh.max);
            return next.length === old.length && next.every((id, index) => id === old[index]) ? old : next;
        });
    }, [fresh, onClose]);
    const choose = (id: string) => {
        setError('');
        setValues(old => old.includes(id) ? old.filter(x => x !== id) : current.max === 1 ? [id] : old.length < current.max ? [...old, id] : old);
    };
    const selectionSummary = current.max === 0 ? '' : current.min === current.max ? `已选 ${values.length} / ${current.max}` : `可选 ${current.min}–${current.max} 项 · 已选 ${values.length}`;

    return <div className="modal-shade" onClick={onClose}><section ref={dialogRef} tabIndex={-1} className="action-sheet" role="dialog" aria-modal="true" aria-label={tx(current.title)} onClick={e => e.stopPropagation()}><div className="sheet-heading"><div><h2>{tx(current.title)}</h2></div><button className="icon" aria-label={t("关闭选择")} onClick={onClose}><X /></button></div>{tx(current.help && <p>{tx(current.help)}</p>)}{tx(action.id === 'pay_custom' && view.board.payment && <div className="inline-actions"><span>{t("折扣后费用")}</span><Cost values={view.board.payment.needed}/><small>{t("黄金可代任意颜色")}</small></div>)}<div className="choices">{tx(current.choices.map(c => <button className={`choice ${values.includes(c.id) ? 'selected' : ''}`} key={c.id} aria-pressed={values.includes(c.id)} onClick={() => choose(c.id)}><span>{c.translateTitle === false || view.board.players?.some((player: { id: string; name: string }) => player.id === c.id && player.name === c.title) ? c.title : t(c.title)}</span>{tx(c.subtitle && <small>{tx(c.subtitle)}</small>)}{tx(values.includes(c.id) && <Check size={15}/>)}</button>))}</div>{tx(error && <p className="error" role="alert">{tx(error)}</p>)}<footer>{selectionSummary && <small role="status">{tx(selectionSummary)}</small>}<button style={{ marginLeft: 'auto' }} className="compact primary" disabled={!valid} onClick={() => {
            try {
                onSubmit({ action: action.id, values });
                onClose();
            }
            catch (e) {
                setError((e as Error).message);
            }
        }}>{current.max === 0 ? tx(current.title) : t("确认")}<Check size={16}/></button></footer></section></div>;
}
export function ActionDock({ view, open, command, busy=false }: {
    busy?: boolean;
    view: GameView;
    open: (a: Action, values?: string[]) => void;
    command: (c: Command) => void;
}) {
    const directHidden = view.kind === 'gems' ? ['take_distinct', 'take_pair', 'buy', 'reserve'] : view.kind === 'bombs' ? ['draw', 'play', 'pair', 'triple', 'nope', 'give'] : [];
    return <div inert={busy} aria-busy={busy} className={`action-dock ${view.actions.length ? 'your-turn' : ''}`}><div className="instruction"><span className="turn-dot"/>{tx(view.instruction)}</div><div className="dock-actions">{tx(view.actions.filter(a => !directHidden.includes(a.id) && !(view.board.isModerator && a.id === view.actions[0]?.id)).map(a => <button key={a.id} className={`compact ${['explode', 'assassinate'].includes(a.id) ? 'danger' : 'primary'}`} onClick={() => a.choices.length || ['explode', 'defuse', 'withdraw'].includes(a.id) ? open(a) : command({ action: a.id, values: [] })}>{tx(a.title)}<ChevronRight size={13}/></button>))}</div></div>;
}
