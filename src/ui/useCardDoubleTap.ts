import {useEffect,useRef,type MouseEvent,type PointerEvent} from 'react';
/** Pointer clicks select normally; a rapid repeat on the same card is a shortcut. */
export function useCardDoubleTap(context:string){
 const last=useRef<{id:string;time:number}|null>(null),touch=useRef(false);
 useEffect(()=>{last.current=null;touch.current=false;},[context]);
 return {
  onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>{touch.current=event.pointerType==='touch';},
  isDoubleTap:(id:string,event:MouseEvent<HTMLButtonElement>)=>{
   const now=performance.now(),previous=last.current;
   const repeat=previous?.id===id&&(touch.current?now-previous.time<=320:event.detail===2);
   last.current=repeat?null:{id,time:now};touch.current=false;
   return !!repeat;
  }
 };
}
