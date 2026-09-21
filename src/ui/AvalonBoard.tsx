import { Check, Crown, Shield, Users, X } from 'lucide-react';
import type { Action, GameView, Player } from '../core/types';
import { t } from '../i18n';

type AvalonPlayer = Player & { team: boolean; leader: boolean; role?: string };
type AvalonBoardView = {
    players: AvalonPlayer[];
    leader: string;
    stage: string;
    team: string[];
    teamSize: number;
    teamSizes: number[];
    results: boolean[];
    rejections: number;
    publicVotes: Record<string, boolean>;
    twoFailsRequired: boolean;
    winner: string | null;
};

export function AvalonBoard({ view, selfID, open }: {
    view: GameView;
    selfID: string;
    open: (action: Action, selected?: string[]) => void;
}) {
    const b = view.board as AvalonBoardView;
    const leader = b.players.find(player => player.id === b.leader);
    const targetAction = view.actions.find(action => action.id === 'propose' || action.id === 'assassinate');
    const showPreviousVotes = !view.finished && Object.keys(b.publicVotes).length > 0;
    return <section className="avalon-board" aria-label={t('远征牌桌')}>
        <div className="quest-track" aria-label={t('任务进度')}>
            {b.teamSizes.map((size, index) => {
                const result = b.results[index];
                const current = !view.finished && index === b.results.length;
                const outcome = result === true ? t('成功') : result === false ? t('失败') : '';
                return <div key={index} className={`quest ${current ? 'current' : ''} ${result === true ? 'success' : result === false ? 'failed' : ''}`} aria-current={current ? 'step' : undefined}>
                    <span aria-label={outcome || undefined}>{result === true ? <Check size={18}/> : result === false ? <X size={18}/> : index + 1}</span>
                    <small>{size} {t('人')}{index === 3 && b.players.length >= 7 && <em title={t('两张失败牌才会失败')}>{t('双败')}</em>}</small>
                </div>;
            })}
        </div>
        <header className="avalon-summary table-emblem">
            {view.finished ? <h2>{t(b.winner || view.instruction)}</h2> : <>
                <div className="avalon-team-heading"><Users size={17}/><b>{t('远征队伍')} <span>{b.team.length} / {b.teamSize}</span></b></div>
                <div className="avalon-leader"><Crown size={14}/><span>{leader?.name}</span></div>
                {b.twoFailsRequired && b.stage === 'mission'
                    ? <span className="avalon-rejections" title={t('两张失败牌才会失败')}>{t('需两张失败')}</span>
                    : <span className="avalon-rejections" title={t('连续五次否决，邪恶获胜')}>{t('连续否决')} <b>{b.rejections} / 5</b></span>}
            </>}
            {showPreviousVotes && <div className="avalon-vote-legend" aria-label={t('上次表决')}>
                <span>{t('上次表决')}</span>
                {b.players.map((player,index)=>Object.hasOwn(b.publicVotes,player.id)&&<span key={player.id} className="avalon-previous-vote" title={`${t('座位')} ${index+1} · ${player.name} · ${t(b.publicVotes[player.id]?'赞成':'反对')}`} aria-label={`${player.name} · ${t('上次表决')} · ${t(b.publicVotes[player.id]?'赞成':'反对')}`}>
                    <span aria-hidden="true">{index+1}</span><span aria-hidden="true" className={`vote-mark ${b.publicVotes[player.id]?'approved':'rejected'}`}>{b.publicVotes[player.id]?'✓':'✕'}</span>
                </span>)}
            </div>}
        </header>
        <div className="avalon-roster seats" aria-label={t('所有玩家')}>
            {b.players.map((player, index) => {
                const selectable = targetAction?.choices.some(choice => choice.id === player.id);
                const previousVote = showPreviousVotes && Object.hasOwn(b.publicVotes, player.id) ? b.publicVotes[player.id] : undefined;
                const status = [view.finished ? t(player.role || '') : player.team ? t('已入队') : '', player.id === selfID ? t('我') : ''].filter(Boolean).join(' · ');
                return <button type="button" key={player.id} className={`seat avalon-seat ${player.id === selfID ? 'self' : ''} ${player.team ? 'team' : ''} ${player.leader ? 'leader' : ''}`}
                    aria-disabled={!selectable} tabIndex={selectable ? 0 : -1} aria-label={`${t('座位')} ${index + 1} · ${player.name}${status ? ` · ${status}` : ''}${player.leader ? ` · ${t('远征队长')}` : ''}${previousVote !== undefined ? ` · ${t('上次表决')} · ${t(previousVote ? '赞成' : '反对')}` : ''}${selectable ? ` · ${t('可选为目标')}` : ''}`}
                    onClick={() => { if (selectable && targetAction) open(targetAction, [player.id]); }}>
                    <span className="avalon-seat-number">{index + 1}</span>
                    <span className="seat-avatar">{player.avatar}</span>
                    <b>{player.name}</b>
                    <small>{player.team && !view.finished && <Shield size={11}/>}<span>{status}</span></small>
                    {player.leader && <Crown className="avalon-crown" size={14} aria-label={t('远征队长')}/>}
                </button>;
            })}
        </div>
    </section>;
}
