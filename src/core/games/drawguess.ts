import { action, assertPlayers, seeded, shuffle, validateCommand, type Action, type Command, type GameModule, type GameOptions, type Player } from '../types';

type Point=[number,number];
export interface DrawStroke {points:Point[];color:string}
/** `rounds` is the number of complete drawing cycles: every player draws once per cycle. */
export interface DrawGuessState {players:Player[];language:'zh'|'en';round:number;rounds:number;seconds:number;drawer:number;phase:'choose'|'draw'|'reveal'|'finished';choices:{id:string;zh:string;en:string}[];answer?:{id:string;zh:string;en:string};strokes:DrawStroke[];guesses:{playerID:string;text:string;correct:boolean}[];scores:number[];history:string[];deadlineAt:number;revealUntil:number;/** Remaining milliseconds while the online/LAN host has paused for a disconnected player. */ pausedRemaining?:number;finished:boolean;winnerIDs:string[]}

const WORDS:[string,string][]=[['apple','苹果'],['bicycle','自行车'],['rainbow','彩虹'],['guitar','吉他'],['volcano','火山'],['umbrella','雨伞'],['rocket','火箭'],['panda','熊猫'],['castle','城堡'],['camera','相机'],['pizza','披萨'],['octopus','章鱼'],['balloon','气球'],['train','火车'],['dragon','龙'],['flower','花朵'],['snowman','雪人'],['key','钥匙'],['robot','机器人'],['whale','鲸鱼'],['sunglasses','太阳镜'],['butterfly','蝴蝶'],['mountain','山'],['coffee','咖啡'],['airplane','飞机'],['book','书本'],['fish','小鱼'],['moon','月亮'],['star','星星'],['tree','大树']];
const label=(s:DrawGuessState,w:{zh:string;en:string})=>s.language==='en'?w.en:w.zh;
const normalized=(value:string)=>value.trim().normalize('NFKC').toLocaleLowerCase();
const makeChoices=(s:DrawGuessState,seed:number)=>shuffle(WORDS,seeded(seed)).slice(0,3).map(([en,zh],i)=>({id:`word-${s.round}-${i}`,en,zh}));
const player=(s:DrawGuessState,id:string)=>s.players.find(p=>p.id===id);
const drawerID=(s:DrawGuessState)=>s.players[s.drawer].id;
const publicGuess=(s:DrawGuessState,g:{playerID:string;text:string;correct:boolean})=>g.correct?`${player(s,g.playerID)?.name||''} 猜对了`: `${player(s,g.playerID)?.name||''}：${g.text}`;
const cycle=(s:DrawGuessState)=>Math.ceil(s.round/s.players.length);
function turnTitle(s:DrawGuessState){return `第 ${cycle(s)} / ${s.rounds} 轮 · 第 ${s.round} 手`}
function startNext(s:DrawGuessState){
 if(s.round>=s.rounds*s.players.length){s.phase='finished';s.finished=true;const max=Math.max(...s.scores);s.winnerIDs=s.players.filter((_,i)=>s.scores[i]===max).map(p=>p.id);return;}
 s.round++;s.drawer=(s.drawer+1)%s.players.length;s.phase='choose';s.choices=makeChoices(s,1009+s.round*83+s.drawer);s.answer=undefined;s.strokes=[];s.guesses=[];s.deadlineAt=0;s.revealUntil=0;
}
/** Called only by a trusted cloud room or LAN host. Client commands cannot advance this clock. */
export function advanceDrawGuessClock(state:DrawGuessState,now:number):DrawGuessState {
 const s=structuredClone(state);if(s.finished||s.pausedRemaining!==undefined||!Number.isSafeInteger(now)||now<0)return s;
 if(s.phase==='choose'&&s.deadlineAt===0)s.deadlineAt=now+30000;
 else if(s.phase==='draw'&&s.deadlineAt===0)s.deadlineAt=now+s.seconds*1000;
 else if(s.phase==='reveal'&&s.revealUntil===0)s.revealUntil=now+7000;
 else if(s.phase==='choose'&&now>=s.deadlineAt){s.answer=s.choices[0];s.phase='draw';s.deadlineAt=now+s.seconds*1000;s.history.push('画词已自动选定');}
 else if(s.phase==='draw'&&now>=s.deadlineAt){s.phase='reveal';s.deadlineAt=0;s.revealUntil=now+7000;s.history.push('时间到，本轮揭晓');}
 else if(s.phase==='reveal'&&now>=s.revealUntil)startNext(s);
 return s;
}
export function drawGuessDeadline(s:DrawGuessState){return s.pausedRemaining!==undefined?0:s.phase==='reveal'?s.revealUntil:s.deadlineAt;}
/** Freeze a trusted host's clock. This never exposes a way for a player command to alter time. */
export function pauseDrawGuessClock(state:DrawGuessState,now:number):DrawGuessState {
 const s=structuredClone(state);if(s.finished||s.pausedRemaining!==undefined||!Number.isSafeInteger(now)||now<0)return s;
 const deadline=drawGuessDeadline(s);if(!deadline)return s;
 s.pausedRemaining=Math.max(0,deadline-now);s.deadlineAt=0;s.revealUntil=0;return s;
}
/** Resume a previously frozen trusted host clock using its stored remaining duration. */
export function resumeDrawGuessClock(state:DrawGuessState,now:number):DrawGuessState {
 const s=structuredClone(state);if(s.finished||s.pausedRemaining===undefined||!Number.isSafeInteger(now)||now<0)return s;
 const remaining=s.pausedRemaining;delete s.pausedRemaining;
 if(s.phase==='reveal')s.revealUntil=now+remaining;else if(s.phase==='choose'||s.phase==='draw')s.deadlineAt=now+remaining;
 return s;
}
export const drawguess:GameModule<DrawGuessState>={
 create(players,seed,options){assertPlayers(players,3,12);const language:'zh'|'en'=options?.language==='en'?'en':'zh',rounds=Math.max(1,Math.min(6,options?.drawRounds||1)),seconds=[45,60,75,90].includes(options?.drawSeconds||60)?options?.drawSeconds||60:60;const initial:DrawGuessState={players:structuredClone(players),language,round:1,rounds,seconds,drawer:0,phase:'choose',choices:[],strokes:[],guesses:[],scores:players.map(()=>0),history:['每位画手从三个词中秘密选择一个。'],deadlineAt:0,revealUntil:0,finished:false,winnerIDs:[]};initial.choices=makeChoices(initial,seed);return initial;},
 view(s,id,spectator=false){if(spectator)id='';const me=s.players.findIndex(p=>p.id===id);if(me<0&&!spectator)return {kind:'drawguess',phase:'不在本局',instruction:'仅本局玩家可查看',finished:s.finished,actions:[],sections:[],log:[],board:{}};
  const drawing=id===drawerID(s),inTurn=!s.finished&&s.phase==='draw',canChoose=!s.finished&&s.phase==='choose'&&drawing,canClear=inTurn&&drawing;
  const actions:Action[]=[...(canChoose?[action('choose', '选择要画的词',s.choices.map(word=>({id:word.id,title:label(s,word),translateTitle:false})),1,1)]:[]),...(canClear?[action('clear','清空画布')]:[])];
  const answerVisible=(drawing&&s.phase==='draw')||s.phase==='reveal'||s.finished;
  const instruction=s.finished?'本局结束':s.phase==='choose'?`${s.players[s.drawer].name} 正在选词`:s.phase==='draw'?`${s.players[s.drawer].name} 正在作画`: '本轮揭晓';
  return structuredClone({kind:'drawguess',phase:turnTitle(s),instruction,finished:s.finished,actions,sections:[],log:s.history,board:{phase:s.phase,round:s.round,cycle:cycle(s),rounds:s.rounds,seconds:s.seconds,deadlineAt:drawGuessDeadline(s),drawerID:drawerID(s),isDrawer:drawing,answer:answerVisible&&s.answer?label(s,s.answer):undefined,strokes:s.strokes,guesses:s.guesses.map(g=>({playerID:g.playerID,text:g.correct?'':g.text,correct:g.correct,label:publicGuess(s,g)})),players:s.players.map((p,i)=>({...p,score:s.scores[i],drawing:p.id===drawerID(s)})),winnerIDs:s.winnerIDs,canGuess:inTurn&&!drawing&&!spectator}});
 },
 apply(state,id,command){
  if(!state.players.some(p=>p.id===id))throw Error('不在本局中');
  // Drawing is deliberately separate from generic choice validation: points are bounded
  // numeric payloads, not a server-provided choice list.
  if(command.action==='stroke'){
   const s=structuredClone(state);if(s.phase!=='draw'||id!==drawerID(s)||s.strokes.length>=180||!/^#[0-9a-f]{6}$/i.test(command.text||'')||command.values.length<2||command.values.length>32)throw Error('这个操作已失效，请重新选择');
   const points:Point[]=command.values.map(value=>{const pair=value.split(',');const x=Number(pair[0]),y=Number(pair[1]);if(pair.length!==2||!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>1000||y<0||y>1000)throw Error('画笔坐标无效');return [x,y];});
   s.strokes.push({points,color:command.text!});return s;
  }
  if(command.action==='guess'){
   const s=structuredClone(state);if(s.phase!=='draw'||id===drawerID(s)||typeof command.text!=='string')throw Error('这个操作已失效，请重新选择');const text=command.text.trim().normalize('NFKC');if(!text||text.length>32)throw Error('猜词限 1–32 个字');const correct=!!s.answer&&normalized(text)===normalized(label(s,s.answer));s.guesses.push({playerID:id,text,correct});if(correct){const guesser=s.players.findIndex(p=>p.id===id);s.scores[guesser]+=2;s.scores[s.drawer]+=1;s.phase='reveal';s.deadlineAt=0;s.revealUntil=0;s.history.push(`${player(s,id)?.name||''} 猜对了`);}s.guesses=s.guesses.slice(-24);return s;
  }
  validateCommand(drawguess.view(state,id),command);const s=structuredClone(state);
  if(command.action==='choose'){s.answer=s.choices.find(word=>word.id===command.values[0]);s.phase='draw';s.deadlineAt=0;s.history.push(`${player(s,id)?.name||''} 已选词`);}
  else if(command.action==='clear'){s.strokes=[];}
  return s;
 }
};
