import {useState,type CSSProperties} from 'react';
import {Paintbrush,Eraser,Undo2,Trash2,X,Check} from 'lucide-react';
import {RELAY_COLORS,RELAY_WIDTHS} from '../core/games/drawrelay';
import {t} from '../i18n';
import {useDialog} from './useDialog';
import './drawing-tools.css';
const names=['墨黑','珊瑚红','金黄','松绿','湖蓝','紫罗兰','白色','橙色','粉色','嫩绿','青色','棕色','灰色','黑色','米色','浅蓝'];
export function DrawingTools({color,width,onColor,onWidth,onUndo,onClear}:{color:number;width:number;onColor:(n:number)=>void;onWidth:(n:number)=>void;onUndo?:()=>void;onClear?:()=>void}){
 const [open,setOpen]=useState(false),ref=useDialog<HTMLDivElement>(open,()=>setOpen(false));
 return <div className="drawing-tools"><button type="button" aria-label={t('画笔工具')} aria-haspopup="dialog" onClick={()=>setOpen(true)} style={{'--ink':RELAY_COLORS[color]} as CSSProperties}>{color===6?<Eraser size={20}/>:<Paintbrush size={20}/>}<i/></button><button type="button" aria-label={t('撤销上一笔')} disabled={!onUndo} onClick={onUndo}><Undo2 size={18}/></button><button type="button" aria-label={t('清空画布')} disabled={!onClear} onClick={onClear}><Trash2 size={18}/></button>
 {open&&<div className="modal-shade" onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}><div ref={ref} className="drawing-tool-dialog" role="dialog" aria-modal="true" aria-label={t('画笔工具')} tabIndex={-1}><header><h2>{t('画笔工具')}</h2><button type="button" aria-label={t('关闭')} onClick={()=>setOpen(false)}><X size={20}/></button></header><div className="drawing-colors" role="group" aria-label={t('画笔颜色')}>{RELAY_COLORS.map((ink,i)=><button type="button" key={ink} style={{'--ink':ink} as CSSProperties} aria-label={t(names[i])} aria-pressed={color===i} onClick={()=>onColor(i)}><i/>{color===i&&<Check size={16}/>}</button>)}</div><div className="drawing-widths" role="group" aria-label={t('笔刷粗细')}>{RELAY_WIDTHS.map((size,i)=><button key={size} type="button" aria-pressed={width===i} aria-label={`${t('笔刷粗细')} ${i+1}`} onClick={()=>onWidth(i)}><i style={{width:4+i*4,height:4+i*4}}/></button>)}</div><button type="button" className="drawing-eraser" aria-pressed={color===6} onClick={()=>onColor(6)}><Eraser size={18}/>{t('橡皮擦')}</button></div></div>}
 </div>;
}
