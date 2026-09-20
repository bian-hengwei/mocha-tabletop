import {SocialTable} from '../../src/ui/SocialTable';
// Test-only Vite entry; excluded from index.html and production build.
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SocialBoard,ActionDock,ActionSheet} from '../../src/ui/Boards';
import {werewolf} from '../../src/core/games/werewolf';
import {avalon} from '../../src/core/games/avalon';
import {AVATARS,type Action} from '../../src/core/types';
import '../../src/ui/style.css';
function Fixture(){
  const isAvalon=new URLSearchParams(location.search).get('kind')==='avalon';
  const players=Array.from({length:isAvalon?10:18},(_,i)=>({id:`p${i}`,name:`玩家${i+1}`,avatar:AVATARS[i%AVATARS.length]}));
  const s=isAvalon?avalon.create(players,17):werewolf.create(players,17);
  if(isAvalon){s.stage='propose';(s as any).leader=0;}else{s.stage='vote';(s as any).electionPending=false;}
  const view=(isAvalon?avalon:werewolf).view(s as any,'p0');
  const [selection,setSelection]=useState<{a:Action;values:string[]}|null>(null);
  const open=(a:Action,values:string[]=[])=>setSelection({a,values});
  return <main className={`app in-game game-${view.kind}`}><header className="topbar"><div className="brand"><div><b>{isAvalon?'阿瓦隆':'狼人杀'}</b><small>{view.phase}</small></div></div></header><div className="game-surface"><SocialTable view={view} selfID="p0" open={open} command={()=>{}}/></div><ActionDock view={view} open={open} command={()=>{}}/>{selection&&<ActionSheet action={selection.a} selected={selection.values} view={view} onClose={()=>setSelection(null)} onSubmit={()=>setSelection(null)}/>}</main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
