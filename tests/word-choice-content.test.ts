import {describe,it,expect} from 'vitest';
import {codenames} from '../src/core/games/codenames';
import {undercover} from '../src/core/games/undercover';
const players=['普通玩家','梅林','红队','UNO爱好者'].map((name,i)=>({id:`choice-content-${i}`,name,avatar:'🦊'}));
describe('word-game choice content stays separate from translated system labels',()=>{
 it('marks actual dealt words literal while keeping clue-number explanations translatable',()=>{
  let s=codenames.create(players,26,{language:'zh'});
  const captain=s.captains[s.turn==='red'?0:1],operative=players.find((p,i)=>s.teams[i]===s.turn&&!s.captains.includes(p.id))!;
  const clue=codenames.view(s,captain).actions.find(a=>a.id==='clue')!;
  expect(clue.choices.every(c=>c.translateTitle!==false)).toBe(true);
  expect(clue.choices.find(c=>c.id==='0')?.subtitle).toBe('不相关 · 不限猜测次数');
  s=codenames.apply(s,captain,{action:'clue',values:['1'],text:'缤纷世界'});
  const guesses=codenames.view(s,operative.id).actions.find(a=>a.id==='guess')!.choices;
  expect(guesses.find(c=>c.title==='黄金')).toEqual({id:s.cards.find(c=>c.word==='黄金')!.id,title:'黄金',translateTitle:false});
  expect(guesses.every(c=>c.translateTitle===false)).toBe(true);
  expect(guesses.map(c=>c.title)).toEqual(s.cards.filter(c=>!c.revealed).map(c=>c.word));
  expect(codenames.view(s,captain).actions.some(a=>a.id==='guess')).toBe(false);
  expect(codenames.view(s,operative.id).board.cards.every((c:{identity?:string})=>c.identity===undefined)).toBe(true);
 });
 it('offers literal compensation choices only to the entitled captain without exposing identity to operatives',()=>{
  let s=codenames.create(players,26,{language:'zh'});const originalCaptain=s.captains[s.turn==='red'?0:1];
  s=codenames.apply(s,originalCaptain,{action:'clue',values:['1'],text:'缤纷世界'});
  s=codenames.apply(s,originalCaptain,{action:'invalid_clue',values:[]});
  const entitled=s.captains[s.turn==='red'?0:1];
  for(const player of players){const view=codenames.view(s,player.id),choice=view.actions.find(a=>a.id==='penalty_cover');
   if(player.id===entitled){expect(choice!.choices.every(c=>c.translateTitle===false)).toBe(true);expect(choice!.choices.map(c=>c.title)).toEqual(s.cards.filter(c=>c.identity===s.turn&&!c.revealed).map(c=>c.word));}
   else expect(choice).toBeUndefined();
  }
 });
 it('keeps dealer roster names literal and omits voting and role choices',()=>{
  const s=undercover.create(players,1,{language:'zh'}),v=undercover.view(s,players[0].id);
  expect(v.board.players.map((p:{name:string})=>p.name)).toEqual(players.map(p=>p.name));
  expect(v.actions.map(a=>a.id)).toEqual(['ready']);expect(v.actions[0].choices).toEqual([]);
  expect(v.board.players.every((p:{word?:string;role?:string})=>!p.word&&!p.role)).toBe(true);
 });
});
