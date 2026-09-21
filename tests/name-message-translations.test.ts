import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {setLocale,t} from '../src/i18n';
import {werewolfHosted} from '../src/core/games/werewolfHosted';
import {werewolf} from '../src/core/games/werewolf';
import {codenames} from '../src/core/games/codenames';
import {undercover} from '../src/core/games/undercover';
import {sushi} from '../src/core/games/sushi';
import {makeRecord} from '../src/local/storage';
import {formatGameText} from '../src/ui/gameText';
import type {Player,GameText} from '../src/core/types';

beforeAll(()=>{vi.stubGlobal('document',{documentElement:{lang:''}});});
afterAll(()=>{setLocale('zh');vi.unstubAllGlobals();});
const players:Player[]=Array.from({length:13},(_,i)=>({id:`name-test-${i}`,name:['梅林','UNO爱好者','红队','蓝队','安抚','狼人','派西维尔','莫甘娜','队长','危险目标','小王','法官','主持人'][i],avatar:'🦊'}));
function bilingual(source:string,zh:string,en:string,message?:GameText){setLocale('zh');expect.soft(formatGameText(source,message)).toBe(zh);setLocale('en');expect.soft(formatGameText(source,message)).toBe(en);}

describe('dynamic messages preserve names and words independently of system terminology',()=>{
 it.each([
  ['梅林 获胜','梅林 获胜','梅林 wins'],
  ['胜者：梅林、UNO爱好者 · 15 分','胜者：梅林、UNO爱好者 · 15 分','Winner: 梅林、UNO爱好者 · 15 points'],
  ['UNO爱好者 赢得本轮 · +26 分 · 累计 500 分','UNO爱好者 赢得本轮 · +26 分 · 累计 500 分','UNO爱好者 wins the round · +26 points · 500 total'],
  ['表决：梅林 赞成；UNO爱好者 反对','表决：梅林 赞成；UNO爱好者 反对','Votes: 梅林: Approve; UNO爱好者: Reject'],
  ['放逐选票：梅林 → UNO爱好者；红队 → 弃票','放逐选票：梅林 → UNO爱好者；红队 → 弃票','Removal votes: 梅林 → UNO爱好者; 红队 → Abstain'],
  ['警长选票：UNO爱好者 → 红队；梅林 → 红队','警长选票：UNO爱好者 → 红队；梅林 → 红队','Speaker votes: UNO爱好者 → 红队; 梅林 → 红队'],
  ['第 2 天出局：梅林、UNO爱好者。','第 2 天出局：梅林、UNO爱好者。','Day 2 departures: 梅林、UNO爱好者.'],
  ['第 2 夜查验：梅林 · 狼人','第 2 夜查验：梅林 · 狼人','Night 2 check: 梅林 · Werewolf'],
  ['第 2 夜用药：毒杀 UNO爱好者','第 2 夜用药：毒杀 UNO爱好者','Night 2 remedy: Sleep remedy for UNO爱好者'],
  ['第 2 夜守护：空守','第 2 夜守护：空守','Night 2 protection: No protection'],
  ['第 2 夜刀口：空刀','第 2 夜刀口：空刀','Night 2 Wolf attack: No selection'],
  ['梅林 开枪带走了 红队。','梅林 开枪带走了 红队。','梅林 shot 红队.'],
  ['警徽移交给 UNO爱好者。','警徽移交给 UNO爱好者。','The council badge passed to UNO爱好者.'],
  ['UNO爱好者 打出 安抚','UNO爱好者 打出 拆弹','UNO爱好者 played Defuse'],
  ['UNO爱好者 打出索取 → 梅林','UNO爱好者 打出索取 → 梅林','UNO爱好者 played Favor → 梅林'],
  ['梅林 打出 变色 → 红色','梅林 打出 变色 → 红色','梅林 played Wild → Red'],
  ['红队 打出 红色 跳过','红队 打出 红色 跳过','红队 played Red Skip'],
  ['梅林 购买 蓝宝石矿场 · 1 分','梅林 购买 蓝宝石矿场 · 1 分','梅林 purchased Sapphire Mine · 1 point'],
  ['梅林 · 同花顺','梅林 · 同花顺','梅林 · Straight flush'],
  ['小王 → 大王 · 小王','小王 → 大王 · 小王','小王 → 大王 · Small joker'],
  ['梅林 · 自摸 · +2','梅林 · 自摸 · +2','梅林 · Self-draw · +2'],
  ['UNO爱好者 的牌桌','UNO爱好者 的牌桌','UNO爱好者’s table'],
  ['查看 梅林 的公开库存','查看 梅林 的公开库存','View 梅林’s public inventory'],
  ['正义获胜 · 梅林幸存','正义获胜 · 先知幸存','Good wins · The Seer stayed hidden'],
 ])('translates system fragments without rewriting captured content: %s',(source,zh,en)=>{bilingual(source,zh,en);});

 it('preserves actual hosted night targets, while translating empty choices and remedies',()=>{
  let s=werewolfHosted.create(players,1,{werewolfMode:'judge',moderatorID:players[12].id,werewolfPreset:'classic'});
  s=werewolfHosted.apply(s,players[12].id,{action:'judge-guard',values:[players[0].id]});
  bilingual(s.privateLog.at(-1)!,'第 1 夜守护：梅林','Night 1 protection: 梅林');
  s=werewolfHosted.apply(s,players[12].id,{action:'judge-wolves',values:[players[1].id]});
  bilingual(s.privateLog.at(-1)!,'第 1 夜刀口：UNO爱好者','Night 1 Wolf attack: UNO爱好者');
  const potion=werewolfHosted.view(s,players[12].id).actions[0];
  bilingual(potion.help!,'刀口：UNO爱好者。不可自救，同夜限一瓶药。','Wolf attack: UNO爱好者. No self-rescue; one remedy per night.');
 });

 it('preserves both names in actual private wolf plans',()=>{
  let s=werewolf.create(players.slice(0,12),3,{werewolfPreset:'classic'});
  const wolf=Object.keys(s.roles).find(id=>s.roles[id]==='wolf')!;
  // Change only this fixture nickname; the role deal and legal action remain real.
  s.players.find(p=>p.id===wolf)!.name='梅林';
  s=werewolf.apply(s,wolf,{action:'wolf',values:[players[1].id]});
  const knowledge=werewolf.view(s,wolf).sections[0].items.find(i=>i.id==='wolfPlans')!;
  bilingual(knowledge.detail!,'梅林：UNO爱好者','梅林: UNO爱好者',knowledge.detailText);
  const nextWolf=Object.keys(s.roles).find(id=>s.roles[id]==='wolf'&&id!==wolf)!;
  s.players.find(p=>p.id===nextWolf)!.name='红队';
  s=werewolf.apply(s,nextWolf,{action:'wolf',values:['skip']});
  const plans=werewolf.view(s,wolf).sections[0].items.find(i=>i.id==='wolfPlans')!;
  // The private plan list follows seat order; no extra prefix marks it as a list.
  const first=s.players.findIndex(p=>p.id===wolf)<s.players.findIndex(p=>p.id===nextWolf);
  bilingual(plans.detail!,first?'梅林：UNO爱好者；红队：空刀':'红队：空刀；梅林：UNO爱好者',first?'梅林: UNO爱好者; 红队: No selection':'红队: No selection; 梅林: UNO爱好者',plans.detailText);
 });

 it('preserves an actual captain clue even when it is also a translated role name',()=>{
  let s=codenames.create(players.slice(0,4),3,{language:'zh'});
  const captain=s.captains[s.turn==='red'?0:1],team=s.turn==='red'?'红队':'蓝队',englishTeam=s.turn==='red'?'Red team':'Blue team';
  s=codenames.apply(s,captain,{action:'clue',values:['1'],text:'梅林'});
  bilingual(s.history.at(-1)!,`${team}: 梅林 · 1`,`${englishTeam}: 梅林 · 1`);
 });

 it('preserves the actual operative name and revealed board word, translating only its identity',()=>{
  let s=codenames.create(players.slice(0,4),3,{language:'zh'});
  const team=s.turn,captain=s.captains[team==='red'?0:1],operative=s.players.find((p,i)=>s.teams[i]===team&&!s.captains.includes(p.id))!;
  s=codenames.apply(s,captain,{action:'clue',values:['1'],text:'梅林'});
  const card=s.cards.find(c=>c.identity==='assassin')!;
  s=codenames.apply(s,operative.id,{action:'guess',values:[card.id]});
  bilingual(s.history.at(-2)!,`${operative.name}: ${card.word} → 刺客`,`${operative.name}: ${card.word} → Assassin`);
 });

 it('preserves compensation words which overlap card and team terminology',()=>{
  for(const word of ['梅林','安抚','红队']){
   let s=codenames.create(players.slice(0,4),3,{language:'zh'});
   const captain=s.captains[s.turn==='red'?0:1];
   s=codenames.apply(s,captain,{action:'clue',values:['1'],text:'月球探险'});
   s=codenames.apply(s,captain,{action:'invalid_clue',values:[]});
   const card=s.cards.find(c=>c.identity===s.turn)!;card.word=word;
   s=codenames.apply(s,s.captains[s.turn==='red'?0:1],{action:'penalty_cover',values:[card.id]});
   bilingual(s.history.at(-1)!,`补偿揭晓：${word}`,`Compensation reveal: ${word}`);
  }
 });

 it('preserves the real odd-word runoff candidate list and description target',()=>{
  let s=undercover.create(players.slice(0,4),1);
  for(const p of s.players)s=undercover.apply(s,p.id,{action:'ready',values:[]});
  bilingual(undercover.view(s,players[0].id).instruction,'请 梅林 描述','梅林: describe your word');
  for(const p of s.players)s=undercover.apply(s,p.id,{action:'described',values:[]});
  for(const [i,p]of s.players.entries())s=undercover.apply(s,p.id,{action:'vote',values:[players[i%2===0?1:0].id]});
  bilingual(s.history.at(-1)!,'平票：UNO爱好者、梅林','Tie: UNO爱好者、梅林');
 });

 it('keeps real three-round Sushi result names and per-round points intact in history summaries',()=>{
  let s=sushi.create(players.slice(0,3),118);
  while(!s.finished){const p=s.players.find(p=>sushi.view(s,p.id).actions.some(a=>a.id==='pick'))!,a=sushi.view(s,p.id).actions.find(a=>a.id==='pick')!;s=sushi.apply(s,p.id,{action:a.id,values:[a.choices[0].id]});}
  expect(s.scores).toEqual([38,23,38]);
  const v=sushi.view(s,players[0].id),record=makeRecord(v,'name-sushi',players[0].id,players[0],'cloud')!;
  expect(record.result).toBe('draw');expect(record.summary).toBe('胜者：梅林、红队');
  bilingual(record.summary,'胜者：梅林、红队','Winner: 梅林、红队');
  for(const [i,points]of s.roundScores.entries()){
   const row=`${players[0].name} +${points[0]} · ${players[1].name} +${points[1]} · ${players[2].name} +${points[2]}`;
   bilingual(s.history[i+1],`第 ${i+1} 轮：${row}`,`Round ${i+1}: ${row}`);
  }
 });
});
