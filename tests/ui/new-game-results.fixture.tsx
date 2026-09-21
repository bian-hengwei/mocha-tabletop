import {createRoot} from 'react-dom/client';
import {RoomClient} from '../../src/net/client';
import {createMatch,viewMatch,type ClientState,type RoomInfo} from '../../src/core/room';
import '../../src/ui/style.css';

// Substitute only transport. Fixed final totals exercise the real filtered
// views, App result overlay, and scoreboard, without replaying a random game.
const params=new URLSearchParams(location.search);
const kind=params.get('kind')==='gems'?'gems':params.get('kind')==='bombs'?'bombs':params.get('kind')==='uno'?'uno':params.get('kind')==='century'?'century':'sushi';
const count=kind==='gems'?4:kind==='uno'?10:5;
const room:RoomInfo={code:'ABC234',kind,mode:'cloud',hostID:'result-0',started:true,revision:1,matchID:'result-fixture',pending:[],players:Array.from({length:count},(_,i)=>({
 id:`result-${i}`,name:params.has('long')?(i%2?`长昵称玩家甲乙丙丁${i}`:`Long name player ${i}`):i===0?'Host':i===1?'Guest':`Mocha ${i-1}`,avatar:i<2?'🦊':'🤖',connected:true,ready:true,...(i>=2?{bot:{difficulty:'normal' as const}}:{}),
}))};
const self=room.players[params.has('guest')?1:0];
localStorage.clear();localStorage.setItem('mocha-profile',JSON.stringify(self));localStorage.setItem('mocha-locale',params.get('locale')||'zh');
const match=createMatch(kind,room.players),game=match.game;
game.finished=true;game.winners=[room.players[2].id];
if(kind==='gems'){
 const scores=[12,15,17,17],counts=[7,6,5,params.has('tie')?5:6];
 game.merchants.forEach((m:{bought:unknown[];nobles:unknown[]},i:number)=>{
  let points=scores[i]-3;
  m.bought=Array.from({length:counts[i]},(_,j)=>{const value=Math.min(5,points);points-=value;return {id:`gem-${i}-${j}`,tier:3,bonus:'white',points:value,cost:[1,1,1,1,1]};});
  m.nobles=[{id:`noble-${i}`,cost:[3,3,3,0,0]}];
 });
 if(params.has('tie'))game.winners=[room.players[2].id,room.players[3].id];
}else if(kind==='bombs'){
 game.alive=[room.players[2].id];game.current=room.players[2].id;game.phase={kind:'turn'};
 for(const p of room.players)if(p.id!==game.current)game.hands[p.id]=[];
}else if(kind==='sushi'){
 // Rounds total 22/17/22/30/25. Pudding adds 0/+3/+3/-6/0.
 // The two 25-point seats are separated by pudding count, not seat order.
 game.round=3;game.step=7;game.scores=[22,20,25,24,25];game.puddings=[2,3,3,1,2];
 game.roundScores=[[7,5,8,10,8],[7,6,7,10,8],[8,6,7,10,9]];
 if(params.has('tie')){
  // Three players share +6 pudding points; two share the highest final total.
  game.puddings=[2,3,3,1,3];game.roundScores=[[7,6,8,10,7],[7,6,7,10,8],[8,6,8,10,8]];
  game.winners=[room.players[2].id,room.players[4].id];
 }
 game.hands=room.players.map(()=>[]);game.table=room.players.map(()=>[]);
}else if(kind==='uno'){
 game.scores=[120,310,530,99,400,210,111,97,55,8];game.roundNumber=4;game.phase='roundEnd';game.roundWinner=room.players[2].id;game.roundPoints=220;
}else{
 // Order points + 3 per gold + silver + non-yellow cubes: 15/20/31/16/27.
 const points=[12,18,24,15,24],gold=[1,0,2,0,1],silver=[0,2,1,1,0];
 game.caravans.forEach((c:{orders:{id:string;points:number;cost:number[]}[];gold:number;silver:number;cubes:number[]},i:number)=>{
  c.orders=Array.from({length:i>=2?5:1},(_,j)=>({id:`order-${i}-${j}`,points:j===0?points[i]:0,cost:[0,0,0,0]}));c.gold=gold[i];c.silver=silver[i];c.cubes=[0,0,0,0];
 });
}
const state:ClientState={status:'playing',mode:'cloud',transport:'cloud',paused:false,selfID:self.id,room,...viewMatch(match,kind,self.id)};
RoomClient.prototype.subscribe=function(next){this.state=state;next(state);return()=>{};};
const{App}=await import('../../src/ui/App');createRoot(document.getElementById('root')!).render(<App/>);
