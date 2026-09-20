import {ClassicTable} from './ClassicTable';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronRight, Cloud, Copy, Crown, Gamepad2, HelpCircle, History, LogOut, Maximize2, Plus, Radio, RefreshCw, RotateCcw, Settings2, Share2, Smartphone, Users, Wifi, X } from 'lucide-react';
import { AVATARS, GAMES, type Action, type Command, type GameKind, type GameOptions, type Player } from '../core/types';
import { modules } from '../core/registry';
import { roomLimits, RoomClient, type ClientState, type RoomCandidate, type RoomMode } from '../net/client';
import { ActionDock, ActionSheet } from './Boards';
import { GemsTable } from './GemsTable';
import { BombsTable } from './BombsTable';
import { SocialTable } from './SocialTable';
import { InstallButton } from './InstallButton';
import { HistoryPanel } from './HistoryPanel';
import { readProfile, readHistory, saveRecord, deleteRecord, makeRecord } from '../local/storage';
import { NewGamesTable } from './NewGamesTable';
import { t, useLocale, setLocale } from '../i18n';
import { RuleGuide } from './RuleGuide';
import { werewolfPresetLimits } from '../core/werewolfPresets';
import { RuleOptions } from './RuleOptions';
import { WordGamesTable } from './WordGamesTable';
import { useDialog } from './useDialog';
import './app-quality.css';
import { IllustratedTile } from './IllustratedTile';
function LanguageToggle() {
    const locale = useLocale(), target = locale === 'zh' ? 'en' : 'zh';
    return <button className="language-toggle" lang={target === 'zh' ? 'zh-CN' : 'en'} aria-label={target === 'zh' ? '切换为中文' : 'Switch to English'} onClick={() => setLocale(target)}>{target === 'zh' ? '中文' : 'English'}</button>;
}
function tx(value: ReactNode): ReactNode { return typeof value === 'string' ? t(value) : value; }
const client = new RoomClient();
const kinds = Object.keys(GAMES) as GameKind[];
type Practice = {
    id: string;
    kind: GameKind;
    players: Player[];
    game: any;
    viewer: string;
    options?: GameOptions;
};
function readPractice(): Practice | null { try {
    if (new URL(location.href).searchParams.has('room'))
        return null;
    const saved = JSON.parse(localStorage.getItem('mocha-practice-v1') || 'null');
    const p = saved?.practice;
    if (!p || typeof p.id !== 'string' || !Number.isFinite(saved.at) || Date.now() - saved.at > 7 * 86400000 || !Object.hasOwn(modules, p.kind) || !Array.isArray(p.players) || !p.players.some((v: Player) => v.id === p.viewer))
        return null;
    if (!Array.isArray(p.game?.players) || p.game.players.length !== p.players.length || p.game.players.some((v: Player, i: number) => v.id !== p.players[i].id))
        return null;
    const v = modules[p.kind as GameKind].view(p.game, p.viewer);
    if (!Array.isArray(v.board.players) || !v.board.players.length)
        return null;
    return p;
}
catch {
    return null;
} }
type Sheet = 'profile' | 'join' | 'nearby' | 'help' | 'log' | 'menu' | 'history' | null;
function Modal({ title, children, onClose, wide = false, dismissible = true }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
    dismissible?: boolean;
}) {
    const panel = useDialog<HTMLElement>(true, onClose);
    return <div className="modal-shade" onClick={onClose}><section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t(title)} className={`panel ${wide ? 'wide' : ''}`} onClick={e => e.stopPropagation()}><header><h2>{tx(title)}</h2>{dismissible ? <button className="icon" aria-label={t("关闭")} onClick={onClose}><X /></button> : <LanguageToggle/>}</header>{tx(children)}</section></div>;
}
export function App() {
    const locale = useLocale();
    useEffect(()=>{document.title=locale==='zh'?'Mocha 桌游':'Mocha Tabletop';document.querySelector('link[rel="manifest"]')?.setAttribute('href',locale==='zh'?'/manifest-mocha.webmanifest':'/manifest-mocha-en.webmanifest');},[locale]);
    const [profile, setProfile] = useState<Player | null>(() => readProfile() || client.getSavedSession()?.profile || null), [state, setState] = useState<ClientState>(client.state), [selectedGame, setSelectedGame] = useState<GameKind | null>(null), [sheet, setSheet] = useState<Sheet>(null), [mode, setMode] = useState<RoomMode>('lan'), [practice, setPractice] = useState<Practice | null>(readPractice), [action, setAction] = useState<{
        a: Action;
        values: string[];
    } | null>(null), [message, setMessage] = useState(''), [rooms, setRooms] = useState<RoomCandidate[]>([]), [finding, setFinding] = useState(false), [code, setCode] = useState(''), [name, setName] = useState(profile?.name || ''), [avatar, setAvatar] = useState(profile?.avatar || AVATARS[0]), [wolfMode, setWolfMode] = useState<NonNullable<GameOptions['werewolfMode']>>('judge');
    const [records, setRecords] = useState(readHistory), [dismissedResult, setDismissedResult] = useState<string | null>(null);
    const room = state.room, kind = practice?.kind || room?.kind || selectedGame;
    const view = practice ? modules[practice.kind].view(practice.game, practice.viewer) : state.view;
    const selfID = practice?.viewer || state.selfID || profile?.id || '';
    const matchKey = practice?.id || room?.matchID;
    const resultKey = matchKey || '';
    const host = room?.hostID === selfID;
    const limits = room ? roomLimits(room.kind, room.options) : null;
    const wolfLabels = { standard: '玩家操作', judge: '法官主持', deal: '只发身份' };
    const [ruleOptions,setRuleOptions]=useState<GameOptions>({werewolfPreset:'auto',werewolfWin:'sides',unoMode:'match',unoChallenge:true});
    const wolfLimits = werewolfPresetLimits(ruleOptions.werewolfPreset);
    const wolfCountLabel = (judge: boolean) => `${judge ? t('1 法官 +')+' ' : ''}${wolfLimits.min===wolfLimits.max?wolfLimits.min:`${wolfLimits.min}–${wolfLimits.max}`} ${t('玩家')}`;
    const gameOptions = (k: GameKind, hostID?: string): GameOptions | undefined => k === 'werewolf' ? { language: locale, werewolfMode: wolfMode, werewolfPreset:ruleOptions.werewolfPreset,werewolfWin:ruleOptions.werewolfWin, ...(hostID && wolfMode !== 'standard' ? { moderatorID: hostID } : {}) } : { language: locale,...(k==='mahjong'?{mahjongMode:ruleOptions.mahjongMode}:{}),...(k==='uno'?{unoMode:ruleOptions.unoMode,unoChallenge:ruleOptions.unoChallenge}:{}) };
    useEffect(() => client.subscribe(setState), []);
    useEffect(() => { const u = new URL(location.href), roomCode = u.searchParams.get('room')?.toUpperCase(), saved = client.getSavedSession(); if (roomCode && roomCode !== saved?.code) {
        setCode(roomCode);
        setSheet('join');
    }
    else if (!practice)
        void client.connect(); }, []);
    useEffect(() => { try {
        if (practice)
            localStorage.setItem('mocha-practice-v1', JSON.stringify({ at: Date.now(), practice }));
        else
            localStorage.removeItem('mocha-practice-v1');
    }
    catch {
        if (practice)
            setMessage('浏览器无法保存试玩，关闭网页后可能无法恢复');
    } }, [practice]);
    useEffect(() => { setAction(null); }, [view?.kind, view?.phase, selfID]);
    useEffect(() => { if (message) {
        const timer = setTimeout(() => setMessage(''), 4000);
        return () => clearTimeout(timer);
    } }, [message]);
    useEffect(() => {
        if (!view?.finished || !matchKey || !profile)
            return;
        // Same-screen practice records the first seat, irrespective of the seat being inspected.
        const recordView = practice ? modules[practice.kind].view(practice.game, practice.players[0].id) : view;
        const record = makeRecord(recordView, matchKey, practice ? practice.players[0].id : selfID, practice ? practice.players[0] : room?.players.find(p => p.id === selfID) || profile, practice ? 'practice' : room?.mode || 'cloud');
        try {
            if (record && saveRecord(record))
                setRecords(readHistory());
        }
        catch {
            setMessage('本局已结束，但浏览器无法保存战绩');
        }
    }, [view, matchKey, selfID, profile, practice, room?.mode]);
    useEffect(() => { const refresh = () => setRecords(readHistory()); window.addEventListener('storage', refresh); return () => window.removeEventListener('storage', refresh); }, []);
    const notify = (s: string) => setMessage(s);
    const resetUser = () => { if (!confirm(t('重置本机用户？将删除这台设备的昵称、头像、房间恢复信息和全部战绩。此操作无法撤销。')))
        return; try {
        client.resetIdentity();
        localStorage.removeItem('mocha-profile');
        localStorage.removeItem('mocha-history-v1');
        localStorage.removeItem('mocha-practice-v1');
        setProfile(null);
        setName('');
        setAvatar(AVATARS[0]);
        setRecords([]);
        setSheet(null);
        setSelectedGame(null);
        notify('已重置本机用户');
    }
    catch (e) {
        notify((e as Error).message);
    } };
    const removeHistory = (id?: string) => { try {
        deleteRecord(id);
        setRecords(readHistory());
    }
    catch {
        notify('无法删除战绩，请检查浏览器存储设置');
    } };
    const saveProfile = () => { if (!name.trim()) {
        notify('取个名字，再入座');
        return;
    } const p = { id: profile?.id || crypto.randomUUID(), name: name.trim().slice(0, 16), avatar }; setProfile(p); setSheet(code ? 'join' : null); try {
        localStorage.setItem('mocha-profile', JSON.stringify(p));
    }
    catch {
        notify('身份仅在本次打开有效；浏览器不允许保存');
    } };
    const run = (cmd: Command) => { if (!practice && state.paused) {
        notify('正在恢复连接，请稍后再操作');
        return;
    } if (practice) {
        try {
            setPractice({ ...practice, game: modules[practice.kind].apply(practice.game, practice.viewer, cmd) });
        }
        catch (e) {
            notify((e as Error).message);
            throw e;
        }
    }
    else
        client.action(cmd); };
    const openAction = (a: Action, values: string[] = []) => setAction({ a, values });
    const startPractice = (k: GameKind) => {
        const replay = practice?.kind === k ? practice : null;
        const count = k==='doudizhu'?3:k==='guandan'||k==='mahjong'?4:k === 'werewolf' ? Math.min(wolfLimits.max,Math.max(wolfLimits.min,9)) + (wolfMode === 'judge' ? 1 : 0) : k === 'avalon' ? 5 : k === 'bombs' || k === 'undercover' ? 3 : k === 'codenames' ? 4 : 2;
        const players = replay?.players || Array.from({ length: count }, (_, i) => ({ id: `practice-${i}`, name: i === 0 ? profile!.name : (locale==='en'?['','Alex','Rain','Quinn','Sunny','Robin','Ash','Zephyr','Summer']:['','阿岚','小雨','阿七','橘子','小白','阿木','南风','夏天'])[i] || (locale==='en'?`Player ${i+1}`:`玩家${i+1}`), avatar: i === 0 ? profile!.avatar : AVATARS[i] }));
        const options = replay ? replay.options : gameOptions(k, players[0].id);
        setPractice({ id: crypto.randomUUID(), kind: k, players, game: modules[k].create(players, crypto.getRandomValues(new Uint32Array(1))[0], options), viewer: players[0].id, options });
        setSelectedGame(null);
    };
    const findRooms = async () => { setSheet('nearby'); setFinding(true); setRooms(await client.discover()); setFinding(false); };
    const join = (c = code) => { if (!profile)
        return; const saved = client.getSavedSession(); if (saved?.code === c) {
        void client.connect();
        setSheet(null);
        return;
    } if (saved && !confirm(t('加入另一张牌桌会替换本机的快捷恢复记录，继续？')))
        return; const invite = new URLSearchParams(location.hash.slice(1)).get('invite') || undefined; void client.join(profile, c, invite); setSheet(null); setSelectedGame(null); };
    const share = async () => { const url = state.inviteURL || `${location.origin}/?room=${room?.code}`; try {
        if (navigator.share)
            await navigator.share({ title: t('Mocha 桌游'), text: `${t('一起来玩')} ${t(GAMES[room!.kind].name)}`, url });
        else {
            await navigator.clipboard.writeText(url);
            notify('邀请链接已复制');
        }
    }
    catch (e) {
        if ((e as Error).name !== 'AbortError')
            notify('请分享房间码：' + room?.code);
    } };
    const fullscreen = () => { const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
    }; void (el.requestFullscreen?.() || el.webkitRequestFullscreen?.())?.catch(() => { }); };
    const leave = () => { if (practice) {
        setPractice(null);
        setSheet(null);
        return;
    } client.leave(); setSheet(null); };
    const usableRoom = room && state.status !== 'idle';
    const savedSession = client.getSavedSession();
    const disconnected = room?.players.filter(p => !p.connected) || [];
    const waitingToStart = room && limits && !room.started ?
        room.players.length > limits.max ? (locale === 'zh' ? `本板型最多 ${limits.max} 位入座，请调整板型或座位` : `This setup allows ${limits.max} seats; change the setup or remove seats`) :
        room.players.length < limits.min ? (locale === 'zh' ? `还需 ${limits.min-room.players.length} 位入座才能开局` : `Waiting for ${limits.min-room.players.length} more player(s)`) :
        disconnected.length ? t('等待离线玩家重连，或由房主移除座位') :
        room.players.some(p => p.id !== room.hostID && !p.ready) ? t('等待所有玩家准备；修改规则后需要重新准备') :
        state.mode === 'lan' && state.transport !== 'lan' ? t('等待直连建立；无法连接时可改用云端') : t('所有人已准备，等待房主开局') : '';
    const coverArt = (k: GameKind) => { const index = ['sushi', 'century', 'uno', 'codenames', 'undercover'].indexOf(k); return index < 0 ? <img src={'/art/' + k + (['doudizhu', 'guandan', 'mahjong'].includes(k) ? '.svg' : '.jpg')} alt=""/> : <IllustratedTile kind="covers" index={index} fit="slice" className="cover-painting"/>; };
    const categories: Record<GameKind, string> = { doudizhu:'经典 · 竞技',guandan:'对家 · 升级',mahjong:'传统 · 四方',gems: '策略 · 收集', bombs: '欢乐 · 生存', werewolf: '推理 · 伪装', avalon: '阵营 · 博弈', sushi: '选牌 · 美食', century: '经营 · 交易', uno: '欢乐 · 出牌', codenames: '线索 · 联想', undercover: '描述 · 推理' };
    return <main className={`app ${view ? 'in-game' : ''} game-${kind || 'home'}`} style={{ '--accent': kind ? GAMES[kind].color : '#d8c291' } as CSSProperties}>
    <header className="topbar"><div className="brand">{tx(view || usableRoom || selectedGame ? <button className="icon" aria-label={t("牌桌菜单")} onClick={() => view || usableRoom ? setSheet('menu') : setSelectedGame(null)}><ArrowLeft size={19}/></button> : <img className="brand-mark brand-image" src="/mocha-icon-180.png" alt=""/>)}<div><b>{tx(kind ? GAMES[kind].name : 'Mocha 桌游')}</b><small>{tx(view ? view.phase : usableRoom ? `房间 ${room.code}` : '')}</small></div></div><div className="top-tools"><LanguageToggle/>{tx(practice ? <label className="practice-switch"><span>{t("\u540C\u5C4F\u8BD5\u73A9")}</span><select aria-label={t("切换试玩座位")} value={practice.viewer} onChange={e => setPractice({ ...practice, viewer: e.target.value })}>{tx(practice.players.map(p => <option value={p.id} key={p.id}>{p.avatar} {p.name}{tx(practice.kind === 'sushi' && modules[practice.kind].view(practice.game, p.id).board.selected ? ' · 已选牌' : modules[practice.kind].view(practice.game, p.id).actions.length ? ' · 待操作' : '')}</option>))}</select></label> : usableRoom ? <span className={`connection ${state.paused ? 'bad' : ''}`}>{tx(state.transport === 'lan' ? <Wifi size={14}/> : <Cloud size={14}/>)}<span>{tx(state.mode === 'lan' ? (state.transport === 'lan' ? 'Wi-Fi 直连' : '直连建立中') : '云端联机')}</span></span> : <button className="compact glass" onClick={() => setSheet('join')}><Users size={15}/>{t("\u52A0\u5165\u724C\u684C")}</button>)}<button className="icon" aria-label={t("玩法和安装帮助")} onClick={() => setSheet('help')}><HelpCircle size={18}/></button>{tx(view && <button className="icon" aria-label={t("对局记录")} onClick={() => setSheet('log')}><History size={18}/></button>)}<button className="profile-chip" aria-label={t("修改昵称头像")} onClick={() => { setName(profile?.name || ''); setAvatar(profile?.avatar || AVATARS[0]); setSheet('profile'); }}>{tx(profile?.avatar || '＋')}<span>{profile?.name||t('入座')}</span></button></div></header>
    {tx(!view && !usableRoom && <><div className="library-heading"><div><small>{t("\u968F\u65F6\u5F00\u4E00\u684C")}</small><h1>{t("\u4ECA\u5929\u73A9\u4EC0\u4E48\uFF1F")}</h1></div><button className="text-button" onClick={() => setSheet('history')}><History size={15}/>{t("\u4E2A\u4EBA\u6218\u7EE9")}</button></div>{tx(savedSession && !['connecting', 'reconnecting'].includes(state.status) && <div className="resume-session"><div><b>{t("\u56DE\u5230\u4E0A\u6B21\u7684\u724C\u684C \u00B7")}{tx(savedSession.code)}</b><small>{t("\u6062\u590D\u539F\u6765\u7684\u5EA7\u4F4D\u4E0E\u5BF9\u5C40\u8FDB\u5EA6")}</small></div><div className="inline-actions"><button className="compact primary" onClick={() => void client.connect()}><RefreshCw size={14}/>{t("\u7EE7\u7EED\u4E0A\u5C40")}</button><button className="text-button" onClick={() => { if (confirm(t('移除本机的恢复入口？原牌桌不会被关闭。')))
        client.forgetSession(); }}>{t("\u5FD8\u8BB0\u724C\u684C")}</button></div></div>)}<section className="game-library">{tx(kinds.map((k, i) => <button key={k} className={`game-cover cover-${k} ${selectedGame === k ? 'chosen' : ''}`} aria-label={t(`选择${GAMES[k].name}`)} onClick={() => setSelectedGame(k)} style={{ '--accent': GAMES[k].color } as CSSProperties}>{coverArt(k)}<span className="cover-index">{String(i + 1).padStart(2,'0')}</span><span className="cover-caption"><small>{tx(categories[k])}</small><strong>{tx(GAMES[k].name)}</strong><p className="cover-tagline">{tx(GAMES[k].tagline)}</p><span>{tx(GAMES[k].min)}{t("\u2013")}{tx(GAMES[k].max)}{' '}{t("\u4EBA")}<ChevronRight size={17}/></span></span></button>))}</section><footer className="home-footer"><InstallButton /><button className="text-button" onClick={() => void findRooms()}><Radio size={15}/>{t("\u53D1\u73B0\u9644\u8FD1\u724C\u684C")}</button></footer></>)}
    {tx(usableRoom && !view && <section className="lobby"><div className="lobby-art">{coverArt(room.kind)}<div><h1>{tx(GAMES[room.kind].name)}</h1><span>{tx(limits!.min)}{t("\u2013")}{tx(limits!.max)}{' '}{t("\u4EBA")}{tx(room.kind === 'werewolf' ? ` · ${wolfLabels[room.options?.werewolfMode || 'standard']}` : '')}{t("\u00B7")}{tx(room.mode === 'lan' ? '同 Wi-Fi 直连' : '云端联机')}</span></div></div><div className="lobby-content"><div className="lobby-heading"><div><small>{t("\u9080\u8BF7\u670B\u53CB\u5165\u5EA7")}</small><button className="room-code" aria-label={t("复制房间码")} onClick={() => void navigator.clipboard?.writeText(room.code).then(() => notify('房间码已复制')).catch(() => notify(room.code))}>{tx(room.code)}<Copy size={14}/></button></div><button className="compact glass" onClick={() => void share()}><Share2 size={15}/>{t("\u9080\u8BF7")}</button></div><div className="lobby-seats">{tx(room.players.map(p => <div className={`lobby-seat ${p.ready ? 'ready' : ''}`} key={p.id}><span>{p.avatar}</span><b>{p.name}{tx(p.id === room.hostID && <Crown size={13}/>)}</b><small>{tx(!p.connected ? '离线' : p.id === room.hostID ? (room.options?.werewolfMode === 'judge' ? '法官 · 房主' : '房主') : p.ready ? '已准备' : '等待准备')}</small>{tx(host && !p.connected && p.id !== room.hostID && <button className="text-button remove-seat" aria-label={t(`移除离线玩家${p.name}`)} onClick={() => { if (confirm(t(`移除 ${p.name} 的离线座位？他们需要重新申请加入。`)))
        client.removePlayer(p.id); }}>{t("\u79FB\u9664")}</button>)}</div>))}{tx(room.players.length < limits!.max && <button className="lobby-seat vacant" onClick={() => void share()}><Plus size={24}/><small>{t("\u7B49\u4F60\u5165\u5EA7")}</small></button>)}</div>{tx(room.pending.length > 0 && host && <div className="join-requests">{tx(room.pending.map(p => <div key={p.id}><span>{p.avatar} {p.name} {t("\u60F3\u5165\u5EA7")}</span><button className="icon" aria-label={t(`拒绝${p.name}`)} onClick={() => client.approve(p.id, false)}><X size={16}/></button><button className="icon approve" aria-label={t(`同意${p.name}`)} onClick={() => client.approve(p.id, true)}><Check size={16}/></button></div>))}</div>)}<RuleOptions kind={room.kind} options={room.options||{}} playerCount={room.players.length-(room.options?.werewolfMode==='judge'?1:0)} disabled={!host} onChange={next=>client.selectGame(room.kind,next)}/><p className="lobby-start-status" role="status">{waitingToStart}</p><footer className="lobby-controls">{tx(host ? <><select aria-label={t("更换游戏")} value={room.kind} onChange={e => client.selectGame(e.target.value as GameKind, gameOptions(e.target.value as GameKind))}>{tx(kinds.map(k => <option key={k} value={k}>{tx(GAMES[k].name)}</option>))}</select>{tx(room.kind === 'werewolf' && <select className="lobby-mode" aria-label={t("狼人杀模式")} value={room.options?.werewolfMode || 'standard'} onChange={e => client.selectGame('werewolf', { ...room.options, moderatorID:undefined, language:locale, werewolfMode: e.target.value as GameOptions['werewolfMode'] })}>{tx(Object.entries(wolfLabels).map(([v, label]) => <option key={v} value={v}>{tx(label)}</option>))}</select>)}<button className="compact primary" disabled={room.players.length < limits!.min || room.players.length > limits!.max || room.players.some(p => !p.connected || p.id !== room.hostID && !p.ready) || state.mode === 'lan' && state.transport !== 'lan'} onClick={() => client.start()}>{t("\u5F00\u5C40")}<ChevronRight size={16}/></button></> : <button className="compact primary" onClick={() => client.ready(!room.players.find(p => p.id === selfID)?.ready)}>{tx(room.players.find(p => p.id === selfID)?.ready ? '取消准备' : '准备好了')}<Check size={16}/></button>)}{tx(host && room.mode === 'lan' && <button className="text-button" onClick={() => client.switchToCloud()}><Cloud size={14}/>{t("\u6539\u7528\u4E91\u7AEF")}</button>)}</footer></div></section>)}
    {tx(usableRoom && disconnected.length > 0 && <div className="presence-notice" role="status"><span>{tx(disconnected.map(p => p.name).join('、'))}{t("\u6682\u65F6\u79BB\u7EBF \u00B7 \u5EA7\u4F4D\u5DF2\u4FDD\u7559")}</span><span>{tx(room.started ? '等待重连后继续；房主可从菜单结束本局' : '房主可移除离线座位')}</span></div>)}
    {tx(view && <><div className="game-surface">{tx(['doudizhu','guandan','mahjong'].includes(view.kind)?<ClassicTable view={view} selfID={selfID} command={run} open={openAction}/>:view.kind === 'gems' ? <GemsTable view={view} selfID={selfID} command={run} open={openAction}/> : view.kind === 'bombs' ? <BombsTable view={view} selfID={selfID} command={run} open={openAction}/> : ['sushi', 'century', 'uno'].includes(view.kind) ? <NewGamesTable view={view} selfID={selfID} command={run} open={openAction}/> : ['codenames', 'undercover'].includes(view.kind) ? <WordGamesTable key={matchKey} view={view} selfID={selfID} command={run} open={openAction}/> : <SocialTable key={practice?.id || room?.code} view={view} selfID={selfID} command={run} open={openAction}/>)}</div>{tx(!['doudizhu','guandan','mahjong','bombs', 'sushi', 'century', 'uno', 'codenames', 'undercover'].includes(view.kind) && <ActionDock view={view} command={run} open={openAction}/>)}{tx(view.finished && dismissedResult !== resultKey && <div className="end-banner"><Crown size={23}/><b>{tx(typeof view.board.winner === 'string' ? view.board.winner : view.instruction)}</b>{tx(practice ? <button className="compact primary" onClick={() => startPractice(practice.kind)}>{t("\u518D\u6765\u4E00\u5C40")}</button> : host ? <button className="compact primary" onClick={() => client.replay()}>{t("\u8FD4\u56DE\u51C6\u5907")}</button> : <small>{t("\u7B49\u5F85\u623F\u4E3B\u518D\u5F00\u4E00\u5C40")}</small>)}<button className="icon dismiss-result" aria-label={t("收起结算")} onClick={() => setDismissedResult(resultKey)}><X size={18}/></button></div>)}</>)}
    {tx(['connecting', 'reconnecting'].includes(state.status) && !room && !practice && <div className="connecting-overlay"><div className="spinner"/><h2>{tx(state.waitingApproval ? '等待房主同意' : '正在寻找牌桌')}</h2><button className="text-button" onClick={() => client.cancelConnection()}>{t("\u53D6\u6D88")}</button></div>)}
    {tx((state.paused || ['reconnecting', 'disconnected'].includes(state.status)) && room && !practice && <div className="pause-overlay"><Cloud size={28}/><b>{t("\u8FDE\u63A5\u6062\u590D\u540E\uFF0C\u7EE7\u7EED\u8FD9\u4E00\u5C40")}</b><div className="inline-actions"><button className="compact primary" onClick={() => void client.connect()}><RefreshCw size={15}/>{t("\u91CD\u8FDE")}</button>{tx(host && state.mode === 'lan' && <button className="compact" onClick={() => client.switchToCloud()}>{t("\u5207\u6362\u4E91\u7AEF")}</button>)}<button className="compact" onClick={() => setSheet('menu')}>{t("\u724C\u684C\u83DC\u5355")}</button></div></div>)}
    {tx(selectedGame && !room && !practice && <Modal title={t(GAMES[selectedGame].name)} onClose={() => setSelectedGame(null)}><div className="create-body"><p className="setup-game-summary">{t(GAMES[selectedGame].tagline)}</p><button className="text-button setup-rules" onClick={()=>setSheet('help')}><HelpCircle size={16}/>{t('规则与教程')}</button>{(selectedGame==='codenames'||selectedGame==='undercover')&&<p className="word-language-note">{t('词库语言')}：{locale==='zh'?'中文':'English'}</p>}{tx(selectedGame === 'werewolf' && <><div className="wolf-mode-picker">{tx(Object.entries(wolfLabels).map(([v, label]) => <button key={v} className={wolfMode === v ? 'selected' : ''} onClick={() => setWolfMode(v as NonNullable<GameOptions['werewolfMode']>)}><b>{tx(label)}</b><small>{tx(wolfCountLabel(v === 'judge'))}</small></button>))}</div><p className="wolf-mode-description">{tx(wolfMode === 'judge' ? '房主担任法官，统一记录技能、死讯和现场投票；玩家只看身份。' : wolfMode === 'deal' ? '随机发身份牌，之后完全线下主持；房主也参与游戏。' : '每位玩家在自己的手机上执行技能和投票。')}</p></>)}<RuleOptions kind={selectedGame} options={{...ruleOptions,werewolfMode:wolfMode}} onChange={setRuleOptions}/><div className="mode-picker"><button className={mode === 'lan' ? 'selected' : ''} onClick={() => setMode('lan')}><Wifi size={23}/><b>{t("\u540C Wi-Fi")}</b><small>{t("\u4E91\u7AEF\u914D\u5BF9 \u00B7 \u624B\u673A\u76F4\u8FDE")}</small></button><button className={mode === 'cloud' ? 'selected' : ''} onClick={() => setMode('cloud')}><Cloud size={23}/><b>{t("\u4E91\u7AEF\u8054\u673A")}</b><small>{t("\u4E0D\u540C\u7F51\u7EDC\uFF0C\u4E5F\u80FD\u540C\u684C")}</small></button></div><footer><button className="text-button" onClick={() => startPractice(selectedGame)}><Gamepad2 size={15}/>{t("\u540C\u5C4F\u8BD5\u73A9")}</button><button className="compact primary" onClick={() => { void client.create(profile!, selectedGame, mode, gameOptions(selectedGame)); setSelectedGame(null); }}>{t("\u521B\u5EFA\u724C\u684C")}<ChevronRight size={16}/></button></footer></div></Modal>)}
    {tx((!profile || sheet === 'profile') && <Modal title={t("先认识一下")} dismissible={!!profile} onClose={() => { if (profile)
        setSheet(null); }}><div className="profile-editor"><div className="avatar-preview">{tx(avatar)}</div><label>{t("\u670B\u53CB\u600E\u4E48\u79F0\u547C\u4F60")}<input autoComplete="nickname" maxLength={16} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); saveProfile(); } }} placeholder={t("你的昵称")} autoFocus/></label><small className="avatar-count">{tx(AVATARS.length)}{t("\u6B3E\u5934\u50CF \u00B7 \u4E0A\u4E0B\u6ED1\u52A8\u67E5\u770B\u66F4\u591A")}</small><div className="avatar-grid" role="group" aria-label={t("选择头像")}>{tx(AVATARS.map(a => <button key={a} aria-label={t(`选择头像${a}`)} aria-pressed={a === avatar} className={a === avatar ? 'selected' : ''} onClick={() => setAvatar(a)}>{tx(a)}</button>))}</div><footer><small>{tx(room ? '昵称和头像将在下次入桌时使用' : '保存在当前浏览器，无需登录')}</small><button className="compact primary" disabled={!name.trim()} onClick={saveProfile}>{t("\u5165\u5EA7")}<ChevronRight size={16}/></button></footer>{tx(profile && !room && !practice && !['connecting', 'reconnecting'].includes(state.status) && <button className="text-button reset-user" onClick={resetUser}><RotateCcw size={14}/>{t("\u91CD\u7F6E\u672C\u673A\u7528\u6237\u4E0E\u6218\u7EE9")}</button>)}</div></Modal>)}
    {tx(sheet === 'join' && profile && <Modal title={t("加入朋友的牌桌")} onClose={() => setSheet(null)}><form className="join-form" onSubmit={e => { e.preventDefault(); join(); }}><label>{t("\u516D\u4F4D\u623F\u95F4\u7801")}<input aria-label={t("房间码")} className="code-input" autoCapitalize="characters" autoComplete="off" maxLength={6} placeholder={t("ABC234")} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}/></label><footer><button type="button" className="text-button" onClick={() => void findRooms()}><Radio size={15}/>{t("\u53D1\u73B0\u9644\u8FD1")}</button><button className="compact primary" disabled={code.length !== 6}>{t("\u5165\u684C")}<ChevronRight size={16}/></button></footer></form></Modal>)}
    {tx(sheet === 'nearby' && <Modal title={t("附近的牌桌")} onClose={() => setSheet(null)}><p className="panel-note">{t("\u6309\u7F51\u7EDC\u51FA\u53E3\u5BFB\u627E\u5019\u9009\u724C\u684C\uFF1B\u5165\u684C\u9700\u623F\u4E3B\u540C\u610F\u3002")}</p><div className="nearby-list">{tx(finding ? <div className="empty-state"><div className="spinner"/>{t("\u5BFB\u627E\u4E2D")}</div> : rooms.length ? rooms.map(r => <button key={r.code} onClick={() => join(r.code)}>{coverArt(r.kind)}<span><b>{tx(r.hostName)}{t("\u7684\u724C\u684C")}</b><small>{tx(GAMES[r.kind].name)}{t("\u00B7")}{tx(r.count)}{t("/")}{tx(r.max)}{t("\u4EBA \u00B7")}{tx(r.mode === 'lan' ? 'Wi-Fi' : '云端')}</small></span><ChevronRight size={18}/></button>) : <div className="empty-state"><Radio size={28}/><p>{t("\u9644\u8FD1\u8FD8\u6CA1\u6709\u5F00\u684C")}</p><small>{t("\u4E5F\u53EF\u4EE5\u8BA9\u670B\u53CB\u5206\u4EAB\u516D\u4F4D\u623F\u95F4\u7801")}</small></div>)}</div><footer><button className="text-button" onClick={() => setSheet('join')}>{t("\u8F93\u5165\u623F\u95F4\u7801")}</button><button className="compact" disabled={finding} onClick={() => void findRooms()}><RefreshCw size={14}/>{t("\u5237\u65B0")}</button></footer></Modal>)}
    {tx(sheet === 'help' && <Modal title={t(kind ? `${GAMES[kind].name} · 玩法` : '使用帮助')} onClose={() => setSheet(null)} wide><div className="help-content">{tx(kind ? <RuleGuide kind={kind}/> : <><h3>{t("\u6DFB\u52A0\u5230\u4E3B\u5C4F\u5E55")}</h3><p>{t("\u652F\u6301\u5B89\u88C5\u7684\u6D4F\u89C8\u5668\u53EF\u4EE5\u4ECE\u9996\u9875\u76F4\u63A5\u6253\u5F00\u7CFB\u7EDF\u786E\u8BA4\u3002iPhone \u8BF7\u7528 Safari \u7684\u5206\u4EAB\u83DC\u5355\u6DFB\u52A0\u3002")}</p><h3>{t("\u8EAB\u4EFD\u3001\u6218\u7EE9\u4E0E\u6062\u590D")}</h3><p>{t("\u6635\u79F0\u3001\u5934\u50CF\u548C\u5DF2\u5B8C\u6210\u6218\u7EE9\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u4E2A\u4EBA\u6218\u7EE9\u652F\u6301\u5355\u6761\u5220\u9664\u6216\u5168\u90E8\u5220\u9664\u3002\u5173\u95ED\u7F51\u9875\u540E\u91CD\u65B0\u6253\u5F00\uFF0C\u53EF\u6062\u590D\u5C1A\u672A\u8FC7\u671F\u7684\u724C\u684C\uFF1B\u4E3B\u52A8\u79BB\u5F00\u6216\u623F\u4E3B\u5173\u95ED\u540E\u65E0\u6CD5\u6062\u590D\u3002")}</p><h3>{t("\u548C\u670B\u53CB\u8054\u673A")}</h3><p>{t("\u521B\u5EFA\u724C\u684C\u540E\u5206\u4EAB\u9080\u8BF7\u94FE\u63A5\uFF0C\u6216\u8BA9\u670B\u53CB\u8F93\u5165\u623F\u95F4\u7801\u3002\u540C Wi-Fi \u6A21\u5F0F\u5148\u8054\u7F51\u914D\u5BF9\uFF0C\u518D\u76F4\u63A5\u4F20\u8F93\u6E38\u620F\u64CD\u4F5C\uFF1B\u76F4\u8FDE\u5931\u8D25\u65F6\u623F\u4E3B\u53EF\u6539\u7528\u4E91\u7AEF\u3002")}</p><h3>{t("\u9644\u8FD1\u724C\u684C\u4E0E\u79BB\u7EBF")}</h3><p>{t("\u9644\u8FD1\u5217\u8868\u4F9D\u636E\u7F51\u7EDC\u51FA\u53E3\uFF0C\u4E0D\u80FD\u4FDD\u8BC1\u786E\u5B9E\u5904\u4E8E\u540C\u4E00 Wi-Fi\u3002\u9875\u9762\u8D44\u6E90\u7F13\u5B58\u5B8C\u6210\u540E\uFF0C\u540C\u5C4F\u8BD5\u73A9\u53EF\u79BB\u7EBF\u4F7F\u7528\uFF1B\u8054\u673A\u5EFA\u623F\u4ECD\u9700\u8054\u7F51\u3002")}</p></>)}<button className="text-button" onClick={fullscreen}><Maximize2 size={15}/>{t("\u5C1D\u8BD5\u5168\u5C4F")}</button></div></Modal>)}
    {tx(sheet === 'history' && <Modal title={t("个人战绩")} onClose={() => setSheet(null)}><HistoryPanel records={records} onDelete={removeHistory}/></Modal>)}
    {tx(sheet === 'log' && view && <Modal title={t("对局记录")} onClose={() => setSheet(null)}><ol className="game-log">{tx(view.log.slice().reverse().map((line, i) => <li key={i}>{tx(line)}</li>))}</ol></Modal>)}
    {tx(sheet === 'menu' && <Modal title={t("牌桌菜单")} onClose={() => setSheet(null)}><div className="menu-list">{tx(view?.finished && (practice || host) && <button onClick={() => { if (practice)
        startPractice(practice.kind);
    else
        client.replay(); setSheet(null); }}><RotateCcw size={18}/>{tx(practice ? '再来一局' : '返回准备，开新一局')}</button>)}<button onClick={() => setSheet('history')}><History size={18}/>{t("\u4E2A\u4EBA\u6218\u7EE9")}<ChevronRight size={16}/></button>{tx(!practice && <button onClick={() => void share()}><Share2 size={18}/>{t("\u5206\u4EAB\u9080\u8BF7")}<ChevronRight size={16}/></button>)}{tx(host && state.mode === 'lan' && <button onClick={() => { client.switchToCloud(); setSheet(null); }}><Cloud size={18}/>{t("\u5207\u6362\u4E91\u7AEF\u8054\u673A")}<ChevronRight size={16}/></button>)}{tx(host && room?.started && <button onClick={() => { if (window.confirm(t('结束当前对局，所有玩家返回准备？'))) {
        client.endGame();
        setSheet(null);
    } }}><RotateCcw size={18}/>{t("\u7ED3\u675F\u672C\u5C40\uFF0C\u8FD4\u56DE\u51C6\u5907")}</button>)}<button onClick={() => { if (!view || window.confirm(t(practice ? '结束这局同屏试玩？' : host ? '离开将关闭这张牌桌，确定？' : '请房主结束本局后再离开。')))
        leave(); }}><LogOut size={18}/>{tx(practice ? '结束试玩' : '离开牌桌')}</button></div></Modal>)}
    {tx(action && view && <ActionSheet key={`${selfID}:${action.a.id}`} action={action.a} selected={action.values} view={view} onClose={() => setAction(null)} onSubmit={run}/>)}
    {tx((message || state.error) && <div className="toast" role="status"><span>{tx(message || state.error)}</span><button className="icon" aria-label={t("关闭提示")} onClick={() => { setMessage(''); client.clearError(); }}><X size={14}/></button></div>)}
  </main>;
}
