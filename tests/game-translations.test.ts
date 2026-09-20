import {describe,it,expect,beforeAll,afterAll,vi} from 'vitest';
import fs from 'node:fs';
import ts from 'typescript';
import {t,setLocale} from '../src/i18n';
beforeAll(()=>{vi.stubGlobal('document',{documentElement:{lang:''}});setLocale('en');});
afterAll(()=>{setLocale('zh');vi.unstubAllGlobals();});
import {modules} from '../src/core/registry';
import type {GameKind,GameView,Player} from '../src/core/types';
const players:Player[]=Array.from({length:8},(_,i)=>({id:`player0${i}`,name:`Player ${i}`,avatar:'🦊'}));
const translate=t;
const textIn=(v:GameView)=>[v.phase,v.instruction,...v.log,...v.actions.flatMap(a=>[a.title,a.help,...a.choices.flatMap(c=>[c.title,c.subtitle])]),...v.sections.flatMap(s=>[s.title,...s.items.flatMap(i=>[i.title,i.detail])])].filter((v):v is string=>typeof v==='string');
describe('engine translation coverage',()=>{
 it('covers every static Chinese literal in the seven established engines and networking layer',()=>{const names=['avalon','bombs','century','gems','sushi','uno','werewolf','werewolfHosted'];const files=[...names.map(n=>`src/core/games/${n}.ts`),'src/core/room.ts','src/net/RoomClient.ts','worker/index.ts'];const missing=new Set<string>();for(const file of files){const visit=(n:ts.Node)=>{if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))&&/[\u3400-\u9fff]/u.test(n.text)&&/[\u3400-\u9fff]/u.test(t(n.text)))missing.add(n.text);ts.forEachChild(n,visit);};visit(ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true));}expect([...missing]).toEqual([]);});
 it('translates nested card names and choices while preserving player names exactly',()=>{expect(translate('狼人 购买 蓝宝石矿场 · 1 分')).toBe('狼人 purchased Sapphire Mine · 1 points');expect(translate('法官 打出 拆弹')).toBe('法官 played Defuse');expect(translate('预言家 · 攻击 · 已暂停')).toBe('预言家 · Attack · Stopped');expect(translate('表决：甲 赞成；乙 反对')).toBe('Votes: 甲: Approve; 乙: Reject');expect(translate('第 2 夜查验：狼人 · 好人')).toBe('Night 2 check: 狼人 · Council');});
 it.each(['gems','bombs','sushi','century','uno','werewolf','avalon'] as GameKind[])('has English for %s initial views, legal actions, and generated logs',kind=>{const n=kind==='werewolf'?8:kind==='avalon'?5:3;const ps=players.slice(0,n);let state=modules[kind].create(ps,4);const missing=new Set<string>();for(let step=0;step<50;step++){const views=ps.map(p=>({p,v:modules[kind].view(state,p.id)}));for(const {v}of views)for(const text of textIn(v))if(/[\u3400-\u9fff]/u.test(translate(text)))missing.add(text);const available=views.find(x=>x.v.actions.length);if(!available||available.v.finished)break;const a=available.v.actions.find(a=>!['cancel','withdraw','explode'].includes(a.id))||available.v.actions[0];state=modules[kind].apply(state,available.p.id,{action:a.id,values:a.choices.slice(0,a.min).map(c=>c.id)});}expect([...missing]).toEqual([]);});
});
