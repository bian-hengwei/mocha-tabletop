import {t} from '../i18n';
import type {GameText} from '../core/types';

/** Localize the system sentence before inserting opaque player text. */
export function formatGameText(fallback:string,message?:GameText):string{
 if(!message)return t(fallback);
 const render=(value:string|GameText):string=>typeof value==='string'?value:formatGameText('',value);
 return t(message.template).replace(/\{([a-zA-Z]+)\}/g,(token,key)=>{
  const value=message.values?.[key];
  return value===undefined?token:Array.isArray(value)?value.map(render).join(''):render(value);
 });
}
