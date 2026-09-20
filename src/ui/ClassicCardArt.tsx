import {useId} from 'react';

const RED='#a93238', INK='#233c3e', GREEN='#26715a', BLUE='#28557c';
const suits=[
 'M0-12C-3-7-12-3-12 3c0 7 8 9 11 4-1 6-3 7-5 8H6C3 14 1 13 1 7c4 5 11 3 11-4C12-3 3-7 0-12Z',
 'M0 12C-3 8-12 2-12-5c0-9 10-11 12-3 3-8 12-6 12 3C12 2 3 8 0 12Z',
 'M-1 6c-4 7-12 2-11-4 1-5 5-7 9-4-6-6-1-14 5-11 5 2 5 8 1 11 7-4 13 3 8 8-3 3-7 2-10 0 0 6 2 7 5 8H-6c3-1 5-3 5-8Z',
 'M0-14 11 0 0 14-11 0Z',
];
function Suit({suit,x,y,size=1,flip=false}:{suit:number;x:number;y:number;size?:number;flip?:boolean}){
 return <path d={suits[suit]} transform={`translate(${x} ${y}) scale(${size})${flip?' rotate(180)':''}`} fill={suit%2?RED:INK}/>;
}
const pips:Record<number,number[][]>={
 2:[[50,38],[50,102]],3:[[50,36],[50,70],[50,104]],
 4:[[32,36],[68,36],[32,104],[68,104]],5:[[32,36],[68,36],[50,70],[32,104],[68,104]],
 6:[[32,36],[68,36],[32,70],[68,70],[32,104],[68,104]],
 7:[[32,34],[68,34],[50,51],[32,70],[68,70],[32,106],[68,106]],
 8:[[32,34],[68,34],[50,52],[32,70],[68,70],[50,88],[32,106],[68,106]],
 9:[[32,30],[68,30],[32,56],[68,56],[50,70],[32,84],[68,84],[32,110],[68,110]],
 10:[[32,28],[68,28],[50,42],[32,55],[68,55],[32,85],[68,85],[50,98],[32,112],[68,112]],
};
function Court({rank,suit}:{rank:number;suit:number}){
 const color=suit%2?RED:BLUE;
 const half=<g>
  <path d="M24 68 28 52 43 45H58L73 57 77 71Z" fill={color} stroke={INK} strokeWidth="1"/>
  <path d="m28 52 16 4 14-11 7 7-15 18H32Z" fill="#c9a660"/>
  <path d="m32 54 9 8m-11 0 9 8m23-16 6 8" stroke="#f6e4ba" strokeWidth="1.5"/>
  <path d="M40 29c-7 7-3 22 4 24h12c8-5 10-22 1-27Z" fill="#d5b580" stroke={INK}/>
  <path d="M43 29v17l7 3 8-6V29" fill="#efd8ab"/>
  <path d="m44 35 4 1m6-1 4-1M51 36l-1 7 4-1m-8 4 8 1" fill="none" stroke={INK} strokeWidth="1.3"/>
  {rank===13?<><path d="m36 29-3-12 10 5 7-10 7 10 10-5-4 12Z" fill="#cfad60" stroke={INK}/><path d="m44 48 2 11 7 4 6-16-7 5Z" fill={INK}/><path d="M70 36v29m-5-25h10" stroke="#d6b466" strokeWidth="3"/></>:rank===12?<><path d="M34 33c-2 9-1 18 5 24l6-6-6-23M61 27l3 28 6-3-3-19" fill={INK}/><path d="m36 29 1-12 8 5 5-11 6 11 7-5v12Z" fill="#cfad60" stroke={INK}/><path d="M70 47v19" stroke={GREEN} strokeWidth="2"/><g fill={RED} stroke="#d6b466"><circle cx="70" cy="42" r="5"/><circle cx="65" cy="46" r="4"/><circle cx="75" cy="46" r="4"/></g></>:<><path d="M34 28c0-14 26-17 32 0Z" fill={color} stroke={INK}/><path d="m53 20 10-13-1 13" fill="#d6b466"/><path d="M69 37v28" stroke={INK} strokeWidth="2"/><path d="m67 38 2-14 3 14Z" fill="#d6b466" stroke={INK}/></>}
  <path d="M25 69h50" stroke="#f6e4ba" strokeWidth="2"/>
 </g>;
 return <g><rect x="23" y="18" width="54" height="104" rx="3" fill="#f0e4c6" stroke="#cbb782"/>{half}<g transform="rotate(180 50 70)">{half}</g><Suit suit={suit} x={28} y={27} size={.3}/><Suit suit={suit} x={72} y={113} size={.3}/></g>;
}
function Jester({red}:{red:boolean}){
 const color=red?RED:BLUE;
 return <g>
  <path d="m24 97 13-19 26-1 16 20-28 21Z" fill={color} stroke={INK} strokeWidth="1.3"/>
  <path d="m26 96 14-5 11 14 13-15 13 7-26 18Z" fill="#cda95e"/>
  <path d="M31 55c-3 18 5 37 19 39 14-2 24-22 18-41Z" fill="#eedaba" stroke={INK}/>
  <path d="M31 65c-11-15-12-31-14-30 16-2 21 12 24 21-2-23 8-31 11-34 10 10 11 22 6 35 7-13 14-19 25-20-6 10-5 27-16 29Z" fill={color} stroke={INK} strokeWidth="1.2"/>
  <path d="m41 56 11-34c5 13 6 23 6 35Z" fill="#cda95e"/>
  <path d="M34 65q16-7 33 0" fill="none" stroke="#cda95e" strokeWidth="5"/>
  <path d="m38 72 7-3m12 0 6 3m-19 10q7 6 14-1m-7-11-3 7h5" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round"/>
  <g fill="#cda95e" stroke={INK}><circle cx="17" cy="35" r="4"/><circle cx="52" cy="22" r="4"/><circle cx="83" cy="37" r="4"/><circle cx="26" cy="97" r="3"/><circle cx="77" cy="97" r="3"/></g>
  <path d="m49 115 3 6 3-6" fill={color}/>
 </g>;
}
/** Original vector deck: complete pip arrangements, mirrored court figures and two jesters. */
export function PokerArt({rank,suit,back=false}:{rank?:number;suit?:number;back?:boolean}){
 const id=useId().replaceAll(':',''),r=rank||0,s=suit||0,label=r===14?'A':r===15?'2':r===11?'J':r===12?'Q':r===13?'K':String(r),joker=r>=16;
 return <svg className="classic-card-art poker-art" viewBox="0 0 100 140" aria-hidden="true" focusable="false" data-rank={r} data-suit={s}>
  <defs><linearGradient id={`${id}paper`} x2=".8" y2="1"><stop stopColor="#fffdf5"/><stop offset="1" stopColor="#e9e0c9"/></linearGradient><pattern id={`${id}weave`} width="12" height="12" patternUnits="userSpaceOnUse"><path d="m6 0 6 6-6 6-6-6Z" fill="none" stroke="#e8d4a3" strokeOpacity=".32" strokeWidth=".7"/></pattern></defs>
  <rect x="1" y="1" width="98" height="138" rx="8" fill={`url(#${id}paper)`} stroke="#d0c4a7"/>
  {back?<><rect x="5" y="5" width="90" height="130" rx="5" fill="#274e47"/><rect x="9" y="9" width="82" height="122" rx="3" fill={`url(#${id}weave)`} stroke="#d5be87"/><path d="m50 34 26 36-26 36-26-36Z" fill="#1b3d37" stroke="#d5be87"/><path d="m37 80 3-22 10 13 10-13 3 22" fill="none" stroke="#d5be87" strokeWidth="3"/><circle cx="50" cy="22" r="2" fill="#d5be87"/><circle cx="50" cy="118" r="2" fill="#d5be87"/></>:<>
   {joker?<Jester red={r===17}/>:r>=11&&r<=13?<Court rank={r} suit={s}/>:r===14?<><path d="M50 28 76 70 50 112 24 70Z" fill="none" stroke="#c6b385" strokeWidth=".7"/><Suit suit={s} x={50} y={70} size={1.8}/></>:(pips[r===15?2:r]||[]).map(([x,y],i)=><Suit key={i} suit={s} x={x} y={y} size={r>=8&&r<=10?.64:.76} flip={y>70}/>)}
   {[false,true].map(flip=><g key={String(flip)} transform={flip?'rotate(180 50 70)':undefined}>
    {joker?<><path d="m12 8 2 4 4 1-3 3 1 5-4-2-4 2 1-5-3-3 4-1Z" fill={r===17?RED:BLUE}/>{'JOKER'.split('').map((c,i)=><text key={i} x="12" y={31+i*9} fontSize="9" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="bold" fill={r===17?RED:INK}>{c}</text>)}</>:<><text x="13" y="24" textAnchor="middle" fontSize={label==='10'?21:24} fontFamily="Georgia,serif" fontWeight="bold" fill={s%2?RED:INK}>{label}</text><Suit suit={s} x={13} y={36} size={.42}/></>}
   </g>)}
  </>}
 </svg>;
}

