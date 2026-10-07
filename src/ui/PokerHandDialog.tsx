import {useState} from 'react';
import {Check,X} from 'lucide-react';
import {t} from '../i18n';
import {pokerTitle,type PokerCard} from '../core/games/poker';
import {PokerArt} from './ClassicCardArt';
import {useDialog} from './useDialog';
import './poker-hand-dialog.css';

type Props={cards:PokerCard[];selected:string[];allowed:string[];level?:number;status:string;submitLabel:string;valid:boolean;canSubmit:boolean;canDeclare:boolean;onToggle:(id:string)=>void;onClear:()=>void;onSubmit:()=>void;onDeclare:()=>void;onClose:()=>void};
export function PokerHandDialog({cards,selected,allowed,level,status,submitLabel,valid,canSubmit,canDeclare,onToggle,onClear,onSubmit,onDeclare,onClose}:Props){
 const ref=useDialog<HTMLElement>(true,onClose),[sort,setSort]=useState<'rank'|'suit'>('rank');
 const suit=(card:PokerCard)=>card.rank>=16?4:card.suit,naturalRank=(card:PokerCard)=>card.rank===15?2:card.rank;
 const displayed=sort==='rank'?cards:[...cards].sort((a,b)=>suit(a)-suit(b)||naturalRank(b)-naturalRank(a));
 return <div className="modal-shade poker-hand-shade" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={ref} className="poker-hand-dialog" role="dialog" aria-modal="true" aria-label={t('展开手牌')} tabIndex={-1}>
   <header><h2>{t('我的手牌')} <small>{cards.length}</small></h2><button type="button" className="icon" aria-label={t('返回牌桌')} onClick={onClose}><X size={20}/></button></header>
   <div className="poker-hand-toolbar"><div role="group" aria-label={t('手牌排序')}><button type="button" aria-pressed={sort==='rank'} onClick={()=>setSort('rank')}>{t('按点数')}</button><button type="button" aria-pressed={sort==='suit'} onClick={()=>setSort('suit')}>{t('按花色')}</button></div><button type="button" disabled={!selected.length} onClick={onClear}>{t('清空选择')}</button></div>
   <div className="poker-expanded-grid" tabIndex={0} aria-label={t('我的手牌')}>
    {displayed.map(card=>{const isSelected=selected.includes(card.id),wild=level!==undefined&&card.suit===1&&card.rank===(level===2?15:level);return <button type="button" key={card.id} data-hand-card={card.id} disabled={!allowed.includes(card.id)} aria-pressed={isSelected} aria-label={`${t(pokerTitle(card))}${wild?` · ${t('逢人配')}`:''}`} className={`poker-expanded-card ${isSelected?'selected':''} ${wild?'wild-card':''}`} onClick={()=>onToggle(card.id)}>
     <PokerArt rank={card.rank} suit={card.suit}/>{wild&&<small>{t('逢人配')}</small>}{isSelected&&<span className="poker-expanded-check" aria-hidden="true"><Check size={17}/></span>}
    </button>;})}
   </div>
   <footer><p role="status">{status}</p><div>{canDeclare&&<button type="button" aria-label={t('出牌牌型')} aria-haspopup="dialog" onClick={onDeclare}>{t('牌型')}</button>}{canSubmit?<button type="button" className="primary" disabled={!valid} onClick={onSubmit}>{submitLabel}{selected.length?` (${selected.length})`:''}</button>:<button type="button" onClick={onClose}>{t('返回牌桌')}</button>}</div></footer>
  </section>
 </div>;
}
