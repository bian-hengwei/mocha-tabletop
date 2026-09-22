import {useState} from 'react';
import {ChevronRight,X} from 'lucide-react';
import {t} from '../i18n';
import {tileTitle,type MahjongAssistance} from '../core/games/mahjong';
import {MahjongArt} from './ClassicCardArt';
import {useDialog} from './useDialog';
import './mahjong-assist.css';

export function MahjongAssist({data,selected}:{data:MahjongAssistance;selected:string|undefined}){
 const [open,setOpen]=useState(false);
 const ref=useDialog<HTMLElement>(open,()=>setOpen(false));
 const waits=data.discards.length?data.discards.find(option=>option.tile.id===selected)?.waits??[]:data.waits;
 if(!waits.length)return null;
 return <div className="mahjong-ready" role="region" aria-label={t('听牌')}>
  <button type="button" className="mahjong-assist-button" aria-label={t('听牌详情')} aria-haspopup="dialog" onClick={()=>setOpen(true)}>{t('听')}<ChevronRight size={12}/></button>
  <div className="mahjong-ready-tiles" tabIndex={0} aria-label={t('可胡的牌')}>
   {waits.map(wait=><span key={wait.value} className={`mahjong-ready-tile ${wait.unseen===0?'exhausted':''}`} role="img" aria-label={`${t(tileTitle(wait.value))} · ${t(`未见 ${wait.unseen} 张`)}`}><MahjongArt value={wait.value}/><small>{wait.unseen}</small></span>)}
  </div>
  {open&&<div className="modal-shade" onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}><section className="panel mahjong-assist" ref={ref} role="dialog" aria-modal="true" aria-label={t('听牌详情')} tabIndex={-1}>
   <header><h2>{t('听牌')}</h2><button type="button" className="icon" aria-label={t('关闭')} onClick={()=>setOpen(false)}><X size={18}/></button></header>
   <div className="mahjong-assist-body"><div className="mahjong-waits">{waits.map(wait=><article key={wait.value} className={`mahjong-wait ${wait.unseen===0?'exhausted':''}`}>
    <span className="mahjong-wait-art" role="img" aria-label={t(tileTitle(wait.value))}><MahjongArt value={wait.value}/></span>
    <div><strong>{t(tileTitle(wait.value))}</strong><span>{t(`未见 ${wait.unseen} 张`)}</span></div>
    <dl><div><dt>{t('点炮胡预估')}</dt><dd>{wait.discardMultiplier===null?t('仅自摸'):`×${wait.discardMultiplier}`}</dd></div><div><dt>{t('自摸预估')}</dt><dd>×{wait.selfDrawMultiplier}</dd></div></dl>
   </article>)}</div></div>
  </section></div>}
 </div>;
}
