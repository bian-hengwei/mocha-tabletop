import { action, assertPlayers, seeded, shuffle, validateCommand, type Action, type GameModule, type Player } from '../types';
export const UNO_COLORS=['red','yellow','green','blue'] as const;
export type UnoColor=typeof UNO_COLORS[number];
export type UnoValue=number|'skip'|'reverse'|'draw2'|'wild'|'wild4';
export interface UnoCard {id:string;color:UnoColor|'wild';value:UnoValue}
export const UNO_LABEL:Record<string,string>={red:'红色',yellow:'黄色',green:'绿色',blue:'蓝色',wild:'变色',wild4:'+4 变色',skip:'跳过',reverse:'反转',draw2:'+2'};
export const unoTitle=(c:UnoCard)=>`${c.color==='wild'?'':UNO_LABEL[c.color]+' '}${typeof c.value==='number'?c.value:UNO_LABEL[c.value]}`;
export type UnoPhase='play'|'color'|'unoCall'|'unoCatch'|'wild4'|'challengeResult'|'roundEnd';
interface Wild4Pending {actor:number;target:number;previousColor:UnoColor;hand:UnoCard[];illegal:boolean;result?:'successful'|'failed'}
interface UnoWindow {actor:number;resume:'play'|'wild4';passed:string[]}
export interface UnoState {
 players:Player[];hands:UnoCard[][];deck:UnoCard[];discard:UnoCard[];current:number;direction:1|-1;color:UnoColor;phase:UnoPhase;drawn:string|null;round:number;finished:boolean;winners:string[];scores:number[];history:string[];rng:number;
 /** Missing fields identify pre-match-mode checkpoints and retain their single-round behavior. */
 mode?:'single'|'match';challengeEnabled?:boolean;roundNumber?:number;dealer?:number;roundWinner?:string;roundPoints?:number;roundResults?:Array<{round:number;winner:string;points:number;scores:number[]}>;
 pendingWild4?:Wild4Pending;unoWindow?:UnoWindow;called?:Record<string,boolean>;
}
const points=(c:UnoCard)=>typeof c.value==='number'?c.value:c.color==='wild'?50:20;
const mode=(s:UnoState)=>s.mode||'single';
const challenges=(s:UnoState)=>s.challengeEnabled!==false;
function next(s:UnoState,steps=1){s.current=(s.current+s.direction*steps+s.players.length*steps)%s.players.length;s.drawn=null;s.round++;}
function draw(s:UnoState,index:number,n:number):UnoCard|undefined {let last:UnoCard|undefined;for(let i=0;i<n;i++){if(!s.deck.length&&s.discard.length>1){const top=s.discard.pop()!;s.deck=shuffle(s.discard,seeded(s.rng++));s.discard=[top];s.history.push('弃牌堆已重新洗入抽牌堆');}last=s.deck.pop();if(last)s.hands[index].push(last);else break;}if(s.hands[index].length!==1&&s.called)delete s.called[s.players[index].id];return last;}
/** Legality is checked privately on a challenge, never used to prohibit a bluff. */
export function unoWild4Legal(s:UnoState,index=s.current){return !s.hands[index].some(c=>c.color===s.color);}
export function unoPlayable(s:UnoState,c:UnoCard):boolean {if(s.drawn&&s.drawn!==c.id)return false;if(c.value==='wild4'&&!challenges(s))return unoWild4Legal(s);const top=s.discard[s.discard.length-1];return c.color==='wild'||c.color===s.color||c.value===top.value;}
const colorChoices=UNO_COLORS.map(c=>({id:c,title:UNO_LABEL[c]}));
function cards():UnoCard[]{const result:UnoCard[]=[];for(const color of UNO_COLORS){result.push({id:`${color}-0`,color,value:0});for(let copy=0;copy<2;copy++)for(const value of [1,2,3,4,5,6,7,8,9,'skip','reverse','draw2'] as UnoValue[])result.push({id:`${color}-${value}-${copy}`,color,value});}for(let i=0;i<4;i++)for(const value of ['wild','wild4'] as const)result.push({id:`${value}-${i}`,color:'wild',value});return result;}
function dealRound(s:UnoState){
 s.deck=shuffle(cards(),seeded(s.rng++));s.hands=s.players.map(()=>s.deck.splice(-7));s.discard=[];s.direction=1;s.current=((s.dealer??s.players.length-1)+1)%s.players.length;s.color='red';s.phase='play';s.drawn=null;s.round=1;s.called={};delete s.pendingWild4;delete s.unoWindow;delete s.roundWinner;s.roundPoints=0;
 let top=s.deck.pop()!;while(top.value==='wild4'){s.deck.unshift(top);top=s.deck.pop()!;}s.discard=[top];
 if(top.color==='wild')s.phase='color';else{s.color=top.color;if(top.value==='skip')next(s);if(top.value==='draw2'){draw(s,s.current,2);next(s);}if(top.value==='reverse'){s.direction=-1;s.current=s.dealer??s.players.length-1;}}
}
function endRound(s:UnoState,index:number){if(s.hands[index].length)return;const earned=s.hands.flat().reduce((n,c)=>n+points(c),0),winner=s.players[index].id;s.scores[index]+=earned;s.roundWinner=winner;s.roundPoints=earned;(s.roundResults??=[]).push({round:s.roundNumber??1,winner,points:earned,scores:[...s.scores]});s.history.push(`${s.players[index].name} 赢得本轮 · +${earned} 分 · 累计 ${s.scores[index]} 分`);delete s.unoWindow;delete s.pendingWild4;s.drawn=null;
 if(mode(s)==='single'||s.scores[index]>=500){s.finished=true;s.winners=[winner];s.history.push(`${s.players[index].name} 获胜 · ${s.scores[index]} 分`);}else{s.phase='roundEnd';}
}
function finishUnoWindow(s:UnoState){s.phase=s.unoWindow!.resume;delete s.unoWindow;}
function actions(s:UnoState,id:string):Action[]{
 if(s.finished)return[];
 if(s.phase==='roundEnd')return id===s.roundWinner||id===s.players[0].id?[action('nextRound','开始下一轮',[],0,0,'保留累计分，重新洗牌发牌；先到 500 分获胜')]:[];
 if(s.phase==='unoCall')return id===s.players[s.unoWindow!.actor].id?[action('callUno','喊：剩一张！'),action('skipUno','不喊，继续',[],0,0,'其他玩家可在下一手开始前指出漏喊；被抓到需抽 2 张')]:[];
 if(s.phase==='unoCatch')return id!==s.players[s.unoWindow!.actor].id&&!s.unoWindow!.passed.includes(id)?[action('catchUno','指出漏喊：罚抽 2 张'),action('passUno','不指出，继续')]:[];
 if(s.phase==='wild4')return id===s.players[s.pendingWild4!.target].id?[action('accept4','接受 +4，抽牌并跳过'),action('challenge4','质疑 +4',[],0,0,'只向你展示出牌时的手牌；质疑成功对方抽 4 张，失败你抽 6 张')]:[];
 if(s.phase==='challengeResult')return id===s.players[s.pendingWild4!.target].id?[action('confirmChallenge','已查看私人核验，继续')]:[];
 if(id!==s.players[s.current].id)return[];
 if(s.phase==='color')return[action('color','选择起始颜色',colorChoices,1,1)];
 const legal=s.hands[s.current].filter(c=>unoPlayable(s,c)),normal=legal.filter(c=>c.color!=='wild'),wild=legal.filter(c=>c.color==='wild'),result:Action[]=[];
 if(normal.length)result.push(action('play','打出这张',normal.map(c=>({id:c.id,title:unoTitle(c)})),1,1));
 for(const c of wild)result.push(action(`wild:${c.id}`,unoTitle(c),colorChoices,1,1,c.value==='wild4'?(challenges(s)?'可选择诈出 +4；若当时持有原颜色的牌，被质疑成功需自己抽 4 张':'仅无当前颜色时可出；下一家自动抽 4 张并跳过'):'出牌时选择下一种颜色'));
 result.push(s.drawn?action('pass','保留抽到的牌，结束回合'):action('draw','抽一张'));return result;
}
export const uno:GameModule<UnoState>={
 create(players,seed,options){assertPlayers(players,2,10);if(options?.unoChallenge!==undefined&&typeof options.unoChallenge!=='boolean')throw Error('七彩接龙质疑设置无效');if(options?.unoMode!==undefined&&!['single','match'].includes(options.unoMode))throw Error('七彩接龙模式无效');const rng=seeded(seed),s:UnoState={players:structuredClone(players),hands:[],deck:[],discard:[],current:0,direction:1,color:'red',phase:'play',drawn:null,round:1,finished:false,winners:[],scores:players.map(()=>0),history:[options?.unoChallenge===false?(options.unoMode==='single'?'单局模式 · 手动喊剩一张 · +4 自动验证':'累计 500 分 · 手动喊剩一张 · +4 自动验证'):(options?.unoMode==='single'?'单局模式 · 手动喊剩一张 · 可质疑 +4':'累计 500 分 · 手动喊剩一张 · 可质疑 +4')],rng:seed+1,mode:options?.unoMode||'match',challengeEnabled:options?.unoChallenge!==false,roundNumber:1,dealer:Math.floor(rng()*players.length),roundResults:[],called:{}};dealRound(s);return s;},
 view(s,id,spectator=false){if(spectator)id='';const me=s.players.findIndex(p=>p.id===id);if(me<0&&!spectator)return{kind:'uno',phase:'不在本局',instruction:'仅本局玩家可查看',finished:s.finished,actions:[],sections:[],log:[],board:{}};
 const legal=spectator?[]:actions(s,id),phase=s.finished?'本局结束':s.phase==='roundEnd'?'本轮结算':s.phase==='unoCall'?'宣告剩一张':s.phase==='unoCatch'?'漏喊响应窗口':s.phase==='wild4'?'+4 接受或质疑':s.phase==='challengeResult'?'私人质疑核验':`第 ${s.roundNumber??1} 轮 · 第 ${s.round} 手 · ${s.direction===1?'顺时针':'逆时针'}`;
 const instruction=s.finished?`胜者：${s.players.find(p=>s.winners.includes(p.id))?.name}`:s.phase==='roundEnd'?`本轮胜者：${s.players.find(p=>p.id===s.roundWinner)?.name} · +${s.roundPoints} 分`:s.phase==='unoCall'?`等待 ${s.players[s.unoWindow!.actor].name} 宣告剩一张`:s.phase==='unoCatch'?'下一手开始前，确认是否指出漏喊':s.phase==='wild4'?`等待 ${s.players[s.pendingWild4!.target].name} 接受或质疑 +4`:s.phase==='challengeResult'?legal.length?'仅你可见：核验出牌时的手牌':'等待质疑者查看私人核验':me===s.current?s.phase==='color'?'选择起始颜色':s.drawn?'可打出刚抽到的牌，或结束回合':'轮到你了：同色、同数或功能牌':`等待 ${s.players[s.current].name}`;
 const pending=s.pendingWild4;
 return structuredClone({kind:'uno',phase,instruction,finished:s.finished,actions:legal,sections:[],log:s.history,board:{phase:s.phase,current:s.players[s.current].id,hand:s.hands[me]||[],top:s.discard.at(-1),color:s.color,direction:s.direction,deckCount:s.deck.length,drawn:me===s.current?s.drawn:null,winners:s.winners,mode:mode(s),challengeEnabled:challenges(s),targetScore:mode(s)==='match'?500:null,roundNumber:s.roundNumber??1,roundWinner:s.roundWinner,roundPoints:s.roundPoints??0,roundResults:s.roundResults||[],
 ...(pending?{pendingWild4:{actor:s.players[pending.actor].id,challenger:s.players[pending.target].id}}:{}),
 ...(pending&&s.phase==='challengeResult'&&me===pending.target?{privateChallenge:{actor:s.players[pending.actor].id,challenger:id,previousColor:pending.previousColor,wasLegal:!pending.illegal,hand:pending.hand}}:{}),
 ...(s.unoWindow?{unoWindow:{playerID:s.players[s.unoWindow.actor].id,passed:s.unoWindow.passed}}:{}),
 players:s.players.map((p,i)=>({...p,handCount:s.hands[i].length,score:s.scores[i],calledUno:!!s.called&&Object.hasOwn(s.called,p.id)&&s.called[p.id]===true,...(s.finished||s.phase==='roundEnd'?{hand:s.hands[i]}:{})}))}});
 },
 apply(state,id,command){validateCommand(uno.view(state,id),command);const s=structuredClone(state),me=s.current,name=s.players[me].name;
 if(command.action==='nextRound'){s.roundNumber=(s.roundNumber??1)+1;s.dealer=((s.dealer??s.players.length-1)+1)%s.players.length;dealRound(s);s.history.push(`第 ${s.roundNumber} 轮开始，累计分保留`);return s;}
 if(command.action==='callUno'){const actor=s.unoWindow!.actor;s.called={...s.called,[id]:true};s.history.push(`${s.players[actor].name}：剩一张！`);finishUnoWindow(s);return s;}
 if(command.action==='skipUno'){s.phase='unoCatch';s.history.push(`${s.players[s.unoWindow!.actor].name} 未宣告剩一张，等待响应`);return s;}
 if(command.action==='catchUno'){const actor=s.unoWindow!.actor;draw(s,actor,2);s.history.push(`${s.players.find(p=>p.id===id)!.name} 指出 ${s.players[actor].name} 漏喊，罚抽 2 张`);finishUnoWindow(s);return s;}
 if(command.action==='passUno'){s.unoWindow!.passed.push(id);if(s.unoWindow!.passed.length===s.players.length-1)finishUnoWindow(s);return s;}
 if(command.action==='accept4'){const pending=s.pendingWild4!;draw(s,pending.target,4);s.history.push(`${s.players[pending.target].name} 接受 +4，抽 4 张并跳过`);s.phase='play';next(s);delete s.pendingWild4;endRound(s,pending.actor);return s;}
 if(command.action==='challenge4'){const pending=s.pendingWild4!;pending.result=pending.illegal?'successful':'failed';draw(s,pending.illegal?pending.actor:pending.target,pending.illegal?4:6);s.phase='challengeResult';s.history.push(`${s.players[pending.target].name} 质疑 +4，正在私人核验`);return s;}
 if(command.action==='confirmChallenge'){const pending=s.pendingWild4!;s.history.push(pending.illegal?'质疑成立，出牌者抽 4 张；质疑者继续本回合':'质疑未成立，质疑者抽 6 张并跳过');s.phase='play';if(!pending.illegal)next(s);delete s.pendingWild4;endRound(s,pending.actor);return s;}
 if(command.action==='color'){s.color=command.values[0] as UnoColor;s.phase='play';return s;}
 if(command.action==='draw'){const c=draw(s,me,1);s.history.push(`${name} 抽了 1 张`);if(c&&unoPlayable(s,c))s.drawn=c.id;else next(s);}
 else if(command.action==='pass'){next(s);}
 else {
  const cardID=command.action.startsWith('wild:')?command.action.slice(5):command.values[0],at=s.hands[me].findIndex(c=>c.id===cardID),card=s.hands[me].splice(at,1)[0],previousColor=s.color,illegal=card.value==='wild4'&&s.hands[me].some(c=>c.color===previousColor);
  s.discard.push(card);s.color=card.color==='wild'?command.values[0] as UnoColor:card.color;s.history.push(`${name} 打出 ${unoTitle(card)}${card.color==='wild'?` → ${UNO_LABEL[s.color]}`:''}`);if(s.called)delete s.called[id];
  if(card.value==='wild4'){next(s);if(challenges(s)){s.pendingWild4={actor:me,target:s.current,previousColor,hand:structuredClone(s.hands[me]),illegal};s.phase='wild4';}else{draw(s,s.current,4);s.history.push(`${s.players[s.current].name} 抽 4 张并跳过`);next(s);}}
  else if(card.value==='reverse'){s.direction=s.direction===1?-1:1;next(s,s.players.length===2?2:1);}
  else if(card.value==='skip')next(s,2);
  else if(card.value==='draw2'){next(s);draw(s,s.current,2);s.history.push(`${s.players[s.current].name} 抽 2 张并跳过`);next(s);}
  else next(s);
  if(s.hands[me].length===1){s.unoWindow={actor:me,resume:s.phase==='wild4'?'wild4':'play',passed:[]};s.phase='unoCall';}
  else if(!s.pendingWild4)endRound(s,me);
 }
 s.history=s.history.slice(-60);return s;
 }
};