// Hand-drawn engraved strokes. These are artwork, never translated UI labels.
const numbers=[
 'M11 20 40 18', 'M13 12 37 11M9 29 41 27', 'M13 8 37 7M16 21 35 20M9 34 42 32',
 'M9 7v29M10 8h31v28H10M20 9v15l-7 5M29 9v17h9',
 'M11 7h30M24 7l-7 29M13 20h23l-2 16M8 37h35',
 'M23 3l4 7M8 15h35M20 22 10 38M31 22l10 16',
 'M8 20 43 14M25 4l-1 29q0 7 15 3l2-7',
 'M19 8q-1 21-10 30M30 6q1 20 12 31',
 'M22 5q2 25-12 33M10 17l25-3-2 19q0 8 10 1l1-7',
];
const wan='M9 5h34M19 2v9M33 2v9M13 14h27v13H13ZM14 20h25M25 13v24M9 30v14M10 31h34v14l-6-1M17 36v5h19v-6';
const honors=[
 'M7 10h38M25 3v43M12 17h26v17H12ZM13 25h24M23 34 7 43M28 34l16 9',
 'M7 9h38M25 3v13M10 17h31v27l-6-1M17 23l3 5M34 23l-3 5M17 30h19M17 36h19M26 29v15',
 'M7 7h39M18 8v20l-7 7M32 8v23h9M9 16h34v27H9Z',
 'M22 5v37M8 15h13M7 36l13-6M31 5v33q1 7 12 1l1-5M32 22l11-10',
 '',
 'M7 8h14l-7 12M27 6l7 8 7-8M7 22l14-8M29 17l16 7M9 27h13l-2 17-9-1M9 35h11M28 25h14M29 25v8h13M30 33l10 12M41 34 26 44',
 'M9 13h33v21H9ZM25 3v43',
];
function Dot({x,y,color,r=6}:{x:number;y:number;color:string;r?:number}){return <g transform={`translate(${x} ${y})`}><circle r={r} fill={color}/><circle r={r*.66} fill="none" stroke="#f4ebd3" strokeWidth={r*.15}/><circle r={r*.23} fill="#f4ebd3"/></g>;}
const tilePositions:Record<number,number[][]>={1:[[36,46]],2:[[36,28],[36,64]],3:[[23,24],[36,46],[49,68]],4:[[23,28],[49,28],[23,64],[49,64]],5:[[23,25],[49,25],[36,46],[23,67],[49,67]],6:[[23,24],[49,24],[23,46],[49,46],[23,68],[49,68]],7:[[21,23],[36,32],[51,23],[24,50],[48,50],[24,70],[48,70]],8:[[23,20],[49,20],[23,37],[49,37],[23,55],[49,55],[23,72],[49,72]],9:[[20,23],[36,23],[52,23],[20,46],[36,46],[52,46],[20,69],[36,69],[52,69]]};
function Bamboo({x,y,color=GREEN}:{x:number;y:number;color?:string}){return <g transform={`translate(${x} ${y})`}><path d="M-3-7q3-3 6 0v14q-3 3-6 0Z" fill={color}/><path d="M-5-7H5M-4 0h8M-5 7H5" stroke={color} strokeWidth="2" strokeLinecap="round"/><path d="M-1-5v4m0 3v4" stroke="#c0d0a4" strokeWidth="1.1"/></g>;}
function Sparrow(){return <g strokeLinejoin="round"><path d="M34 38q-18 4-15 22l9 8-9 16 20-12q17-4 17-25L44 35Z" fill={GREEN} stroke="#1e5147" strokeWidth="1.2"/><path d="M31 47q-11 7-5 17 13 0 23-21-2 16-16 25" fill="#82a779" stroke="#f0e4b9"/><path d="m34 40-5-18 10-9 12 7-1 18-9 8Z" fill={BLUE}/><path d="m50 25 10 3-10 4" fill={RED}/><path d="M32 21q8-12 16-1" fill="none" stroke={RED} strokeWidth="5"/><circle cx="44" cy="25" r="2" fill="#f7ead3"/><circle cx="44" cy="25" r="1" fill={INK}/><path d="m31 68-2 7m9-8v8M16 79l37-7" fill="none" stroke="#af6247" strokeWidth="2"/></g>;}
/** All 34 traditional faces, with jade tile thickness and font-independent markings. */
export function MahjongArt({value,back=false}:{value?:number;back?:boolean}){
 const id=useId().replaceAll(':',''),v=value??0,n=v%9+1;
 return <svg className="classic-card-art mahjong-art" viewBox="0 0 72 100" aria-hidden="true" focusable="false" data-tile={value}>
  <defs><linearGradient id={`${id}tile`} x2=".7" y2="1"><stop stopColor="#fffef4"/><stop offset=".55" stopColor="#f4eedc"/><stop offset="1" stopColor="#d6cfb7"/></linearGradient><linearGradient id={`${id}jade`} x2="0" y2="1"><stop stopColor="#538f79"/><stop offset="1" stopColor="#184a3e"/></linearGradient></defs>
  <rect x="1" y="5" width="70" height="94" rx="9" fill={`url(#${id}jade)`} stroke="#123e32"/>
  <rect x="1" y="1" width="70" height="90" rx="9" fill={back?'#356c59':`url(#${id}tile)`} stroke="#b6b49e"/>
  <rect x="5" y="5" width="62" height="82" rx="6" fill="none" stroke={back?'#c9bb83':'#fffef7'} strokeOpacity=".8"/>
  {back?<><path d="m36 20 18 25-18 25-18-25Z" fill="none" stroke="#d4bf86"/><path d="m27 53 2-15 7 9 7-9 2 15" fill="none" stroke="#d4bf86" strokeWidth="2"/></>:v<9?<g strokeLinecap="round" strokeLinejoin="round" fill="none"><path d={numbers[n-1]} transform="translate(12 7) scale(.95 .75)" stroke={INK} strokeWidth="3.7"/><path d={wan} transform="translate(12 40) scale(.95 .87)" stroke={RED} strokeWidth="3"/></g>:v<18?<>{tilePositions[n].map(([x,y],i)=><Dot key={i} x={x} y={y} color={n===1?BLUE:n===2?GREEN:n===3?[BLUE,RED,GREEN][i]:n===5&&i===2?RED:n===7&&i<3?RED:n===9&&i>=3&&i<6?RED:i%2?BLUE:GREEN} r={n===1?20:n===2?10:n>=8?5.9:7.3}/>)}{n===1&&<g stroke="#f4ebd3" strokeWidth="1.4">{Array.from({length:8},(_,i)=><path key={i} d="M36 30v7" transform={`rotate(${i*45} 36 46)`}/>)}</g>}</>:v<27?n===1?<Sparrow/>:<>{tilePositions[n].map(([x,y],i)=><Bamboo key={i} x={x} y={y} color={n===7&&i<3||n===9&&i>=3&&i<6?RED:GREEN}/>)}</>:v===31?<><rect x="16" y="20" width="40" height="52" rx="2" fill="none" stroke={BLUE} strokeWidth="5"/><rect x="21" y="25" width="30" height="42" fill="none" stroke={BLUE} strokeWidth="1"/>{Array.from({length:5},(_,i)=><path key={i} d={`M14 ${25+i*10}h6m32 0h6`} stroke="#f4ebd3" strokeWidth="2"/>)}</>:<path d={honors[v-27]} transform="translate(8 16) scale(1.12 1.3)" fill="none" stroke={v===32?GREEN:v===33?RED:INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>}
 </svg>;
}
