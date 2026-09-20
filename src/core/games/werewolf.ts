import {werewolfHosted,isHostedWerewolf,type HostedWerewolfState} from './werewolfHosted';
import { action, assertPlayers, seeded, shuffle, validateCommand, type Action, type Command, type GameOptions, type GameModule, type GameView, type Player } from '../types';
export type WolfRole='wolf'|'villager'|'seer'|'witch'|'hunter'|'guard';
type Stage='signup'|'electionSpeech'|'electionVote'|'nightFirst'|'nightSecond'|'discussion'|'vote'|'pk'|'hunter'|'badge';
export interface WerewolfState {
  players:Player[]; roles:Record<string,WolfRole>; alive:string[]; stage:Stage; submissions:Record<string,string>;
  candidates:string[]; electionRunoff:boolean; electionPending:boolean; electionExplosions:number; dayRunoff:boolean;
  sheriff:string|null; night:number; previousGuard:string|null; guarded:string|null; victim:string|null; poisoned:string|null;
  rescued:boolean; antidote:boolean; poison:boolean; investigations:Record<string,string>; hunterID:string|null;
  badgeOwner:string|null; continuation:'discussion'|'nightFirst'; winner:string|null; log:string[]; revealed:string[];
  publicVotes:Record<string,string>;
}
const labels:Record<WolfRole,string>={wolf:'狼人',villager:'平民',seer:'预言家',witch:'女巫',hunter:'猎人',guard:'守卫'};
export function werewolfPreset(n:number):WolfRole[]{
  if(!Number.isInteger(n)||n<6||n>18)throw new Error('狼人杀需要 6–18 人');
  const roles:WolfRole[]=[...Array(Math.floor(n/3)).fill('wolf'),'seer','witch'];
  if(n>=8)roles.push('hunter');if(n>=12)roles.push('guard');
  return [...roles,...Array(n-roles.length).fill('villager')];
}
const name=(s:WerewolfState,id:string)=>s.players.find(p=>p.id===id)?.name??id;
const living=(s:WerewolfState)=>s.players.map(p=>p.id).filter(id=>s.alive.includes(id));
const voters=(s:WerewolfState)=>s.stage==='electionVote'||(s.stage==='vote'&&s.dayRunoff)?living(s).filter(id=>!s.candidates.includes(id)):living(s);
const choices=(s:WerewolfState,ids:string[])=>ids.map(id=>({id,title:name(s,id)}));
const select=(s:WerewolfState,id:string,title:string,ids:string[],skip=false,help='')=>action(id,title,[...choices(s,ids),...(skip?[{id:'skip',title:'放弃'}]:[])],1,1,help);
function actionsFor(s:WerewolfState,id:string):Action[]{
  if(s.winner)return [];
  if(s.stage==='hunter')return id===s.hunterID?[select(s,'shoot','猎人开枪',living(s),true)]:[];
  if(s.stage==='badge')return id===s.badgeOwner?[select(s,'badge','移交警徽',living(s),true)]:[];
  if(!s.alive.includes(id))return [];
  const actions:Action[]=[];
  if(s.submissions[id]===undefined){
    switch(s.stage){
      case 'signup':actions.push(action('signup','警长竞选',[{id:'yes',title:'上警'},{id:'no',title:'不上警'}],1,1));break;
      case 'electionSpeech':case 'discussion':case 'pk':actions.push(action('ready','发言结束'));break;
      case 'electionVote':if(voters(s).includes(id))actions.push(select(s,'elect','选警长',s.candidates,true));break;
      case 'vote':if(voters(s).includes(id))actions.push(select(s,'vote',s.dayRunoff?'PK 复投':'放逐',s.dayRunoff?s.candidates:living(s),true));break;
      case 'nightFirst':
        if(s.roles[id]==='wolf')actions.push(select(s,'wolf','狼人袭击',living(s),true,'狼队刀口一致才生效'));
        else if(s.roles[id]==='seer')actions.push(select(s,'inspect','查验身份',living(s).filter(p=>p!==id),true));
        else if(s.roles[id]==='guard')actions.push(select(s,'guard','守护',living(s).filter(p=>p!==s.previousGuard),true,'不能连续两夜守同一人'));
        else actions.push(action('sleep','闭眼'));break;
      case 'nightSecond':
        if(s.roles[id]==='witch')actions.push(action('potion','女巫用药',[{id:'skip',title:'不用药'},...(s.antidote&&s.victim&&s.victim!==id?[{id:'save',title:`解救 ${name(s,s.victim)}`}]:[]),...(s.poison?living(s).filter(p=>p!==id).map(p=>({id:'poison:'+p,title:`毒杀 ${name(s,p)}`})):[])],1,1,s.antidote?`刀口：${s.victim?name(s,s.victim):'无人'}；不可自救，同夜只用一瓶`:'解药已用，不再获知刀口'));
        else actions.push(action('sleep','闭眼'));break;
    }
  }
  if(s.stage==='electionSpeech'&&s.candidates.includes(id))actions.push(action('withdraw','退水'));
  if(s.roles[id]==='wolf'&&['electionSpeech','discussion','pk'].includes(s.stage))actions.push(action('explode','自爆'));
  return actions;
}
function beginNight(s:WerewolfState){
  s.stage='nightFirst';s.submissions={};s.guarded=null;s.victim=null;s.poisoned=null;s.rescued=false;s.dayRunoff=false;
  s.candidates=s.electionPending&&s.electionExplosions>0?s.candidates.filter(id=>s.alive.includes(id)):[];
}
function evaluateWinner(s:WerewolfState){
  const roles=living(s).map(id=>s.roles[id]);
  if(!roles.includes('wolf'))s.winner='好人获胜 · 狼人全部出局';
  else if(!roles.includes('villager')||!roles.some(r=>r!=='wolf'&&r!=='villager'))s.winner='狼人获胜 · 屠边成功';
}
function resume(s:WerewolfState){s.submissions={};if(s.continuation==='nightFirst'){s.night++;beginNight(s);}else s.stage='discussion';}
function afterDeath(s:WerewolfState){
  if(s.hunterID){s.stage='hunter';return;}evaluateWinner(s);if(s.winner)return;
  if(s.badgeOwner){s.stage='badge';return;}resume(s);
}
function remove(s:WerewolfState,id:string){s.alive=s.alive.filter(p=>p!==id);if(s.sheriff===id){s.badgeOwner=id;s.sheriff=null;}}
function resolveNight(s:WerewolfState,next:'discussion'|'nightFirst'='discussion'){
  const deaths=new Set<string>();
  if(s.victim&&(s.victim===s.guarded)===s.rescued)deaths.add(s.victim);
  if(s.poisoned)deaths.add(s.poisoned);
  for(const id of deaths)remove(s,id);
  s.log.push(deaths.size?`第 ${s.night} 天出局：${s.players.filter(p=>deaths.has(p.id)).map(p=>p.name).join('、')}。`:`第 ${s.night} 天：平安夜。`);
  s.hunterID=[...deaths].find(id=>s.roles[id]==='hunter'&&id!==s.poisoned)??null;
  s.continuation=next;s.submissions={};afterDeath(s);
}
function finishElection(s:WerewolfState){s.electionPending=false;s.log.push(s.sheriff?`${name(s,s.sheriff)} 当选警长，放逐票计 1.5 票。`:'本局无警长。');resolveNight(s);}
function explode(s:WerewolfState,id:string){
  const election=s.stage==='electionSpeech';remove(s,id);s.revealed.push(id);s.log.push(`${name(s,id)} 公开狼人身份并自爆，白天结束。`);s.submissions={};
  if(election){s.electionExplosions++;if(s.electionExplosions>=2){s.electionPending=false;s.log.push('连续两次警上自爆，警徽流失。');}else s.log.push('警长竞选推迟到次日。');resolveNight(s,'nightFirst');}
  else{s.continuation='nightFirst';afterDeath(s);}
}
function resolveVote(s:WerewolfState){
  const election=s.stage==='electionVote';s.publicVotes={...s.submissions};s.log.push((election?'警长选票：':'放逐选票：')+voters(s).map(id=>`${name(s,id)} → ${s.submissions[id]==='skip'?'弃票':name(s,s.submissions[id])}`).join('；'));
  const counts:Record<string,number>={};for(const [id,target] of Object.entries(s.submissions))if(target!=='skip')counts[target]=(counts[target]??0)+(!election&&id===s.sheriff?3:2);
  const highest=Math.max(0,...Object.values(counts)),tied=living(s).filter(id=>counts[id]===highest&&highest>0);s.submissions={};
  if(election){
    if(tied.length===1){s.sheriff=tied[0];finishElection(s);}
    else if(tied.length>1&&!s.electionRunoff){s.candidates=tied;s.electionRunoff=true;s.stage='electionSpeech';}
    else{s.log.push('警长竞选未产生结果。');finishElection(s);}
  }else{
    if(tied.length===1){const target=tied[0];remove(s,target);s.log.push(`${name(s,target)} 被放逐。`);s.hunterID=s.roles[target]==='hunter'?target:null;s.continuation='nightFirst';afterDeath(s);}
    else if(tied.length>1&&!s.dayRunoff){s.candidates=tied;s.dayRunoff=true;s.stage='pk';}
    else{s.log.push('无人被放逐。');s.night++;beginNight(s);}
  }
}
export const standardWerewolf:GameModule<WerewolfState>={
  create(players,seed){
    assertPlayers(players,6,18);const deck=shuffle(werewolfPreset(players.length),seeded(seed));
    return {players:structuredClone(players),roles:Object.fromEntries(players.map((p,i)=>[p.id,deck[i]])),alive:players.map(p=>p.id),stage:'nightFirst',submissions:{},candidates:[],electionRunoff:false,electionPending:true,electionExplosions:0,dayRunoff:false,sheriff:null,night:1,previousGuard:null,guarded:null,victim:null,poisoned:null,rescued:false,antidote:true,poison:true,investigations:{},hunterID:null,badgeOwner:null,continuation:'discussion',winner:null,log:[`${players.length} 人局 · 屠边 · 首夜结束后竞选警长`],revealed:[],publicVotes:{}};
  },
  view(s,id){
    if(!s.players.some(p=>p.id===id))throw new Error('不是本局玩家');
    const role=s.roles[id],knowledge=[{id:'role',title:labels[role],detail:role==='wolf'?'狼人阵营':'好人阵营'}];
    if(role==='wolf'){
      knowledge.push({id:'wolves',title:'狼队友',detail:s.players.filter(p=>s.roles[p.id]==='wolf'&&p.id!==id).map(p=>p.name).join('、')});
      if(s.stage==='nightFirst')knowledge.push({id:'wolfPlans',title:'狼队刀口',detail:s.players.filter(p=>s.roles[p.id]==='wolf'&&s.submissions[p.id]!==undefined).map(p=>`${p.name}：${s.submissions[p.id]==='skip'?'空刀':name(s,s.submissions[p.id])}`).join('；')});
    }
    if(role==='seer')for(const [target,result] of Object.entries(s.investigations))knowledge.push({id:'check:'+target,title:name(s,target),detail:result});
    if(role==='witch')knowledge.push({id:'potions',title:'药剂',detail:`解药 ${s.antidote?'有':'无'} · 毒药 ${s.poison?'有':'无'}`});
    const night=s.stage==='nightFirst'||s.stage==='nightSecond';
    const stages:Record<Stage,string>={signup:'警长竞选 · 上警',electionSpeech:s.electionRunoff?'警长竞选 · PK':'警长竞选 · 发言',electionVote:'警长竞选 · 投票',nightFirst:`第 ${s.night} 夜`,nightSecond:`第 ${s.night} 夜`,discussion:`第 ${s.night} 天 · 发言`,vote:s.dayRunoff?'PK 复投':'放逐投票',pk:'平票 PK',hunter:'猎人开枪',badge:'警徽移交'};
    const actions=actionsFor(s,id);
    const candidates=['electionSpeech','electionVote','pk'].includes(s.stage)||(s.stage==='vote'&&s.dayRunoff)?s.candidates:[];
    return {kind:'werewolf',phase:s.winner??stages[s.stage],instruction:s.winner?'本局结束':actions.length?'轮到你了':'等待其他玩家',finished:!!s.winner,actions,sections:[{id:'identity',title:'你的身份',private:true,items:knowledge}],log:[...s.log],board:{stage:s.winner?'finished':night?'night':s.stage,night:s.night,ownRole:labels[role],ownKnowledge:knowledge,players:s.players.map(p=>({...p,alive:s.alive.includes(p.id),sheriff:s.sheriff===p.id,candidate:candidates.includes(p.id),...(p.id===id||s.winner||s.revealed.includes(p.id)?{role:labels[s.roles[p.id]]}:{})})),candidates:[...candidates],sheriff:s.sheriff,publicVotes:{...s.publicVotes},winner:s.winner}};
  },
  apply(state,id,command){
    validateCommand(standardWerewolf.view(state,id),command);const s=structuredClone(state),value=command.values[0]??'ready';
    if(command.action==='withdraw'){s.candidates=s.candidates.filter(p=>p!==id);s.log.push(`${name(s,id)} 退出警长竞选。`);if(s.candidates.length<=1){s.sheriff=s.candidates[0]??null;finishElection(s);}return s;}
    if(command.action==='explode'){explode(s,id);return s;}
    switch(s.stage){
      case 'hunter':if(value!=='skip'){remove(s,value);s.log.push(`猎人带走了 ${name(s,value)}。`);}s.revealed.push(id);s.hunterID=null;afterDeath(s);break;
      case 'badge':s.sheriff=value==='skip'?null:value;s.badgeOwner=null;s.log.push(s.sheriff?`警徽移交给 ${name(s,s.sheriff)}。`:'警徽已撕毁。');resume(s);break;
      case 'signup':
        s.submissions[id]=value;if(Object.keys(s.submissions).length===s.alive.length){s.candidates=living(s).filter(p=>s.submissions[p]==='yes');s.submissions={};if(s.candidates.length<=1){s.sheriff=s.candidates[0]??null;finishElection(s);}else s.stage='electionSpeech';}break;
      case 'electionSpeech':case 'discussion':case 'pk':
        s.submissions[id]=value;if(Object.keys(s.submissions).length===s.alive.length){s.submissions={};if(s.stage==='electionSpeech'){if(s.candidates.length<=1){s.sheriff=s.candidates[0]??null;finishElection(s);}else{s.stage='electionVote';if(voters(s).length===0){s.log.push('全员上警，本局无警长。');finishElection(s);}}}else{s.stage='vote';if(voters(s).length===0)resolveVote(s);}}break;
      case 'electionVote':case 'vote':s.submissions[id]=value;if(Object.keys(s.submissions).length===voters(s).length)resolveVote(s);break;
      case 'nightFirst':
        s.submissions[id]=value;if(command.action==='guard')s.guarded=value==='skip'?null:value;
        if(command.action==='inspect'&&value!=='skip')s.investigations[value]=s.roles[value]==='wolf'?'狼人':'好人';
        if(Object.keys(s.submissions).length===s.alive.length){const targets=new Set(living(s).filter(p=>s.roles[p]==='wolf').map(p=>s.submissions[p]));s.victim=targets.size===1&&![...targets].includes('skip')?[...targets][0]:null;s.previousGuard=s.guarded;s.submissions={};s.stage='nightSecond';}break;
      case 'nightSecond':
        s.submissions[id]=value;if(command.action==='potion'){if(value==='save'){s.antidote=false;s.rescued=true;}else if(value.startsWith('poison:')){s.poison=false;s.poisoned=value.slice(7);}}
        if(Object.keys(s.submissions).length===s.alive.length){s.submissions={};if(s.electionPending){if(s.electionExplosions>0){s.candidates=s.candidates.filter(p=>s.alive.includes(p));if(s.candidates.length<=1){s.sheriff=s.candidates[0]??null;finishElection(s);}else s.stage='electionSpeech';}else{s.stage='signup';s.candidates=[];s.electionRunoff=false;}}else resolveNight(s);}break;
    }
    return s;
  }
};

