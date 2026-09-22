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

it('retains each seat through replies, pass closure, JSON reload, and clears on the next lead',()=>{
 let s=doudizhu.create(players,17,{pokerCounter:true});
 s=doudizhu.apply(s,'p0',{action:'bid',values:['3']});
 // Independent fixed legal single-card sequence, retaining deck identities.
 s.hands[0]=[{id:'p0-0',rank:3,suit:0},{id:'p0-8',rank:5,suit:0}];
 s.hands[1]=[{id:'p0-4',rank:4,suit:0},{id:'p0-12',rank:6,suit:0}];
 s=doudizhu.apply(s,'p0',{action:'play',values:['p0-0']});
 s=doudizhu.apply(s,'p1',{action:'play',values:['p0-4']});
 expect(s.tablePlays?.map(p=>[p.player,p.cards[0].rank])).toEqual([[0,3],[1,4]]);
 s=doudizhu.apply(s,'p2',{action:'pass',values:[]});
 expect(s.tablePlays?.map(p=>p.player)).toEqual([0,1,2]);
 s=doudizhu.apply(s,'p0',{action:'pass',values:[]});
 expect(s.last).toBeNull();
 expect(s.tablePlays?.find(p=>p.player===1)?.cards[0].rank).toBe(4);
 s=JSON.parse(JSON.stringify(s));
 expect(doudizhu.view(s,'p0').board.tablePlays).toHaveLength(3);
 s=doudizhu.apply(s,'p1',{action:'play',values:['p0-12']});
 expect(s.tablePlays?.map(p=>p.player)).toEqual([1]);
});

it('migrates old saves using only their public last play and defaults the counter off',()=>{
 let s=doudizhu.create(players,17);s=doudizhu.apply(s,'p0',{action:'bid',values:['3']});
 s=doudizhu.apply(s,'p0',{action:'play',values:[s.hands[0][0].id]});
 delete s.tablePlays;delete s.playSerial;delete s.counterEnabled;
 const view=doudizhu.view(s,'p1');expect(view.board.tablePlays).toEqual([{...s.last,serial:0}]);expect(view.board.counter).toBeNull();
 const before=structuredClone(s);expect(()=>doudizhu.apply(s,'p1',{action:'play',values:['unknown']})).toThrow();expect(s).toEqual(before);
 s=doudizhu.apply(s,'p1',{action:'pass',values:[]});expect(s.tablePlays).toHaveLength(2);
});
