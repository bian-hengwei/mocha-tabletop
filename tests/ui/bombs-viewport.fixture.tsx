import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {bombs,BOMB_TITLES,type BombCard,type BombKind} from '../../src/core/games/bombs';
import {BombsTable} from '../../src/ui/BombsTable';
import {t,useLocale,setLocale} from '../../src/i18n';
import '../../src/ui/style.css';
const players=Array.from({length:5},(_,i)=>({id:`p${i}`,name:['Alex','Blair','Casey','Drew','Ellie'][i],avatar:['🦊','🐼','🐱','🐻','🐰'][i]}));
const scenario=new URLSearchParams(location.search).get('scenario')||'turn';
const card=(kind:BombKind,id:string=kind):BombCard=>({kind,id,title:BOMB_TITLES[kind]});
function initial(){let s=bombs.create(players,9);s.hands.p0=['defuse','attack','skip','favor','shuffle','future','nope','moonCat'].map(k=>card(k as BombKind));const combo=[card('moonCat','cat1'),card('moonCat','cat2'),card('moonCat','cat3')];s.hands.p0.push(...combo);s.deck=[card('bomb','deck-bomb'),...s.deck];
 if(scenario==='target')s.phase={kind:'target',cards:[card('favor')]};
 if(scenario==='request')s.phase={kind:'request',cards:combo,target:'p1'};
 if(scenario==='response'){s.hands.p1=[card('attack','blair-attack'),card('nope','blair-nope')];s.current='p1';s=bombs.apply(s,'p1',{action:'play',values:['blair-attack']});}
 if(scenario==='give')s.phase={kind:'give',actor:'p1',target:'p0'};
 if(scenario==='future')s.phase={kind:'future',cards:s.deck.slice(0,3)};
 if(scenario==='bomb')s.phase={kind:'bomb',card:card('bomb')};
 if(scenario==='insert')s.phase={kind:'insert',card:card('bomb')};
 if(scenario==='finished'){s.alive=['p0'];s.hands.p1=[];}
 return s;
}
function Fixture(){const [state,setState]=useState(initial),[viewer,setViewer]=useState('p0'),locale=useLocale();return <main className="app in-game game-bombs"><header className="topbar"><b>{t('喵喵危机')}</b><div className="top-tools"><select aria-label="Seat" value={viewer} onChange={e=>setViewer(e.target.value)}>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button onClick={()=>setLocale(locale==='zh'?'en':'zh')}>{locale==='zh'?'English':'中文'}</button></div></header><div className="game-surface"><BombsTable view={bombs.view(state,viewer)} selfID={viewer} command={c=>setState(s=>bombs.apply(s,viewer,c))}/></div></main>}
createRoot(document.getElementById('root')!).render(<Fixture/>);
