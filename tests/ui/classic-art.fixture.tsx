import '../../src/ui/classic-table.css';
import {createRoot} from 'react-dom/client';
import {MahjongArt,PokerArt} from '../../src/ui/ClassicCardArt';
import {tileTitle} from '../../src/core/games/mahjong';
function Gallery(){return <main style={{padding:30,maxWidth:1200,margin:'auto'}}><h1>Mocha · classic card collection</h1><section style={{display:'grid',gridTemplateColumns:'repeat(17,1fr)',gap:9}}>{Array.from({length:34},(_,value)=><div key={value} title={tileTitle(value)}><MahjongArt value={value}/></div>)}</section><section style={{display:'grid',gridTemplateColumns:'repeat(13,1fr)',gap:9,marginTop:35}}>{[0,1,2,3].flatMap(suit=>Array.from({length:13},(_,i)=><div key={`${suit}-${i}`}><PokerArt rank={i+3} suit={suit}/></div>))}<PokerArt rank={16}/><PokerArt rank={17}/><PokerArt back/><MahjongArt back/></section></main>;}
createRoot(document.getElementById('root')!).render(<Gallery/>);
