import {ClassicTable} from '../../src/ui/ClassicTable';
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
import {bombs} from '../../src/core/games/bombs';
import {century} from '../../src/core/games/century';
import {gems} from '../../src/core/games/gems';
import {WordGamesTable} from '../../src/ui/WordGamesTable';
import {NewGamesTable} from '../../src/ui/NewGamesTable';
import {ActionSheet,ActionDock} from '../../src/ui/Boards';
const params=new URLSearchParams(location.search),kind=(params.get('kind')||'gems') as GameKind;
const players=Array.from({length:params.get("players")==="max"?GAMES[kind].max:kind==='uno'&&params.get("players")==="10"?10:params.get("scenario")==="challenge"?3:GAMES[kind].min},(_,i)=>({id:`english-player-${i}`,name:['Alex','Blair','Casey','Drew','Eli','Frank','Grace','Hayden','Indigo','Jules'][i]||`Player ${i+1}`,avatar:['🦊','🐼','🐱','🐻'][i%4]}));
function initialGame(){
 if(kind==='gems'&&params.get('scenario')==='empty-tier'){
  const state=modules.gems.create(players,11);state.market[0]=[];state.decks[0]=[];return state;
 }
 if(kind==='century'&&params.get('scenario')==='order-inspection'){
  const state=century.create(players,11);
  state.caravans[0].cubes=[2,1,0,0];
  state.caravans[0].played=state.caravans[0].hand;state.caravans[0].hand=[];
  state.goals=[{id:'order-short',cost:[3,1,1,1],points:14},{id:'order-ready',cost:[2,1,0,0],points:7}];
  return state;
 }
 if(kind==='guandan'&&params.get('scenario')==='spectator-lead'){
  const state=modules.guandan.create(players,11);state.phase='play';state.current=1;state.hands[0]=[];state.order=[0];state.last=null;return state;
 }
 if((kind==='doudizhu'||kind==='guandan')&&params.get('scenario')==='played-single'){
  const state=modules[kind].create(players,11);state.phase='play';state.current=0;if(kind==='doudizhu')state.landlord=0;state.level=Number(params.get('level')||2);
  const rank=Number(params.get('rank')||12);
  state.hands[0]=[{id:'caption-played',rank,suit:rank>=16?4:0},{id:'caption-retained',rank:3,suit:2}];
  return modules[kind].apply(state,players[0].id,{action:'play',values:['caption-played']});
 }

 if(kind==='gems'&&['bank-scarce','bank-one','bank-no-pair','bank-full-hand'].includes(params.get('scenario')||'')){
  const state=gems.create(players,11),scenario=params.get('scenario');
  const bank=scenario==='bank-scarce'?[0,2,1,0,0,5]:scenario==='bank-one'?[0,0,0,3,0,5]:scenario==='bank-no-pair'?[3,3,3,3,3,5]:[5,5,5,5,5,5];
  if(scenario==='bank-full-hand')state.merchants[0].tokens=state.bank.map((n,i)=>n-bank[i]);
  else{let seat=0;state.bank.forEach((n,color)=>{for(let token=bank[color];token<n;token++)state.merchants[seat++%players.length].tokens[color]++;});}
  state.bank=bank;
  return state;
 }
 if(kind==='gems'&&params.get('scenario')==='inspection'){
  const state=gems.create(players,11);
  state.merchants[0].reserved.push(...state.market[0].splice(0,3));
  state.merchants[0].bought.push(state.decks[0].pop()!);
  const other=state.decks[0].pop()!;state.merchants[1].reserved.push(other);state.merchants[1].publicReserved=[other.id];
  return state;
 }
 if(kind==='gems'&&params.get('scenario')==='payment'){
  const state=gems.create(players,11);state.merchants[0].tokens[5]=5;state.bank[5]=0;
  const buy=gems.view(state,players[0].id).actions.find(a=>a.id==='buy')!;
  return gems.apply(state,players[0].id,{action:'buy',values:[buy.choices[0].id]});
 }

 if(kind==='century'&&params.get('scenario')==='table-dense'){
  const state=century.create(players,11);
  state.market.forEach(slot=>{slot.bonus=[1,1,1,1];});
  state.caravans[0].hand.push(...state.deck.splice(0,20));
  state.caravans[0].played.push(...state.deck.splice(0,10));
  return state;
 }
 if(kind==='sushi'&&params.get('scenario')==='full-plates'){const state=modules.sushi.create(players,11);state.table=players.map((_,i)=>Array.from({length:9},(_,j)=>({id:`plate-${i}-${j}`,kind:(['tempura','sashimi','dumpling','maki1','maki2','maki3','egg','salmon','squid'] as const)[j]})));return state;}
 if(kind==='sushi'&&params.get('scenario')==='chopsticks'){const state=modules.sushi.create(players,11);state.table[0]=[{id:'table-chopsticks',kind:'chopsticks'}];state.hands[0]=[{id:'wasabi-first',kind:'wasabi'},{id:'squid-second',kind:'squid'},...state.hands[0].slice(2)];return state;}
 if(kind==='bombs'&&params.get('scenario')==='combo'){const state=bombs.create(players,11);state.hands[players[0].id]=[{id:'skip-a',kind:'skip',title:'跳过'},{id:'skip-b',kind:'skip',title:'跳过'},{id:'attack-a',kind:'attack',title:'攻击'},...state.hands[players[0].id].filter(c=>c.kind==='nope')];return state;}

 if((kind==='guandan'||kind==='doudizhu')&&params.get('scenario')==='response-feedback'){
  const state=modules[kind].create(players,11);state.phase='play';state.current=0;state.landlord=0;state.bid=1;state.level=5;
  if(kind==='guandan'){state.levels=[2,5];state.round=2;}
  state.hands[1]=state.hands[1].slice(0,1);
  state.hands[0]=[7,7,8,9,9,9,9,3].map((rank,i)=>({id:`response-${i}`,rank,suit:[0,2,0,0,1,2,3,0][i]}));
  state.last={player:1,cards:[0,2].map(suit=>({id:`previous-${suit}`,rank:kind==='guandan'?5:10,suit})),combo:{type:'对子',power:kind==='guandan'?17:10,size:2,bomb:0}};
  return state;
 }
 if(kind==='guandan'&&params.get('scenario')==='declare'){const state=modules.guandan.create(players,11);state.hands[0]=[5,6,7,8,9,3].map((rank,i)=>({id:`declare-${i}`,rank,suit:0}));return state;}
 if(kind==='uno'&&params.get('scenario')==='call'){let state=uno.create(players,11);state.current=0;state.phase='play';state.color='red';state.drawn=null;state.hands[0]=[{id:'call-red',color:'red',value:2},{id:'last-blue',color:'blue',value:7}];state.discard=[{id:'top-red',color:'red',value:1}];return uno.apply(state,players[0].id,{action:'play',values:['call-red']});}
 if(kind==='uno'&&params.get('scenario')==='no-match'){
  const state=uno.create(players,11);state.current=0;state.phase='play';state.color='red';state.drawn=null;
  state.hands[0]=[{id:'blocked-blue-eight',color:'blue',value:8},{id:'blocked-green-nine',color:'green',value:9}];
  state.discard=[{id:'blocked-red-one',color:'red',value:1}];state.deck.push({id:'drawn-green-six',color:'green',value:6});return state;
 }

 if(kind==='uno'&&['selection','long-hand'].includes(params.get('scenario')||'')){
  const state=uno.create(players,11,{unoChallenge:params.get('challenge')!=='off'});state.current=0;state.phase='play';state.color='red';state.drawn=null;
  state.hands[0]=[{id:'test-red-seven',color:'red',value:7},{id:'test-red-nine',color:'red',value:9},{id:'test-blue-eight',color:'blue',value:8},{id:'test-wild',color:'wild',value:'wild'},{id:'test-plus-four',color:'wild',value:'wild4'}];state.discard=[{id:'test-red-one',color:'red',value:1}];if(params.get('scenario')==='long-hand')state.hands[0].push(...state.deck.splice(0,23));if(params.get('waiting')==='1')state.current=1;return state;
 }

 if(kind==='uno'&&params.get('scenario')==='challenge'){
  let state=uno.create(players,11);state.current=0;state.phase='play';state.color='red';state.drawn=null;
  state.hands[0]=[{id:'test-plus-four',color:'wild',value:'wild4'},{id:'test-red-seven',color:'red',value:7},{id:'test-blue-nine',color:'blue',value:9}];state.discard=[{id:'test-red-one',color:'red',value:1}];
  state=uno.apply(state,players[0].id,{action:'wild:test-plus-four',values:['blue']});return uno.apply(state,players[1].id,{action:'challenge4',values:[]});
 }
 return modules[kind].create(players,11,{language:params.get('words')==='zh'?'zh':'en'});
}
function Fixture(){const locale=useLocale(),[game,setGame]=useState(initialGame),[viewer,setViewer]=useState(players[params.get("scenario")==="challenge"?1:0].id),[selection,setSelection]=useState<{a:Action;values:string[]}|null>(null);const view=modules[kind].view(game,viewer),command=(c:Command)=>setGame(modules[kind].apply(game,viewer,c)),open=(a:Action,values:string[]=[])=>setSelection({a,values});const props={view,selfID:viewer,command,open};return <main className={`app in-game game-${kind}`}><header className="topbar"><div className="brand"><b>{t(GAMES[kind].name)}</b></div><div className="top-tools"><select aria-label="Seat" value={viewer} onChange={e=>{setViewer(e.target.value);setSelection(null);}}>{players.map(p=><option value={p.id} key={p.id}>{p.name}{modules[kind].view(game,p.id).actions.length?' *':''}</option>)}</select><button className="compact" aria-label="Toggle language" onClick={()=>setLocale(locale==='en'?'zh':'en')}>{locale==='en'?'中文':'English'}</button></div></header><div className="game-surface">{['doudizhu','guandan','mahjong'].includes(kind)?<ClassicTable {...props}/>:kind==='gems'?<GemsTable {...props}/>:kind==='bombs'?<BombsTable {...props}/>:kind==='avalon'||kind==='werewolf'?<SocialTable {...props}/>:kind==="codenames"||kind==="undercover"?<WordGamesTable {...props}/>:<NewGamesTable {...props}/>}</div>{['gems','avalon','werewolf'].includes(kind)&&<ActionDock {...props}/>} {selection&&<ActionSheet action={selection.a} selected={selection.values} view={view} onClose={()=>setSelection(null)} onSubmit={command}/>}</main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
