import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {setLocale} from '../src/i18n';
import {formatGameText} from '../src/ui/gameText';
import {avalon} from '../src/core/games/avalon';
import {werewolf} from '../src/core/games/werewolf';
import {werewolfHosted} from '../src/core/games/werewolfHosted';
import type {GameText,GameView} from '../src/core/types';
beforeAll(()=>vi.stubGlobal('document',{documentElement:{lang:''}}));
afterAll(()=>{setLocale('zh');vi.unstubAllGlobals();});
const players=Array.from({length:13},(_,i)=>({id:`structured-${i}`,name:['梅林；红队','{votes}','UNO爱好者','正常玩家','红队','空刀','{target}','空守','蓝队','{plans}','梅林','{name}','主持人'][i],avatar:'🦊'}));
function latest(view:GameView){const i=view.log.length-1;return formatGameText(view.log[i],view.logText?.[i]);}
describe('structured social messages keep names opaque',()=>{
 it('inserts placeholder-looking names once and changes only system text with locale',()=>{
  const message:GameText={template:'表决：{votes}',values:{votes:{template:'{name} 赞成',values:{name:'{votes}；梅林'}}}};
  setLocale('en');expect(formatGameText('',message)).toBe('Votes: {votes}；梅林: Approve');
  setLocale('zh');expect(formatGameText('',message)).toBe('表决：{votes}；梅林 赞成');
 });
 it('publishes Avalon votes only once everyone voted and preserves punctuation inside each nickname',()=>{
  let s=avalon.create(players.slice(0,5),4);const leader=s.players[s.leader].id;
  s=avalon.apply(s,leader,{action:'propose',values:players.slice(0,2).map(p=>p.id)});
  for(let i=0;i<5;i++){
   s=avalon.apply(s,players[i].id,{action:'approve',values:[i===1?'no':'yes']});
   if(i<4)expect(avalon.view(s,players[4].id).logText).toEqual({});
  }
  const v=avalon.view(s,players[0].id);
  expect(s.log.at(-1)).toBe('表决：梅林；红队 赞成；{votes} 反对；UNO爱好者 赞成；正常玩家 赞成；红队 赞成');
  setLocale('en');expect(latest(v)).toBe('Votes: 梅林；红队: Approve; {votes}: Reject; UNO爱好者: Approve; 正常玩家: Approve; 红队: Approve');
  setLocale('zh');expect(latest(v)).toBe(s.log.at(-1));
  v.logText![1].template='mutated';expect(s.logText![1].template).toBe('表决：{votes}');
 });
 it.each(['vote','electionVote'] as const)('preserves raw source and target names in Werewolf %s',stage=>{
  let s=werewolf.create(players.slice(0,6),1);s.stage=stage;s.candidates=stage==='electionVote'?[players[0].id,players[1].id]:[];
  const voting=stage==='electionVote'?players.slice(2,6):players.slice(0,6);
  for(const [i,p]of voting.entries())s=werewolf.apply(s,p.id,{action:stage==='vote'?'vote':'elect',values:[i===0?'skip':players[0].id]});
  const v=werewolf.view(s,players[0].id),i=v.log.findIndex(line=>line.startsWith(stage==='vote'?'放逐选票：':'警长选票：'));
  setLocale('en');expect(formatGameText(v.log[i],v.logText?.[i])).toBe((stage==='vote'?'Removal votes: ':'Speaker votes: ')+voting.map((p,i)=>`${p.name} → ${i===0?'Abstain':'梅林；红队'}`).join('; '));
  setLocale('zh');expect(formatGameText(v.log[i],v.logText?.[i])).toBe(v.log[i]);
 });
 it('returns structured wolf plans only to wolves, with source and target treated as literal names',()=>{
  let s=werewolf.create(players.slice(0,12),1,{werewolfPreset:'classic'});
  const wolves=s.players.filter(p=>s.roles[p.id]==='wolf');
  s.players.find(p=>p.id===wolves[0].id)!.name='梅林；红队';
  s.players.find(p=>p.id===wolves[1].id)!.name='{plans}';
  const target=s.players.find(p=>s.roles[p.id]!=='wolf')!;target.name='{target}；红队';
  s=werewolf.apply(s,wolves[0].id,{action:'wolf',values:[target.id]});
  s=werewolf.apply(s,wolves[1].id,{action:'wolf',values:['skip']});
  for(const p of s.players){
   const view=werewolf.view(s,p.id),plan=view.sections[0].items.find(i=>i.id==='wolfPlans');
   if(s.roles[p.id]==='wolf'){
    expect(plan?.detailText).toBeDefined();setLocale('en');
    expect(formatGameText(plan!.detail!,plan!.detailText)).toBe('梅林；红队: {target}；红队; {plans}: No selection');
    setLocale('zh');expect(formatGameText(plan!.detail!,plan!.detailText)).toBe(plan!.detail);
   }else{expect(plan).toBeUndefined();expect(view.board.ownKnowledge.some((i:{id:string})=>i.id==='wolfPlans')).toBe(false);}
   expect(view.logText).toEqual({});
  }
 });
 it('keeps hosted night selections private and distinguishes a name from an empty choice',()=>{
  let s=werewolfHosted.create(players,2,{werewolfMode:'judge',moderatorID:players[12].id,werewolfPreset:'classic'});
  s=werewolfHosted.apply(s,players[12].id,{action:'judge-guard',values:[players[7].id]});
  s=werewolfHosted.apply(s,players[12].id,{action:'judge-wolves',values:[players[5].id]});
  const moderator=werewolfHosted.view(s,players[12].id).board.moderatorOnly;
  setLocale('en');expect(formatGameText(moderator.log[0],moderator.logText[0])).toBe('Night 1 protection: 空守');
  expect(formatGameText(moderator.log[1],moderator.logText[1])).toBe('Night 1 Wolf attack: 空刀');
  for(const p of players.slice(0,12)){const v=werewolfHosted.view(s,p.id);expect(v.board.moderatorOnly).toBeUndefined();expect(v.logText).toEqual({});}
 });
 it('restores legacy string-only logs and appends structured messages without changing old entries',()=>{
  let s=avalon.create(players.slice(0,5),1);delete s.logText;
  s.log.push('表决：甲 赞成；乙 反对');
  s=avalon.apply(s,s.players[s.leader].id,{action:'propose',values:players.slice(0,2).map(p=>p.id)});
  for(const p of s.players)s=avalon.apply(s,p.id,{action:'approve',values:['yes']});
  expect(s.logText?.[1]).toBeUndefined();expect(s.logText?.[2]).toBeDefined();
  setLocale('en');expect(formatGameText(s.log[1])).toBe('Votes: 甲: Approve; 乙: Reject');
  const restored=JSON.parse(JSON.stringify(s));expect(latest(avalon.view(restored,players[0].id))).toContain('梅林；红队: Approve');
 });
});
