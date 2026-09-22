import {useCallback,useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import type {PokerCard,PokerTablePlay} from '../core/games/poker';
import {PokerArt} from './ClassicCardArt';
import {t} from '../i18n';

type FlyingCard={card:PokerCard;x:number;y:number;width:number;height:number};
type Flight={key:string;player:number;serial:number;label:string;left:number;top:number;width:number;height:number;fromX:number;fromY:number;viaX:number;viaY:number;tilt:number;cards:FlyingCard[]};
export const pokerFlightKey=(round:number,play:PokerTablePlay)=>`${round}:${play.player}:${play.serial}`;

/** Snapshot public card geometry after the authoritative view renders. No private cards are copied. */
export function usePokerPlayMotion(arena:RefObject<HTMLDivElement|null>,plays:PokerTablePlay[],round:number,selfID:string){
 const [flights,setFlights]=useState<Flight[]>([]);
 const previous=useRef({round,selfID,serial:Math.max(0,...plays.map(p=>p.serial))});
 const finish=useCallback((key:string)=>setFlights(old=>old.filter(f=>f.key!==key)),[]);
 useLayoutEffect(()=>{
  const last=previous.current,serial=Math.max(0,...plays.map(p=>p.serial));previous.current={round,selfID,serial};
  if(last.round!==round||last.selfID!==selfID||serial<last.serial){setFlights([]);return;}
  const table=arena.current;if(!table||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const rect=table.getBoundingClientRect(),created:Flight[]=[];
  for(const play of plays.filter(p=>p.serial>last.serial&&p.cards.length&&p.combo)){
   const pile=table.querySelector<HTMLElement>(`.poker-seat-play[data-serial="${play.serial}"]`),rail=pile?.querySelector<HTMLElement>('.played-scroll');
   if(!pile||!rail)continue;
   const target=rail.getBoundingClientRect(),seat=[...table.querySelectorAll<HTMLElement>('.classic-seat')].find(s=>s.dataset.player===pile.dataset.player),source=seat?.getBoundingClientRect();
   const own=pile.dataset.player===selfID;
   const x=own?rect.width/2:source?source.left-rect.left+source.width/2:rect.width/2;
   const y=own?rect.height+25:source?source.top-rect.top+source.height/2:20;
   const left=target.left-rect.left-table.clientLeft,top=target.top-rect.top-table.clientTop,width=target.width,height=target.height;
   const cards=[...rail.querySelectorAll<HTMLElement>('.classic-face')].flatMap((el,i)=>{const r=el.getBoundingClientRect();return r.right>target.left&&r.left<target.right?[{card:play.cards[i],x:r.left-target.left,y:r.top-target.top,width:r.width,height:r.height}]:[];});
   // Travel through a readable central pose; short landscape stays inside its shallow arena.
   const focusY=rect.height<240?rect.height*.68:rect.height*.48;
   const viaX=rect.width/2-left-width/2,viaY=Math.max(height*.7,Math.min(focusY,rect.height-height*.7))-top-height/2;
   created.push({key:pokerFlightKey(round,play),player:play.player,serial:play.serial,label:play.combo!.type,left,top,width,height,fromX:x-left-width/2,fromY:y-top-height/2,viaX,viaY,tilt:own?-8:x<rect.width/2?-14:14,cards});
  }
  if(created.length)setFlights(old=>[...old.filter(f=>!created.some(n=>n.player===f.player)),...created].slice(-4));
 },[arena,plays,round,selfID]);
 useEffect(()=>{
  const cancel=()=>setFlights([]),media=matchMedia('(prefers-reduced-motion:reduce)');window.addEventListener('resize',cancel);media.addEventListener('change',cancel);
  return()=>{window.removeEventListener('resize',cancel);media.removeEventListener('change',cancel);};
 },[]);
 return{flights,finish};
}

function FlyingPlay({flight,onDone}:{flight:Flight;onDone:(key:string)=>void}){
 const ref=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const element=ref.current;if(!element)return;let live=true;
  const transform=(x:number,y:number,scale:number,rotation:number)=>`translate(${x}px,${y}px) scale(${scale}) rotate(${rotation}deg)`;
  const animation=element.animate([
   {offset:0,opacity:0,easing:'cubic-bezier(.25,0,.3,1)',transform:transform(flight.fromX,flight.fromY,.45,flight.tilt)},
   {offset:.16,opacity:1,easing:'cubic-bezier(.15,.65,.3,1)',transform:transform(flight.fromX*.82+flight.viaX*.18,flight.fromY*.82+flight.viaY*.18,.72,flight.tilt*.6)},
   {offset:.40,opacity:1,transform:transform(flight.viaX,flight.viaY,1.28,-flight.tilt*.12)},
   {offset:.56,opacity:1,easing:'cubic-bezier(.4,0,.25,1)',transform:transform(flight.viaX,flight.viaY,1.28,0)},
   {offset:.9,opacity:1,transform:transform(0,-3,1.035,0)},
   {offset:1,opacity:1,transform:transform(0,0,1,0)}
  ],{duration:900,easing:'linear',fill:'both'});
  animation.finished.then(()=>{if(live)onDone(flight.key);},()=>{});
  return()=>{live=false;animation.cancel();};
 },[flight,onDone]);
 return <div ref={ref} className="poker-flight" data-flight={flight.key} style={{left:flight.left,top:flight.top,width:flight.width,height:flight.height}}>
  <span className="poker-flight-label">{t(flight.label)}</span><span className="poker-flight-glow"/>
  <div className="poker-flight-cards">{flight.cards.map(({card,x,y,width,height},i)=><span className="poker-flight-card" key={card.id} style={{left:x,top:y,width,height,animationDelay:`${Math.min(i,7)*18}ms`}}><PokerArt rank={card.rank} suit={card.suit}/></span>)}</div>
 </div>;
}
export function PokerPlayMotion({flights,finish}:ReturnType<typeof usePokerPlayMotion>){return <div className="poker-motion-layer" aria-hidden="true">{flights.map(f=><FlyingPlay key={f.key} flight={f} onDone={finish}/>)}</div>;}
