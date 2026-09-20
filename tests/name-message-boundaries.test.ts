import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {setLocale,t} from '../src/i18n';
import {bombs} from '../src/core/games/bombs';
beforeAll(()=>vi.stubGlobal('document',{documentElement:{lang:''}}));
afterAll(()=>{setLocale('zh');vi.unstubAllGlobals();});
describe('message data boundaries',()=>{
 it.each(['同意','拒绝','梅林','UNO爱好者'])('does not treat a nickname prefix as an app action: %s',name=>{
  setLocale('zh');expect(t(`${name} 的公开库存`)).toBe(`${name} 的公开库存`);expect(t(`${name} 获胜`)).toBe(`${name} 获胜`);
  setLocale('en');expect(t(`${name} 的公开库存`)).toBe(`${name}’s public inventory`);expect(t(`${name} 获胜`)).toBe(`${name} wins`);
 });
 it('preserves a real Favor target named after a color',()=>{
  const players=[{id:'first',name:'梅林',avatar:'🦊'},{id:'second',name:'红色',avatar:'🐻'}];
  let state=bombs.create(players,1);const favor=state.hands.first.find(c=>c.kind==='favor')!;expect(favor).toBeDefined();
  state=bombs.apply(state,'first',{action:'play',values:[favor.id]});
  state=bombs.apply(state,'first',{action:'target',values:['second']});
  const line=state.history.at(-1)!;
  setLocale('zh');expect(t(line)).toBe('梅林 打出索取 → 红色');
  setLocale('en');expect(t(line)).toBe('梅林 played Favor → 红色');
  expect(t('梅林 打出2 张同名组合 → 蓝色')).toBe('梅林 played 2 matching cards → 蓝色');
  expect(t('梅林 打出 变色 → 红色')).toBe('梅林 played Wild → Red');
 });
 it('keeps system game titles translatable inside surrounding labels',()=>{
  setLocale('zh');expect(t('UNO · 玩法')).toBe('七彩接龙 · 玩法');expect(t('删除阿瓦隆战绩')).toBe('删除迷雾远征战绩');
  setLocale('en');expect(t('UNO · 玩法')).toBe('Color Dash · Rules');expect(t('删除阿瓦隆战绩')).toBe('Delete record: Mistbound Quest');
 });
});
