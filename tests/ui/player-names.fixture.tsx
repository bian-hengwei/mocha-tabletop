import {avalon} from '../../src/core/games/avalon';
import {standardWerewolf} from '../../src/core/games/werewolf';
import {werewolfHosted} from '../../src/core/games/werewolfHosted';
import {formatGameText} from '../../src/ui/gameText';
import {useDialog} from '../../src/ui/useDialog';
import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {modules} from '../../src/core/registry';
import {GAMES,type GameKind,type Action} from '../../src/core/types';
import {setLocale,useLocale} from '../../src/i18n';
import {GemsTable} from '../../src/ui/GemsTable';
import {BombsTable} from '../../src/ui/BombsTable';
import {SocialTable} from '../../src/ui/SocialTable';
import {NewGamesTable} from '../../src/ui/NewGamesTable';
import {WordGamesTable} from '../../src/ui/WordGamesTable';
import {ActionSheet} from '../../src/ui/Boards';
import '../../src/ui/style.css';
const params=new URLSearchParams(location.search),kind=(params.get('kind')||'avalon') as GameKind,scenario=params.get('scenario'),names=['梅林','UNO爱好者','同意','🌻'];
const players=Array.from({length:Math.max(4,GAMES[kind].min)+(scenario==='judge'?1:0)},(_,i)=>({id:`name-player-${i}`,name:names[i%names.length],avatar:'🦊'}));
const game=modules[kind].create(players,111,scenario==='judge'?{werewolfMode:'judge',moderatorID:players[0].id}:{language:'en'});
function Fixture(){useLocale();const [action,setAction]=useState<Action|null>(null),view=modules[kind].view(game,players[0].id);
 if(scenario==='judge'){view.board.stage=params.get('stage')||'dawn';view.board.moderatorOnly.pendingDeaths=players.slice(1,5).map(p=>p.id);view.board.moderatorOnly.checks=[{target:players[2].id,result:'好人'}];view.board.moderatorOnly.knife=players[3].id;}
 if(scenario==='identity')view.board.ownKnowledge=[{id:'evil',title:'邪恶玩家',detail:names.join('、')},{id:'check:'+players[0].id,title:names[0],detail:'好人'}];
 if(kind==='bombs'){view.board.current=players[2].id;view.board.phase='turn';view.actions=[];}
 const props={view,selfID:players[0].id,command:()=>{},open:(a:Action)=>setAction(a)};
 return <main className={`app in-game game-${kind}`}><header className="topbar"><button onClick={()=>setLocale(params.get('lang')==='zh'?'zh':'en')}>Set language</button><button onClick={()=>setAction({id:'test-target',title:'选择目标',choices:[...players.map(p=>({id:p.id,title:p.name})),{id:'system-confirm',title:'同意'}],min:1,max:1})}>Player choices</button></header><div className="game-surface">{kind==='gems'?<GemsTable {...props}/>:kind==='bombs'?<BombsTable {...props}/>:kind==='werewolf'||kind==='avalon'?<SocialTable {...props}/>:kind==='codenames'||kind==='undercover'?<WordGamesTable {...props}/>:<NewGamesTable {...props}/>}</div>{action&&<ActionSheet action={action} view={{...view,actions:[action]}} selected={[]} onSubmit={()=>{}} onClose={()=>setAction(null)}/>}</main>;
}
createRoot(document.getElementById('root')!).render(scenario?.startsWith('structured-')?<StructuredFixture/>:<Fixture/>);

function structuredViews(){
 const named=['梅林；红队','{votes}','同意','🌻','UNO爱好者','甲','乙'];
 const people=Array.from({length:scenario==='structured-avalon'?5:scenario==='structured-hosted'?7:6},(_,i)=>({id:`structured-player-${i}`,name:named[i],avatar:'🦊'}));
 if(scenario==='structured-avalon'){
  let state=avalon.create(people,19);const leader=people[state.leader].id,proposal=avalon.view(state,leader).actions[0];
  state=avalon.apply(state,leader,{action:proposal.id,values:people.slice(0,proposal.min).map(p=>p.id)});
  for(const [i,person]of people.entries())state=avalon.apply(state,person.id,{action:'approve',values:[i%2?'no':'yes']});
  return {view:avalon.view(state,people[0].id),selfID:people[0].id};
 }
 if(scenario==='structured-plans'){
  let state=standardWerewolf.create(people,1);
  for(let seed=1;seed<=1000;seed++){state=standardWerewolf.create(people,seed);if(state.roles[people[0].id]==='wolf'&&state.roles[people[1].id]==='wolf')break;}
  if(state.roles[people[0].id]!=='wolf'||state.roles[people[1].id]!=='wolf')throw Error('No deterministic two-wolf setup');
  state=standardWerewolf.apply(state,people[0].id,{action:'wolf',values:['skip']});
  state=standardWerewolf.apply(state,people[1].id,{action:'wolf',values:[people[0].id]});
  return {view:standardWerewolf.view(state,people[0].id),otherView:standardWerewolf.view(state,people[2].id),selfID:people[0].id};
 }
 // The moderator is a separate final seat; both unusual names are actual players.
 const moderator=people.at(-1)!.id,target=people[Number(params.get('target')||0)].id;
 let state=werewolfHosted.create(people,23,{werewolfMode:'judge',moderatorID:moderator});
 for(let step=0;step<10&&state.stage!=='day'&&!state.winner;step++){
  const action=werewolfHosted.view(state,moderator).actions[0];
  if(!action)throw Error(`Missing moderator action at ${state.stage}`);
  const value=action.id==='judge-wolves'?target:action.id==='judge-dawn'?'confirm':'skip';
  state=werewolfHosted.apply(state,moderator,{action:action.id,values:[value]});
 }
 return {view:werewolfHosted.view(state,moderator),otherView:werewolfHosted.view(state,people[0].id),selfID:moderator};
}
function StructuredFixture(){
 const locale=useLocale(),[{view,otherView,selfID}]=useState(structuredViews),[other,setOther]=useState(false),[log,setLog]=useState<'public'|'private'|null>(null);
 const active=other&&otherView?otherView:view,panel=useDialog<HTMLElement>(!!log,()=>setLog(null));
 const source=log==='private'?active.board.moderatorOnly:active;
 return <main className="app in-game game-werewolf"><header className="topbar"><button onClick={()=>setLocale(locale==='zh'?'en':'zh')}>Toggle language</button><button onClick={()=>setLog('public')}>Public log</button>{active.board.moderatorOnly&&<button onClick={()=>setLog('private')}>Private log</button>}{otherView&&<button onClick={()=>setOther(!other)}>Switch viewer</button>}</header><div className="game-surface"><SocialTable view={active} selfID={other?'structured-player-2':selfID} open={()=>{}} command={()=>{}}/></div>{log&&<div className="modal-shade"><section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Game log" className="panel"><header><h2>Game log</h2><button onClick={()=>setLog(null)}>Close log</button></header><ol className="game-log">{source.log.slice().reverse().map((line:string,i:number)=><li key={i}>{formatGameText(line,source.logText?.[source.log.length-1-i])}</li>)}</ol></section></div>}</main>;
}
