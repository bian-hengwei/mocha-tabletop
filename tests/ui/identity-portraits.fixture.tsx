import { createRoot } from 'react-dom/client';
import { SocialTable } from '../../src/ui/SocialTable';
import { avalon } from '../../src/core/games/avalon';
import { standardWerewolf } from '../../src/core/games/werewolf';
import { setLocale } from '../../src/i18n';
import '../../src/ui/style.css';
const params = new URLSearchParams(location.search);
const kind = params.get('kind') === 'avalon' ? 'avalon' : 'werewolf';
const role = params.get('role') || (kind === 'avalon' ? 'merlin' : 'seer');
setLocale(params.get('language') === 'en' ? 'en' : 'zh');
const players = Array.from({ length: kind === 'avalon' ? 10 : ['idiot','wolfKing'].includes(role) ? 12 : 18 }, (_, i) => ({
  id: `portrait-${i}`, name: params.has('long') ? `远征队的第${i + 1}位伙伴名字很长` : `玩家 ${i + 1}`, avatar: '🦊'
}));
const module = kind === 'avalon' ? avalon : standardWerewolf;
const state = module.create(players, 91, kind==='werewolf'&&['idiot','wolfKing'].includes(role)?{werewolfPreset:role as 'idiot'|'wolfKing'}:undefined);
const viewer = players.find(p => state.roles[p.id] === role)!.id;
// Exercise a real seer's late-game journal as well as newly dealt role cards.
if (params.has('long') && 'investigations' in state) state.investigations = Object.fromEntries(players.filter(p => p.id !== viewer).map(p => [p.id, state.roles[p.id] === 'wolf' ? '狼人' : '好人']));
const view = module.view(state as never, viewer);
createRoot(document.getElementById('root')!).render(<main className={`app in-game game-${kind}`}><header className="topbar"><b>Identity portrait review</b></header><div className="game-surface"><SocialTable view={view} selfID={viewer} open={() => {}} command={() => {}}/></div></main>);
