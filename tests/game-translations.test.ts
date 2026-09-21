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
 it.each([
  ['0 张','0 cards'],['1 张','1 card'],['2 张','2 cards'],
  ['需要 3 位不同玩家','Needs 3 distinct players'],['需要 4 位不同玩家','Needs 4 distinct players'],['需要 2–4 位不同玩家','Needs 2–4 distinct players'],
  ['支付 1 枚任选香料','Pay any 1 spice cube'],['支付 2 枚任选香料','Pay any 2 spice cubes'],
  ['归还 1 枚香料','Return 1 spice'],['归还 2 枚香料','Return 2 spices'],
  ['归还 1 枚香料（还需 2 枚）','Return 1 spice (2 still to return)'],['归还 2 枚香料（还需 1 枚）','Return 2 spices (1 still to return)'],
  [' · 还可升级 1 次',' · 1 upgrade left'],[' · 还可升级 2 次',' · 2 upgrades left'],
  ['升级 1 次','Upgrade 1 step'],['升级 2 次','Upgrade 2 steps'],
  ['再升级 1 次','Up to 1 more upgrade'],['再升级 2 次','Up to 2 more upgrades'],
  ['暂时离线 · 座位已保留','is offline · Seat reserved'],['暂时离线 · 所有座位已保留','are offline · Seats reserved'],
  ['1 张手牌','1 card in hand'],['2 张手牌','2 cards in hand'],
  ['1 张 · 仅你可见','1 card · Private'],['2 张 · 仅你可见','2 cards · Private'],
  ['确认 1 张','Confirm 1 card'],['确认 2 张','Confirm 2 cards'],
  ['已选 1 张','1 card selected'],['已选 2 张','2 cards selected'],
  ['0 单 · 金 1 / 银 2','0 orders · Gold 1 / Silver 2'],
  ['1 单 · 金 2 / 银 3','1 order · Gold 2 / Silver 3'],
  ['2 单 · 金 3 / 银 4','2 orders · Gold 3 / Silver 4'],
 ])('uses the correct English count and preserves Chinese: %s',(source,expected)=>{
  expect(t(source)).toBe(expected);setLocale('zh');expect(t(source)).toBe(source);setLocale('en');expect(t(source)).toBe(expected);
 });
 it('covers every static Chinese literal in the seven established engines and networking layer',()=>{const names=['avalon','bombs','century','gems','sushi','uno','werewolf','werewolfHosted'];const files=[...names.map(n=>`src/core/games/${n}.ts`),'src/core/room.ts','src/net/RoomClient.ts','worker/index.ts'];const missing=new Set<string>();for(const file of files){const visit=(n:ts.Node)=>{if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))&&/[\u3400-\u9fff]/u.test(n.text)&&/[\u3400-\u9fff]/u.test(t(n.text)))missing.add(n.text);ts.forEachChild(n,visit);};visit(ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true));}expect([...missing]).toEqual([]);});
 it('translates nested card names and choices while preserving player names exactly',()=>{expect(translate('狼人 购买 蓝宝石矿场 · 1 分')).toBe('狼人 purchased Sapphire Mine · 1 points');expect(translate('法官 打出 拆弹')).toBe('法官 played Defuse');expect(translate('狼人 已出牌')).toBe('狼人 played');expect(translate('预言家 · 攻击 · 已暂停')).toBe('预言家 · Attack · Stopped');expect(translate('预言家 · 攻击 · 已被否决')).toBe('预言家 · Attack · Blocked');expect(translate('狼人 · 2 张同名组合 · 已被否决')).toBe('狼人 · 2 matching cards · Blocked');expect(translate('表决：甲 赞成；乙 反对')).toBe('Votes: 甲: Approve; 乙: Reject');expect(translate('第 2 夜查验：狼人 · 好人')).toBe('Night 2 check: 狼人 · Council');});
 it.each(['gems','bombs','sushi','century','uno','werewolf','avalon'] as GameKind[])('has English for %s initial views, legal actions, and generated logs',kind=>{const n=kind==='werewolf'?8:kind==='avalon'?5:3;const ps=players.slice(0,n);let state=modules[kind].create(ps,4);const missing=new Set<string>();for(let step=0;step<50;step++){const views=ps.map(p=>({p,v:modules[kind].view(state,p.id)}));for(const {v}of views)for(const text of textIn(v))if(/[\u3400-\u9fff]/u.test(translate(text)))missing.add(text);const available=views.find(x=>x.v.actions.length);if(!available||available.v.finished)break;const a=available.v.actions.find(a=>!['cancel','withdraw','explode'].includes(a.id))||available.v.actions[0];state=modules[kind].apply(state,available.p.id,{action:a.id,values:a.choices.slice(0,a.min).map(c=>c.id)});}expect([...missing]).toEqual([]);});
});
