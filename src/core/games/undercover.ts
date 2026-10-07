import { action, assertPlayers, seeded, shuffle, validateCommand, type GameModule, type Player } from '../types';
import { ODD_WORD_PAIRS, localWord, type WordLanguage } from './wordBank';
export type OddRole='common'|'odd';
export interface UndercoverState {players:Player[];roles:OddRole[];words:[string,string];alive:boolean[];ready:boolean[];phase:'deal'|'describe'|'vote'|'defend';order:number[];speaker:number;votes:Record<string,string>;lastVotes:Record<string,string>;tied:string[];runoff:boolean;round:number;finished:boolean;winners:string[];winnerRole:OddRole|null;history:string[];language:WordLanguage}
/** Stable state fields also allow old deal/turn checkpoints to reopen as a word tool. */
export const undercover:GameModule<UndercoverState>={
 create(players,seed,options){assertPlayers(players,3,12);const rng=seeded(seed),language=options?.language==='en'?'en':'zh',pair=ODD_WORD_PAIRS[Math.floor(rng()*ODD_WORD_PAIRS.length)],oddCount=players.length<=6?1:players.length<=10?2:3;
 const words=shuffle(pair,rng).map(p=>localWord(p,language)) as [string,string],roles=shuffle<OddRole>([...Array(oddCount).fill('odd'),...Array(players.length-oddCount).fill('common')],rng);
 return{players:structuredClone(players),roles,words,alive:players.map(()=>true),ready:players.map(()=>false),phase:'deal',order:[],speaker:0,votes:{},lastVotes:{},tied:[],runoff:false,round:0,finished:false,winners:[],winnerRole:null,history:[],language};},
 view(s,id,spectator=false){const me=spectator?-1:s.players.findIndex(p=>p.id===id);
 if(me<0&&!spectator)throw new Error('不在本局中');
 return structuredClone({kind:'undercover',phase:'秘密发词',instruction:'发词后在线下组织游戏',finished:false,actions:me>=0&&!s.ready[me]?[action('ready','记住了')]:[],sections:[],log:[],board:{language:s.language,phase:'deal',round:0,word:me<0?undefined:s.words[s.roles[me]==='common'?0:1],ready:me>=0&&s.ready[me],players:s.players.map((p,i)=>({...p,ready:s.ready[i]}))}});},
 apply(state,id,command){validateCommand(undercover.view(state,id),command);const s=structuredClone(state),me=s.players.findIndex(p=>p.id===id);s.ready[me]=true;return s;}
};
