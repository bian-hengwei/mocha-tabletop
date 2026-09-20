import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ActionDock,ActionSheet} from '../../src/ui/Boards';
import {SocialTable} from '../../src/ui/SocialTable';
import {werewolf} from '../../src/core/games/werewolf';
import {avalon} from '../../src/core/games/avalon';
import {AVATARS,type Action,type Command,type GameOptions} from '../../src/core/types';
import '../../src/ui/style.css';
const params=new URLSearchParams(location.search),mode=params.get('mode')||'judge',n=Number(params.get('n')||18),isAvalon=mode==='avalon';
const players=Array.from({length:n+(mode==='judge'?1:0)},(_,i)=>({id:`p${i}`,name:mode==='judge'&&i===0?'法官':`玩家${i}`,avatar:AVATARS[i%AVATARS.length]}));
const module=isAvalon?avalon:werewolf;
function Fixture(){
 const [s,setS]=useState<any>(()=>{let state:any=module.create(players,111,{werewolfMode:mode as GameOptions['werewolfMode'],moderatorID:'p0'});if(isAvalon&&['approve','mission'].includes(params.get('stage')||'')){state=avalon.apply(state,players[state.leader].id,{action:'propose',values:players.slice(0,3).map(p=>p.id)});if(params.get('stage')==='mission')for(const player of players)state=avalon.apply(state,player.id,{action:'approve',values:['yes']});}if(params.get('stage')==='finished'){state.winner=isAvalon?'正义获胜 · 梅林幸存':'好人获胜';}return state;}),[viewer,setViewer]=useState('p0'),[selection,setSelection]=useState<{a:Action;values:string[]}|null>(null);
 const view=module.view(s,viewer),open=(a:Action,values:string[]=[])=>setSelection({a,values}),command=(cmd:Command)=>{setS(module.apply(s,viewer,cmd));setSelection(null);};
 return <main className={`app in-game game-${view.kind}`}><header className="topbar"><div className="brand"><div><b>{isAvalon?'阿瓦隆':'狼人杀'}</b><small>{view.phase}</small></div></div><select aria-label="切换测试座位" value={viewer} onChange={e=>{setViewer(e.target.value);setSelection(null);}}>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></header><div className="game-surface"><SocialTable key={viewer} view={view} selfID={viewer} open={open} command={command}/></div><ActionDock view={view} open={open} command={command}/>{selection&&<ActionSheet key={`${viewer}:${selection.a.id}`} action={selection.a} selected={selection.values} view={view} onClose={()=>setSelection(null)} onSubmit={command}/>}</main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
