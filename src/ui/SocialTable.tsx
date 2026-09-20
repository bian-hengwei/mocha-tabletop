import { WolfRuleStrip } from './WolfRuleStrip';
import { t } from '../i18n';
function tx<T>(value: T): T | string { return typeof value === 'string' ? t(value) : value; }
import { useEffect, useState, type CSSProperties } from 'react';
import { Check, Crown, Eye, EyeOff, Flame, LockKeyhole, Moon, Shield, Skull, Sparkles, Sun, Swords, X } from 'lucide-react';
import type { Action, Command, GameView } from '../core/types';
import { SocialBoard } from './Boards';
import { RoleArt } from './Art';
import './social-table.css';
type Props = {
    view: GameView;
    selfID: string;
    command: (c: Command) => void;
    open: (a: Action, selected?: string[]) => void;
};
const roleKeys: Record<string, string> = { '狼人': 'wolf', '平民': 'villager', '预言家': 'seer', '女巫': 'witch', '猎人': 'hunter', '守卫': 'guard', '梅林': 'merlin', '派西维尔': 'percival', '忠臣': 'servant', '莫甘娜': 'morgana', '刺客': 'assassin', '爪牙': 'minion', '法官': 'moderator' };
const roleRules: Record<string, string> = { wolf: '每晚与狼队共同选择袭击目标。', villager: '白天讨论并投票放逐。', seer: '每晚查验一名玩家的阵营。', witch: '一瓶解药，一瓶毒药；同夜限用一瓶。', hunter: '被刀或放逐时可开枪；被毒不能开枪。', guard: '每晚守护一人，不能连续守同一人。', merlin: '知道邪恶玩家；三次任务成功后须躲过刺杀。', percival: '知道梅林与莫甘娜的位置，但无法区分。', servant: '任务中只能提交成功。', morgana: '会被派西维尔误认为梅林。', assassin: '三次任务成功后，选择一人刺杀梅林。', minion: '任务中可提交失败。', moderator: '主持流程，不参与阵营胜负。' };
const evilRoles = new Set(['wolf', 'morgana', 'assassin', 'minion']);
function roleKey(view: GameView) { return view.board.ownRoleKey || roleKeys[view.board.ownRole] || 'villager'; }
function RoleBack({ large = false }: {
    large?: boolean;
}) { return <div className={`role-back ${large ? 'large' : ''}`}><div className="role-back-border"/><span className="role-back-star north">{t("✦")}</span><span className="role-back-star south">{t("✦")}</span><div className="role-back-sigil"><Moon /><i /><i /><i /></div><span className="role-back-label">{t("身份牌")}</span><small>{t("点击查看")}</small></div>; }
function IdentityReveal({ view, onClose }: {
    view: GameView;
    onClose: () => void;
}) {
    const b = view.board, key = roleKey(view), evil = evilRoles.has(key), knowledge = (b.ownKnowledge || []).filter((k: any) => k.id !== 'role');
    useEffect(() => {
        const conceal = () => onClose();
        const visibility = () => {
            if (document.hidden)
                conceal();
        };
        window.addEventListener('blur', conceal);
        document.addEventListener('visibilitychange', visibility);
        return () => { window.removeEventListener('blur', conceal); document.removeEventListener('visibilitychange', visibility); };
    }, [onClose]);
    return <div className="identity-curtain" role="dialog" aria-modal="true" aria-label={t("我的秘密身份")} onClick={onClose}><section className={`identity-reveal ${evil ? 'evil' : 'good'}`} onClick={e => e.stopPropagation()}><button className="identity-hide" aria-label={t("收起身份")} onClick={onClose}><EyeOff size={18}/><span>{t("收起")}</span></button><div className="identity-portrait"><RoleArt role={key}/><div className="portrait-engraving"/><span className="portrait-edition">{t("Mocha 桌游")}</span></div><div className="identity-story"><div className="identity-allegiance">{tx(evil ? <Flame size={13}/> : <Shield size={13}/>)}<span>{tx(key === 'moderator' ? '法官' : view.kind === 'avalon' ? (evil ? '邪恶阵营' : '正义阵营') : (evil ? '狼人阵营' : '好人阵营'))}</span></div><h2>{tx(b.ownRole)}</h2><p className="identity-lore">{tx(roleRules[key])}</p>{tx(knowledge.length > 0 ? <div className="identity-knowledge">{tx(knowledge.map((k: any) => <div key={k.id}><small>{tx(k.title)}</small><p>{tx(k.detail || '尚无记录')}</p></div>))}</div> : <div className="identity-secret"><LockKeyhole size={15}/><span>{t("没有额外情报")}</span></div>)}<button className="identity-seal" onClick={onClose}><EyeOff size={14}/>{t("翻回牌背")}</button></div></section></div>;
}
function PersonalCard({ view, selfID, onReveal }: {
    view: GameView;
    selfID: string;
    onReveal: () => void;
}) {
    const player = view.board.players.find((p: any) => p.id === selfID), seat = view.board.players.findIndex((p: any) => p.id === selfID) + 1;
    return <section className="personal-deal"><div className="personal-atmosphere"/><div className="personal-story"><h2>{tx(view.board.mode === 'deal' ? '仅发身份' : '法官主持')}</h2><div className="personal-seat"><span>{tx(String(seat).padStart(2, '0'))}</span><div><b>{player?.name}</b><small>{tx(view.board.mode === 'deal' ? `第 ${view.board.dealNumber} 次发牌` : player?.alive === false ? '本局已出局' : '玩家只需查看身份')}</small></div></div></div><button className="personal-card-button" onClick={onReveal} aria-label={t("查看我的身份")}><RoleBack large/></button><span className="personal-confidential"><LockKeyhole size={12}/>{" " + t("不向其他玩家公开身份")}</span></section>;
}
function JudgeTable({ view, open }: {
    view: GameView;
    open: Props['open'];
}) {
    const b = view.board, m = b.moderatorOnly, primary = view.actions[0], phases = ['guard', 'wolves', 'witch', 'seer', 'sheriff', 'dawn', 'day'], stageIndex = phases.indexOf(b.stage), night = ['guard', 'wolves', 'witch', 'seer'].includes(b.stage);
    const title = (id: string) => b.players.find((p: any) => p.id === id)?.name || '无人';
    const selectPlayer = (id: string) => {
        const a = view.actions.find(a => a.choices.some(c => c.id === id || c.id === `poison:${id}`));
        if (a)
            open(a, [a.choices.find(c => c.id === id || c.id === `poison:${id}`)!.id]);
    };
    return <section className={`judge-table ${night ? 'is-night' : ''}`}><header className="judge-heading"><div><span className="judge-eye"><Eye size={15}/></span><b>{t("法官手册")}</b><small>{t("仅你可见")}</small></div><span>{tx(night ? <Moon size={13}/> : <Sun size={13}/>)}{t("第") + " "}{tx(b.night)} {tx(night ? '夜' : '天')}</span></header><div className="judge-workspace"><div className={`judge-roster count-${b.players.length}`}>{tx(b.players.map((p: any, i: number) => <button type="button" className={`judge-player ${p.alive ? '' : 'dead'} ${m.pendingDeaths.includes(p.id) ? 'pending' : ''}`} key={p.id} onClick={() => selectPlayer(p.id)} aria-label={`${t("座位")} ${i + 1} · ${p.name} · ${t(p.role)}${p.alive ? "" : ` · ${t("已出局")}`}`}><span className="judge-player-art"><RoleArt role={p.roleKey} align="top"/>{tx(!p.alive && <Skull size={20}/>)}</span><span className="judge-player-number">{tx(i + 1)}</span><div><b>{p.name}</b><small>{tx(p.role)}{tx(p.sheriff && <Crown size={10}/>)}</small></div></button>))}</div><aside className="judge-console"><div className="judge-phase-pips">{tx(phases.map((p, i) => <i key={p} className={i === stageIndex ? 'active' : i < stageIndex ? 'done' : ''}/>))}</div><span className="judge-phase-label">{tx(b.stage === 'finished' ? '终章' : '当前流程')}</span><h2>{tx(m.prompt)}</h2>{tx(b.stage === 'dawn' ? <div className="judge-death-list"><small>{t("即将公布")}</small><b>{tx(m.pendingDeaths.length ? m.pendingDeaths.map(title).join('、') : '平安夜')}</b></div> : b.stage === 'witch' ? <div className="judge-potions"><span className={m.potions.antidote ? 'available' : ''}>{t("解药") + " "}{tx(m.potions.antidote ? '●' : '○')}</span><span className={m.potions.poison ? 'available' : ''}>{t("毒药") + " "}{tx(m.potions.poison ? '●' : '○')}</span><small>{tx(m.potions.antidote ? `刀口 · ${m.knife ? title(m.knife) : '无人'}` : '解药已用，不提示刀口')}</small></div> : <p className="judge-guidance">{tx(primary?.help || '按现场结果记录，由法官统一推进。')}</p>)}{tx(m.checks.length > 0 && <div className="judge-last-check"><Eye size={12}/><span>{tx(title(m.checks.at(-1).target))}{" " + t("·") + " "}{tx(m.checks.at(-1).result)}</span></div>)}{tx(primary && <button className="judge-next" aria-label={tx(primary.title)} onClick={() => open(primary)}>{tx(primary.title)}<span>{t("→")}</span></button>)}</aside></div></section>;
}
export function SocialTable(props: Props) {
    const { view, selfID, open } = props, b = view.board, [revealed, setRevealed] = useState(false), hosted = b.mode === 'judge' || b.mode === 'deal';
    useEffect(() => setRevealed(false), [selfID, view.kind, view.finished, b.dealNumber]);
    const quick = view.kind === 'avalon' ? view.actions.find(a => a.id === 'approve' || a.id === 'mission') : undefined;
    return <div className={`social-table-v2 ${hosted ? 'hosted' : ''} ${b.isModerator ? 'moderator' : ''} ${view.kind === 'avalon' ? 'council' : ''} ${quick ? 'is-decision' : ''}`}>
      {view.kind==='werewolf'&&<WolfRuleStrip preset={b.preset} winRule={b.winRule}/>}
  {tx(hosted ? (b.isModerator ? <JudgeTable view={view} open={open}/> : <PersonalCard view={view} selfID={selfID} onReveal={() => setRevealed(true)}/>) : <><SocialBoard {...props}/><button className="identity-deck" onClick={() => setRevealed(true)} aria-label={t("查看我的身份")}><RoleBack /><span>{t("我的身份")}</span></button>{tx(quick && <div className="council-decision"><small>{tx(quick.id === 'approve' ? '这支队伍，值得信任吗？' : '秘密提交你的任务牌')}</small><div>{tx(quick.choices.map(c => <button className={`council-token ${c.id === 'no' || c.id === 'fail' ? 'dark' : ''}`} key={c.id} onClick={() => open(quick, [c.id])} aria-label={tx(c.title)}>{tx(c.id === 'yes' || c.id === 'success' ? <Check /> : <X />)}<b>{tx(c.title)}</b></button>))}</div></div>)}</>)}
  {tx(revealed && <IdentityReveal key={`${selfID}:${b.dealNumber || 0}`} view={view} onClose={() => setRevealed(false)}/>)}
 </div>;
}
