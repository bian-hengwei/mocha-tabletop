import {classicText,classicPatterns} from './i18n/classicText';
import {useSyncExternalStore} from 'react';
import {recognitionText} from './i18n/recognitionText';
import {appText,appPatterns} from './i18n/appText';
import {uiText,uiPatterns} from './i18n/uiText';
import {gameText,gamePatterns} from './i18n/gameText';
import {wordGameText,wordGamePatterns} from './i18n/wordGameText';
export type Locale='zh'|'en';
let locale:Locale='zh';try{if(localStorage.getItem('mocha-locale')==='en')locale='en';}catch{}
const subscribers=new Set<()=>void>();
const subscribe=(fn:()=>void)=>{subscribers.add(fn);return()=>{subscribers.delete(fn);};};
export function getLocale(){return locale;}
export function setLocale(value:Locale){locale=value;try{localStorage.setItem('mocha-locale',value);}catch{}document.documentElement.lang=value==='zh'?'zh-CN':'en';subscribers.forEach(fn=>fn());}
export function useLocale(){return useSyncExternalStore(subscribe,getLocale);}
const aliases:Record<string,string>={'危险目标':'刺客','闹闹牌':'爆炸牌','安抚':'拆弹','加班':'攻击','借一张':'索取','偷瞄三张':'预知三张','等等':'否决','阿瓦隆':'迷雾远征','狼人杀':'月夜议会','炸弹猫':'喵喵危机','宝石商人':'晶石商会','Sushi Go':'寿司小宴','SushiGo':'寿司小宴','香料之路':'香料商旅','UNO':'七彩接龙','Codenames':'密语行动','谁是卧底':'异词同伴','梅林':'先知','派西维尔':'守望者','莫甘娜':'伪先知','爪牙':'暗影同伴','忠臣':'远征队员'};
function neutral(text:string){for(const [from,to]of Object.entries(aliases))text=text.replaceAll(from,to);return text;}
const sourceText={...classicText,...gameText,...uiText,...wordGameText,...appText,...recognitionText};
const dictionary:Record<string,string>=Object.fromEntries(Object.entries(sourceText).flatMap(([key,value])=>[[key,value],[neutral(key),value]]));
const dictionaryKeys=Object.keys(dictionary).filter(k=>/[\u3400-\u9fff]/u.test(k)).sort((a,b)=>b.length-a.length);
const cache=new Map<string,string>();
const patterns:[RegExp,string,number[]?][]=[...classicPatterns,...appPatterns,...uiPatterns,...wordGamePatterns,...gamePatterns].flatMap(([pattern,replacement,captures])=>{
 const current=neutral(pattern.source);
 return current===pattern.source?[[pattern,replacement,captures]]:[[new RegExp(current,pattern.flags),replacement,captures],[pattern,replacement,captures]];
});
function english(text:string,depth=0):string {
 if(depth>5)return text;if(cache.has(text))return cache.get(text)!;
 if(Object.hasOwn(dictionary,text))return dictionary[text];
 const renamed=neutral(text);if(Object.hasOwn(dictionary,renamed))return dictionary[renamed];
 for(const [pattern,replacement,translatedCaptures=[]]of patterns){pattern.lastIndex=0;const match=pattern.exec(text);if(!match)continue;
   const output=replacement.replace(/\$(\d+)/g,(_,index)=>{const i=Number(index),capture=match[i]||'';return translatedCaptures.includes(i)?capture.split('；').map(part=>english(part,depth+1)).join('; '):capture;});
   if(cache.size>10000)cache.clear();cache.set(text,output);return output;
 }
 // Compound labels such as token costs contain independently localized fragments.
 let output=text;for(const key of dictionaryKeys)output=output.replaceAll(key,dictionary[key]);
 if(cache.size>10000)cache.clear();cache.set(text,output);return output;
}
export function t(value:string|number|null|undefined):string {if(value==null)return '';const text=String(value);return locale==='zh'?neutral(text):english(text);}
if(typeof document!=='undefined')document.documentElement.lang=locale==='zh'?'zh-CN':'en';
