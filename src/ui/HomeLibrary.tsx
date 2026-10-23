import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {ChevronRight, Star, Users} from 'lucide-react';
import {GAMES, type GameKind} from '../core/types';
import {t, useLocale} from '../i18n';
import './home-library.css';

const kinds = Object.keys(GAMES) as GameKind[];
const minPlayers = Math.min(...kinds.map(kind => GAMES[kind].min));
const maxPlayers = Math.max(...kinds.map(kind => GAMES[kind].max));

export function HomeLibrary({favorites, onToggleFavorite, selectedGame, onSelect, renderArt}: {
    favorites: GameKind[];
    onToggleFavorite: (kind: GameKind) => void;
    selectedGame: GameKind | null;
    onSelect: (kind: GameKind, players?: number) => void;
    renderArt: (kind: GameKind) => ReactNode;
}) {
    const locale = useLocale();
    const [players, setPlayers] = useState<number | undefined>();
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const libraryRef = useRef<HTMLElement>(null);
    useEffect(() => { libraryRef.current?.scrollTo({top: 0}); }, [favoritesOnly, players]);
    const playerMatches = (kind: GameKind) => players === undefined || players >= GAMES[kind].min && players <= GAMES[kind].max;
    const visible = kinds.filter(kind => playerMatches(kind) && (!favoritesOnly || favorites.includes(kind)));
    const emptyAction = favorites.length === 0 ? '显示全部游戏' : players !== undefined ? '查看全部人数' : '显示全部游戏';
    const emptyActionClick = () => {
        if (favorites.length === 0) {
            setFavoritesOnly(false);
            setPlayers(undefined);
        }
        else if (players !== undefined)
            setPlayers(undefined);
        else
            setFavoritesOnly(false);
    };
    return <>
        <div className="library-filters">
            <div className="library-filter-controls"><label><Users size={16} aria-hidden="true"/><span>{t('玩家人数')}</span>
                <select aria-label={t('玩家人数')} value={players ?? ''} onChange={event => setPlayers(event.target.value ? Number(event.target.value) : undefined)}>
                    <option value="">{t('全部人数')}</option>
                    {Array.from({length: maxPlayers - minPlayers + 1}, (_, index) => minPlayers + index).map(count => <option key={count} value={count}>{count} {t('人')}</option>)}
                </select>
            </label><button type="button" className="library-favorite-filter" aria-label={t(favoritesOnly ? '显示全部游戏' : '只看收藏')} aria-pressed={favoritesOnly} title={t(favoritesOnly ? '显示全部游戏' : '只看收藏')} onClick={() => setFavoritesOnly(value => !value)}><Star size={17} fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true"/><span aria-hidden="true">{favorites.length}</span></button></div>
            <span className="library-result-count" role="status">{locale === 'zh' ? `${visible.length} 款游戏` : `${visible.length} ${visible.length === 1 ? 'game' : 'games'}`}</span>
        </div>
        <section ref={libraryRef} className="game-library" aria-label={t(favoritesOnly ? '收藏游戏' : '游戏列表')}>
            {visible.map(kind => { const favorite = favorites.includes(kind); return <div className="game-entry" key={kind}>
                <button className={`game-cover cover-${kind} ${selectedGame === kind ? 'chosen' : ''}`} aria-label={t(`选择${GAMES[kind].name}`)} onClick={() => onSelect(kind, players)} style={{'--accent': GAMES[kind].color} as CSSProperties}>
                    {renderArt(kind)}
                    <span className="cover-caption"><strong>{t(GAMES[kind].name)}</strong><span><small>{GAMES[kind].min === GAMES[kind].max ? GAMES[kind].min : `${GAMES[kind].min}–${GAMES[kind].max}`} {t('人')}</small><b aria-hidden="true"><ChevronRight size={15}/></b></span></span>
                </button>
                <button type="button" className={`game-favorite ${favorite ? 'active' : ''}`} aria-label={`${t(favorite ? '取消收藏' : '收藏')} · ${t(GAMES[kind].name)}`} aria-pressed={favorite} onClick={() => onToggleFavorite(kind)}><Star size={18} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true"/></button>
            </div>; })}
            {!visible.length && <div className="library-empty"><Star size={24} aria-hidden="true"/><strong role="status">{t(favoritesOnly ? favorites.length === 0 ? '还没有收藏游戏' : '没有符合人数的收藏' : '没有符合人数的游戏')}</strong><button type="button" className="text-button" onClick={emptyActionClick}>{t(emptyAction)}</button></div>}
        </section>
    </>;
}
