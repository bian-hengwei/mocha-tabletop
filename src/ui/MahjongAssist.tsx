import {useState} from 'react';
import {X} from 'lucide-react';
import {t} from '../i18n';
import {tileTitle,type MahjongAssistance,type MahjongWait} from '../core/games/mahjong';
import {MahjongArt} from './ClassicCardArt';
import {useDialog} from './useDialog';
import './mahjong-assist.css';

const summary=(waits:MahjongWait[])=>t(`听 ${waits.length} 种 · 未见 ${waits.reduce((sum,wait)=>sum+wait.unseen,0)} 张`);
export function MahjongAssist({data,selected}:{data:MahjongAssistance;selected:string|undefined}){
 const [open,setOpen]=useState(false),[preview,setPreview]=useState<string|undefined>();
 const ref=useDialog<HTMLElement>(open,()=>setOpen(false));
 const options=data.discards.filter((option,index,all)=>all.findIndex(other=>other.tile.value===option.tile.value)===index);
 const chosen=data.discards.find(option=>option.tile.id===preview)||data.discards.find(option=>option.tile.id===selected)||options.find(option=>option.waits.length)||options[0];
 const waits=chosen?.waits??data.waits;
 return <>
  <button type="button" className="compact mahjong-assist-button" aria-haspopup="dialog" onClick={()=>{setPreview(selected);setOpen(true);}}>{t('听牌助手')}</button>
  {open&&<div className="modal-shade" onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}><section className="panel mahjong-assist" ref={ref} role="dialog" aria-modal="true" aria-label={t('听牌助手')} tabIndex={-1}>
   <header><h2>{t('听牌助手')}</h2><button type="button" className="icon" aria-label={t('关闭')} onClick={()=>setOpen(false)}><X size={18}/></button></header>
   <div className="mahjong-assist-body">
    {data.currentWin&&<p className="mahjong-assist-win">{t(data.currentWin.selfDraw?'当前可自摸':'当前可胡牌')} <strong>×{data.currentWin.multiplier}</strong></p>}
    {chosen&&<label className="mahjong-assist-discard">{t('试算打出')}<select value={chosen.tile.value} onChange={event=>setPreview(options.find(option=>option.tile.value===Number(event.target.value))!.tile.id)}>{options.map(option=><option value={option.tile.value} key={option.tile.value}>{t(tileTitle(option.tile))} · {summary(option.waits)}</option>)}</select></label>}
    <p className="mahjong-assist-summary" aria-live="polite">{waits.length?summary(waits):t(chosen?'打出此牌后未听牌':'当前未听牌')}</p>
    <div className="mahjong-waits">{waits.map(wait=><article key={wait.value} className={`mahjong-wait ${wait.unseen===0?'exhausted':''}`}>
     <span className="mahjong-wait-art" role="img" aria-label={t(tileTitle(wait.value))}><MahjongArt value={wait.value}/></span>
     <div><strong>{t(tileTitle(wait.value))}</strong><span>{t(`未见 ${wait.unseen} 张`)}</span></div>
     <dl><div><dt>{t('普通胡牌')}</dt><dd>{wait.discardMultiplier===null?t('仅自摸'):`×${wait.discardMultiplier}`}</dd></div><div><dt>{t('自摸')}</dt><dd>×{wait.selfDrawMultiplier}</dd></div></dl>
    </article>)}</div>
    <p className="mahjong-assist-note">{t('未见数 = 4 − 自己手牌及公开可见牌，可能在对手手中或牌墙内；0 张也保留显示。')}</p>
    <p className="mahjong-assist-note">{t('倍数按本桌规则估算，按每位付款玩家计算；不含未来杠上花、抢杠及杠分。试算不会出牌。')}</p>
   </div>
  </section></div>}
 </>;
}
