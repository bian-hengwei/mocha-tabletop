import type {GameText} from './types';

/** Keep the legacy log intact; structured data is optional for restored saves. */
export function recordGameText(state:{log:string[];logText?:Record<number,GameText>},text:string,message:GameText){
 (state.logText??={})[state.log.length]=message;state.log.push(text);
}
export function textList(items:(string|GameText)[],separator='；'):(string|GameText)[]{
 return items.flatMap((item,i)=>i?[{template:separator},item]:[item]);
}
