import {useEffect,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {t} from '../i18n';
export function useSeatPage(total:number,context:string){
 const query='(max-width:600px), (max-height:500px)';
 const [compact,setCompact]=useState(()=>matchMedia(query).matches),[page,setPage]=useState(0);
 useEffect(()=>{const media=matchMedia(query),change=()=>setCompact(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>setPage(0),[context,compact,total]);
 const size=compact?6:total,pages=Math.ceil(total/size),current=Math.min(page,pages-1);
 return {start:current*size,end:(current+1)*size,page:current,pages,setPage,compact};
}
export function SeatPagination({page,pages,setPage}:ReturnType<typeof useSeatPage>){
 return pages>1?<nav className="seat-pagination" aria-label={t('座位分页')}><button aria-label={t('上一页')} disabled={page===0} onClick={()=>setPage(page-1)}><ChevronLeft size={20}/></button><span>{page+1} / {pages}</span><button aria-label={t('下一页')} disabled={page===pages-1} onClick={()=>setPage(page+1)}><ChevronRight size={20}/></button></nav>:null;
}
