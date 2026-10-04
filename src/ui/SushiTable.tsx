import {useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {ChevronLeft,ChevronRight,X} from 'lucide-react';
import {t} from '../i18n';
import type {Command,GameView,Player} from '../core/types';
import {SUSHI_INFO,sushiPlateScore,type SushiCard} from '../core/games/sushi';
import {IllustratedTile} from './IllustratedTile';
import {useDialog} from './useDialog';

type TablePlayer=Player&{table:SushiCard[];score:number;puddings:number;ready:boolean};
type Board={players:TablePlayer[];hand:SushiCard[];selected:string[]|null;round:number;step:number};
type Props={view:GameView;selfID:string;command:(command:Command)=>void;onShowResults?:()=>void};
const illustrations={tempura:0,sashimi:1,dumpling:2,maki1:3,maki2:4,maki3:5,egg:6,salmon:7,squid:8,wasabi:9,pudding:10,chopsticks:11};
const accents={tempura:'#a86b3d',sashimi:'#b76258',dumpling:'#9a8454',maki1:'#577769',maki2:'#577769',maki3:'#577769',egg:'#b18f44',salmon:'#c17960',squid:'#7f9093',wasabi:'#718551',pudding:'#a27a50',chopsticks:'#776357'};
const rolls=(cards:SushiCard[])=>cards.reduce((sum,card)=>sum+(card.kind==='maki1'?1:card.kind==='maki2'?2:card.kind==='maki3'?3:0),0);

const description=(card:SushiCard,playerCount:number)=>t(card.kind==='pudding'&&playerCount===2?'两人局：三轮后最多 +6，最少不扣分':SUSHI_INFO[card.kind].detail);

function SushiFace({card,selected,order,small=false,onClick,playerCount}:{card:SushiCard;selected?:boolean;order?:number;small?:boolean;onClick?:()=>void;playerCount:number}){
 const info=SUSHI_INFO[card.kind];
 return <button type="button" disabled={!onClick} aria-label={`${t(info.title)}${t('：')}${description(card,playerCount)}`} aria-pressed={selected===undefined?undefined:selected}
  className={`ng-sushi-card ${selected?'ng-selected':''} ${small?'ng-small':''}`} style={{'--sushi-accent':accents[card.kind]} as CSSProperties} onClick={onClick}>
  <span className="ng-sushi-illustration"><IllustratedTile kind="sushi" index={illustrations[card.kind]}/></span>
  <b>{t(info.title)}</b>{!small&&<small>{description(card,playerCount)}</small>}
  {order!==undefined&&<span className="ng-order">{order}</span>}
 </button>;
}

function DishDialog({card,onClose,playerCount}:{card:SushiCard;onClose:()=>void;playerCount:number}){
 const ref=useDialog<HTMLElement>(true,onClose),info=SUSHI_INFO[card.kind];
 return <div className="modal-shade" onClick={onClose}><section ref={ref} tabIndex={-1} className="sushi-dish-dialog" role="dialog" aria-modal="true" aria-label={t(info.title)} onClick={e=>e.stopPropagation()}>
  <header><h2>{t(info.title)}</h2><button type="button" className="icon" aria-label={t('关闭')} onClick={onClose}><X/></button></header>
  <IllustratedTile kind="sushi" index={illustrations[card.kind]}/><p>{description(card,playerCount)}</p>
 </section></div>;
}

export function SushiTable({view,selfID,command,onShowResults}:Props){
 const b=view.board as Board,pick=view.actions.find(a=>a.id==='pick'),cancel=view.actions.find(a=>a.id==='cancel');
 const [selected,setSelected]=useState<string[]>([]),[plateID,setPlateID]=useState(selfID),[detail,setDetail]=useState<SushiCard|null>(null);
 const tabs=useRef<HTMLDivElement>(null),hand=useRef<HTMLDivElement>(null);
 const handIDs=b.hand.map(c=>c.id).join(':');
 useLayoutEffect(()=>{setSelected([]);setDetail(null);if(hand.current)hand.current.scrollLeft=0;},[selfID,b.round,b.step,!!b.selected,handIDs]);
 useLayoutEffect(()=>{setPlateID(selfID);},[selfID,b.round]);
 const plate=b.players.find(p=>p.id===plateID)||b.players[0],plateIndex=b.players.indexOf(plate);
 useLayoutEffect(()=>{tabs.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});},[plate.id]);
 const shown=b.selected||selected,valid=!!pick&&selected.length>=pick.min&&selected.length<=pick.max;
 const toggle=(id:string)=>setSelected(old=>old.includes(id)?old.filter(value=>value!==id):old.length<(pick?.max||1)?[...old,id]:[id]);
 const waiting=b.players.filter(p=>!p.ready);
 const status=view.finished?t(view.instruction):b.selected?(waiting.length===1?`${t('仍在选牌')}${t('：')}${waiting[0].name}`:t(view.instruction)):'';
 const pudding=(player:TablePlayer)=>player.puddings+(view.finished?0:player.table.filter(card=>card.kind==='pudding').length);
 return <div className={`ng-table ng-sushi ${view.finished?'ng-sushi-finished':''}`}>
  <div className="ng-sushi-overview">
   <div ref={tabs} className="ng-players sushi-players" role="group" aria-label={t('查看玩家盘面')}>
    {b.players.map(player=><button type="button" key={player.id} className={`ng-player ${player.id===selfID?'ng-self':''}`} aria-pressed={plate.id===player.id} aria-controls="sushi-public-plate" onClick={()=>setPlateID(player.id)}>
     <span className="ng-avatar" aria-hidden="true">{player.avatar}</span><div><b>{player.name}{player.id===selfID?` · ${t('你')}`:''}</b>
      <small>{view.finished?t('已结算'):t(player.ready?'✓ 已选':'选牌中')}</small>
     </div><strong>{player.score}<small> {t('分')}</small></strong><span className="sushi-player-counts">{t('卷数')} {rolls(player.table)} · {t('布丁')} {pudding(player)}</span>
    </button>)}
   </div>
   <section id="sushi-public-plate" className="sushi-public-plate" aria-label={`${plate.name} · ${t('盘面')}`}>
    <header><div><h3>{plate.avatar} {plate.name}<small>{t('盘面')}</small></h3><p>{t('料理分')} <b>{sushiPlateScore(plate.table)}</b> · {t('卷数')} <b>{rolls(plate.table)}</b> · {t('布丁')} <b>{pudding(plate)}</b></p></div>
     <nav aria-label={t('查看玩家盘面')}><button type="button" aria-label={t('上一位玩家')} disabled={plateIndex===0} onClick={()=>setPlateID(b.players[plateIndex-1].id)}><ChevronLeft size={18}/></button><span>{plateIndex+1}/{b.players.length}</span><button type="button" aria-label={t('下一位玩家')} disabled={plateIndex===b.players.length-1} onClick={()=>setPlateID(b.players[plateIndex+1].id)}><ChevronRight size={18}/></button></nav>
    </header>
    <div className="sushi-dishes" tabIndex={plate.table.length?0:undefined} aria-label={t('盘面可左右滑动')}>
     {plate.table.length?plate.table.map(card=><SushiFace key={card.id} card={card} playerCount={b.players.length} small onClick={()=>setDetail(card)}/>):<p className="sushi-empty"><span aria-hidden="true">◯</span>{t('等待大家同时揭晓第一道')}</p>}
    </div>
   </section>
   {status&&<header className="ng-heading sushi-status"><strong role="status">{status}</strong>{view.finished&&onShowResults&&<button type="button" className="ng-action" onClick={onShowResults}>{t('得分明细')}</button>}</header>}
  </div>
  {!view.spectating&&!view.finished&&<section className="ng-panel ng-sushi-hand-panel">
   <h3>{t('你的手牌')}<small>{t(`${b.hand.length} 张 · 仅你可见`)}</small><span className="sushi-hand-cue" aria-hidden="true">↔</span></h3>
   <div ref={hand} className="ng-hand" tabIndex={0} aria-label={t('手牌可左右滑动')}>
    {b.hand.map(card=><SushiFace key={card.id} card={card} playerCount={b.players.length} selected={shown.includes(card.id)} order={shown.includes(card.id)?shown.indexOf(card.id)+1:undefined} onClick={pick?()=>toggle(card.id):undefined}/>)}
   </div>
   <div className="ng-controls ng-sushi-confirm">
    {pick&&<><span className="sushi-pick-limit">{pick.max===2?t('筷子：可选 1–2 张'):t('选择 1 张')}{pick.max===2&&<small>{t('按所选顺序出牌')}</small>}</span><button type="button" className="ng-action" disabled={!valid} onClick={()=>{if(valid){command({action:'pick',values:selected});setSelected([]);}}}>{selected.length?t(`确认 ${selected.length} 张`):t('确认选牌')}</button></>}
    {cancel&&<button type="button" className="ng-action" onClick={()=>command({action:'cancel',values:[]})}>{t(cancel.title)}</button>}
   </div>
  </section>}
  {detail&&<DishDialog card={detail} playerCount={b.players.length} onClose={()=>setDetail(null)}/>}
 </div>;
}
