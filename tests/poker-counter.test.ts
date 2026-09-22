import {expect,it} from 'vitest';
import {doudizhu,guandan,pokerDeck,unplayedRanks} from '../src/core/games/poker';
import {createMatch,normalizeGameOptions,validateMatchForRoom,type RoomInfo} from '../src/core/room';
const players=Array.from({length:4},(_,i)=>({id:`player00${i}`,name:`P${i}`,avatar:'🐶',ready:true,connected:true}));
it.each([['doudizhu',doudizhu,3,54],['guandan',guandan,4,108]] as const)('%s counter excludes own and played cards once, never other hands',(_,module,n,total)=>{
 const state=module.create(players.slice(0,n),7,{pokerCounter:true});
 expect(unplayedRanks(state,0).reduce((sum,r)=>sum+r.count,0)).toBe(total-state.hands[0].length);
 const deck=pokerDeck(n===4?2:1);
 state.hands[0]=[deck[0],deck[52]];state.played=[deck[1],deck[53]];
 const counts=unplayedRanks(state,0);
 expect(counts.find(c=>c.rank===3)?.count).toBe(n===4?6:2);
 expect(counts.find(c=>c.rank===16)?.count).toBe(n===4?1:0);
 expect(counts.find(c=>c.rank===17)?.count).toBe(n===4?1:0);
 const before=module.view(state,players[0].id).board.counter;
 state.hands[1]=[deck[20]];expect(module.view(state,players[0].id).board.counter).toEqual(before);
 const spectator=module.view(state,'',true);expect(spectator.board.hand).toEqual([]);
 expect(spectator.board.counter.reduce((sum:number,c:{count:number})=>sum+c.count,0)).toBe(total-2);
 state.counterEnabled=false;expect(module.view(state,players[0].id).board.counter).toBeNull();
});
it('normalizes the host setting and rejects malformed, wrong-game and forged checkpoint settings',()=>{
 expect(normalizeGameOptions('guandan',{pokerCounter:false},players[0].id)).toBeUndefined();
 expect(normalizeGameOptions('guandan',{pokerCounter:true},players[0].id)).toEqual({pokerCounter:true});
 expect(()=>normalizeGameOptions('uno',{pokerCounter:true},players[0].id)).toThrow();
 expect(()=>normalizeGameOptions('doudizhu',{pokerCounter:'yes'},players[0].id)).toThrow();
 const room:RoomInfo={code:'ABC234',kind:'guandan',mode:'lan',hostID:players[0].id,players,pending:[],started:true,revision:1,options:{pokerCounter:true}};
 const match=createMatch('guandan',players,room.options);expect(validateMatchForRoom(match,room).game.counterEnabled).toBe(true);
 match.game.counterEnabled=false;expect(()=>validateMatchForRoom(match,room)).toThrow();
});
it('resets history and counts at the next Guandan deal while preserving the host setting',()=>{
 let state=guandan.create(players,11,{pokerCounter:true});state.phase='roundEnd';state.previousOrder=[0,1,2,3];state.played=pokerDeck(2);state.tablePlays=[{player:0,cards:[state.played[0]],combo:null,serial:8}];
 state=guandan.apply(state,players[0].id,{action:'nextRound',values:[]});expect(state.tablePlays).toEqual([]);expect(state.played).toEqual([]);expect(state.counterEnabled).toBe(true);expect(unplayedRanks(state,0).reduce((sum,r)=>sum+r.count,0)).toBe(108-state.hands[0].length);
});
