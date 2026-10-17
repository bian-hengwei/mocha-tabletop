import {useState, type CSSProperties, type ReactNode} from 'react';
import {ChevronRight, Users} from 'lucide-react';
import {GAMES, type GameKind} from '../core/types';
import {t, useLocale} from '../i18n';
import './home-library.css';

const kinds = Object.keys(GAMES) as GameKind[];
const minPlayers = Math.min(...kinds.map(kind => GAMES[kind].min));
const maxPlayers = Math.max(...kinds.map(kind => GAMES[kind].max));

export function HomeLibrary({selectedGame, onSelect, renderArt}: {
    selectedGame: GameKind | null;
    onSelect: (kind: GameKind, players?: number) => void;
    renderArt: (kind: GameKind) => ReactNode;
}) {
    const locale = useLocale();
    const [players, setPlayers] = useState<number | undefined>();
    const visible = kinds.filter(kind => players === undefined || players >= GAMES[kind].min && players <= GAMES[kind].max);
    return <>
        <div className="library-filters">
            <label><Users size={16} aria-hidden="true"/><span>{t('玩家人数')}</span>
                <select value={players ?? ''} onChange={event => setPlayers(event.target.value ? Number(event.target.value) : undefined)}>
                    <option value="">{t('全部人数')}</option>
                    {Array.from({length: maxPlayers - minPlayers + 1}, (_, index) => minPlayers + index).map(count => <option key={count} value={count}>{count} {t('人')}</option>)}
                </select>
            </label>
            <span className="library-result-count" role="status">{locale === 'zh' ? `${visible.length} 款游戏` : `${visible.length} ${visible.length === 1 ? 'game' : 'games'}`}</span>
        </div>
        <section className="game-library" aria-label={t('游戏列表')}>
            {visible.map(kind => <button key={kind} className={`game-cover cover-${kind} ${selectedGame === kind ? 'chosen' : ''}`} aria-label={t(`选择${GAMES[kind].name}`)} onClick={() => onSelect(kind, players)} style={{'--accent': GAMES[kind].color} as CSSProperties}>
                {renderArt(kind)}
                <span className="cover-caption"><strong>{t(GAMES[kind].name)}</strong><span><small>{GAMES[kind].min === GAMES[kind].max ? GAMES[kind].min : `${GAMES[kind].min}–${GAMES[kind].max}`} {t('人')}</small><b aria-hidden="true"><ChevronRight size={15}/></b></span></span>
            </button>)}
        </section>
    </>;
}
