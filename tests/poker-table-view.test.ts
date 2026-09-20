import {it,expect} from 'vitest';
import {doudizhu} from '../src/core/games/poker';
const players=Array.from({length:3},(_,i)=>({id:`p${i}`,name:`Player ${i}`,avatar:'🐶'}));
it('publishes bids and passes beside seats without exposing opponent hands, and clears passes on a fresh trick',()=>{
 let s=doudizhu.create(players,17);
 s=doudizhu.apply(s,'p0',{action:'bid',values:['1']});
 expect(doudizhu.view(s,'p2').board.bids).toEqual([1,null,null]);
 s=doudizhu.apply(s,'p1',{action:'bid',values:['3']});
 s=doudizhu.apply(s,'p1',{action:'play',values:[s.hands[1][0].id]});
 s=doudizhu.apply(s,'p2',{action:'pass',values:[]});
 for(const p of players){const view=doudizhu.view(s,p.id);expect(view.board.passed).toEqual([2]);expect(view.board.players.every((p:{hand?:unknown})=>p.hand===undefined)).toBe(true);}
 const copy=doudizhu.view(s,'p0');copy.board.passed.push(0);expect(s.passed).toEqual([2]);
 s=doudizhu.apply(s,'p0',{action:'pass',values:[]});
 expect(doudizhu.view(s,'p1').board.passed).toEqual([]);expect(s.last).toBeNull();
});