function createWerewolf(players:Player[],seed:number):WerewolfState;
function createWerewolf(players:Player[],seed:number,options:GameOptions&{werewolfMode:'judge'|'deal'}):HostedWerewolfState;
function createWerewolf(players:Player[],seed:number,options?:GameOptions):WerewolfState|HostedWerewolfState;
function createWerewolf(players:Player[],seed:number,options?:GameOptions){return options?.werewolfMode==='judge'||options?.werewolfMode==='deal'?werewolfHosted.create(players,seed,options):standardWerewolf.create(players,seed);}
function applyWerewolf(state:WerewolfState,id:string,command:Command):WerewolfState;
function applyWerewolf(state:HostedWerewolfState,id:string,command:Command):HostedWerewolfState;
function applyWerewolf(state:WerewolfState|HostedWerewolfState,id:string,command:Command):WerewolfState|HostedWerewolfState;
function applyWerewolf(state:WerewolfState|HostedWerewolfState,id:string,command:Command){return isHostedWerewolf(state)?werewolfHosted.apply(state,id,command):standardWerewolf.apply(state,id,command);}
export const werewolf={create:createWerewolf,view:(state:WerewolfState|HostedWerewolfState,id:string)=>isHostedWerewolf(state)?werewolfHosted.view(state,id):standardWerewolf.view(state,id),apply:applyWerewolf};
