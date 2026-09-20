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
 it('marks avatar-prefixed vote targets literal without exposing secret words or roles',()=>{
  let s=undercover.create(players,1,{language:'zh'});
  for(const player of players)s=undercover.apply(s,player.id,{action:'ready',values:[]});
  while(s.phase==='describe')s=undercover.apply(s,players[s.order[s.speaker]].id,{action:'described',values:[]});
  const view=undercover.view(s,players[0].id),choices=view.actions.find(a=>a.id==='vote')!.choices;
  expect(choices).toEqual(players.slice(1).map(p=>({id:p.id,title:`${p.avatar} ${p.name}`,translateTitle:false})));
  expect(view.board.players.every((p:{word?:string;role?:string})=>p.word===undefined&&p.role===undefined)).toBe(true);
  expect(choices.some(c=>c.id===players[0].id)).toBe(false);
  s=undercover.apply(s,players[0].id,{action:'vote',values:[players[1].id]});
  expect(undercover.view(s,players[0].id).actions[0].id).toBe('cancel_vote');
  expect(undercover.view(s,players[1].id).board.lastVotes).toEqual({});
 });
});
