import { useId } from 'react';

/** Small, unambiguous counters. The visible name beside each cube carries the color meaning. */
export function SpiceCube({ color }: { color: number }) {
 const tones = [['#f3d36c','#be882d','#f9e6a3'],['#da7271','#8d363f','#f1a69a'],['#98b37e','#486c4d','#c0d0a3'],['#b48c69','#6a4437','#d7b797']][color];
 return <svg className="ng-spice-cube" viewBox="0 0 30 32" aria-hidden="true"><path d="M15 2 28 9v15l-13 7L2 24V9Z" fill={tones[1]} stroke="#281e1c" strokeOpacity=".25"/><path d="m15 2 13 7-13 8L2 9Z" fill={tones[2]}/><path d="m2 9 13 8v14L2 24Z" fill={tones[0]}/><path d="m15 17 13-8v15l-13 7Z" fill={tones[1]}/><path d="m5 9 10-5 9 5M5 13v8" fill="none" stroke="white" strokeOpacity=".45" strokeWidth="1.2"/></svg>;
}

/** Original engraved deck design, independent of the printed UNO trade dress. */
export function ColorCardArt({ color, wild = false }: { color: string; wild?: boolean }) {
 const id=useId().replaceAll(':','');
 return <svg className="ng-color-art" viewBox="0 0 160 240" preserveAspectRatio="none" aria-hidden="true">
  <defs><linearGradient id={`${id}-ink`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={color}/><stop offset="1" stopColor="#112d35"/></linearGradient><radialGradient id={`${id}-paper`}><stop stopColor="#fff9df"/><stop offset="1" stopColor="#d9c7a2"/></radialGradient><pattern id={`${id}-grain`} width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 1h7M1 0v7" stroke="#fff" strokeOpacity=".035" strokeWidth=".6"/></pattern></defs>
  <rect width="160" height="240" rx="15" fill={`url(#${id}-ink)`}/><rect width="160" height="240" rx="15" fill={`url(#${id}-grain)`}/>
  <rect x="7" y="7" width="146" height="226" rx="10" fill="none" stroke="#f7e8c8" strokeOpacity=".65"/>
  <rect x="11" y="11" width="138" height="218" rx="7" fill="none" stroke="#f7e8c8" strokeOpacity=".2"/>
  <g stroke="#f7e8c8" strokeOpacity=".17" fill="none">{Array.from({length:12},(_,i)=><ellipse key={i} cx="80" cy="120" rx={25+i*5.8} ry={29+i*8} transform="rotate(28 80 120)"/>)}</g>
  <path d="m80 35 55 85-55 85-55-85Z" fill="#091f2c" fillOpacity=".18" stroke="#efd7aa" strokeOpacity=".55"/>
  <path d="M31 124c-8-51 21-79 55-63s59 74 36 111S42 183 31 124Z" fill={`url(#${id}-paper)`} stroke="#f6ebd2" strokeWidth="2"/>
  <path d="M37 123c-6-44 18-68 47-54s51 64 31 96S47 174 37 123Z" fill="none" stroke={color} strokeOpacity=".4" strokeWidth="1"/>
  {wild&&<g transform="translate(80 120)"><path d="M0-51A51 51 0 0 1 51 0H0Z" fill="#b75d59"/><path d="M51 0A51 51 0 0 1 0 51V0Z" fill="#567ca0"/><path d="M0 51A51 51 0 0 1-51 0H0Z" fill="#7b9970"/><path d="M-51 0A51 51 0 0 1 0-51V0Z" fill="#ccad54"/><circle r="36" fill={`url(#${id}-paper)`}/><circle r="50" fill="none" stroke="#f7e8c8" strokeWidth="2"/></g>}
  <g fill="#e8d8ac"><path d="m80 20 3 5-3 5-3-5ZM80 210l3 5-3 5-3-5Z"/><circle cx="21" cy="21" r="2"/><circle cx="139" cy="219" r="2"/></g>
 </svg>;
}
