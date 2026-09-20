import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {modules} from '../../src/core/registry';
import {GAMES,type GameKind,type Action,type Command} from '../../src/core/types';
import {t,useLocale,setLocale} from '../../src/i18n';
import '../../src/ui/style.css';
import {GemsTable} from '../../src/ui/GemsTable';
import {BombsTable} from '../../src/ui/BombsTable';
import {SocialTable} from '../../src/ui/SocialTable';
import {uno} from '../../src/core/games/uno';
import {WordGamesTable} from '../../src/ui/WordGamesTable';
import {NewGamesTable} from '../../src/ui/NewGamesTable';
import {ActionSheet,ActionDock} from '../../src/ui/Boards';
const params=new URLSearchParams(location.search),kind=(params.get('kind')||'gems') as GameKind;
const players=Array.from({length:params.get("scenario")==="challenge"?3:GAMES[kind].min},(_,i)=>({id:`english-player-${i}`,name:['Alex','Blair','Casey','Drew','Eli','Frank','Grace','Hayden','Indigo','Jules'][i],avatar:['🦊','🐼','🐱','🐻'][i%4]}));
function initialGame(){
 if(kind==='uno'&&params.get('scenario')==='no-match'){
  const state=uno.create(players,11);state.current=0;state.phase='play';state.color='red';state.drawn=null;
  state.hands[0]=[{id:'blocked-blue-eight',color:'blue',value:8},{id:'blocked-green-nine',color:'green',value:9}];
  state.discard=[{id:'blocked-red-one',color:'red',value:1}];state.deck.push({id:'drawn-green-six',color:'green',value:6});return state;
 }

 if(kind==='uno'&&params.get('scenario')==='selection'){
  const state=uno.create(players,11,{unoChallenge:params.get('challenge')!=='off'});state.current=0;state.phase='play';state.color='red';state.drawn=null;
  state.hands[0]=[{id:'test-red-seven',color:'red',value:7},{id:'test-red-nine',color:'red',value:9},{id:'test-blue-eight',color:'blue',value:8},{id:'test-wild',color:'wild',value:'wild'},{id:'test-plus-four',color:'wild',value:'wild4'}];state.discard=[{id:'test-red-one',color:'red',value:1}];return state;
 }

 if(kind==='uno'&&params.get('scenario')==='challenge'){
  let state=uno.create(players,11);state.current=0;state.phase='play';state.color='red';state.drawn=null;
  state.hands[0]=[{id:'test-plus-four',color:'wild',value:'wild4'},{id:'test-red-seven',color:'red',value:7},{id:'test-blue-nine',color:'blue',value:9}];state.discard=[{id:'test-red-one',color:'red',value:1}];
  state=uno.apply(state,players[0].id,{action:'wild:test-plus-four',values:['blue']});return uno.apply(state,players[1].id,{action:'challenge4',values:[]});
 }
 return modules[kind].create(players,11,{language:params.get('words')==='zh'?'zh':'en'});
}
function Fixture(){const locale=useLocale(),[game,setGame]=useState(initialGame),[viewer,setViewer]=useState(players[params.get("scenario")==="challenge"?1:0].id),[selection,setSelection]=useState<{a:Action;values:string[]}|null>(null);const view=modules[kind].view(game,viewer),command=(c:Command)=>setGame(modules[kind].apply(game,viewer,c)),open=(a:Action,values:string[]=[])=>setSelection({a,values});const props={view,selfID:viewer,command,open};return <main className={`app in-game game-${kind}`}><header className="topbar"><div className="brand"><b>{t(GAMES[kind].name)}</b></div><div className="top-tools"><select aria-label="Seat" value={viewer} onChange={e=>{setViewer(e.target.value);setSelection(null);}}>{players.map(p=><option value={p.id} key={p.id}>{p.name}{modules[kind].view(game,p.id).actions.length?' *':''}</option>)}</select><button className="compact" aria-label="Toggle language" onClick={()=>setLocale(locale==='en'?'zh':'en')}>{locale==='en'?'中文':'English'}</button></div></header><div className="game-surface">{kind==='gems'?<GemsTable {...props}/>:kind==='bombs'?<BombsTable {...props}/>:kind==='avalon'||kind==='werewolf'?<SocialTable {...props}/>:kind==="codenames"||kind==="undercover"?<WordGamesTable {...props}/>:<NewGamesTable {...props}/>}</div>{['gems','avalon','werewolf'].includes(kind)&&<ActionDock {...props}/>} {selection&&<ActionSheet action={selection.a} selected={selection.values} view={view} onClose={()=>setSelection(null)} onSubmit={command}/>}</main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
