import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Check, ChevronRight, Crown, Eye, Gem, LockKeyhole, Moon, Shield, Skull, Sparkles, Swords, X } from 'lucide-react';
import type { Action, Command, GameView } from '../core/types';
import { GEM_COLORS } from '../core/games/gems';

const colors = ['#ebe4ca','#7fb9e8','#7bc8a2','#dd807e','#7f8597','#e8bd67'];
const names = ['白钻','蓝宝石','祖母绿','红宝石','黑玛瑙','黄金'];
type BoardProps = {view:GameView; selfID:string; command:(cmd:Command)=>void; open:(action:Action,selected?:string[])=>void};
export function Token({color,count,onClick,selected=false,small=false,label}:{color:number;count?:number;onClick?:()=>void;selected?:boolean;small?:boolean;label?:string}) {
  return <button type="button" aria-label={label||`${names[color]}${count===undefined?'':` ${count} 枚`}`} onClick={onClick} disabled={!onClick} className={`token ${small?'small':''} ${selected?'selected':''}`} style={{'--gem':colors[color]} as CSSProperties}><Gem size={small?12:20}/>{count!==undefined&&<b>{count}</b>}</button>;
}
function Cost({values}:{values:number[]}) {return <div className="cost">{values.map((n,i)=>n>0&&<span key={i} style={{'--gem':colors[i]} as CSSProperties}><i/>{n}</span>)}</div>;}
export function GemCard({card,onClick,mini=false}:{card:any;onClick?:()=>void;mini?:boolean}) {
  const color=GEM_COLORS.indexOf(card.bonus);
  return <button type="button" className={`gem-card ${mini?'mini':''}`} aria-label={`${names[color]} ${card.points} 分，费用 ${card.cost.map((n:number,i:number)=>n?`${names[i]}${n}`:'').filter(Boolean).join('，')}`} onClick={onClick} style={{'--gem':colors[color], '--tier':card.tier} as CSSProperties}>
    <div className="card-sky"><span className="card-points">{card.points||'·'}</span><Gem size={19}/><div className={`architecture tier-${card.tier}`}><i/><i/><i/></div></div><div className="card-bottom"><Cost values={card.cost}/><small>{['矿场','商路','工坊'][card.tier-1]}</small></div>
  </button>;
}
function PlayerStrip({players,current,selfID,onInspect}:{players:any[];current?:string;selfID:string;onInspect?:(id:string)=>void}) {return <div className="player-strip">{players.map(p=><div key={p.id} role={onInspect?'button':undefined} tabIndex={onInspect?0:undefined} aria-label={onInspect?`查看 ${p.name} 的公开筹码和奖励`:undefined} onClick={()=>onInspect?.(p.id)} onKeyDown={e=>{if(onInspect&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onInspect(p.id);}}} className={`player-chip ${p.id===current?'active':''} ${p.alive===false?'out':''}`}><span className="avatar">{p.avatar}</span><div><b>{p.name}{p.id===selfID?' · 我':''}</b><small>{p.score!==undefined?`${p.score} 分 · 预留 ${p.reservedCount}`:p.alive===false?'已出局':`${p.count} 张手牌`}</small></div>{p.score!==undefined?<div className="mini-bonuses">{p.bonuses?.map((n:number,i:number)=><span key={i} style={{color:colors[i]}}>{n}</span>)}</div>:p.id===current?<span className="turn-dot"/>:null}</div>)}</div>;}
export function GemsBoard({view,selfID,command,open}:BoardProps) {
  const b=view.board, own=b.players.find((p:any)=>p.id===selfID);
  const [picked,setPicked]=useState<string[]>([]),[card,setCard]=useState<any>(null),[pair,setPair]=useState(false),[merchantID,setMerchantID]=useState<string|null>(null);
  const merchant=b.players.find((p:any)=>p.id===merchantID);
  const action=view.actions.find(a=>a.id===(pair?'take_pair':'take_distinct'));
  useEffect(()=>{setPicked([]);setCard(null);},[view.phase,b.current,b.phase,selfID]);
  const choose=(id:string)=>{if(!action?.choices.some(c=>c.id===id))return;setPicked(p=>p.includes(id)?p.filter(x=>x!==id):pair?[id]:p.length<action.max?[...p,id]:[...p.slice(1),id]);};
  const cardAction=(id:string)=>view.actions.find(a=>a.id===id&&a.choices.some(c=>c.id===card?.id));
  return <div className="gems-board">
    <PlayerStrip players={b.players} current={b.current} selfID={selfID} onInspect={setMerchantID}/>
    <div className="gems-playfield"><aside className="noble-lane"><small>贵族来访</small>{b.nobles.map((n:any,i:number)=><button className="noble" key={n.id} onClick={()=>{const a=view.actions.find(a=>a.id==='noble');if(a?.choices.some(c=>c.id===n.id))open(a,[n.id]);}} aria-label={`贵族 ${i+1}，三分`}><Crown size={18}/><b>3</b><Cost values={n.cost}/></button>)}</aside>
    <div className="market">{[3,2,1].map(t=><div className="market-row" key={t}><button className={`tier-deck tier-${t}`} aria-label={`预留 ${t} 级盲牌`} onClick={()=>{const a=view.actions.find(a=>a.id==='reserve');if(a?.choices.some(c=>c.id===`deck:${t}`))open(a,[`deck:${t}`]);}}><Gem size={23}/><span>{'•'.repeat(t)}</span><small>{b.decks[t-1]}</small></button>{b.market.filter((c:any)=>c.tier===t).map((c:any)=><GemCard card={c} key={c.id} onClick={()=>setCard(c)}/>)}</div>)}</div>
    <aside className="bank"><div className="bank-mode"><button className={!pair?'on':''} onClick={()=>{setPair(false);setPicked([]);}}>异色</button><button className={pair?'on':''} onClick={()=>{setPair(true);setPicked([]);}}>同色 ×2</button></div><div className="bank-tokens">{b.bank.map((n:number,i:number)=><Token key={i} color={i} count={n} selected={picked.includes(GEM_COLORS[i])} onClick={i<5&&action?.choices.some(c=>c.id===GEM_COLORS[i])?()=>choose(GEM_COLORS[i]):undefined}/>)}</div>{picked.length>0&&<button className="compact primary" disabled={picked.length!==(action?.min??0)} onClick={()=>{command({action:action!.id,values:picked});setPicked([]);}}><Check size={15}/>拿取 {pair?2:picked.length}</button>}</aside></div>
    <div className="own-tray"><span className="tray-label">我的筹码</span><div className="my-tokens">{own.tokens.map((n:number,i:number)=><div key={i}><Token small color={i} count={n}/>{i<5&&<small>+{own.bonuses[i]}</small>}</div>)}</div>{b.payment?<div className="reserved-hand" aria-label="待购买的发展牌和自动支付筹码"><span>{b.payment.auto.every((n:number)=>n===0)?'免费':'支付'}<Cost values={b.payment.auto}/></span><GemCard card={b.payment.card} mini onClick={()=>setCard(b.payment.card)}/></div>:<div className="reserved-hand"><span>预留 {b.hand.length}/3</span>{b.hand.map((c:any)=><GemCard card={c} mini key={c.id} onClick={()=>setCard(c)}/>)}</div>}</div>
    {merchant&&<div className="modal-shade" onClick={()=>setMerchantID(null)}><section className="action-sheet" role="dialog" aria-label={`${merchant.name} 的公开库存`} onClick={e=>e.stopPropagation()}><div className="sheet-heading"><div><small>公开库存</small><h2>{merchant.avatar} {merchant.name} · {merchant.score} 分</h2></div><button className="icon" aria-label="关闭公开库存" onClick={()=>setMerchantID(null)}><X/></button></div><p>发展牌 {merchant.bought.length} · 贵族 {merchant.nobles.length} · 预留 {merchant.reservedCount}</p><div className="my-tokens">{merchant.tokens.map((n:number,i:number)=><div key={i}><Token color={i} count={n}/>{i<5&&<small>永久 +{merchant.bonuses[i]}</small>}</div>)}</div>{merchant.nobles.length>0&&<div className="choices">{merchant.nobles.map((n:any)=><div className="choice" key={n.id}><span><Crown size={14}/> {n.id} · 3 分</span><Cost values={n.cost}/></div>)}</div>}</section></div>}
    {card&&<div className="modal-shade" onClick={()=>setCard(null)}><section className="card-inspect" onClick={e=>e.stopPropagation()}><button className="icon close" aria-label="关闭牌面" onClick={()=>setCard(null)}><X/></button><GemCard card={card}/><div><p>{['矿场','商路','工坊'][card.tier-1]}</p><h2>{names[GEM_COLORS.indexOf(card.bonus)]}</h2><p>永久减免一枚同色宝石</p><div className="inline-actions">{['buy','reserve'].map(id=>{const a=cardAction(id);return a&&<button key={id} className="compact primary" onClick={()=>{command({action:a.id,values:[card.id]});setCard(null);}}>{a.title}<ChevronRight size={14}/></button>;})}</div>{!cardAction('buy')&&!cardAction('reserve')&&<small>{b.payment?.card.id===card.id?'请在桌面确认支付或取消':view.finished?'本局已结束':'等待你的回合，或筹码不足'}</small>}</div></section></div>}
  </div>;
}
const symbols:Record<string,string>={bomb:'💣',defuse:'✂️',attack:'⚡',skip:'↪',favor:'🐾',shuffle:'⤨',future:'🔮',nope:'✋',moonCat:'🌙',cloudCat:'☁️',leafCat:'🌿',starCat:'⭐',sunCat:'☀️'};
export function CatCard({card,onClick,selected=false}:{card:any;onClick?:()=>void;selected?:boolean}) {return <button type="button" onClick={onClick} className={`cat-card kind-${card.kind} ${selected?'selected':''}`} aria-label={card.title}><small>{card.title}</small><span className="cat-symbol">{symbols[card.kind]||'🐱'}</span><b>{card.kind.endsWith('Cat')?'=^·ω·^=':card.title}</b></button>;}
export function BombsBoard({view,selfID,command,open}:BoardProps){
  const b=view.board,[selected,setSelected]=useState<string[]>([]);
  useEffect(()=>setSelected([]),[b.phase,b.current,selfID]);
  const cards=b.hand.filter((c:any)=>selected.includes(c.id)),single=cards[0];
  const singleAction=single&&view.actions.find(a=>['play','nope','give'].includes(a.id)&&a.choices.some(c=>c.id===single.id));
  const combo=cards.length>=2&&cards.every((c:any)=>c.kind===single.kind)?view.actions.find(a=>a.id===(cards.length===2?'pair':'triple')&&a.choices.some(c=>c.id===single.kind)):null;
  const play=()=>{const a=cards.length===1?singleAction:combo;if(a){command({action:a.id,values:[cards.length===1?single.id:single.kind]});setSelected([]);}};
  const draw=view.actions.find(a=>a.id==='draw');
  const response=b.response;
  const requestedTitle=response?.requested?view.actions.flatMap(a=>a.choices).find(c=>c.id===response.requested)?.title||({bomb:'炸弹',defuse:'拆弹',attack:'攻击',skip:'跳过',favor:'索取',shuffle:'洗牌',future:'预见未来',nope:'否决',moonCat:'月亮猫',cloudCat:'云朵猫',leafCat:'叶子猫',starCat:'星星猫',sunCat:'太阳猫'} as Record<string,string>)[response.requested]:null;
  return <div className="bombs-board"><PlayerStrip players={b.players} current={b.current} selfID={selfID}/><div className="cat-table"><div className="cat-table-label"><small>最后留下来的猫</small><h2>运气，也是实力。</h2>{b.turnsRemaining>1&&<span className="pill danger">还需 {b.turnsRemaining} 个回合</span>}</div><button className={`draw-pile ${draw?'can-draw':''}`} onClick={()=>draw&&command({action:'draw',values:[]})} aria-label={`抽牌，剩余 ${b.deckCount} 张`} disabled={!draw}><span>🐾</span><b>{draw?'抽一张':'抽牌堆'}</b><small>{b.deckCount}</small></button><div className="discard-pile">{b.discard[0]?<CatCard card={b.discard[0]}/>:<div className="empty-card">弃牌</div>}</div>{b.response&&<div className="effect-note"><b>{b.response.cards.length>1?`${b.response.cards.length} 张同名组合`:b.response.cards[0].title}{b.response.target?` → ${b.players.find((p:any)=>p.id===b.response.target)?.name}`:''}{requestedTitle?` · 索要${requestedTitle}`:''}</b><span>{b.response.cancelled?'效果已否决':'等待大家响应'}</span><div className="response-dots">{b.players.filter((p:any)=>p.alive).map((p:any)=><span key={p.id} className={b.response.passed.includes(p.id)?'done':''} title={p.name}>{p.avatar}</span>)}</div></div>}</div>
    {b.privateFuture&&<div className="future-peek"><small><Eye size={13}/> 仅你可见 · 从牌堆顶部起</small><div>{b.privateFuture.map((c:any)=><CatCard key={c.id} card={c}/>)}</div></div>}
    <div className="hand-area"><div className="hand-caption"><span>我的手牌 · {b.hand.length}</span>{selected.length>0&&<><button className="text-button" onClick={()=>setSelected([])}>取消</button><button className="compact primary" onClick={play} disabled={!(cards.length===1?singleAction:combo)}>{cards.length===1?(singleAction?.title||'暂不可打出'):combo?(cards.length===2?'对子 · 随机拿牌':'三张 · 指定牌名'):'选择同名牌'}<ChevronRight size={14}/></button></>}</div><div className={`cat-hand ${b.hand.length>10?'long-hand':''}`} aria-label="我的手牌，可横向滑动">{b.hand.map((c:any,i:number)=><div key={c.id} style={{'--angle':`${(i-(b.hand.length-1)/2)*2}deg`} as CSSProperties}><CatCard card={c} selected={selected.includes(c.id)} onClick={()=>setSelected(p=>p.includes(c.id)?p.filter(x=>x!==c.id):p.length<3?[...p,c.id]:[c.id])}/></div>)}</div></div>
  </div>;
}
// Equal-angle ellipse points crowd the short vertical sides at 13–18 players.
// Distribute large tables by measured arc length and retain the full seat hit areas.
function socialSeatPositions(count:number,aspect:number){
  if(count<=12)return Array.from({length:count},(_,i)=>{const a=2*Math.PI*i/count-Math.PI/2;return {left:50+44*Math.cos(a),top:50+43*Math.sin(a)};});
  const rx=47,ry=43,steps=720,points=[{angle:-Math.PI/2,distance:0}];let length=0;
  for(let i=1;i<=steps;i++){
    const a=-Math.PI/2+(i-1)*2*Math.PI/steps,b=-Math.PI/2+i*2*Math.PI/steps;
    length+=Math.hypot(aspect*rx*(Math.cos(b)-Math.cos(a)),ry*(Math.sin(b)-Math.sin(a)));
    points.push({angle:b,distance:length});
  }
  return Array.from({length:count},(_,i)=>{
    const target=length*i/count,k=points.findIndex(p=>p.distance>=target),before=points[Math.max(0,k-1)],after=points[k];
    const fraction=after.distance===before.distance?0:(target-before.distance)/(after.distance-before.distance);
    const angle=before.angle+(after.angle-before.angle)*fraction;
    return {left:50+rx*Math.cos(angle),top:50+ry*Math.sin(angle)};
  });
}
export function SocialBoard({view,selfID,open}:BoardProps){
  const b=view.board,[reveal,setReveal]=useState(false),avalon=view.kind==='avalon';
  const tableRef=useRef<HTMLDivElement>(null),[aspect,setAspect]=useState(2);
  useLayoutEffect(()=>{
    const node=tableRef.current;if(!node)return;
    const measure=()=>{const box=node.getBoundingClientRect();if(box.height>0)setAspect(box.width/box.height);};
    measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();
  },[]);
  const positions=useMemo(()=>socialSeatPositions(b.players.length,aspect),[b.players.length,aspect]);
  useEffect(()=>setReveal(false),[selfID,view.kind,view.finished]);
  const targetActions=view.actions.filter(a=>a.choices.some(c=>b.players.some((p:any)=>p.id===c.id||c.id===`poison:${p.id}`)));
  return <div className={`social-board ${avalon?'avalon':'werewolf'} ${b.stage==='night'?'night':''}`}>
    {avalon?<div className="quest-track">{b.teamSizes.map((n:number,i:number)=><div key={i} className={`quest ${i===b.results.length?'current':''} ${b.results[i]===true?'success':b.results[i]===false?'failed':''}`}><span>{b.results[i]===true?<Check size={19}/>:b.results[i]===false?<X size={19}/>:i+1}</span><small>{n} 人{i===3&&b.players.length>=7?' · 双败':''}</small></div>)}<div className="rejection-track"><span>拒绝</span>{[0,1,2,3,4].map(i=><i key={i} className={i<b.rejections?'filled':''}/>)}</div></div>:<div className="night-counter"><Moon size={16}/><span>第 {b.night} {b.stage==='night'?'夜':'天'}</span><small>{b.players.filter((p:any)=>p.alive).length} 人存活</small></div>}
    <div className="round-table" ref={tableRef}><div className="table-emblem">{avalon?<Swords/>:<Moon/>}<b>{view.phase}</b><small>{avalon?`远征 ${b.quest} · ${b.teamSize} 人队伍`:b.stage==='night'?'请保管好自己的身份':'面对面发言，手机上投票'}</small>{b.winner&&<h2>{b.winner}</h2>}</div><div className={`seats count-${b.players.length}`}>{b.players.map((p:any,i:number)=>{const position=positions[i];return <button className={`seat ${p.id===selfID?'self':''} ${!p.alive?'out':''} ${p.team?'team':''} ${p.leader||p.sheriff?'leader':''}`} key={p.id} style={{left:`${position.left}%`,top:`${position.top}%`} as CSSProperties} onClick={()=>{const a=targetActions.find(a=>a.choices.some(c=>c.id===p.id||c.id===`poison:${p.id}`));if(a)open(a,[a.choices.find(c=>c.id===p.id||c.id===`poison:${p.id}`)!.id]);}} aria-label={`${i+1}号 ${p.name}${p.alive?'':' 已出局'}`}><span className="seat-number">{i+1}</span><span className="seat-avatar">{p.alive?p.avatar:<Skull size={22}/>}</span>{(p.leader||p.sheriff)&&<Crown className="seat-crown" size={15}/>}<b>{p.name}</b><small>{p.role&&(view.finished||p.id!==selfID)?p.role:p.candidate?(['pk','vote'].includes(b.stage)?'PK':'竞选中'):p.team?'远征队员':p.id===selfID?'我':''}</small>{Object.hasOwn(b.publicVotes||{},p.id)&&<span className="vote-mark">{avalon?(b.publicVotes[p.id]?'✓':'✕'):b.publicVotes[p.id]==='skip'?'弃票':`→ ${b.players.findIndex((x:any)=>x.id===b.publicVotes[p.id])+1}`}</span>}</button>;})}</div></div>
    <button className={`identity-card ${reveal?'revealed':''}`} onClick={()=>setReveal(!reveal)} aria-label={reveal?'收起身份':'查看我的身份'}>{reveal?<><b>{b.ownRole}</b><span>{b.ownKnowledge?.filter((k:any)=>k.id!==selfID&&k.id!=='role').map((k:any)=>`${k.title}${k.detail?` · ${k.detail}`:''}`).join(' / ')||'没有额外情报'}</span><small>轻点收起</small></>:<><LockKeyhole size={24}/><b>我的身份</b><small>轻点查看 · 注意遮挡</small></>}</button>
  </div>;
}
export function ActionSheet({action,selected,view,onClose,onSubmit}:{action:Action;selected:string[];view:GameView;onClose:()=>void;onSubmit:(cmd:Command)=>void}){
  const [values,setValues]=useState(selected),[error,setError]=useState('');
  const fresh=view.actions.find(a=>a.id===action.id);
  const valid=fresh&&values.length>=fresh.min&&values.length<=fresh.max&&values.every(id=>fresh.choices.some(c=>c.id===id));
  useEffect(()=>{if(!fresh)onClose();},[fresh,onClose]);
  const choose=(id:string)=>setValues(old=>old.includes(id)?old.filter(x=>x!==id):action.max===1?[id]:old.length<action.max?[...old,id]:old);
  return <div className="modal-shade" onClick={onClose}><section className="action-sheet" onClick={e=>e.stopPropagation()}><div className="sheet-heading"><div><small>你的决定</small><h2>{action.title}</h2></div><button className="icon" aria-label="关闭选择" onClick={onClose}><X/></button></div>{action.help&&<p>{action.help}</p>}{action.id==='pay_custom'&&view.board.payment&&<div className="inline-actions"><span>折扣后费用</span><Cost values={view.board.payment.needed}/><small>黄金可代任意颜色</small></div>}<div className="choices">{(fresh||action).choices.map(c=><button className={`choice ${values.includes(c.id)?'selected':''}`} key={c.id} onClick={()=>choose(c.id)}><span>{c.title}</span>{c.subtitle&&<small>{c.subtitle}</small>}{values.includes(c.id)&&<Check size={15}/>}</button>)}</div>{error&&<p className="error">{error}</p>}<footer><small>{action.max>0?`已选 ${values.length} / ${action.max}`:'确认后执行'}</small><button className="compact primary" disabled={!valid} onClick={()=>{try{onSubmit({action:action.id,values});onClose();}catch(e){setError((e as Error).message);}}}>确认<Check size={16}/></button></footer></section></div>;
}
export function ActionDock({view,open,command}:{view:GameView;open:(a:Action,values?:string[])=>void;command:(c:Command)=>void}){
  const directHidden=view.kind==='gems'?['take_distinct','take_pair','buy','reserve']:view.kind==='bombs'?['draw','play','pair','triple','nope','give']:[];
  return <div className={`action-dock ${view.actions.length?'your-turn':''}`}><div className="instruction"><span className="turn-dot"/>{view.instruction}</div><div className="dock-actions">{view.actions.filter(a=>!directHidden.includes(a.id)&&!(view.board.isModerator&&a.id===view.actions[0]?.id)).map(a=><button key={a.id} className={`compact ${['explode','assassinate'].includes(a.id)?'danger':'primary'}`} onClick={()=>a.choices.length||['explode','defuse','withdraw'].includes(a.id)?open(a):command({action:a.id,values:[]})}>{a.title}<ChevronRight size={13}/></button>)}</div></div>;
}
