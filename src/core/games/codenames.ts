import { action, assertPlayers, seeded, shuffle, validateCommand, type GameModule, type Player } from '../types';
import { SIGNAL_WORDS, localWord, type WordLanguage } from './wordBank';
export type SignalTeam='red'|'blue';
export type SignalIdentity=SignalTeam|'neutral'|'assassin';
export interface SignalCard {id:string;word:string;identity:SignalIdentity;revealed:boolean}
export interface SignalsState {players:Player[];teams:SignalTeam[];captains:string[];cards:SignalCard[];turn:SignalTeam;startingTeam:SignalTeam;phase:'clue'|'guess'|'penalty';clue:{word:string;count:number|'unlimited'}|null;guesses:number;limit:number|null;round:number;finished:boolean;winners:string[];winnerTeam:SignalTeam|null;history:string[];language:WordLanguage}
const say=(s:SignalsState,zh:string,en:string)=>zh;
const other=(team:SignalTeam):SignalTeam=>team==='red'?'blue':'red';
const teamLabel=(s:SignalsState,team:SignalTeam)=>say(s,team==='red'?'红队':'蓝队',team==='red'?'Red team':'Blue team');
const remaining=(s:SignalsState,team:SignalTeam)=>s.cards.filter(c=>c.identity===team&&!c.revealed).length;
function finish(s:SignalsState,team:SignalTeam){s.finished=true;s.winnerTeam=team;s.winners=s.players.filter((_,i)=>s.teams[i]===team).map(p=>p.id);s.history.push(say(s,`${teamLabel(s,team)}获胜`,`${teamLabel(s,team)} wins`));}
function nextTurn(s:SignalsState){s.turn=other(s.turn);s.phase='clue';s.clue=null;s.guesses=0;s.limit=null;s.round++;}
export function validSignalClue(s:SignalsState,input:unknown):string {
 if(typeof input!=='string')throw Error(say(s,'请输入一个线索词','Enter one clue word'));
 const text=input.trim().normalize('NFKC');
 if(!text||text.length>32||!/^\p{L}[\p{L}\p{M}'’\-]*$/u.test(text))throw Error(say(s,'线索需为 1–32 字的单个词，不含空格或数字','Use one word of 1–32 letters, without spaces or numbers'));
 const normalized=text.toLocaleLowerCase();
 for(const c of s.cards.filter(c=>!c.revealed)){
  const word=c.word.toLocaleLowerCase();
  if(normalized===word||(s.language==='zh'&&normalized.includes(word))||(s.language==='en'&&['s','es','ed','ing'].some(suffix=>normalized===word+suffix)))throw Error(say(s,'线索不能使用尚未揭晓的牌面词或其直接变形','A clue cannot be an unrevealed board word or its direct inflection'));
 }
 return text;
}
export const codenames:GameModule<SignalsState>={
 create(players,seed,options){assertPlayers(players,4,12);const rng=seeded(seed),language=options?.language==='en'?'en':'zh',startingTeam:SignalTeam=rng()<.5?'red':'blue';const identities=shuffle<SignalIdentity>([...Array(9).fill(startingTeam),...Array(8).fill(other(startingTeam)),...Array(7).fill('neutral'),'assassin'],rng);const words=shuffle(SIGNAL_WORDS,rng).slice(0,25);const teams=players.map((_,i)=>i%2?'blue' as const:'red' as const);return{players:structuredClone(players),teams,captains:[players[0].id,players[1].id],cards:words.map((pair,i)=>({id:`word-${i}`,word:localWord(pair,language),identity:identities[i],revealed:false})),turn:startingTeam,startingTeam,phase:'clue',clue:null,guesses:0,limit:null,round:1,finished:false,winners:[],winnerTeam:null,history:['按座位交替分红蓝队，每队首位玩家担任队长。'],language};},
 view(s,id){const me=s.players.findIndex(p=>p.id===id);if(me<0)return{kind:'codenames',phase:say(s,'不在本局','Not in this match'),instruction:say(s,'仅本局玩家可查看','Only match participants can view'),finished:s.finished,actions:[],sections:[],log:[],board:{}};
 const captain=s.captains.includes(id),myTeam=s.teams[me],canClue=!s.finished&&s.turn===myTeam&&captain&&s.phase==='clue',canGuess=!s.finished&&s.turn===myTeam&&!captain&&s.phase==='guess';
 const choices=Array.from({length:10},(_,i)=>({id:String(i),title:String(i),...(i===0?{subtitle:say(s,'不相关 · 不限猜测次数','Unrelated · unlimited guesses')}:{})})).concat([{id:'unlimited',title:'∞',subtitle:say(s,'不限猜测次数','Unlimited guesses')}]);
 const actions=!s.finished&&s.phase==='penalty'&&captain&&s.turn===myTeam?[action('penalty_cover',say(s,'补偿揭晓一个己方词','Reveal one team word as compensation'),s.cards.filter(c=>!c.revealed&&c.identity===myTeam).map(c=>({id:c.id,title:c.word,translateTitle:false})),1,1),action('skip_penalty',say(s,'放弃补偿，开始线索','Skip compensation and give a clue'))]:!s.finished&&s.phase==='guess'&&captain&&s.turn===myTeam?[action('invalid_clue',say(s,'承认线索无效，交出回合','Concede invalid clue and end turn'),[],0,0,say(s,'双方讨论确认后使用；对方队长可免费揭晓一个己方词。','Use after both sides agree. The opposing captain may reveal one of their team’s words.'))]:canClue?[action('clue',say(s,'发送线索','Send clue'),choices,1,1,say(s,'一个词加一个数字；线索必须关联含义，不能使用牌面词。','One word and one number. Link meanings; do not use a board word.'))]:canGuess?[action('guess',say(s,'确认猜词','Confirm guess'),s.cards.filter(c=>!c.revealed).map(c=>({id:c.id,title:c.word,translateTitle:false})),1,1),...(s.guesses>0?[action('stop',say(s,'结束猜测','End guesses'))]:[])]:[];
 const instruction=s.finished?say(s,`${teamLabel(s,s.winnerTeam!)}获胜`,`${teamLabel(s,s.winnerTeam!)} wins`):s.phase==='penalty'?say(s,`等待${teamLabel(s,s.turn)}队长选择补偿揭晓，或放弃补偿`,`Waiting for the ${teamLabel(s,s.turn)} captain to reveal a compensation word or skip compensation`):s.phase==='clue'?say(s,`等待${teamLabel(s,s.turn)}队长给出线索`,`Waiting for ${teamLabel(s,s.turn)} captain's clue`):say(s,`${teamLabel(s,s.turn)}猜词 · ${s.limit===null?'不限次数':`还可猜 ${s.limit-s.guesses} 次`}`,`${teamLabel(s,s.turn)} guesses · ${s.limit===null?'unlimited':`${s.limit-s.guesses} remaining`}`);
 return structuredClone({kind:'codenames',phase:say(s,`第 ${s.round} 回合`,`Turn ${s.round}`),instruction,finished:s.finished,actions,sections:[],log:s.history,board:{language:s.language,phase:s.phase,round:s.round,turn:s.turn,startingTeam:s.startingTeam,clue:s.clue,guesses:s.guesses,limit:s.limit,myTeam,isCaptain:captain,cards:s.cards.map(c=>({id:c.id,word:c.word,revealed:c.revealed,...(c.revealed||captain||s.finished?{identity:c.identity}:{})})),remaining:{red:remaining(s,'red'),blue:remaining(s,'blue')},winners:s.winners,winnerTeam:s.winnerTeam,players:s.players.map((p,i)=>({...p,team:s.teams[i],captain:s.captains.includes(p.id),score:s.cards.filter(c=>c.identity===s.teams[i]&&c.revealed).length}))}});},
 apply(state,id,command){validateCommand(codenames.view(state,id),command);const s=structuredClone(state);
 if(command.action==='clue'){const word=validSignalClue(s,command.text),count=command.values[0]==='unlimited'?'unlimited':Number(command.values[0]);s.clue={word,count};s.phase='guess';s.guesses=0;s.limit=count===0||count==='unlimited'?null:count+1;s.history.push(`${teamLabel(s,s.turn)}: ${word} · ${count==='unlimited'?'∞':count}`);}
 else if(command.action==='stop'){nextTurn(s);}
 else if(command.action==='invalid_clue'){s.history.push(say(s,'队长承认无效线索，对方获得补偿','Captain conceded an invalid clue. The other team receives compensation.'));nextTurn(s);s.phase='penalty';}
 else if(command.action==='skip_penalty'){s.phase='clue';}
 else if(command.action==='penalty_cover'){const card=s.cards.find(c=>c.id===command.values[0])!;card.revealed=true;s.history.push(say(s,`补偿揭晓：${card.word}`,`Compensation reveal: ${card.word}`));if(!remaining(s,s.turn))finish(s,s.turn);else s.phase='clue';}
 else if(command.action==='guess'){const card=s.cards.find(c=>c.id===command.values[0])!;card.revealed=true;s.guesses++;const identity=card.identity==='assassin'?say(s,'危险目标','Danger'):card.identity==='neutral'?say(s,'路人','Bystander'):teamLabel(s,card.identity);s.history.push(`${s.players.find(p=>p.id===id)!.name}: ${card.word} → ${identity}`);
 if(card.identity==='assassin')finish(s,other(s.turn));else if(!remaining(s,'red'))finish(s,'red');else if(!remaining(s,'blue'))finish(s,'blue');else if(card.identity!==s.turn||(s.limit!==null&&s.guesses>=s.limit))nextTurn(s);
 }
 s.history=s.history.slice(-60);return s;}
};
