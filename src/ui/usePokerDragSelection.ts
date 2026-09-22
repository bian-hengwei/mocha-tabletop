import {useEffect,useRef,useState,type RefObject,type Dispatch,type SetStateAction} from 'react';

/** Touch swipes scroll normally. Holding before moving paints a selection instead. */
export function usePokerDragSelection(rail:RefObject<HTMLDivElement|null>,selected:string[],setSelected:Dispatch<SetStateAction<string[]>>,choices:string[],max:number,resetKey:string){
 const selection=useRef(selected);selection.current=selected;
 const [dragging,setDragging]=useState(false);
 const choiceKey=choices.join('|');
 useEffect(()=>{
  const node=rail.current;if(!node||max<=1)return;
  const allowed=new Set(choices);
  let gesture:{id:string;x:number;y:number;touch:boolean;active:boolean;remove:boolean;seen:Set<string>}|null=null;
  let timer:ReturnType<typeof setTimeout>|undefined,suppressUntil=0;
  const cardAt=(x:number,y:number)=>{
   const target=document.elementFromPoint(x,y)?.closest<HTMLButtonElement>('[data-poker-card]');
   return target&&node.contains(target)&&!target.disabled?target.dataset.pokerCard:undefined;
  };
  const paint=(id:string)=>{
   if(!gesture||gesture.seen.has(id)||!allowed.has(id))return;gesture.seen.add(id);
   const remove=gesture.remove;
   setSelected(old=>remove?old.filter(c=>c!==id):old.includes(id)||old.length>=max?old:[...old,id]);
  };
  const activate=()=>{if(!gesture)return;gesture.active=true;setDragging(true);paint(gesture.id);};
  const finish=()=>{clearTimeout(timer);if(gesture?.active)suppressUntil=performance.now()+500;gesture=null;setDragging(false);};
  const down=(event:PointerEvent)=>{
   if(!event.isPrimary||event.button!==0)return;const id=cardAt(event.clientX,event.clientY);if(!id)return;
   finish();gesture={id,x:event.clientX,y:event.clientY,touch:event.pointerType!=='mouse',active:false,remove:selection.current.includes(id),seen:new Set()};
   if(gesture.touch)timer=setTimeout(activate,260);
  };
  const move=(x:number,y:number)=>{
   if(!gesture)return;
   if(!gesture.active){if(Math.hypot(x-gesture.x,y-gesture.y)<6)return;if(gesture.touch){finish();return;}activate();}
   // Sample the segment so fast mouse drags do not skip narrow cards.
   const steps=Math.max(1,Math.ceil(Math.hypot(x-gesture.x,y-gesture.y)/8));
   for(let i=1;i<=steps;i++){const id=cardAt(gesture.x+(x-gesture.x)*i/steps,gesture.y+(y-gesture.y)*i/steps);if(id)paint(id);}
   gesture.x=x;gesture.y=y;
  };
  const pointerMove=(event:PointerEvent)=>{if(gesture&&!gesture.touch)move(event.clientX,event.clientY);};
  const touchMove=(event:TouchEvent)=>{
   if(!gesture?.touch)return;if(event.touches.length!==1){finish();return;}
   if(gesture.active)event.preventDefault();
   move(event.touches[0].clientX,event.touches[0].clientY);
  };
  const touchStart=(event:TouchEvent)=>{if(event.touches.length>1)finish();};
  const click=(event:Event)=>{if(performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();suppressUntil=0;}};
  const contextMenu=(event:Event)=>{if(gesture){event.preventDefault();}};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')finish();};
  node.addEventListener('pointerdown',down);window.addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);
  node.addEventListener('touchmove',touchMove,{passive:false});node.addEventListener('touchstart',touchStart,{passive:true});node.addEventListener('click',click,true);node.addEventListener('contextmenu',contextMenu);
  window.addEventListener('keydown',key);window.addEventListener('blur',finish);window.addEventListener('resize',finish);
  return()=>{clearTimeout(timer);node.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);node.removeEventListener('touchmove',touchMove);node.removeEventListener('touchstart',touchStart);node.removeEventListener('click',click,true);node.removeEventListener('contextmenu',contextMenu);window.removeEventListener('keydown',key);window.removeEventListener('blur',finish);window.removeEventListener('resize',finish);setDragging(false);};
 },[rail,setSelected,choiceKey,max,resetKey]);
 return dragging;
}
