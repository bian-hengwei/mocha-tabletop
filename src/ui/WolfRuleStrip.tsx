import {BookOpen} from 'lucide-react';
import {WEREWOLF_PRESETS} from '../core/werewolfPresets';
import {t} from '../i18n';
import './wolf-rule-strip.css';
export function WolfRuleStrip({preset='auto',winRule='sides'}:{preset?:string;winRule?:string}){return <aside className="wolf-rule-strip" aria-label={t('胜负条件')}><BookOpen size={14}/><span><small>{t('身份牌型')}</small><strong>{t(WEREWOLF_PRESETS.find(p=>p.id===preset)?.name||'随人数自动配置')}</strong></span><span><small>{t('胜负条件')}</small><strong>{t(winRule==='parity'?'人数：狼人达到好人人数':'屠边：清除平民或神职')}</strong></span></aside>;}
