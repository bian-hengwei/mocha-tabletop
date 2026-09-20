import {MAHJONG_MODES} from '../core/games/mahjong';
import type {GameKind,GameOptions} from '../core/types';
import {WEREWOLF_PRESETS,WOLF_ROLE_LABELS,werewolfPreset,type WolfRole} from '../core/werewolfPresets';
import {t} from '../i18n';
import {RoleArt} from './Art';

export function RuleOptions({kind,options,onChange,disabled=false,playerCount}:{kind:GameKind;options:GameOptions;disabled?:boolean;playerCount?:number;onChange:(next:GameOptions)=>void}) {
 if(kind==='mahjong')return <div className="rule-options"><label>{t('麻将玩法')}<select disabled={disabled} aria-label={t('麻将玩法')} value={options.mahjongMode||'guangdong'} onChange={e=>onChange({...options,mahjongMode:e.target.value as GameOptions['mahjongMode']})}>{Object.entries(MAHJONG_MODES).map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</select></label><small>{t('可碰、杠，不吃牌')}</small></div>;
 if(kind==='uno')return <div className="rule-options"><label>{t('比赛长度')}<select disabled={disabled} aria-label={t('比赛长度')} value={options.unoMode||'match'} onChange={e=>onChange({...options,unoMode:e.target.value as GameOptions['unoMode']})}><option value="match">{t('累计 500 分')}</option><option value="single">{t('只玩一轮')}</option></select></label><label className="uno-challenge-toggle"><span>{t('+4 质疑规则')}</span><input type="checkbox" disabled={disabled} role="switch" aria-label={t('+4 质疑规则')} checked={options.unoChallenge!==false} onChange={e=>onChange({...options,unoChallenge:e.target.checked})}/><small>{t(options.unoChallenge===false?'关闭：系统限制非法 +4，直接罚牌':'开启：允许诈出 +4，下家可质疑')}</small></label></div>;
 if(kind!=='werewolf')return null;
 const preset=WEREWOLF_PRESETS.find(p=>p.id===(options.werewolfPreset||'auto'))||WEREWOLF_PRESETS[0];
 const count=Math.min(preset.max,Math.max(preset.min,playerCount??9));
 const deck=werewolfPreset(count,preset.id),roles=Object.entries(WOLF_ROLE_LABELS) as [WolfRole,string][];
 const special=preset.id==='idiot'?'白痴被放逐时翻牌存活，失去投票权；被刀、毒或枪击仍会出局。':preset.id==='wolfKing'?'狼王出局可开枪；被毒或自爆不能开枪，最后一狼出局直接结算。':null;
 return <div className="rule-options wolf-options"><label>{t('身份牌型')}<select disabled={disabled} aria-label={t('身份牌型')} value={preset.id} onChange={e=>onChange({...options,werewolfPreset:e.target.value as GameOptions['werewolfPreset']})}>{WEREWOLF_PRESETS.map(p=><option key={p.id} value={p.id}>{t(p.name)}</option>)}</select></label><label>{t('胜负条件')}<select disabled={disabled} aria-label={t('胜负条件')} value={options.werewolfWin||'sides'} onChange={e=>onChange({...options,werewolfWin:e.target.value as GameOptions['werewolfWin']})}><option value="sides">{t('屠边：清除平民或神职')}</option><option value="parity">{t('人数：狼人达到好人人数')}</option></select></label>
 <section className="wolf-composition" aria-label={t('身份配置')}><header><b>{count} {t('人配置')}</b><small>{preset.min===preset.max?t('固定人数'):t('随人数调整')}{options.werewolfMode==='judge'?' · '+t('法官不占身份位'):''}</small></header><div className="wolf-role-list">{roles.map(([role,label])=>{const amount=deck.filter(r=>r===role).length;return amount?<div className="wolf-role-token" key={role}><RoleArt role={role}/><span>{t(label)}<b>×{amount}</b></span></div>:null;})}</div>{special&&<p>{t(special)}</p>}</section></div>;
}
