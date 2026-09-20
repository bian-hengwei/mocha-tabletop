import {t} from '../i18n';
function tx<T>(value: T): T | string { return typeof value === 'string' ? t(value) : value; }
import { useId } from 'react';
const roleKeys = ['wolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'merlin', 'percival', 'morgana', 'assassin', 'loyal', 'evil'];
export function RoleArt({ role, className = '', align = 'center', fit = 'cover' }: {
    role: string;
    className?: string;
    align?: 'top' | 'center';
    fit?: 'cover' | 'contain';
}) {
    const clipID = useId().replace(/:/g, '');
    const aliases: Record<string, string> = { servant: 'loyal', minion: 'evil', moderator: 'seer' };
    const index = Math.max(0, roleKeys.indexOf(aliases[role] || role));
    const tile = index % 6;
    const expanded = role === 'idiot' || role === 'wolfKing';
    const x = expanded ? (role === 'idiot' ? 0 : 100) : tile % 3 * 100, y = expanded ? 0 : Math.floor(tile / 3) * 150;
    // Clip the sprite before fitting it: letterboxing must never reveal an
    // adjacent role from the shared illustration sheet.
    return <svg className={`role-art ${className}`} viewBox={`${x} ${y} 100 150`} preserveAspectRatio={`${align === 'top' ? 'xMidYMin' : 'xMidYMid'} ${fit === 'contain' ? 'meet' : 'slice'}`} aria-hidden="true"><defs><clipPath id={clipID}><rect x={x} y={y} width="100" height="150"/></clipPath></defs><image clipPath={`url(#${clipID})`} href={expanded ? '/art/roles-wolf-expanded-v1.jpg' : `/art/roles-${index < 6 ? 'wolf' : 'avalon'}-v2.jpg`} width={expanded ? 200 : 300} height={expanded ? 150 : 300}/></svg>;
}
export function CardArt({ card, className = '' }: {
    card: {
        id: string;
        tier: number;
    };
    className?: string;
}) {
    const tile = [...card.id].reduce((n, c) => n * 31 + c.charCodeAt(0), 0) >>> 0;
    const v = tile % 6;
    return <svg className={`development-art ${className}`} viewBox={`${v % 3 * 100} ${Math.floor(v / 3) * 75} 100 75`} preserveAspectRatio="xMidYMid slice" aria-hidden="true"><image href={`/art/cards-${card.tier}-v2.jpg`} width="300" height="150"/></svg>;
}
export const GEM_NAMES = ['白钻', '蓝宝石', '祖母绿', '红宝石', '黑玛瑙', '黄金'];
export const GEM_TONES = ['#f2eddd', '#70b9ee', '#54c99c', '#f08081', '#8893ad', '#f3c564'];
export function GemArt({ color, className = '' }: {
    color: number;
    className?: string;
}) {
    const id = useId().replace(/:/g, '');
    const tones = [['#ffffff', '#a2b6c7', '#d6e4eb'], ['#c0f0ff', '#125290', '#529bd8'], ['#baffd9', '#075744', '#37b388'], ['#ffd1c3', '#8b233f', '#e36a75'], ['#c8d3e3', '#20283e', '#69748d'], ['#fff0ad', '#99702a', '#e6af42']][color] || ['#fff', '#888', '#ccc'];
    const outline = ['12,22 24,10 40,10 52,22 32,54', '18,10 46,10 56,30 46,50 18,50 8,30', '18,8 46,8 53,18 53,46 46,54 18,54 11,46 11,18', '32,5 51,25 53,39 43,53 22,53 11,39 13,25', '22,7 44,7 56,27 48,49 32,57 14,48 8,26'][color];
    return <svg className={`gem-art ${className}`} viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={tones[0]}/><stop offset=".48" stopColor={tones[2]}/><stop offset="1" stopColor={tones[1]}/></linearGradient></defs>{tx(color === 5 ? <g stroke="#956a24" strokeWidth="1.5"><ellipse cx="32" cy="43" rx="24" ry="12" fill={tones[1]}/><path d="M8 35v8c0 16 48 16 48 0v-8" fill={tones[2]}/><ellipse cx="32" cy="35" rx="24" ry="12" fill={`url(#${id}g)`}/><ellipse cx="32" cy="34" rx="16" ry="7" fill="none"/><path d="m28 29 8 5-8 5" fill="none" stroke="#fff1b9" strokeWidth="3"/></g> : <g stroke={tones[0]} strokeOpacity=".35" strokeWidth=".8"><polygon points={outline} fill={`url(#${id}g)`}/><path d="M20 23 43 23 45 39 32 48 19 38Z" fill={tones[2]}/><path d="M20 23 32 14 43 23 32 30Z" fill={tones[0]} opacity=".7"/><path d="m32 30 13 9-13 9Z" fill={tones[1]} opacity=".65"/><path d="m20 23 12 7-13 8Z" fill={tones[0]} opacity=".28"/><path d="M12 22 20 23M24 10 32 14M40 10 43 23M52 22 43 23M32 54 32 48" fill="none"/><path d="m23 16 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z" fill="white" stroke="none" opacity=".75"/></g>)}</svg>;
}
