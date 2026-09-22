import {useId,useState} from 'react';
import {t,useLocale} from '../i18n';
import {MAHJONG_MODES,type MahjongMode} from '../core/mahjongModes';
import {tileTitle} from '../core/games/mahjong';
import {mahjongGeneral} from '../i18n/mahjongGuide';
import {mahjongVariantGuide} from '../i18n/mahjongVariants';
import {classicGuides} from '../i18n/classicGuides';
import {MahjongArt} from './ClassicCardArt';
import './mahjong-guide.css';
export function MahjongRuleGuide({mode='guangdong',legacy=false}:{mode?:MahjongMode;legacy?:boolean}){
 const locale=useLocale(),[tab,setTab]=useState(0),[selected,setSelected]=useState(mode),id=useId();
 const tabs=locale==='zh'?['快速入门','完整规则','模式规则']:['Quick start','Full rules','Variant rules'];
 const guide=tab===2?(legacy?classicGuides.mahjong[locale]:mahjongVariantGuide(selected,locale)):mahjongGeneral[locale];
 return <div className="rule-guide mahjong-guide">
  <div className="rule-tabs" role="tablist" aria-label={t('规则与教程')} onKeyDown={e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
   const next=e.key==='Home'?0:e.key==='End'?2:(tab+(e.key==='ArrowRight'?1:2))%3;setTab(next);document.getElementById(`${id}-tab-${next}`)?.focus();
  }}>{tabs.map((label,i)=><button key={label} id={`${id}-tab-${i}`} role="tab" aria-selected={tab===i} aria-controls={`${id}-content`} tabIndex={tab===i?0:-1} className={tab===i?'selected':''} onClick={()=>setTab(i)}>{label}</button>)}</div>
  <div id={`${id}-content`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}>
   {tab===2&&!legacy&&<label className="mahjong-guide-mode">{locale==='zh'?'选择模式':'Choose a variant'}<select aria-label={locale==='zh'?'查看模式规则':'View variant rules'} value={selected} onChange={e=>setSelected(e.target.value as MahjongMode)}>{Object.entries(MAHJONG_MODES).map(([key,name])=><option key={key} value={key}>{t(name)}</option>)}</select></label>}
   {tab===2&&legacy&&<p className="rule-edition">{locale==='zh'?'这是更新前开始的牌局，继续使用开局时的规则；新开局会使用新版模式规则。':'This saved deal keeps its original rules. Start a new deal to use the updated variants.'}</p>}
   {tab!==2&&<p className="rule-edition">{guide.edition}</p>}
   {tab===0&&<figure className="mahjong-example"><figcaption>{locale==='zh'?'一手最常见的胡牌':'A typical winning hand'}</figcaption><div className="mahjong-example-groups">{[[0,1,2],[12,13,14],[18,19,20],[33,33,33],[7,7]].map((group,i)=><div key={i}><span>{group.map((v,j)=><span className="mahjong-example-tile" key={j} role="img" aria-label={t(tileTitle(v))}><MahjongArt value={v}/></span>)}</span><small>{locale==='zh'?(i===4?'一对将':i===3?'刻子':'顺子'):(i===4?'Pair':i===3?'Triplet':'Run')}</small></div>)}</div><p>{locale==='zh'?'3 ＋ 3 ＋ 3 ＋ 3 ＋ 2 ＝ 14 张':'3 + 3 + 3 + 3 + 2 = 14 tiles'}</p></figure>}
   {tab===0?<ol>{guide.quick.map(text=><li key={text}>{text}</li>)}</ol>:guide.sections.map(section=><section key={section.title}><h3>{section.title}</h3>{section.text.map(text=><p key={text}>{text}</p>)}</section>)}
  </div>
 </div>;
}
