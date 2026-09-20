import {useState} from 'react';
import type {GameKind} from '../core/types';
import {useLocale,t} from '../i18n';
import {guides} from '../i18n/guides';
export type Guide={edition:string;quick:string[];sections:{title:string;text:string[]}[]};
export function RuleGuide({kind}:{kind:GameKind}){const locale=useLocale(),[full,setFull]=useState(false);const guide=guides[kind][locale];return <div className="rule-guide"><div className="rule-tabs" role="tablist" aria-label={t('规则与教程')}><button role="tab" aria-selected={!full} className={!full?'selected':''} onClick={()=>setFull(false)}>{t('快速入门')}</button><button role="tab" aria-selected={full} className={full?'selected':''} onClick={()=>setFull(true)}>{t('完整规则')}</button></div><p className="rule-edition">{guide.edition}</p>{full?guide.sections.map(section=><section key={section.title}><h3>{section.title}</h3>{section.text.map(text=><p key={text}>{text}</p>)}</section>):<ol>{guide.quick.map(text=><li key={text}>{text}</li>)}</ol>}<p className="rule-source">{locale==='zh'?'按当前牌桌实现编写；遇到有选择的操作，只有符合当前阶段的选项会亮起。':'Written for this table’s implemented rules. Available actions light up when they are legal in the current phase.'}</p></div>;}
