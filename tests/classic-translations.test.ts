import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import fs from 'node:fs';
import ts from 'typescript';
import {modules} from '../src/core/registry';
import {pokerHint} from '../src/core/games/poker';
import {makeRecord} from '../src/local/storage';
import type {GameKind,GameView} from '../src/core/types';
let t:(value:string)=>string;
beforeAll(async()=>{vi.stubGlobal('document',{documentElement:{lang:''}});vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{}});const i18n=await import('../src/i18n');i18n.setLocale('en');t=i18n.t;});
afterAll(()=>vi.unstubAllGlobals());
const players=Array.from({length:4},(_,i)=>({id:`translation-${i}`,name:`Player ${i}`,avatar:'🐶'}));
const strings=(v:GameView)=>[v.phase,v.instruction,...v.log,...v.actions.flatMap(a=>[a.title,a.help||'',...a.choices.map(c=>c.title)])];
describe('Classic game translations and result records',()=>{
 it('translates every static engine and table literal',()=>{const missing=new Set<string>();for(const file of ['src/core/games/poker.ts','src/core/games/mahjong.ts','src/core/games/mahjongScoring.ts','src/core/mahjongModes.ts','src/ui/ClassicTable.tsx','src/ui/RuleOptions.tsx']){const visit=(n:ts.Node)=>{if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))&&/[\u3400-\u9fff]/u.test(n.text)&&/[\u3400-\u9fff]/u.test(t(n.text)))missing.add(n.text);ts.forEachChild(n,visit);};visit(ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true));}expect([...missing]).toEqual([]);});
 it.each(['doudizhu','guandan','mahjong'] as GameKind[])('translates %s views, action labels and generated logs',kind=>{const ps=players.slice(0,kind==='doudizhu'?3:4);let state=modules[kind].create(ps,13),missing=new Set<string>();for(let step=0;step<150;step++){const all=ps.map(p=>({p,v:modules[kind].view(state,p.id)}));for(const {v}of all)for(const text of strings(v))if(/[\u3400-\u9fff]/u.test(t(text)))missing.add(text);if(all[0].v.finished||state.phase==='roundEnd')break;const {p,v}=all.find(x=>x.v.actions.length)!;const a=v.actions.find(a=>a.id==='hu')||v.actions[0];let values=a.choices.slice(0,a.min).map(c=>c.id),action=a.id;if(kind!=='mahjong'&&state.phase==='play'){values=pokerHint(state);action=values.length?'play':'pass';}state=modules[kind].apply(state,p.id,{action,values});}expect([...missing]).toEqual([]);});
 it('does not mistake existing spice trades for player tribute logs',()=>{expect(t('🟢 豆蔻 1 → 🟡 姜黄 1 · 🔴 藏红花 2')).toBe('🟢 Cardamom 1 → 🟡 Turmeric 1 · 🔴 Saffron 2');});
 it('keeps player names intact in Chinese classic game logs',()=>{expect(t('北 · 同花顺')).toBe('北 · Straight flush');expect(t('东 · 7万')).toBe('东 · 7 Characters');expect(t('红中 · 自摸 · +2')).toBe('红中 · Self-draw · +2');expect(t('小王 → 大王 · 小王')).toBe('小王 → 大王 · Small joker');});
 it('records Mahjong draws and shared score ties as draws, while partner victories remain wins',()=>{let s=modules.mahjong.create(players,1);s.finished=true;s.winners=[];expect(makeRecord(modules.mahjong.view(s,players[0].id),'m0',players[0].id,players[0],'cloud')?.result).toBe('draw');s.winners=players.slice(0,2).map(p=>p.id);expect(makeRecord(modules.mahjong.view(s,players[0].id),'m1',players[0].id,players[0],'cloud')?.result).toBe('draw');const gd=modules.guandan.create(players,1);gd.finished=true;gd.winners=[players[0].id,players[2].id];expect(makeRecord(modules.guandan.view(gd,players[0].id),'g0',players[0].id,players[0],'cloud')?.result).toBe('win');});
});
