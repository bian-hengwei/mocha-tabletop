import {X} from 'lucide-react';
import {t} from '../i18n';
import {SPICES,type SpiceOrder} from '../core/games/century';
import {SpiceCube} from './NewGameArt';
import {useDialog} from './useDialog';

export function CenturyOrderDialog({order,cubes,bonus,note,onClose,onClaim}:{
 order:SpiceOrder;cubes:readonly number[];bonus:string;note:string;onClose:()=>void;onClaim?:()=>void;
}){
 const ref=useDialog<HTMLElement>(true,onClose);
 return <div className="modal-shade" onClick={onClose}><section ref={ref} tabIndex={-1} className="ng-order-inspector" role="dialog" aria-modal="true" aria-label={t('订单详情')} onClick={e=>e.stopPropagation()}>
  <header><div><h2>{t('订单详情')}</h2><strong>{order.points} {t('分')}</strong>{bonus&&<small>{bonus}</small>}</div><button type="button" className="icon" aria-label={t('关闭')} onClick={onClose}><X/></button></header>
  <div className="ng-order-details"><table><thead><tr><th>{t('香料')}</th><th>{t('所需')}</th><th>{t('持有')}</th><th>{t('还缺')}</th></tr></thead><tbody>{order.cost.map((cost,i)=>cost>0&&<tr key={i}><th scope="row"><span><SpiceCube color={i}/>{t(SPICES[i])}</span></th><td>{cost}</td><td>{cubes[i]}</td><td className={cost>cubes[i]?'missing':''}>{Math.max(0,cost-cubes[i])||'—'}</td></tr>)}</tbody></table>{!onClaim&&<p>{note}</p>}</div>
  <footer>{onClaim?<button type="button" className="compact primary" onClick={onClaim}>{t('完成订单')}</button>:<button type="button" className="compact" onClick={onClose}>{t('关闭')}</button>}</footer>
 </section></div>;
}
