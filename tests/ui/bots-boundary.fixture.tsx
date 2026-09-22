import {createRoot} from 'react-dom/client';
import {RoomClient} from '../../src/net/client';
import {applyMatch,createMatch,viewMatch,type ClientState,type RoomInfo} from '../../src/core/room';
import {continueBotRound} from '../../src/core/roomBots';
import {guandan} from '../../src/core/games/poker';
import {uno} from '../../src/core/games/uno';
import '../../src/ui/style.css';

// Deterministic rare-state UI fixture. Only the room transport is substituted;
// the real App, filtered player view and round continuation rules are used.
const params=new URLSearchParams(location.search),retry=params.get('state')==='retry',finished=params.get('state')==='finished',guest=params.has('guest');
const kind=retry||params.get('kind')==='mahjong'?'mahjong':params.get('kind')==='doudizhu'?'doudizhu':params.get('kind')==='uno'?'uno':'guandan';
const room:RoomInfo={code:'ABC234',kind,mode:'cloud',hostID:'human-host',started:true,revision:1,matchID:'boundary-match',pending:[],players:[
 {id:'human-host',name:'Host',avatar:'🦊',connected:true,ready:true},
 {id:'bot_one',name:'Mocha 1',avatar:'🤖',bot:{difficulty:'hard'},connected:true,ready:true},
 {id:'human-guest',name:'Guest',avatar:'🐼',connected:true,ready:true},
 {id:'bot_two',name:'Mocha 2',avatar:'🤖',bot:{difficulty:'normal'},connected:true,ready:true},
],...(retry?{botError:'人机暂时无法行动，请重试'}:{})};
if(kind==='doudizhu')room.players=room.players.slice(0,3);
const self=room.players[guest?2:0];
localStorage.clear();localStorage.setItem('mocha-profile',JSON.stringify(self));localStorage.setItem('mocha-locale',params.get('locale')||'zh');
let match=createMatch(room.kind,room.players);
if(!retry&&!finished&&kind==='uno'){
 const game=uno.create(room.players,20260921,{unoMode:'match'});
 // Reach roundEnd by legally playing the bot's final number card. The turn
 // advances to Guest, while the host remains the first player and can continue.
 for(let i=0;i<game.hands.length;i++){
  const last=game.hands[i].find(card=>card.color!=='wild'&&typeof card.value==='number');
  if(!last)throw new Error('The fixture requires a number card in each starting hand');
  game.deck.push(...game.hands[i].filter(card=>card.id!==last.id));game.hands[i]=[last];
 }
 const color=game.hands[1][0].color;if(color==='wild')throw new Error('The fixture must finish with a number card');
 game.phase='play';game.current=1;game.direction=1;game.color=color;game.drawn=null;
 const result=uno.apply(game,room.players[1].id,{action:'play',values:[game.hands[1][0].id]});
 if(result.current!==2||result.phase!=='roundEnd'||result.roundWinner!==room.players[1].id)throw new Error('The fixture must end with a bot winner and a different current seat');
 match.game=result;
}else if(!retry&&!finished){const game=guandan.create(room.players,20260921);game.phase='roundEnd';game.current=1;game.order=[1,0,3];game.previousOrder=[1,0,3,2];game.played=game.order.flatMap(i=>game.hands[i]);for(const i of game.order)game.hands[i]=[];game.levels=[2,3];game.level=3;match.game=game;}
// Retain large revealed hands to stress the result layout; this is not a rule simulation.
if(finished){
 match.game.finished=true;match.game.winners=[self.id];match.game.scores=kind==='doudizhu'?[4,-2,-2]:[6,-2,-2,-2];
 if(kind==='mahjong'){match.game.won=[0];match.game.wins=[{player:0,from:0,tile:match.game.hands[0][0],points:6,selfDraw:true}];}
 else{match.game.phase='play';match.game.landlord=0;if(kind==='guandan'){match.game.winners=[room.players[0].id,room.players[2].id];match.game.scores=[3,-3,3,-3];match.game.levels=[14,10];match.game.level=14;match.game.order=[0,2,1,3];}}
}
let state:ClientState={status:'playing',mode:'cloud',transport:'cloud',paused:false,selfID:self.id,room,...viewMatch(match,room.kind,self.id)};
let listener:((state:ClientState)=>void)|undefined;
const events={continues:0,retries:0,humanActions:0,round:1};
declare global{interface Window{botBoundaryEvents:typeof events}}
window.botBoundaryEvents=events;
RoomClient.prototype.subscribe=function(next){listener=next;this.state=state;next(state);return()=>{listener=undefined;};};
RoomClient.prototype.continueBotRound=function(){events.continues++;match=continueBotRound(room,match,self.id);state={...state,...viewMatch(match,room.kind,self.id)};listener?.(state);};
RoomClient.prototype.action=function(command){match=applyMatch(match,room.kind,room.players,self.id,command,'fixture-human-action',state.actionRevision);events.humanActions++;state={...state,...viewMatch(match,room.kind,self.id)};events.round=state.view!.board.roundNumber;listener?.(state);};
RoomClient.prototype.retryBot=function(){events.retries++;state={...state,room:{...room,botError:undefined}};listener?.(state);};
const{App}=await import('../../src/ui/App');createRoot(document.getElementById('root')!).render(<App/>);
