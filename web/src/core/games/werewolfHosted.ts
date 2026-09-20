import {action,assertPlayers,seeded,shuffle,validateCommand,type Action,type GameModule,type GameOptions,type GameView,type Player} from '../types';
import {werewolfPreset,type WolfRole} from './werewolf';
export type HostedStage='dealt'|'guard'|'wolves'|'witch'|'seer'|'sheriff'|'dawn'|'day'|'hunter'|'badge'|'finished';
export interface HostedWerewolfState{
  options:{werewolfMode:'judge'|'deal';moderatorID:string};players:Player[];participants:Player[];seed:number;dealNumber:number;
  roles:Record<string,WolfRole>;alive:string[];stage:HostedStage;night:number;sheriff:string|null;
  guarded:string|null;previousGuard:string|null;knife:string|null;poisoned:string|null;saved:boolean;antidote:boolean;poison:boolean;
  checks:Array<{night:number;target:string;result:string}>;hunterID:string|null;badgeOwner:string|null;
  electionPending:boolean;electionExplosions:number;next:'day'|'night';winner:string|null;log:string[];privateLog:string[];
}
const roleNames:Record<WolfRole,string>={wolf:'狼人',villager:'平民',seer:'预言家',witch:'女巫',hunter:'猎人',guard:'守卫'};
const prompts:Record<HostedStage,string>={dealt:'身份已发放',guard:'守卫请睁眼',wolves:'狼人请睁眼',witch:'女巫请睁眼',seer:'预言家请睁眼',sheriff:'天亮 · 竞选警长',dawn:'公布昨夜死讯',day:'白天 · 发言与投票',hunter:'猎人决定是否开枪',badge:'警徽移交',finished:'本局结束'};
const pName=(s:HostedWerewolfState,id:string)=>s.participants.find(p=>p.id===id)?.name??id;
const alive=(s:HostedWerewolfState)=>s.participants.filter(p=>s.alive.includes(p.id));
const livingRole=(s:HostedWerewolfState,role:WolfRole)=>alive(s).find(p=>s.roles[p.id]===role)?.id;
const opts=(s:HostedWerewolfState,ids:string[])=>ids.map(id=>({id,title:pName(s,id),subtitle:`${s.participants.findIndex(p=>p.id===id)+1} 号`}));
const target=(s:HostedWerewolfState,id:string,title:string,ids:string[],skip=true,help=''):Action=>action(id,title,[...opts(s,ids),...(skip?[{id:'skip',title:'放弃 / 无人'}]:[])],1,1,help);
function pendingDeaths(s:HostedWerewolfState){const deaths=new Set<string>();if(s.knife&&(s.knife===s.guarded)===s.saved)deaths.add(s.knife);if(s.poisoned)deaths.add(s.poisoned);return [...deaths];}
function afterNightStage(s:HostedWerewolfState){
 const order:HostedStage[]=['guard','wolves','witch','seer'];const current=order.indexOf(s.stage);
 for(let i=current+1;i<order.length;i++){const stage=order[i],role=({guard:'guard',wolves:'wolf',witch:'witch',seer:'seer'} as Record<string,WolfRole>)[stage];if(livingRole(s,role)){s.stage=stage;return;}}
 s.next='day';s.stage=s.electionPending?'sheriff':'dawn';
}
function beginNight(s:HostedWerewolfState){s.night++;s.knife=null;s.guarded=null;s.poisoned=null;s.saved=false;s.stage='guard';if(!livingRole(s,'guard'))afterNightStage(s);}
function kill(s:HostedWerewolfState,id:string){s.alive=s.alive.filter(p=>p!==id);if(s.sheriff===id){s.badgeOwner=id;s.sheriff=null;}}
function resume(s:HostedWerewolfState){if(s.next==='night')beginNight(s);else s.stage='day';}
function afterDeath(s:HostedWerewolfState){
 if(s.hunterID){s.stage='hunter';return;}
 const roles=alive(s).map(p=>s.roles[p.id]);
 if(!roles.includes('wolf'))s.winner='好人获胜 · 狼人全部出局';
 else if(!roles.includes('villager')||!roles.some(r=>r!=='wolf'&&r!=='villager'))s.winner='狼人获胜 · 屠边成功';
 if(s.winner){s.stage='finished';s.log.push(s.winner);return;}if(s.badgeOwner){s.stage='badge';return;}resume(s);
}
function actions(s:HostedWerewolfState,id:string):Action[]{
 if(id!==s.options.moderatorID)return [];
 if(s.options.werewolfMode==='deal')return [action('redeal','重新发身份',[{id:'confirm',title:'确认重发，所有人原身份作废'}],1,1,'将重新洗牌并收起每个人的身份卡。')];
 const ids=alive(s).map(p=>p.id);
 switch(s.stage){
  case 'guard':return [target(s,'judge-guard','记录守护对象',ids.filter(p=>p!==s.previousGuard),true,'根据守卫手势记录；不可连续两夜守同一人。')];
  case 'wolves':return [target(s,'judge-wolves','记录狼队刀口',ids,true,'根据狼队共同手势记录。意见不一致记为空刀。')];
  case 'witch':{const witch=livingRole(s,'witch');return [action('judge-potion','记录女巫用药',[{id:'skip',title:'不用药'},...(s.antidote&&s.knife&&s.knife!==witch?[{id:'save',title:`解救 ${pName(s,s.knife)}`}]:[]),...(s.poison?opts(s,ids.filter(p=>p!==witch)).map(c=>({...c,id:'poison:'+c.id,title:'毒杀 '+c.title})):[])],1,1,s.antidote?`刀口：${s.knife?pName(s,s.knife):'无人'}。不可自救，同夜限一瓶药。`:'解药已用：不要再向女巫提示刀口。')];}
  case 'seer':return [target(s,'judge-inspect','记录预言家查验',ids.filter(p=>p!==livingRole(s,'seer')),true,'查验结果仅保存在法官手册；面对面向预言家给出手势。')];
  case 'sheriff':return [target(s,'judge-sheriff','记录当选警长',ids,true,'先完成现场上警、发言和表决，再记录结果；尚未公布昨夜死讯。'),target(s,'judge-election-explode','记录警上自爆',ids.filter(p=>s.roles[p]==='wolf'),false,'首次警上自爆延迟竞选，第二次吞警徽。之后仍需公布当夜死讯。')];
  case 'dawn':return [action('judge-dawn','公布死讯',[{id:'confirm',title:pendingDeaths(s).length?'确认公布昨夜出局玩家':'确认宣布平安夜'}],1,1)];
  case 'day':return [target(s,'judge-exile','记录放逐结果',ids,true,'现场统计选票（警长 1.5 票），平票先进行 PK。复投仍平票则选择无人。'),target(s,'judge-explode','记录狼人自爆',ids.filter(p=>s.roles[p]==='wolf'),false,'根据现场已公开的自爆记录；白天随即结束。')];
  case 'hunter':return [target(s,'judge-shoot',`${pName(s,s.hunterID!)} · 猎人开枪`,ids,true)];
  case 'badge':return [target(s,'judge-badge',`${pName(s,s.badgeOwner!)} · 移交警徽`,ids,true,'选择放弃则撕毁警徽。')];
  default:return [];
 }
}
export function isHostedWerewolf(s:unknown):s is HostedWerewolfState{return !!s&&typeof s==='object'&&['judge','deal'].includes((s as HostedWerewolfState).options?.werewolfMode);}
export const werewolfHosted:GameModule<HostedWerewolfState>={
 create(players,seed,options?:GameOptions){
  const mode=options?.werewolfMode;if(mode!=='judge'&&mode!=='deal')throw new Error('请选择法官或仅发身份模式');
  assertPlayers(players,mode==='judge'?7:6,mode==='judge'?19:18);
  const moderatorID=options?.moderatorID;if(!moderatorID||!players.some(p=>p.id===moderatorID))throw new Error('需要房主担任法官 / 发牌人');
  const participants=players.filter(p=>mode!=='judge'||p.id!==moderatorID),deck=shuffle(werewolfPreset(participants.length),seeded(seed));
  const s:HostedWerewolfState={options:{werewolfMode:mode,moderatorID},players:structuredClone(players),participants:structuredClone(participants),seed:seed>>>0,dealNumber:1,roles:Object.fromEntries(participants.map((p,i)=>[p.id,deck[i]])),alive:participants.map(p=>p.id),stage:'dealt',night:0,sheriff:null,guarded:null,previousGuard:null,knife:null,poisoned:null,saved:false,antidote:true,poison:true,checks:[],hunterID:null,badgeOwner:null,electionPending:true,electionExplosions:0,next:'day',winner:null,log:[mode==='judge'?'法官已发放身份，所有玩家只需查看自己的牌。':'身份已发放，现场自由主持。'],privateLog:[]};
  if(mode==='judge')beginNight(s);return s;
 },
 view(s,id){
  if(!s.players.some(p=>p.id===id))throw new Error('不是本局玩家');
  const judge=s.options.werewolfMode==='judge'&&s.options.moderatorID===id,role=s.roles[id],name=judge?'法官':roleNames[role];
  const ownKnowledge=[{id:'role',title:name,detail:judge?'你负责主持，不参与阵营胜负':role==='wolf'?'狼人阵营':'好人阵营'}];
  const board:Record<string,any>={mode:s.options.werewolfMode,moderatorID:s.options.moderatorID,isModerator:judge,stage:judge?s.stage:'dealt',dealNumber:s.dealNumber,ownRole:name,ownRoleKey:judge?'moderator':role,ownKnowledge,night:judge?s.night:undefined,players:s.participants.map(p=>({...p,alive:s.alive.includes(p.id),sheriff:s.sheriff===p.id,...(judge||p.id===id?{role:roleNames[s.roles[p.id]],roleKey:s.roles[p.id]}:{})})),sheriff:s.sheriff,winner:s.winner};
  if(judge)board.moderatorOnly={night:s.night,prompt:prompts[s.stage],knife:s.knife,guarded:s.guarded,previousGuard:s.previousGuard,potions:{antidote:s.antidote,poison:s.poison},checks:structuredClone(s.checks),pendingDeaths:pendingDeaths(s),hunterID:s.hunterID,badgeOwner:s.badgeOwner,log:[...s.privateLog]};
  return {kind:'werewolf',phase:judge?`第 ${s.night} ${['guard','wolves','witch','seer'].includes(s.stage)?'夜':'天'} · ${prompts[s.stage]}`:s.options.werewolfMode==='deal'?'身份牌已发放':s.winner??'听法官主持',instruction:judge?'仅法官操作':s.options.werewolfMode==='deal'?'看好自己的身份牌':'收好身份牌，听法官主持',finished:!!s.winner,actions:actions(s,id),sections:[{id:'identity',title:'你的身份',private:true,items:ownKnowledge}],log:[...s.log],board};
 },
 apply(state,id,command){
  validateCommand(werewolfHosted.view(state,id),command);
  if(command.action==='redeal'){const nextSeed=(Math.imul(state.seed,1664525)+1013904223+state.dealNumber)>>>0,s=werewolfHosted.create(state.players,nextSeed,state.options);s.dealNumber=state.dealNumber+1;return s;}
  const s=structuredClone(state),value=command.values[0];
  switch(command.action){
   case 'judge-guard':s.guarded=value==='skip'?null:value;s.previousGuard=s.guarded;s.privateLog.push(`第 ${s.night} 夜守护：${s.guarded?pName(s,s.guarded):'空守'}`);afterNightStage(s);break;
   case 'judge-wolves':s.knife=value==='skip'?null:value;s.privateLog.push(`第 ${s.night} 夜刀口：${s.knife?pName(s,s.knife):'空刀'}`);afterNightStage(s);break;
   case 'judge-potion':if(value==='save'){s.antidote=false;s.saved=true;}else if(value.startsWith('poison:')){s.poison=false;s.poisoned=value.slice(7);}s.privateLog.push(`第 ${s.night} 夜用药：${value==='skip'?'无':value==='save'?'解药':`毒杀 ${pName(s,s.poisoned!)}`}`);afterNightStage(s);break;
   case 'judge-inspect':if(value!=='skip'){const result=s.roles[value]==='wolf'?'狼人':'好人';s.checks.push({night:s.night,target:value,result});s.privateLog.push(`第 ${s.night} 夜查验：${pName(s,value)} · ${result}`);}afterNightStage(s);break;
   case 'judge-sheriff':s.electionPending=false;s.sheriff=value==='skip'?null:value;s.log.push(s.sheriff?`${pName(s,s.sheriff)} 当选警长。`:'本局无警长。');s.stage='dawn';break;
   case 'judge-election-explode':kill(s,value);s.electionExplosions++;s.electionPending=s.electionExplosions<2;s.log.push(`${pName(s,value)} 警上自爆，${s.electionPending?'竞选延至次日':'警徽流失'}。`);s.next='night';s.stage='dawn';break;
   case 'judge-dawn':{const deaths=pendingDeaths(s);for(const target of deaths)kill(s,target);s.log.push(deaths.length?`第 ${s.night} 天出局：${deaths.map(id=>pName(s,id)).join('、')}。`:`第 ${s.night} 天：平安夜。`);s.hunterID=deaths.find(p=>s.roles[p]==='hunter'&&p!==s.poisoned)??null;afterDeath(s);break;}
   case 'judge-exile':case 'judge-explode':if(value!=='skip'){kill(s,value);s.log.push(`${pName(s,value)} ${command.action==='judge-explode'?'公开狼人身份并自爆':'被放逐'}。`);s.hunterID=s.roles[value]==='hunter'?value:null;}else s.log.push('本轮无人被放逐。');s.next='night';afterDeath(s);break;
   case 'judge-shoot':if(value!=='skip'){kill(s,value);s.log.push(`猎人带走了 ${pName(s,value)}。`);}s.hunterID=null;afterDeath(s);break;
   case 'judge-badge':s.sheriff=value==='skip'?null:value;s.badgeOwner=null;s.log.push(s.sheriff?`警徽移交给 ${pName(s,s.sheriff)}。`:'警徽已撕毁。');resume(s);break;
  }
  return s;
 }
};
