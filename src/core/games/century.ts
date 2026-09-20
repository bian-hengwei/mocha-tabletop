import {BASE_MERCHANTS,BASE_ORDERS} from './centuryCatalog';
import { action, assertPlayers, seeded, shuffle, validateCommand, type Action, type GameModule, type Player } from '../types';
export const SPICES=['姜黄','藏红花','豆蔻','肉桂'];
export const SPICE_SYMBOLS=['🟡','🔴','🟢','🟤'];
export type Cubes=[number,number,number,number];
export interface SpiceCard {id:string;type:'gain'|'upgrade'|'trade';gain:Cubes;cost:Cubes;upgrades:number}
export interface SpiceOrder {id:string;cost:Cubes;points:number}
export const spiceText=(c:readonly number[])=>c.map((n,i)=>n?`${SPICE_SYMBOLS[i]} ${SPICES[i]} ${n}`:'').filter(Boolean).join(' · ')||'无';
export const spiceCardTitle=(c:SpiceCard)=>c.type==='upgrade'?`升级 ${c.upgrades} 次`:c.type==='gain'?`获得 ${spiceText(c.gain)}`:`${spiceText(c.cost)} → ${spiceText(c.gain)}`;
interface Caravan {cubes:Cubes;hand:SpiceCard[];played:SpiceCard[];orders:SpiceOrder[];gold:number;silver:number}
export interface CenturyState {players:Player[];caravans:Caravan[];deck:SpiceCard[];orders:SpiceOrder[];market:{card:SpiceCard;bonus:Cubes}[];goals:SpiceOrder[];gold:number;silver:number;current:number;round:number;phase:'action'|'upgrade'|'trade'|'pay'|'discard';active:SpiceCard|null;remaining:number;acquiring:string|null;paid:number;finished:boolean;finalRound:boolean;winners:string[];history:string[]}
const zero=():Cubes=>[0,0,0,0];
const sum=(c:number[])=>c.reduce((n,v)=>n+v,0);
const enough=(have:number[],cost:number[])=>cost.every((n,i)=>n<=have[i]);
export const centuryScore=(c:Caravan)=>c.orders.reduce((n,o)=>n+o.points,0)+c.gold*3+c.silver+sum(c.cubes.slice(1));
export const SPICE_CATALOG=BASE_MERCHANTS;
export const SPICE_ORDERS=BASE_ORDERS;
function finishTurn(s:CenturyState){const c=s.caravans[s.current];if(sum(c.cubes)>10){s.phase='discard';return;}if(c.orders.length>=(s.players.length<=3?6:5))s.finalRound=true;if(s.finalRound&&s.current===s.players.length-1){s.finished=true;const best=Math.max(...s.caravans.map(centuryScore));const winner=s.caravans.map(centuryScore).lastIndexOf(best);s.winners=[s.players[winner].id];s.history.push(`${s.players[winner].name} 获胜 · ${best} 分`);}else{s.current=(s.current+1)%s.players.length;if(!s.current)s.round++;}s.phase='action';s.active=null;s.remaining=0;s.acquiring=null;s.paid=0;}
function acquire(s:CenturyState){const c=s.caravans[s.current],at=s.market.findIndex(m=>m.card.id===s.acquiring),slot=s.market.splice(at,1)[0];c.hand.push(slot.card);slot.bonus.forEach((n,i)=>c.cubes[i]+=n);const card=s.deck.pop();if(card)s.market.push({card,bonus:zero()});s.history.push(`${s.players[s.current].name} 招募商人`);finishTurn(s);}
function actions(s:CenturyState):Action[]{if(s.finished)return[];const c=s.caravans[s.current],cubes=c.cubes.flatMap((n,i)=>n?[{id:String(i),title:SPICES[i],subtitle:`持有 ${n}`}]:[]);
 if(s.phase==='upgrade')return [...(s.remaining&&c.cubes.slice(0,3).some(Boolean)?[action('upgrade',`再升级 ${s.remaining} 次`,cubes.filter(x=>x.id!=='3'),1,1)]:[]),action('done','结束升级')];
 if(s.phase==='trade')return[...(enough(c.cubes,s.active!.cost)?[action('repeat','再交易一次',[],0,0,spiceCardTitle(s.active!))]:[]),action('done','结束交易')];
 if(s.phase==='pay')return[action('pay',`支付给第 ${s.paid+1} 位商人`,cubes,1,1,'任选 1 枚香料放到途经的商人上')];
 if(s.phase==='discard'){const n=sum(c.cubes)-10,batch=Math.min(n,32);return[action('discard',n>32?`先归还 ${batch} 枚 · 共需归还 ${n} 枚`:`归还 ${n} 枚香料`,c.cubes.flatMap((v,i)=>Array.from({length:v},(_,j)=>({id:`${i}:${j}`,title:`${SPICES[i]} · ${j+1}`}))),batch,batch)];}
 const play=c.hand.filter(card=>card.type!=='trade'||enough(c.cubes,card.cost)),claim=s.goals.filter(o=>enough(c.cubes,o.cost)),market=s.market.filter((_,i)=>i<=sum(c.cubes));
 return [...(play.length?[action('play','使用商人',play.map(card=>({id:card.id,title:spiceCardTitle(card)})),1,1)]:[]),...(market.length?[action('acquire','招募商人',market.map((m,i)=>({id:m.card.id,title:spiceCardTitle(m.card),subtitle:`支付 ${i} 枚 · 附赠 ${spiceText(m.bonus)}`})),1,1)]:[]),...(claim.length?[action('claim','完成订单',claim.map(o=>({id:o.id,title:`${o.points} 分`,subtitle:spiceText(o.cost)})),1,1)]:[]),action('rest','休整，收回所有商人')];
}
export const century:GameModule<CenturyState>={
 create(players,seed){assertPlayers(players,2,5);const rng=seeded(seed),deck=shuffle(structuredClone(SPICE_CATALOG),rng),orders=shuffle(structuredClone(SPICE_ORDERS),rng);return{players:structuredClone(players),caravans:players.map((p,i)=>({cubes:i===0?[3,0,0,0]:i<3?[4,0,0,0]:[3,1,0,0],hand:[{id:`start-gain-${p.id}`,type:'gain',gain:[2,0,0,0],cost:zero(),upgrades:0},{id:`start-upgrade-${p.id}`,type:'upgrade',gain:zero(),cost:zero(),upgrades:2}],played:[],orders:[],gold:0,silver:0})),deck,orders,market:deck.splice(-6).map(card=>({card,bonus:zero()})),goals:orders.splice(-5),gold:players.length*2,silver:players.length*2,current:0,round:1,phase:'action',active:null,remaining:0,acquiring:null,paid:0,finished:false,finalRound:false,winners:[],history:['基础牌组 · 43 张商人、36 张订单']};},
 view(s,id){const me=s.players.findIndex(p=>p.id===id);if(me<0)return{kind:'century',phase:'不在本局',instruction:'仅本局玩家可查看',finished:s.finished,actions:[],sections:[],log:[],board:{}};const c=s.caravans[me];return structuredClone({kind:'century',phase:s.finished?'游戏结束':`第 ${s.round} 轮${s.finalRound?' · 最后一轮':''}`,instruction:s.finished?`胜者：${s.players.find(p=>s.winners.includes(p.id))?.name}`:s.current===me?({action:'轮到你的商队了',pay:'选择支付的香料',trade:'继续交易，或结束本回合',upgrade:'逐次升级，或提前结束',discard:'商队最多容纳 10 枚，请归还多余香料'}[s.phase]):`等待 ${s.players[s.current].name}`,finished:s.finished,actions:me===s.current?actions(s):[],sections:[],log:s.history,board:{phase:s.phase,hand:c.hand,played:c.played,cubes:c.cubes,orders:c.orders,active:s.active,remaining:s.remaining,current:s.players[s.current].id,market:s.market,goals:s.goals,gold:s.gold,silver:s.silver,goalTarget:s.players.length<=3?6:5,finalRound:s.finalRound,winners:s.winners,players:s.players.map((p,i)=>({...p,cubes:s.caravans[i].cubes,handCount:s.caravans[i].hand.length,played:s.caravans[i].played,orderCount:s.caravans[i].orders.length,gold:s.caravans[i].gold,silver:s.caravans[i].silver,score:centuryScore(s.caravans[i])}))}});},
 apply(state,id,command){validateCommand(century.view(state,id),command);const s=structuredClone(state),c=s.caravans[s.current],name=s.players[s.current].name,values=command.values;
 switch(command.action){
 case 'play':{const at=c.hand.findIndex(card=>card.id===values[0]),card=c.hand.splice(at,1)[0];c.played.push(card);s.active=card;s.history.push(`${name} 使用 ${spiceCardTitle(card)}`);if(card.type==='gain'){card.gain.forEach((n,i)=>c.cubes[i]+=n);finishTurn(s);}else if(card.type==='upgrade'){s.remaining=card.upgrades;s.phase='upgrade';}else{card.cost.forEach((n,i)=>c.cubes[i]-=n);card.gain.forEach((n,i)=>c.cubes[i]+=n);s.phase='trade';}break;}
 case 'upgrade':{const color=Number(values[0]);c.cubes[color]--;c.cubes[color+1]++;s.remaining--;if(!s.remaining||!c.cubes.slice(0,3).some(Boolean))finishTurn(s);break;}
 case 'repeat':s.active!.cost.forEach((n,i)=>c.cubes[i]-=n);s.active!.gain.forEach((n,i)=>c.cubes[i]+=n);break;
 case 'done':finishTurn(s);break;
 case 'acquire':s.acquiring=values[0];s.paid=0;if(s.market[0].card.id===s.acquiring)acquire(s);else s.phase='pay';break;
 case 'pay':{const color=Number(values[0]);c.cubes[color]--;s.market[s.paid].bonus[color]++;s.paid++;if(s.paid===s.market.findIndex(m=>m.card.id===s.acquiring))acquire(s);break;}
 case 'claim':{const at=s.goals.findIndex(o=>o.id===values[0]),order=s.goals.splice(at,1)[0];order.cost.forEach((n,i)=>c.cubes[i]-=n);c.orders.push(order);if(at===0&&s.gold){s.gold--;c.gold++;}else if(((at===1&&s.gold>0)||(at===0&&!s.gold))&&s.silver){s.silver--;c.silver++;}const next=s.orders.pop();if(next)s.goals.push(next);s.history.push(`${name} 完成 ${order.points} 分订单`);finishTurn(s);break;}
 case 'rest':c.hand.push(...c.played);c.played=[];s.history.push(`${name} 休整，收回商人`);finishTurn(s);break;
 case 'discard':for(const value of values)c.cubes[Number(value.split(':')[0])]--;finishTurn(s);break;
 default:throw Error('未知操作');}
 s.history=s.history.slice(-40);return s;}
};
