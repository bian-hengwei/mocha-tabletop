import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {mahjong,type Tile,type MahjongMode} from '../../src/core/games/mahjong';
import {ClassicTable} from '../../src/ui/ClassicTable';
import {ActionSheet} from '../../src/ui/Boards';
import {t,useLocale,setLocale} from '../../src/i18n';
import type {Action,Command} from '../../src/core/types';
import '../../src/ui/style.css';
const params=new URLSearchParams(location.search),scenario=params.get('scenario')||'hu',players=['Alex','Blair','Casey','Drew'].map((name,i)=>({id:`fixture-${i}`,name:params.has('long')?name+' Long Mahjong Player':name,avatar:'🐶'}));
const tiles=(values:number[],prefix='t'):Tile[]=>values.map((value,i)=>({id:`${prefix}${i}`,value}));
const waiting=[0,1,2,3,4,5,9,10,11,12,13,14,6];
function initial(){const mode=(params.get('mode')||'guangdong') as MahjongMode,s=mahjong.create(players,11,{mahjongMode:mode});if(scenario==='opening')return s;s.phase='discard';if(['sichuan','bloodflow','bloodflowAny','bloodflowThree','redBloodflow','redBattle'].includes(mode))s.missing={0:2,1:2,2:2,3:2};
 if(scenario==='quick'){s.hands=[tiles([...waiting,26],'a'),...['b','c','d'].map(p=>tiles(waiting,p))];}
 if(scenario==='remote'){s.hands=[tiles(waiting,'a'),tiles([...waiting,26],'b'),tiles(waiting,'c'),tiles(waiting,'d')];s.current=1;}
 if(scenario==='hu')s.hands[0]=tiles([...waiting,6]);
 if(scenario==='kong')s.hands[0]=tiles([6,6,6,6,0,1,2,3,4,5,9,10,11,12]);
 if(scenario==='rob'){s.hands[0]=tiles([6,0,1,2,3,4,5,9,10,11,12]);s.melds[0]=[{type:'pong',tiles:tiles([6,6,6],'m'),from:2}];s.hands[1]=tiles(waiting,'b');}
 if(scenario==='claims'){s.hands[0]=tiles([6,0,1,2,3,4,5,9,10,11,12,13,14,18]);s.hands[1]=tiles(waiting,'b');s.hands[2]=tiles([6,6,6,0,1,2,3,4,5,9,10,11,12],'c');}
 if(scenario==='dense'){s.discards=players.map((_,i)=>tiles(Array.from({length:24},(_,j)=>(i*7+j)%27),'river'+i));s.melds[1]=[{type:'pong',tiles:tiles([22,22,22],'meld'),from:2}];s.melds[2]=[{type:'concealed',tiles:tiles([31,31,31,31],'hidden'),from:2}];s.hands[0]=tiles([...waiting,6]);s.won=[0];s.selfWon=true;s.wins=[{player:0,from:0,tile:s.hands[0].at(-1)!,points:6,selfDraw:true}];}
 if(scenario==='max-melds'){s.hands=players.map((_,i)=>tiles([3,4],`hand${i}`));s.melds=players.map((_,i)=>Array.from({length:4},(_,j)=>({type:'pong' as const,tiles:tiles([j,j,j],`meld${i}-${j}`),from:(i+1)%4})));s.discards=players.map((_,i)=>tiles(Array.from({length:24},(_,j)=>j%27),`river${i}`));}
 if(scenario==='not-ready'){s.hands[0]=tiles([0,2,4,6,8,9,11,13,15,17,18,20,22,24]);}
 if(scenario==='exhausted'){s.hands[0]=tiles(waiting);s.current=1;s.discards[2]=tiles([0,0,0,3,3,3,6,6,6],'seen');}
 if(scenario==='wide-waits'){s.hands[0]=tiles([33,33,33,33,0,1,2,9,10,11,18,19,20]);s.current=1;}
 if(params.has('statuses'))s.won=[0,3];
 if(params.has('large'))s.scores=[1073741824,-536870912,-268435456,-268435456];
 if(scenario==='wall')s.wall=s.wall.slice(-3);
 if(scenario==='drawn-low'){s.hands[0]=tiles([4,5,6,7,8,9,10,11,12,13,14,15,16,0]);}
 if(scenario==='long-names')s.players=s.players.map(p=>({...p,name:p.name+' very long player name 超长玩家昵称'}));
 s.drawn=s.hands[s.current].at(-1)!.id;return s;}
function Fixture(){const locale=useLocale();const [state,setState]=useState(initial),[seat,setSeat]=useState(0),[selection,setSelection]=useState<Action|null>(null),[error,setError]=useState('');const view=mahjong.view(state,players[seat].id),command=(c:Command)=>{try{setState(mahjong.apply(state,players[seat].id,c));setError('');}catch(e){setError(String(e));}};return <main className="app in-game game-mahjong"><header className="topbar"><b>{t('麻将')}</b><select aria-label="Seat" value={seat} onChange={e=>{setSeat(Number(e.target.value));setSelection(null);}}>{players.map((p,i)=><option key={i} value={i}>{p.name}{mahjong.view(state,p.id).actions.length?' *':''}</option>)}</select>{scenario==='remote'&&<button onClick={()=>setState(mahjong.apply(state,players[state.current].id,{action:'discard',values:[state.hands[state.current].at(-1)!.id]}))}>Remote discard</button>}<button aria-label="Toggle language" onClick={()=>setLocale(locale==='zh'?'en':'zh')}>{locale==='zh'?'English':'中文'}</button></header><div className="game-surface"><ClassicTable view={view} selfID={players[seat].id} command={command} open={a=>setSelection(a)}/></div>{error&&<div role="alert">{error}</div>}{selection&&<ActionSheet action={selection} selected={[]} view={view} onClose={()=>setSelection(null)} onSubmit={command}/>}</main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
