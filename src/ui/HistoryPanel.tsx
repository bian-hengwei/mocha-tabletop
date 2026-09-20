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
    const competitive = records.filter(r => r.mode !== 'practice' && ['win', 'loss', 'draw'].includes(r.result));
    return <div className="history-panel"><p className="panel-note">{t("保存在当前浏览器，最多保留最近 500 局。清除浏览器数据会一并删除；同屏试玩单独标记。")}</p><div className="history-summary"><Trophy size={20}/><b>{tx(competitive.length)}{" " + t("局联机")}</b><span>{tx(competitive.filter(r => r.result === 'win' || r.result === 'draw').length)}{" " + t("局获胜 / 并列")}</span></div>{tx(records.length ? <><ul className="personal-records">{tx(records.map(r => <li key={r.id}><div className={`result-mark result-${r.result}`}>{tx({ win: '胜', loss: '负', draw: '并列', host: '主持', completed: '完成' }[r.result])}</div><div><b>{tx(GAMES[r.kind].name)}{tx(r.score !== undefined && <span>{" " + t("·") + " "}{tx(r.score)}{" " + t("分")}</span>)}</b><small>{tx(r.avatar)} {r.name}{" " + t("·") + " "}{tx(r.playerCount)}{" " + t("人 ·") + " "}{tx({ practice: '同屏试玩', cloud: '云端', lan: '局域网' }[r.mode])}</small><p>{tx(r.summary)}</p><time dateTime={new Date(r.at).toISOString()}>{tx(new Date(r.at).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</time></div><button className="icon" aria-label={tx(`删除${GAMES[r.kind].name}战绩`)} onClick={() => {
                    if (confirm(tx('删除这条战绩？')))
                        onDelete(r.id);
                }}><Trash2 size={17}/></button></li>))}</ul><footer><small>{t("删除后不会因重新打开终局而恢复")}</small><button className="text-button" onClick={() => {
                if (confirm(tx('清空这台设备的全部战绩？此操作无法撤销。')))
                    onDelete();
            }}><Trash2 size={15}/>{t("全部删除")}</button></footer></> : <div className="empty-state"><Trophy size={32}/><p>{t("完成第一局，战绩就会记在这里")}</p></div>)}</div>;
}
