import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {mahjong,type Tile,type MahjongMode} from '../../src/core/games/mahjong';
import {ClassicTable} from '../../src/ui/ClassicTable';
import {ActionSheet} from '../../src/ui/Boards';
import {t,useLocale} from '../../src/i18n';
import type {Action,Command} from '../../src/core/types';
import '../../src/ui/style.css';
const params=new URLSearchParams(location.search),scenario=params.get('scenario')||'hu',players=['Alex','Blair','Casey','Drew'].map((name,i)=>({id:`fixture-${i}`,name,avatar:'🐶'}));
const tiles=(values:number[],prefix='t'):Tile[]=>values.map((value,i)=>({id:`${prefix}${i}`,value}));
const waiting=[0,1,2,3,4,5,9,10,11,12,13,14,6];
function initial(){const mode=(params.get('mode')||'guangdong') as MahjongMode,s=mahjong.create(players,11,{mahjongMode:mode});s.phase='discard';if(mode==='sichuan'||mode==='bloodflow')s.missing={0:2,1:2,2:2,3:2};
 if(scenario==='quick'){s.hands=[tiles([...waiting,26],'a'),...['b','c','d'].map(p=>tiles(waiting,p))];}
 if(scenario==='hu')s.hands[0]=tiles([...waiting,6]);
 if(scenario==='kong')s.hands[0]=tiles([6,6,6,6,0,1,2,3,4,5,9,10,11,12]);
 if(scenario==='rob'){s.hands[0]=tiles([6,0,1,2,3,4,5,9,10,11,12]);s.melds[0]=[{type:'pong',tiles:tiles([6,6,6],'m'),from:2}];s.hands[1]=tiles(waiting,'b');}
 if(scenario==='claims'){s.hands[0]=tiles([6,0,1,2,3,4,5,9,10,11,12,13,14,18]);s.hands[1]=tiles(waiting,'b');s.hands[2]=tiles([6,6,6,0,1,2,3,4,5,9,10,11,12],'c');}
 if(scenario==='dense'){s.discards=players.map((_,i)=>tiles(Array.from({length:24},(_,j)=>(i*7+j)%27),'river'+i));s.melds[1]=[{type:'pong',tiles:tiles([22,22,22],'meld'),from:2}];s.melds[2]=[{type:'concealed',tiles:tiles([31,31,31,31],'hidden'),from:2}];s.hands[0]=tiles([...waiting,6]);s.won=[0];s.selfWon=true;s.wins=[{player:0,from:0,tile:s.hands[0].at(-1)!,points:6,selfDraw:true}];}
 if(scenario==='wall')s.wall=s.wall.slice(-3);
 s.drawn=s.hands[0].at(-1)!.id;return s;}
function Fixture(){useLocale();const [state,setState]=useState(initial),[seat,setSeat]=useState(0),[selection,setSelection]=useState<Action|null>(null),[error,setError]=useState('');const view=mahjong.view(state,players[seat].id),command=(c:Command)=>{try{setState(mahjong.apply(state,players[seat].id,c));setError('');}catch(e){setError(String(e));}};return <main className="app in-game game-mahjong"><header className="topbar"><b>{t('麻将')}</b><select aria-label="Seat" value={seat} onChange={e=>{setSeat(Number(e.target.value));setSelection(null);}}>{players.map((p,i)=><option key={i} value={i}>{p.name}{mahjong.view(state,p.id).actions.length?' *':''}</option>)}</select></header><div className="game-surface"><ClassicTable view={view} selfID={players[seat].id} command={command} open={a=>setSelection(a)}/></div>{error&&<div role="alert">{error}</div>}{selection&&<ActionSheet action={selection} selected={[]} view={view} onClose={()=>setSelection(null)} onSubmit={command}/>}</main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
