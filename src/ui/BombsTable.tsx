import {useCardDoubleTap} from './useCardDoubleTap';
import { useDialog } from './useDialog';
import { t } from '../i18n';
function tx<T>(value: T): T | string { return typeof value === 'string' ? t(value) : value; }
import { useEffect, useState, type CSSProperties, type ReactNode, type MouseEvent, type PointerEvent } from 'react';
import { ArrowRight, Bomb, Check, ChevronDown, Cloud, Eye, FastForward, Hand, Leaf, Moon, PawPrint, Scissors, Shuffle, Skull, Star, Sun, X, Zap } from 'lucide-react';
import type { Action, Command, GameView } from '../core/types';
import { BOMB_TITLES, type BombCard, type BombKind } from '../core/games/bombs';
import './bombs-table.css';
import './bombs-viewport.css';
type Props = {
    view: GameView;
    selfID: string;
    command: (command: Command) => void;
    open?: (action: Action, values?: string[]) => void;
};
const kinds: BombKind[] = ['defuse', 'attack', 'skip', 'favor', 'shuffle', 'future', 'nope', 'moonCat', 'cloudCat', 'leafCat', 'starCat', 'sunCat', 'bomb'];
const titles = BOMB_TITLES;
const details: Record<BombKind, string> = { bomb: '拆弹，或告别这张桌子', defuse: '抽到爆炸牌时使用', attack: '结束自己的回合，下家做 2 回合；若已被攻击，转交剩余回合再加 2', skip: '结束一个回合，不抽牌', favor: '选一位玩家，让对方交一张牌', shuffle: '打乱抽牌堆，继续出牌', future: '秘密看顶部三张，不改变顺序', nope: '取消效果；再次否决则恢复', moonCat: '两张随机拿牌 · 三张指定牌名', cloudCat: '两张随机拿牌 · 三张指定牌名', leafCat: '两张随机拿牌 · 三张指定牌名', starCat: '两张随机拿牌 · 三张指定牌名', sunCat: '两张随机拿牌 · 三张指定牌名' };
const accents: Record<BombKind, string> = { bomb: '#f07861', defuse: '#91c99c', attack: '#edab66', skip: '#7ababc', favor: '#e3adbb', shuffle: '#96b9cc', future: '#b4a0d8', nope: '#e39180', moonCat: '#a6acdb', cloudCat: '#b8d5de', leafCat: '#a5c695', starCat: '#dcc384', sunCat: '#eab87c' };
function KindIcon({ kind, size = 18 }: {
    kind: BombKind;
    size?: number;
}) { const Icon = { bomb: Bomb, defuse: Scissors, attack: Zap, skip: FastForward, favor: Hand, shuffle: Shuffle, future: Eye, nope: Hand, moonCat: Moon, cloudCat: Cloud, leafCat: Leaf, starCat: Star, sunCat: Sun }[kind]; return <Icon size={size}/>; }
/** Original, code-native cat illustrations. No commercial card artwork. */
function CatArt({ kind }: {
    kind: BombKind;
}) {
    const evil = kind === 'bomb' || kind === 'attack', sleep = kind === 'skip', color = accents[kind];
    return <svg className="bt-cat-art" viewBox="0 0 120 104" aria-hidden="true">
    <ellipse cx="59" cy="89" rx="41" ry="7" fill="#263234" opacity=".12"/>
    <circle cx="59" cy="49" r="40" fill="#fff" opacity=".16"/>
    <path d="M89 74C118 88 116 52 103 62" fill="none" stroke="#485453" strokeWidth="9" strokeLinecap="round"/>
    <path d="M29 79Q28 52 44 49L77 49Q91 59 89 82Q64 94 29 79Z" fill="#f3ead5" stroke="#485453" strokeWidth="2.4"/>
    <path d="M28 43L25 13 47 26Q60 19 74 26L94 12 91 46Q91 68 60 70Q29 66 28 43Z" fill="#f4eddd" stroke="#485453" strokeWidth="2.4" strokeLinejoin="round"/>
    <path d="M30 20L33 37 42 29Z M88 20L85 37 78 30Z" fill={color}/>
    <path d="M48 24L52 37M59 23L61 34M70 24L69 37" fill="none" stroke="#b3aa96" strokeWidth="3" strokeLinecap="round"/>
    {tx(sleep ? <path d="M40 45Q45 50 49 45M71 45Q76 50 80 45" fill="none" stroke="#435353" strokeWidth="3" strokeLinecap="round"/> : <><ellipse cx="45" cy="46" rx="3" ry={evil ? 3 : 5} fill="#354545"/><ellipse cx="76" cy="46" rx="3" ry={evil ? 3 : 5} fill="#354545"/>{tx(evil && <path d="M38 38L49 41M80 38L70 41" stroke="#354545" strokeWidth="2.7" strokeLinecap="round"/>)}</>)}
    <path d="M56 53L64 53 60 58Z" fill="#d28982"/><path d="M60 58Q55 63 52 58M60 58Q65 63 68 58" fill="none" stroke="#485453" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M35 54L22 51M35 58L23 60M84 54L98 51M84 58L97 60" fill="none" stroke="#8f9a90" strokeWidth="1.5"/>
    <path d="M42 74L40 85M78 74L80 85" stroke="#b3aa96" strokeWidth="3" strokeLinecap="round"/>
    {tx(kind === 'bomb' && <><circle cx="60" cy="80" r="13" fill="#465050"/><path d="M63 66Q65 57 72 62" stroke="#d4a165" strokeWidth="3" fill="none"/><path d="M73 56L74 62 80 60M70 58L74 62 73 67" stroke="#f17b53" strokeWidth="2" fill="none"/></>)}
    {tx(kind === 'defuse' && <path d="M44 76L76 85M46 87L74 74" stroke="#659480" strokeWidth="4" strokeLinecap="round"/>)}
    {tx(kind === 'attack' && <path d="M61 65L50 79 60 79 56 93 72 74 62 75Z" fill="#cf8651"/>)}
    {tx(kind === 'future' && <><circle cx="60" cy="81" r="12" fill="#9a85c0" stroke="#d4c7e9" strokeWidth="2"/><circle cx="56" cy="77" r="3" fill="#e8def4"/></>)}
    {tx(kind === 'nope' && <><circle cx="60" cy="80" r="13" fill="#cb7663"/><path d="M54 74L66 86M66 74L54 86" stroke="#f6e9d6" strokeWidth="3" strokeLinecap="round"/></>)}
    {tx(kind.endsWith('Cat') && <path d="M46 70Q60 75 75 70L70 78 61 74 51 79Z" fill={color}/>)}
  </svg>;
}
export function BombsIllustratedCard({ card, selected = false, onClick, onPointerDown, small = false, order }: {
    card: BombCard;
    selected?: boolean;
    onClick?: (event:MouseEvent<HTMLButtonElement>) => void;
    onPointerDown?: (event:PointerEvent<HTMLButtonElement>) => void;
    small?: boolean;
    order?: number;
}) {
    return <button type="button" disabled={!onClick} className={`bt-card ${small ? 'bt-small' : ''} ${selected ? 'bt-selected' : ''}`} style={{ '--card-accent': accents[card.kind] } as CSSProperties} aria-label={tx(titles[card.kind])} aria-pressed={onClick ? selected : undefined} onClick={onClick} onPointerDown={onPointerDown}>
    <span className="bt-card-heading"><b>{tx(titles[card.kind])}</b><KindIcon kind={card.kind} size={13}/></span><CatArt kind={card.kind}/>{tx(selected && <span className="bt-card-check"><Check size={13}/></span>)}{tx(order !== undefined && <span className="bt-order">{tx(order)}</span>)}
  </button>;
}
export function BombsTable({ view, selfID, command }: Props) {
    const b = view.board, hand = (b.hand as BombCard[] || []), [selected, setSelected] = useState<string[]>([]), [insertion, setInsertion] = useState(0), [explosionPrompt, setExplosionPrompt] = useState(false);
    const confirmationDialog = useDialog(explosionPrompt, () => setExplosionPrompt(false));
    const get = (id: string) => view.actions.find(a => a.id === id);
    const handIDs=hand.map(c=>c.id).join('|'),context=[selfID,b.phase,b.current,handIDs,b.discard[0]?.id].join(':');
    const taps=useCardDoubleTap(context);
    useEffect(() => { setSelected([]); setInsertion(0); setExplosionPrompt(false); }, [context]);
    const cards = hand.filter(c => selected.includes(c.id)), first = cards[0];
    const single = cards.length === 1 ? view.actions.find(a => ['play', 'nope', 'give'].includes(a.id) && a.choices.some(c => c.id === first.id)) : undefined;
    const combo = cards.length >= 2 && cards.length <= 3 && cards.every(c => c.kind === first.kind) ? get(cards.length === 2 ? 'pair' : 'triple') : undefined;
    const validCombo = combo?.choices.some(c => c.id === first?.kind) ? combo : undefined;
    const sorted = [...hand].sort((a, c) => kinds.indexOf(a.kind) - kinds.indexOf(c.kind));
    const target = get('target'), request = get('request'), give = get('give'), response = b.response, draw = get('draw'), mine = b.current === selfID;
    const displayName = (id: string) => b.players.find((p: any) => p.id === id)?.name || t('玩家');
    const run = (action: string, values: string[] = []) => { command({ action, values }); setSelected([]); };
    const pick = (card: BombCard) => setSelected(old => old.includes(card.id) ? old.filter(id => id !== card.id) : give || get('nope') ? [card.id] : old.length >= 3 || old.some(id=>hand.find(c=>c.id===id)?.kind!==card.kind) ? [card.id] : [...old, card.id]);
    const selectCard=(card:BombCard,event:MouseEvent<HTMLButtonElement>)=>{
        const action=view.actions.find(a=>['play','nope','give'].includes(a.id)&&a.choices.some(choice=>choice.id===card.id));
        if(taps.isDoubleTap(card.id,event)&&action&&selected.length===1&&selected[0]===card.id)run(action.id,[card.id]);
        else pick(card);
    };
    const actionTitle = single?.id === 'give' ? '交给对方' : single?.id === 'nope' ? (response?.cancelled ? '恢复效果' : '否决这张') : single ? '打出这张' : validCombo ? (cards.length === 2 ? '随机拿一张' : '指定牌名') : '';
    const play = () => {
        const a = single || validCombo;
        if (a)
            run(a.id, [single ? first.id : first.kind]);
    };
    let focus: ReactNode = null;
    if (view.finished)
        focus = <div className="bt-focus"><span className="bt-eyebrow">{t("最后的幸存者")}</span><h2>{tx(view.instruction)}</h2><PawPrint className="bt-focus-icon"/></div>;
    else if (target)
        focus = <div className="bt-focus"><span className="bt-eyebrow">{t("选择目标")}</span><h2>{t("点一位朋友的头像")}</h2><button className="bt-quiet" onClick={() => run('cancel')}>{t("取消出牌")}</button></div>;
    else if (request)
        focus = <div className="bt-focus"><span className="bt-eyebrow">{t("三张组合 · 指定牌名")}</span><div className="bt-request">{tx(request.choices.map(c => <button key={c.id} onClick={() => run('request', [c.id])}><KindIcon kind={c.id as BombKind} size={15}/><span>{tx(c.title)}</span></button>))}</div><button className="bt-quiet" onClick={() => run('cancel')}>{t("取消出牌")}</button></div>;
    else if (response)
        focus = <div className="bt-focus bt-response"><span className="bt-eyebrow">{displayName(response.actor)}{" " + t("出牌")}</span><h2>{tx(response.cards.length > 1 ? `${response.cards.length} 张同名组合` : titles[response.cards[0].kind as BombKind])}{tx(response.target && <small>{" " + t("→") + " "}{displayName(response.target)}</small>)}</h2>{tx(response.requested && <p>{t("索要 ·") + " "}{tx(titles[response.requested as BombKind])}</p>)}<div className="bt-response-status">{tx(b.players.filter((p: any) => p.alive).map((p: any) => <span key={p.id} className={response.passed.includes(p.id) ? 'confirmed' : ''} aria-label={tx(`${p.name}${response.passed.includes(p.id) ? '已确认' : '待响应'}`)}>{tx(p.avatar)}{tx(response.passed.includes(p.id) && <Check size={10}/>)}</span>))}<b>{tx(response.cancelled ? '效果已取消，可再次否决恢复' : '等待确认')}</b></div><div className="bt-action-row">{tx(single?.id === 'nope' && <button className="bt-primary" onClick={play}><Hand size={15}/>{tx(actionTitle)}</button>)}{tx(get('pass') && <button className="bt-secondary" onClick={() => run('pass')}>{tx(response.cancelled ? '保持取消，继续' : '不否决，继续')}<Check size={15}/></button>)}</div></div>;
    else if (give)
        focus = <div className="bt-focus"><span className="bt-eyebrow">{t("交牌给") + " "}{displayName(b.give.actor)}</span><h2>{tx(first ? titles[first.kind] : '你决定交哪张')}</h2>{tx(single && <button className="bt-primary" onClick={play}>{t("交出这张")}<ArrowRight size={15}/></button>)}</div>;
    else if (b.phase === 'future')
        focus = b.privateFuture ? <div className="bt-focus bt-future"><span className="bt-eyebrow"><Eye size={13}/>{" " + t("只有你能看到 · 从顶端起")}</span><div className="bt-future-cards">{tx(b.privateFuture.map((c: BombCard, i: number) => <BombsIllustratedCard key={c.id} card={c} small order={i + 1}/>))}</div><button className="bt-primary" onClick={() => run('done')}>{t("看好了")}<Check size={14}/></button></div> : <div className="bt-focus"><Eye className="bt-focus-icon"/><p>{displayName(b.current)}{t("正在偷瞄牌堆")}</p></div>;
    else if (get('defuse'))
        focus = <div className="bt-focus bt-danger"><span className="bt-eyebrow">{t("抽到爆炸牌！")}</span><h2>{t("使用拆弹牌，否则立即出局。")}</h2><div className="bt-action-row"><button className="bt-primary" onClick={() => run('defuse')}><Scissors size={18}/>{t("使用拆弹")}</button><button className="bt-quiet" onClick={() => setExplosionPrompt(true)}>{t("放弃拆弹")}</button></div></div>;
    else if (get('insert'))
        focus = <div className="bt-focus bt-insert"><span className="bt-eyebrow">{t("秘密放回爆炸牌")}</span><h2>{tx(insertion === 0 ? '下一张就是它' : insertion === b.deckCount ? '藏到最底下' : `放在第 ${insertion + 1} 张`)}</h2><div className="bt-insert-range"><button aria-label={t("爆炸牌移向顶部")} disabled={insertion === 0} onClick={() => setInsertion(n => n - 1)}>{t("−")}</button><input aria-label={t("爆炸牌插入位置")} type="range" min={0} max={b.deckCount} value={insertion} onChange={e => setInsertion(Number(e.target.value))}/><button aria-label={t("爆炸牌移向底部")} disabled={insertion === b.deckCount} onClick={() => setInsertion(n => n + 1)}>{t("＋")}</button></div><div className="bt-action-row"><button className="bt-quiet" onClick={() => setInsertion(0)}>{t("顶部")}</button><button className="bt-quiet" onClick={() => setInsertion(b.deckCount)}>{t("底部")}</button><button className="bt-primary" onClick={() => run('insert', [String(insertion)])}>{t("放好了")}<Check size={14}/></button></div></div>;
    else if (first)
        focus = <div className="bt-focus"><span className="bt-eyebrow">{tx(cards.length > 1 ? `已选 ${cards.length} 张` : '选中的手牌')}</span><h2>{tx(cards.length > 1 && cards.every(c => c.kind === first.kind) ? `${titles[first.kind]} ×${cards.length}` : titles[first.kind])}</h2><p>{tx(cards.length > 1 && !cards.every(c => c.kind === first.kind) ? '组合需要同名牌' : details[first.kind])}</p><div className="bt-action-row">{tx(actionTitle && <button className="bt-primary" onClick={play}>{tx(actionTitle)}<ArrowRight size={15}/></button>)}<button className="bt-quiet" onClick={() => setSelected([])}>{t("收起")}</button></div></div>;
    else
        focus = <div className="bt-focus">{!mine&&<span className="bt-eyebrow">{t('轮到')}</span>}<h2>{mine ? t('你的回合') : displayName(b.current)}</h2><p>{tx(b.phase === 'give' ? `${displayName(b.give.target)} 正在挑选手牌` : b.phase === 'insert' ? '正在秘密放回爆炸牌' : '')}</p>{tx(b.turnsRemaining > 1 && <span className="bt-debt"><Zap size={14}/>{" " + t("还需结束") + " "}{tx(b.turnsRemaining)}{" " + t("个回合")}</span>)}</div>;
    return <div className={`bt-table ${['request','future','bomb','insert'].includes(b.phase)?'bt-focused-phase ':''}bt-phase-${b.phase}`}>
    <div className="bt-seats">{tx(b.players.map((p: any) => <button key={p.id} type="button" className={`bt-seat ${p.id === b.current ? 'current' : ''} ${p.id === selfID ? 'self' : ''} ${!p.alive ? 'eliminated' : ''} ${target?.choices.some(c => c.id === p.id) ? 'targetable' : ''}`} aria-label={`${p.name}${p.id === selfID ? ` · ${t("我")}` : ""} · ${p.alive ? t(`${p.count} 张手牌`) : t("已出局")}${target?.choices.some(c => c.id === p.id) ? ` · ${t("可选为目标")}` : ""}`} onClick={() => {
                if (target?.choices.some(c => c.id === p.id))
                    run('target', [p.id]);
            }}><span className="bt-avatar">{tx(p.alive ? p.avatar : <Skull size={21}/>)}</span><span><b>{p.name}{tx(p.id === selfID && <small>{t("我")}</small>)}</b><em>{tx(p.alive ? <><span className="bt-tiny-back"/>{tx(p.count)}</> : '已出局')}</em></span>{tx(p.id === b.current && p.alive && <span className="bt-seat-turn"/>)}</button>))}</div>
    <div className="bt-arena"><div className="bt-piles"><button className={`bt-deck ${draw ? 'available' : ''}`} aria-label={tx(`抽牌，剩余 ${b.deckCount} 张`)} disabled={!draw} onClick={() => run('draw')}><span className="bt-deck-corners">{t("✦")}</span><CatArt kind="bomb"/><b>{tx(draw ? '抽一张' : '抽牌堆')}</b><small>{tx(b.deckCount)}</small></button><div className="bt-discard" aria-label={t("弃牌堆")}>{tx(b.discard[0] ? <BombsIllustratedCard card={b.discard[0]} small/> : <span className="bt-empty"><PawPrint size={25}/><small>{t("弃牌")}</small></span>)}</div></div>{tx(focus)}</div>
    <div className="bt-hand-zone"><div className="bt-hand-label"><span>{t("我的手牌") + " "}<b>{tx(hand.length)}</b></span>{tx(selected.length > 0 ? <button onClick={() => setSelected([])}><X size={12}/>{t("清空选择")}</button> : null)}</div><div className={`bt-hand ${hand.length > 8 ? 'bt-long-hand' : ''}`} aria-label={t("我的手牌，可左右滑动")}>{tx(sorted.map((c, i) => <div className="bt-hand-slot" key={c.id} style={{ '--fan': `${Math.max(-5, Math.min(5, (i - (hand.length - 1) / 2) * 1.2))}deg`, '--lift': `${Math.abs(i - (hand.length - 1) / 2) * .35}px` } as CSSProperties}><BombsIllustratedCard card={c} selected={selected.includes(c.id)} onPointerDown={taps.onPointerDown} onClick={event=>selectCard(c,event)}/></div>))}{tx(!hand.length && <span className="bt-empty-hand">{tx(b.players.find((p: any) => p.id === selfID)?.alive ? '手里空了，也能继续抽牌' : '本局先看朋友们的表演')}</span>)}</div></div>
    {tx(explosionPrompt && <div className="bt-confirm-shade"><section ref={confirmationDialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t("确认放弃拆弹")}><Bomb size={28}/><h2>{t("这局就到这里？")}</h2><p>{t("放弃拆弹后，你会立即出局。")}</p><div className="bt-action-row"><button className="bt-secondary" onClick={() => setExplosionPrompt(false)}>{t("再想想")}</button><button className="bt-primary" onClick={() => { setExplosionPrompt(false); run('explode'); }}>{t("确认出局")}</button></div></section></div>)}
  </div>;
}
