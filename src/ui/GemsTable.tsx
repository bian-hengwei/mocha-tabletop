import { useEffect, useState, type CSSProperties } from 'react';
import { Check, Crown, Layers3, LockKeyhole, ShoppingBag, X } from 'lucide-react';
import type { Action, Command, GameView } from '../core/types';
import { GEM_COLORS } from '../core/games/gems';
import { CardArt, GemArt, GEM_NAMES, GEM_TONES } from './Art';
import './gems-table.css';
type Props={view:GameView;selfID:string;command:(c:Command)=>void;open:(a:Action,values?:string[])=>void};
export function GemCost({values}:{values:number[]}){return <div className="g-cost">{values.map((n,i)=>n>0&&<span key={i} aria-label={`${GEM_NAMES[i]} ${n}`}><GemArt color={i}/><b>{n}</b></span>)}</div>;}
export function DevelopmentCard({card,onClick,mini=false}:{card:any;onClick?:()=>void;mini?:boolean}){
 const color=GEM_COLORS.indexOf(card.bonus);
 return <button className={`development-card ${mini?'mini':''}`} onClick={onClick} aria-label={`${GEM_NAMES[color]} ${card.points} 分，费用 ${card.cost.map((n:number,i:number)=>n?`${GEM_NAMES[i]}${n}`:'').filter(Boolean).join('，')||'免费'}`} style={{'--gem-tone':GEM_TONES[color]} as CSSProperties}><CardArt card={card}/><div className="development-top"><b>{card.points||''}</b><GemArt color={color}/></div><GemCost values={card.cost}/></button>;
}
function StockNumbers({tokens,bonuses}:{tokens:number[];bonuses:number[]}){return <div className="stock-numbers" aria-label="宝石库存与已购牌数量">{tokens.map((n,i)=><div key={i}><GemArt color={i}/><b aria-label={`${GEM_NAMES[i]} ${n}枚`}>{n}</b>{i<5?<span aria-label={`${GEM_NAMES[i]}卡 ${bonuses[i]}张`}><Layers3/>{bonuses[i]}</span>:<span className="gold-placeholder"/>}</div>)}</div>;}
export function GemsTable({view,selfID,command,open}:Props){
 const b=view.board,own=b.players.find((p:any)=>p.id===selfID);
 const [picked,setPicked]=useState<number[]>([]),[card,setCard]=useState<any>(null),[merchantID,setMerchantID]=useState<string|null>(null);
 const merchant=b.players.find((p:any)=>p.id===merchantID);
 const distinct=view.actions.find(a=>a.id==='take_distinct'),pair=view.actions.find(a=>a.id==='take_pair');
 const isPair=picked.length===2&&picked[0]===picked[1];
 const selectedAction=isPair?pair:distinct;
 const selectionValid=!!selectedAction&&(isPair||picked.length===selectedAction.min&&new Set(picked).size===picked.length);
 useEffect(()=>{setPicked([]);setCard(null);},[b.current,b.phase,selfID]);
 const choose=(i:number)=>{
  if(!distinct?.choices.some(c=>c.id===GEM_COLORS[i]))return;
  setPicked(old=>{
   if(old.length===1&&old[0]===i&&pair?.choices.some(c=>c.id===GEM_COLORS[i]))return [i,i];
   if(old.includes(i))return old.filter(x=>x!==i);
   if(old.length===2&&old[0]===old[1])return [old[0],i];
   return old.length<(distinct?.max||3)?[...old,i]:[...old.slice(1),i];
  });
 };
 const actFor=(action:string,c:any)=>view.actions.find(a=>a.id===action&&a.choices.some(x=>x.id===c.id));
 const reserve=view.actions.find(a=>a.id==='reserve');
 return <div className="g-table">
  <div className="g-merchants">{b.players.map((p:any)=><button className={`g-merchant ${p.id===b.current?'active':''}`} key={p.id} aria-label={`查看 ${p.name} 的公开库存`} onClick={()=>setMerchantID(p.id)}><div className="merchant-head"><span>{p.avatar}</span><b>{p.name}{p.id===selfID?' · 我':''}</b><strong><Crown/>{p.score}</strong><small title="已购牌"><Layers3/>{p.bought.length}</small><small title="预留牌"><LockKeyhole/>{p.reservedCount}</small><small title="贵族"><Crown/>{p.nobles.length}</small></div><StockNumbers tokens={p.tokens} bonuses={p.bonuses}/></button>)}</div>
  <div className="g-playfield"><aside className="g-nobles" aria-label="贵族">{b.nobles.map((n:any,i:number)=><button className="g-noble" key={n.id} aria-label={`贵族 ${i+1}，3分，${n.cost.map((v:number,c:number)=>v?`${GEM_NAMES[c]}卡${v}张`:'').filter(Boolean).join('，')}`} onClick={()=>{const a=view.actions.find(a=>a.id==='noble');if(a?.choices.some(c=>c.id===n.id))open(a,[n.id]);}}><Crown/><b>3</b><GemCost values={n.cost}/></button>)}</aside>
   <div className="g-market">{[3,2,1].map(t=><div className="g-market-row" key={t}><button className={`g-deck level-${t}`} aria-label={`预留 ${t} 级盲牌`} disabled={!reserve?.choices.some(c=>c.id===`deck:${t}`)} onClick={()=>reserve?.choices.some(c=>c.id===`deck:${t}`)&&open(reserve,[`deck:${t}`])}><Layers3/><span>{'•'.repeat(t)}</span><small>{b.decks[t-1]}</small></button>{b.market.filter((c:any)=>c.tier===t).map((c:any)=><DevelopmentCard key={c.id} card={c} onClick={()=>setCard(c)}/>)}</div>)}</div>
   <aside className="g-bank"><div className="g-bank-gems">{b.bank.map((n:number,i:number)=>{const count=picked.filter(x=>x===i).length;return <button key={i} className={`g-bank-gem ${count?'selected':''} ${n===0?'empty':''}`} aria-label={`${GEM_NAMES[i]} ${n} 枚${count?`，已选${count}枚`:''}`} disabled={i===5||!distinct?.choices.some(c=>c.id===GEM_COLORS[i])} onClick={()=>choose(i)}><GemArt color={i}/><b>{n}</b>{count>0&&<span className="gem-picked">{count}</span>}</button>;})}</div><div className="g-take"><button className="compact primary" disabled={!selectionValid} onClick={()=>{if(selectedAction){command({action:selectedAction.id,values:isPair?[GEM_COLORS[picked[0]]]:picked.map(i=>GEM_COLORS[i])});setPicked([]);}}}><Check size={14}/>{picked.length?`拿取 ${picked.length}`:'拿取'}</button>{picked.length>0&&<button className="icon" aria-label="清空宝石选择" onClick={()=>setPicked([])}><X size={14}/></button>}</div></aside>
  </div>
  <div className="g-own-tray"><button className="g-own-stock" aria-label="查看我的全部库存" onClick={()=>setMerchantID(selfID)}><span>我的库存</span><StockNumbers tokens={own.tokens} bonuses={own.bonuses}/></button><div className="g-reserved"><span><LockKeyhole size={12}/>{b.hand.length}/3</span>{b.hand.map((c:any)=><DevelopmentCard key={c.id} card={c} mini onClick={()=>setCard(c)}/>)}</div>{b.payment&&<div className="g-payment" aria-label="待购买的发展牌和自动支付筹码"><ShoppingBag size={15}/>{b.payment.auto.every((n:number)=>n===0)?<span className="g-free-payment">免费</span>:<GemCost values={b.payment.auto}/>}<DevelopmentCard card={b.payment.card} mini onClick={()=>setCard(b.payment.card)}/></div>}</div>
  {card&&<div className="modal-shade" onClick={()=>setCard(null)}><section className="g-card-inspector" role="dialog" aria-label="发展牌" onClick={e=>e.stopPropagation()}><button className="icon close" aria-label="关闭牌面" onClick={()=>setCard(null)}><X/></button><DevelopmentCard card={card}/><div className="g-card-buttons">{(['buy','reserve'] as const).map(id=>{const a=actFor(id,card);return a&&<button key={id} className="compact primary" onClick={()=>{command({action:id,values:[card.id]});setCard(null);}}>{id==='buy'?<ShoppingBag size={16}/>:<LockKeyhole size={16}/>} {id==='buy'?'购买':'预留'}</button>;})}</div></section></div>}
  {merchant&&<div className="modal-shade" onClick={()=>setMerchantID(null)}><section className="g-inventory panel" role="dialog" aria-label={`${merchant.name} 的公开库存`} onClick={e=>e.stopPropagation()}><header><h2>{merchant.avatar} {merchant.name}</h2><span className="inventory-score"><Crown size={17}/>{merchant.score}</span><button className="icon" aria-label="关闭公开库存" onClick={()=>setMerchantID(null)}><X/></button></header><div className="inventory-body"><div className="inventory-summary"><h3>宝石库存</h3><StockNumbers tokens={merchant.tokens} bonuses={merchant.bonuses}/><h3>预留牌 <small>{merchant.reservedCount}/3</small></h3><div className="inventory-reserved">{(merchant.id===selfID?b.hand.map((c:any)=>({public:true,card:c,id:c.id,tier:c.tier})):merchant.reservedCards||[]).map((r:any)=>r.public?<DevelopmentCard key={r.id} card={r.card} onClick={()=>{setCard(r.card);setMerchantID(null);}}/>:<div className="g-hidden-card" key={r.id}><LockKeyhole size={20}/><span>{'•'.repeat(r.tier)}</span></div>)}{merchant.reservedCount===0&&<span className="inventory-empty">—</span>}</div><div className="inventory-nobles"><h3>贵族 <small>{merchant.nobles.length}</small></h3>{merchant.nobles.map((n:any)=><div className="g-noble" key={n.id}><Crown/><b>3</b><GemCost values={n.cost}/></div>)}</div></div><div className="inventory-purchases"><h3>已购牌 <small>{merchant.bought.length}</small></h3><div className="purchased-columns">{GEM_COLORS.slice(0,5).map((color,i)=><div key={color}><header><GemArt color={i}/><b>{merchant.bonuses[i]}</b></header>{merchant.bought.filter((c:any)=>c.bonus===color).map((c:any)=><DevelopmentCard key={c.id} card={c} mini onClick={()=>{setCard(c);setMerchantID(null);}}/>)}</div>)}</div></div></div></section></div>}
 </div>;
}
