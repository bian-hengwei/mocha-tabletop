import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {modules} from '../../src/core/registry';
import type {Action,Command,GameKind} from '../../src/core/types';
import {WordGamesTable} from '../../src/ui/WordGamesTable';
import {ActionSheet} from '../../src/ui/Boards';
import '../../src/ui/style.css';
const kind=(new URLSearchParams(location.search).get('kind')||'codenames') as GameKind;
const players=Array.from({length:kind==='codenames'?4:3},(_,index)=>({id:'word-player-'+index,name:['Alex','Blair','Casey','Drew'][index],avatar:['🦊','🐼','🐱','🐻'][index]}));
function Fixture(){
 const [game,setGame]=useState(()=>modules[kind].create(players,11,{language:'en'})),[viewer,setViewer]=useState(players[0].id),[selection,setSelection]=useState<{action:Action;values:string[]}|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[acknowledgements,setAcknowledgements]=useState(0);
 const view=modules[kind].view(game,viewer);
 // Model a socket command: sending returns immediately; success/failure arrives later.
 const command=(command:Command)=>{setError('');setPending(true);setTimeout(()=>{try{setGame(modules[kind].apply(game,viewer,command));}catch(error){setError((error as Error).message);}finally{setPending(false);setAcknowledgements(count=>count+1);}},100);};
 return <main data-viewer={viewer} className={`app in-game game-${kind}`}><header className="topbar"><select aria-label="Seat" value={viewer} onChange={event=>{setViewer(event.target.value);setSelection(null);}}>{players.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select><span data-testid="network-state" data-completed={acknowledgements}>{pending?'pending':'settled'}</span><span data-testid="network-error">{error}</span></header><div className="game-surface"><WordGamesTable view={view} selfID={viewer} command={command} open={(action,values=[])=>setSelection({action,values})}/></div>{selection&&<ActionSheet action={selection.action} selected={selection.values} view={view} onClose={()=>setSelection(null)} onSubmit={command}/>}</main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
