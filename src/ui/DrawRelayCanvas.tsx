import {useEffect,useLayoutEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {decodeRelayStroke,encodeRelayStroke,RELAY_COLORS,RELAY_MAX_POINTS,RELAY_WIDTHS,type RelayPoint} from '../core/games/drawrelay';
import {t} from '../i18n';

type Props={strokes:string[];enabled?:boolean;onStroke?:(encoded:string)=>void;color?:number;width?:number};

function sample(points:RelayPoint[],limit:number){return points.length<=limit?points:Array.from({length:limit},(_,i)=>points[Math.round(i*(points.length-1)/(limit-1))]);}
function StrokePath({points,color,width}:{points:RelayPoint[];color:number;width:number}){
 if(!points.length)return null;
 const same=points.every(([x,y])=>x===points[0][0]&&y===points[0][1]);
 if(same)return <circle cx={points[0][0]} cy={points[0][1]} r={Math.max(2,RELAY_WIDTHS[width]/2)} fill={RELAY_COLORS[color]}/>;
 return <polyline points={points.map(point=>point.join(',')).join(' ')} stroke={RELAY_COLORS[color]} strokeWidth={RELAY_WIDTHS[width]} fill="none" strokeLinecap="round" strokeLinejoin="round"/>;
}
function Stroke({encoded}:{encoded:string}){const {color,width,points}=decodeRelayStroke(encoded);return <StrokePath points={points} color={color} width={width}/>;}

export function DrawRelayCanvas({strokes,enabled=false,onStroke,color=0,width=1}:Props){
 const svg=useRef<SVGSVGElement>(null),points=useRef<RelayPoint[]>([]),pointer=useRef<number|null>(null),draftColor=useRef(color),frame=useRef<number|null>(null),previousStrokeCount=useRef(strokes.length);
 const [preview,setPreview]=useState<RelayPoint[]>([]),[cursor,setCursor]=useState<RelayPoint|null>(null);
 const refresh=()=>{if(frame.current!==null)return;frame.current=requestAnimationFrame(()=>{frame.current=null;setPreview([...points.current]);});};
 const discard=()=>{const id=pointer.current;pointer.current=null;points.current=[];if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}setPreview([]);if(id!==null&&svg.current?.hasPointerCapture(id))svg.current.releasePointerCapture(id);};
 useLayoutEffect(()=>{if(!enabled||strokes.length<previousStrokeCount.current)discard();previousStrokeCount.current=strokes.length;},[enabled,strokes.length]);
 useEffect(()=>{const hidden=()=>{if(document.hidden)discard();};window.addEventListener('blur',discard);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('blur',discard);document.removeEventListener('visibilitychange',hidden);discard();};},[]);
 const position=(event:PointerEvent<SVGSVGElement>):RelayPoint=>{const matrix=event.currentTarget.getScreenCTM();if(!matrix)return [0,0];const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return [Math.round(Math.max(0,Math.min(1023,p.x))),Math.round(Math.max(0,Math.min(767,p.y)))];};
 const append=(point:RelayPoint)=>{const previous=points.current.at(-1);if(previous?.[0]===point[0]&&previous?.[1]===point[1])return;if(points.current.length>=512)points.current=sample(points.current,256);points.current.push(point);};
 const finish=(event:PointerEvent<SVGSVGElement>)=>{if(pointer.current!==event.pointerId)return;if(!enabled){discard();return;}append(position(event));const stroke=sample(points.current,RELAY_MAX_POINTS),strokeColor=draftColor.current;discard();if(stroke.length)onStroke?.(encodeRelayStroke(stroke,strokeColor,width));};
 const keyboard=(event:KeyboardEvent<SVGSVGElement>)=>{if(!enabled||pointer.current!==null)return;const current=cursor||[512,384] as RelayPoint,delta:Record<string,RelayPoint>={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};if(event.key==='Enter'||event.key===' '){event.preventDefault();onStroke?.(encodeRelayStroke([current],color,width));setCursor(current);return;}const change=delta[event.key];if(!change)return;event.preventDefault();const next:RelayPoint=[Math.max(0,Math.min(1023,current[0]+change[0])),Math.max(0,Math.min(767,current[1]+change[1]))];setCursor(next);onStroke?.(encodeRelayStroke([current,next],color,width));};
 return <svg ref={svg} className={`relay-canvas ${enabled?'editable':''}`} viewBox="0 0 1023 767" role="img" aria-label={t('接龙画板')} aria-description={enabled?t('方向键作画，回车落点'):undefined} tabIndex={enabled?0:undefined} onKeyDown={keyboard} onBlur={discard} onPointerDown={event=>{if(!enabled||pointer.current!==null||event.button!==0||!event.isPrimary)return;event.preventDefault();event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);pointer.current=event.pointerId;draftColor.current=color;points.current=[position(event)];refresh();}} onPointerMove={event=>{if(pointer.current!==event.pointerId)return;if(event.pointerType==='mouse'&&!(event.buttons&1)){discard();return;}append(position(event));refresh();}} onPointerUp={finish} onPointerCancel={event=>{if(pointer.current===event.pointerId)discard();}} onLostPointerCapture={event=>{if(pointer.current===event.pointerId)discard();}}>
  <rect width="1023" height="767" fill="#fff"/>{strokes.map((encoded,index)=><Stroke key={`${index}:${encoded}`} encoded={encoded}/>)}<StrokePath points={preview} color={draftColor.current} width={width}/>{enabled&&cursor&&<circle cx={cursor[0]} cy={cursor[1]} r="12" fill="none" stroke="#658793" strokeWidth="3" strokeDasharray="5 4"/>}
 </svg>;
}
