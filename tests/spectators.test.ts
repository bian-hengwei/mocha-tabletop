import {describe,it,expect} from 'vitest';
import {modules} from '../src/core/registry';
import {GAMES,type GameKind,type Player,type GameOptions} from '../src/core/types';
import {createMatch,viewRoomMatch,applyMatch,type RoomInfo} from '../src/core/room';
const watcher={id:'spectator-0',name:'Watcher',avatar:'🐼',connected:true};
const roster=(n:number):Player[]=>Array.from({length:n},(_,i)=>({id:`player-${i}`,name:`Player ${i}`,avatar:'🦊'}));
function setup(kind:GameKind,options?:GameOptions){const players=roster(GAMES[kind].min+(options?.werewolfMode==='judge'?1:0)),match=createMatch(kind,players,options),room:RoomInfo={code:'ABC234',kind,hostID:players[0].id,mode:'cloud',players:players.map(p=>({...p,ready:true,connected:true})),spectators:[watcher],pending:[],started:true,revision:1,options};return{match,room,view:()=>viewRoomMatch(match,room,watcher.id).view};}
describe('public spectator projection',()=>{
 it('keeps Mahjong assistance private even when spectator projection receives a seated ID',()=>{
  const {match,view}=setup('mahjong'),s=match.game;
  expect(modules.mahjong.view(s,s.players[0].id).board.assistance).not.toBeNull();
  for(const v of [view(),modules.mahjong.view(s,s.players[0].id,true)]){
   expect(v.board.assistance).toBeNull();expect(v.board.hand).toEqual([]);expect(v.actions).toEqual([]);
   for(const tile of s.hands.flat())expect(JSON.stringify(v)).not.toContain(`"${tile.id}"`);
  }
 });
 it('shows public UNO penalty amounts without giving spectators a confirmation action',()=>{
  for(const count of [2,4] as const){const {match,view}=setup('uno'),s=match.game;s.phase='penalty';s.current=1;s.pendingPenalty={count,actor:0};
   expect(modules.uno.view(s,s.players[1].id).actions.map(a=>a.id)).toEqual(['acceptPenalty']);
   for(const v of [view(),modules.uno.view(s,s.players[1].id,true)]){
    expect(v.board.pendingPenalty).toEqual({count});expect(v.actions).toEqual([]);expect(v.board.hand).toEqual([]);expect(v.board.privateChallenge).toBeUndefined();
   }
  }
 });
 for(const kind of Object.keys(GAMES) as GameKind[])it(`${kind}: authenticated observer, no seat, no actions, detached public state`,()=>{
  const {match,room,view}=setup(kind),before=structuredClone(match),v=view();expect(v.spectating).toBe(true);expect(v.actions).toEqual([]);expect(v.sections.some(s=>s.private)).toBe(false);expect(v.board.players).toHaveLength(room.players.length);
  expect(v.board.hand||[]).toEqual([]);expect(v.board.ownRole).toBeUndefined();expect(v.board.ownKnowledge||[]).toEqual([]);
  expect(v.board.word).toBeUndefined();expect(v.board.isCaptain||false).toBe(false);expect(v.board.isModerator||false).toBe(false);
  expect(()=>viewRoomMatch(match,room,'stranger')).toThrow();expect(()=>viewRoomMatch(match,{...room,allowSpectators:false},watcher.id)).toThrow();
  expect(()=>applyMatch(match,kind,room.players,watcher.id,{action:'ready',values:[]},'forged',0)).toThrow('不在本局中');
  v.board.players[0].name='mutated public copy';expect(match).toEqual(before);
 });
 it('never sends any dealt hand or deck card IDs',()=>{
  for(const kind of ['sushi','uno','bombs','mahjong','doudizhu','guandan'] as const){const {match,view}=setup(kind),s=match.game,raw=JSON.stringify(view());
   const hands=Array.isArray(s.hands)?s.hands:Object.values(s.hands);
   for(const card of [...hands.flat(),...(s.deck||s.wall||[])])expect(raw,kind).not.toContain(`"${card.id}"`);
  }
 });
 it('hides blind reserves, including an in-progress payment',()=>{const {match,view}=setup('gems'),s=match.game,card=s.decks[0].pop();s.merchants[0].reserved=[card];s.payment=card;s.phase='payment';expect(JSON.stringify(view())).not.toContain(`"${card.id}"`);expect(view().board.payment).toBeNull();s.merchants[0].publicReserved=[card.id];expect(view().board.players[0].reservedCards[0].card.id).toBe(card.id);});
 it('hides future cards and UNO challenge evidence',()=>{const bombs=setup('bombs');bombs.match.game.phase={kind:'future',cards:bombs.match.game.deck.slice(0,3)};expect(bombs.view().board.privateFuture).toBeUndefined();const uno=setup('uno');uno.match.game.phase='challengeResult';uno.match.game.pendingWild4={actor:0,target:1,previousColor:'red',illegal:true,hand:[{id:'secret-evidence',color:'red',value:7}]};expect(uno.view().board.privateChallenge).toBeUndefined();expect(JSON.stringify(uno.view())).not.toContain('secret-evidence');});
 it('hides unrevealed word keys and secret picks until public reveal',()=>{const signals=setup('codenames');expect(signals.view().board.cards.every((c:{identity?:string})=>!c.identity)).toBe(true);signals.match.game.cards[0].revealed=true;expect(signals.view().board.cards[0].identity).toBe(signals.match.game.cards[0].identity);const odd=setup('undercover');for(const word of odd.match.game.words)expect(JSON.stringify(odd.view())).not.toContain(word);const sushi=setup('sushi');sushi.match.game.picks[0]=[sushi.match.game.hands[0][0].id];expect(sushi.view().board.selected).toBeUndefined();expect(sushi.view().board.players[0].ready).toBe(true);});
 it('hides all concealed kongs and simultaneous missing-suit choices',()=>{const {match,view}=setup('mahjong'),s=match.game;s.phase='que';s.missing={0:1};s.melds[0]=[{type:'concealed',tiles:[{id:'secret-kong',value:5}],from:0}];const v=view();expect(v.board.players[0].missing).toBeUndefined();expect(v.board.players[0].melds[0].tiles).toEqual([]);expect(JSON.stringify(v)).not.toContain('secret-kong');});
 for(const mode of ['standard','judge','deal'] as const)it(`werewolf ${mode}: identities, investigation and moderator evidence stay private`,()=>{const {match,view}=setup('werewolf',{werewolfMode:mode}),s=match.game;s.privateLog=['private knife evidence'];s.investigations={[s.players[0].id]:'狼人'};const v=view();expect(v.board.players.every((p:{role?:string})=>!p.role)).toBe(true);expect(v.board.moderatorOnly).toBeUndefined();expect(v.board.ownKnowledge).toEqual([]);expect(JSON.stringify(v)).not.toContain('private knife evidence');});
 it('shows public terminal results without assigning a seat',()=>{for(const kind of ['uno','sushi','codenames','undercover'] as const){const {match,view}=setup(kind);match.game.finished=true;match.game.winners=[match.game.players[0].id];if(kind==='undercover')match.game.winnerRole='common';if(kind==='codenames')match.game.winnerTeam='red';expect(view().finished).toBe(true);expect(view().actions).toEqual([]);expect(view().board.winners).toEqual([match.game.players[0].id]);}});
});
