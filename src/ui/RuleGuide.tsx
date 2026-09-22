import {MahjongRuleGuide} from './MahjongRuleGuide';
import type {MahjongMode} from '../core/mahjongModes';
import {useId,useState} from 'react';
import type {GameKind} from '../core/types';
import {useLocale,t} from '../i18n';
import {guides} from '../i18n/guides';
export type Guide={edition:string;quick:string[];sections:{title:string;text:string[]}[]};
export function RuleGuide({kind,mahjongMode,legacy=false}:{kind:GameKind;mahjongMode?:MahjongMode;legacy?:boolean}){return kind==='mahjong'?<MahjongRuleGuide mode={mahjongMode} legacy={legacy}/>:<GeneralRuleGuide kind={kind}/>;}
function GeneralRuleGuide({kind}:{kind:GameKind}){
 const locale=useLocale(),[full,setFull]=useState(false),id=useId(),guide=guides[kind][locale];
 return <div className="rule-guide"><div className="rule-tabs" role="tablist" aria-label={t('规则与教程')} onKeyDown={event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const next=event.key==='Home'?false:event.key==='End'?true:!full;setFull(next);
  document.getElementById(`${id}-${next?'full':'quick'}`)?.focus();
 }}>{[false,true].map(value=><button key={String(value)} id={`${id}-${value?'full':'quick'}`} role="tab" aria-selected={full===value} aria-controls={`${id}-content`} tabIndex={full===value?0:-1} className={full===value?'selected':''} onClick={()=>setFull(value)}>{t(value?'完整规则':'快速入门')}</button>)}</div>
 <div id={`${id}-content`} role="tabpanel" aria-labelledby={`${id}-${full?'full':'quick'}`} tabIndex={0}><p className="rule-edition">{guide.edition}</p>{full?guide.sections.map(section=><section key={section.title}><h3>{section.title}</h3>{section.text.map(text=><p key={text}>{text}</p>)}</section>):<ol>{guide.quick.map(text=><li key={text}>{text}</li>)}</ol>}</div>
 <p className="rule-source">{locale==='zh'?'按当前牌桌实现编写；遇到有选择的操作，只有符合当前阶段的选项会亮起。':'Written for this table’s implemented rules. Available actions light up when they are legal in the current phase.'}</p></div>;
}
