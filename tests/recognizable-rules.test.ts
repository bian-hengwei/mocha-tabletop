import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {t,setLocale} from '../src/i18n';
import {bombs,BOMB_TITLES,type BombKind} from '../src/core/games/bombs';
import {sushi} from '../src/core/games/sushi';
import {uno} from '../src/core/games/uno';
import {avalon,avalonTeamSizes} from '../src/core/games/avalon';
import {GAMES,type Player} from '../src/core/types';
const players=(n:number):Player[]=>Array.from({length:n},(_,i)=>({id:`p${i}`,name:`Player ${i}`,avatar:'🐱'}));
beforeAll(()=>vi.stubGlobal('document',{documentElement:{lang:''}}));
afterAll(()=>{setLocale('zh');vi.unstubAllGlobals();});
const tally=(kinds:string[])=>Object.fromEntries([...new Set(kinds)].map(k=>[k,kinds.filter(x=>x===k).length]));
describe('publisher base components remain exact',()=>{
 it.each([2,3,4,5])('uses the 2025 kitten deck for %i players, with no renamed-card balance changes',n=>{
  const s=bombs.create(players(n),2025),all=[...s.deck,...Object.values(s.hands).flat()];
  expect(tally(all.map(c=>c.kind))).toEqual({bomb:n-1,defuse:n+(n===5?1:2),attack:4,skip:4,favor:4,shuffle:4,future:5,nope:5,moonCat:4,cloudCat:4,leafCat:4,starCat:4,sunCat:4});
  expect(Object.values(s.hands).map(h=>h.length)).toEqual(Array(n).fill(8));
 });
 it('uses the complete 108-card drafting deck',()=>{
  const s=sushi.create(players(5),33);
  expect(tally([...s.deck,...s.hands.flat()].map(c=>c.kind))).toEqual({tempura:14,sashimi:14,dumpling:14,maki1:6,maki2:12,maki3:8,egg:5,salmon:10,squid:5,wasabi:6,pudding:10,chopsticks:4});
 });
 it('uses the classic 108-card color deck with default 500-point play and challenges',()=>{
  const s=uno.create(players(4),2012),all=[...s.deck,...s.hands.flat(),...s.discard];
  expect(all).toHaveLength(108);expect(s.mode).toBe('match');expect(s.challengeEnabled).toBe(true);
  expect(tally(all.map(c=>c.color))).toEqual({red:25,yellow:25,green:25,blue:25,wild:8});
  expect(tally(all.map(c=>String(c.value)))).toEqual({'0':4,'1':8,'2':8,'3':8,'4':8,'5':8,'6':8,'7':8,'8':8,'9':8,skip:8,reverse:8,draw2:8,wild:4,wild4:4});
 });
 it.each([
  [5,2,[2,3,2,3,3]],[6,2,[2,3,4,3,4]],[7,3,[2,3,3,4,4]],
  [8,3,[3,4,4,5,5]],[9,3,[3,4,4,5,5]],[10,4,[3,4,4,5,5]],
 ] as const)('keeps %i-player quests and the Watcher/False Seer role mix', (n,evil,teams)=>{
  const s=avalon.create(players(n),1);
  expect(avalonTeamSizes(n)).toEqual(teams);
  expect(Object.values(s.roles).filter(r=>['morgana','assassin','minion'].includes(r))).toHaveLength(evil);
  for(const role of ['merlin','percival','morgana','assassin'])expect(Object.values(s.roles).filter(r=>r===role)).toHaveLength(1);
 });
});
describe('clear names and restored saves',()=>{
 it('uses functional card names in both languages and preserves player names in logs',()=>{
  setLocale('zh');expect(Object.values(BOMB_TITLES).slice(0,8)).toEqual(['爆炸牌','拆弹','攻击','跳过','索取','洗牌','预知三张','否决']);
  expect(t('梅林 / 莫甘娜')).toBe('先知 / 伪先知');
  setLocale('en');expect(Object.values(BOMB_TITLES).slice(0,8).map(t)).toEqual(['Bomb','Defuse','Attack','Skip','Favor','Shuffle','Peek 3','Nope']);
  expect(t('狼人')).toBe('Werewolf');expect(t('刺客')).toBe('Assassin');
  expect(t('加班 抽到了爆炸牌')).toBe('加班 drew Bomb');
  expect(t('攻击 抽到了闹闹牌')).toBe('攻击 drew Bomb');
  for(const game of Object.values(GAMES))expect(t(game.name)).not.toMatch(/[\u3400-\u9fff]/u);
 });
 it('derives actions and sections from card kind after loading a pre-rename save',()=>{
  const s=bombs.create(players(3),25);
  s.hands.p0=[{id:'old-defuse',kind:'defuse',title:'安抚'},{id:'old-attack',kind:'attack',title:'加班'}];
  const before=JSON.stringify(s),view=bombs.view(JSON.parse(before),'p0');
  expect(view.sections[0].items.map(c=>c.title)).toEqual(['拆弹','攻击']);
  expect(view.actions.find(a=>a.id==='play')?.choices[0].title).toBe('攻击');
  expect(JSON.stringify(s)).toBe(before);
  expect(bombs.apply(s,'p0',{action:'play',values:['old-attack']}).phase.kind).toBe('response');
 });
});
