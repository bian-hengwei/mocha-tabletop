import { t, useLocale } from '../i18n';
function tx<T>(value: T): T | string { return typeof value === 'string' ? t(value) : value; }
import { Trash2, Trophy } from 'lucide-react';
import { GAMES } from '../core/types';
import type { MatchRecord } from '../local/storage';
import './personal.css';
export function HistoryPanel({ records, onDelete }: {
    records: MatchRecord[];
    onDelete: (id?: string) => void;
}) {
    const locale = useLocale();
    const competitive = records.filter(r => r.mode !== 'practice' && r.mode !== 'solo' && !r.botCount && ['win', 'loss', 'draw'].includes(r.result));
    return <div className="history-panel"><p className="panel-note">{t("最近 500 局 · 仅保存在当前浏览器")}</p><div className="history-summary"><Trophy size={20}/><b>{tx(competitive.length)}{" " + t("局联机")}</b><span>{tx(competitive.filter(r => r.result === 'win' || r.result === 'draw').length)}{" " + t("局获胜 / 并列")}</span></div>{tx(records.length ? <><ul className="personal-records">{tx(records.map(r => <li key={r.id}><div className={`result-mark result-${r.result}`}>{tx({ win: '胜', loss: '负', draw: '并列', host: '主持', completed: '完成' }[r.result])}</div><div><b>{tx(GAMES[r.kind].name)}{tx(r.score !== undefined && <span>{" " + t("·") + " "}{tx(r.score)}{" " + t("分")}</span>)}</b><small>{tx(r.avatar)} {r.name}{" " + t("·") + " "}{tx(r.playerCount)}{" " + t("人 ·") + " "}{r.botCount?`${t('人机对局')} · ${r.botCount} 🤖 · `:''}{tx({ solo: '单人人机', practice: '同屏试玩', cloud: '云端', lan: '局域网' }[r.mode])}</small><p>{tx(r.summary)}</p><time dateTime={new Date(r.at).toISOString()}>{tx(new Date(r.at).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</time></div><button className="icon" aria-label={tx(`删除${GAMES[r.kind].name}战绩`)} onClick={() => {
                    if (confirm(tx('删除这条战绩？')))
                        onDelete(r.id);
                }}><Trash2 size={17}/></button></li>))}</ul><footer><button className="text-button" onClick={() => {
                if (confirm(tx('清空这台设备的全部战绩？此操作无法撤销。')))
                    onDelete();
            }}><Trash2 size={15}/>{t("全部删除")}</button></footer></> : <div className="empty-state"><Trophy size={32}/><p>{t("暂无战绩")}</p></div>)}</div>;
}
