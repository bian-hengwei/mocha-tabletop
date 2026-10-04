import { useState } from 'react';
import { t, useLocale } from '../i18n';
import { Trash2, Trophy } from 'lucide-react';
import { GAMES, type GameKind } from '../core/types';
import type { MatchRecord } from '../local/storage';
import './personal.css';

type HistoryMode = 'all' | 'online' | 'solo' | 'practice';
export function HistoryPanel({ records, onDelete }: {
    records: MatchRecord[];
    onDelete: (id?: string) => void;
}) {
    const locale = useLocale();
    const [game, setGame] = useState<GameKind | 'all'>('all');
    const [mode, setMode] = useState<HistoryMode>('all');
    const filtered = records.filter(record =>
        (game === 'all' || record.kind === game) &&
        (mode === 'all' || (mode === 'online' ? record.mode === 'cloud' || record.mode === 'lan' : record.mode === mode)));
    const competitive = filtered.filter(record => record.mode !== 'practice' && record.mode !== 'solo' && !record.botCount && ['win', 'loss', 'draw'].includes(record.result));
    const resetFilters = () => { setGame('all'); setMode('all'); };
    return <div className="history-panel">
        <p className="panel-note">{t('最近 500 局 · 仅保存在当前浏览器')}</p>
        {records.length > 0 && <>
            <div className="history-filters">
                <label>{t('筛选游戏')}<select value={game} onChange={event => setGame(event.target.value as GameKind | 'all')}>
                    <option value="all">{t('全部游戏')}</option>
                    {(Object.keys(GAMES) as GameKind[]).map(kind => <option value={kind} key={kind}>{t(GAMES[kind].name)}</option>)}
                </select></label>
                <label>{t('对局类型')}<select value={mode} onChange={event => setMode(event.target.value as HistoryMode)}>
                    <option value="all">{t('全部类型')}</option><option value="online">{t('联机对局')}</option>
                    <option value="solo">{t('单人人机')}</option><option value="practice">{t('同屏试玩')}</option>
                </select></label>
            </div>
            <div className="history-filter-status"><span role="status">{t(`${filtered.length} / ${records.length} 条战绩`)}</span>{(game !== 'all' || mode !== 'all') && <button className="text-button" onClick={resetFilters}>{t('重置筛选')}</button>}</div>
        </>}
        {competitive.length > 0 && <div className="history-summary"><Trophy size={20}/><b>{competitive.length} {t('局联机')}</b><span>{competitive.filter(record => record.result === 'win' || record.result === 'draw').length} {t('局获胜 / 并列')}</span></div>}
        {filtered.length > 0 ? <ul className="personal-records">{filtered.map(record => <li key={record.id}>
            <div className={`result-mark result-${record.result}`}>{t({ win: '胜', loss: '负', draw: '并列', host: '主持', completed: '完成' }[record.result])}</div>
            <div>
                <b>{t(GAMES[record.kind].name)}{record.score !== undefined && <span> · {record.score} {t('分')}</span>}</b>
                <small>{record.avatar} {record.name} · {record.playerCount} {t('人 ·')} {record.botCount ? `${t('人机对局')} · ${record.botCount} 🤖 · ` : ''}{t({ solo: '单人人机', practice: '同屏试玩', cloud: '云端', lan: '局域网' }[record.mode])}</small>
                <p>{t(record.summary)}</p>
                <time dateTime={new Date(record.at).toISOString()}>{new Date(record.at).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
            </div>
            <button className="icon" aria-label={t(`删除${GAMES[record.kind].name}战绩`)} onClick={() => {
                if (confirm(t('删除这条战绩？'))) onDelete(record.id);
            }}><Trash2 size={17}/></button>
        </li>)}</ul> : <div className="empty-state"><Trophy size={32}/><p>{t(records.length ? '没有符合筛选的战绩' : '暂无战绩')}</p></div>}
        {records.length > 0 && <footer><button className="text-button" onClick={() => {
            if (confirm(t('清空这台设备的全部战绩？此操作无法撤销。'))) onDelete();
        }}><Trash2 size={15}/>{t(`删除全部 ${records.length} 条战绩`)}</button></footer>}
    </div>;
}
