import {recordGameText,textList} from '../gameText';
import { action, assertPlayers, seeded, shuffle, validateCommand, type GameModule, type Player, type GameView, type GameText } from '../types';

export type AvalonRole = 'merlin'|'percival'|'servant'|'morgana'|'assassin'|'minion';
export interface AvalonState {
  players:Player[]; roles:Record<string,AvalonRole>; stage:'propose'|'approve'|'mission'|'assassinate';
  leader:number; team:string[]; votes:Record<string,boolean>; results:boolean[]; failCounts:number[];
  rejections:number; publicVotes:Record<string,boolean>; winner:string|null; log:string[]; logText?:Record<number,GameText>;
}
const labels:Record<AvalonRole,string>={merlin:'梅林',percival:'派西维尔',servant:'忠臣',morgana:'莫甘娜',assassin:'刺客',minion:'爪牙'};
const evil=(role:AvalonRole)=>['morgana','assassin','minion'].includes(role);
export const avalonTeamSizes=(n:number)=>n===5?[2,3,2,3,3]:n===6?[2,3,4,3,4]:n===7?[2,3,3,4,4]:[3,4,4,5,5];
export const avalon:GameModule<AvalonState>={
  create(players,seed){
    assertPlayers(players,5,10); const rng=seeded(seed), evilCount=({5:2,6:2,7:3,8:3,9:3,10:4} as Record<number,number>)[players.length];
    const deck=shuffle<AvalonRole>(['merlin','percival','morgana','assassin',...Array(evilCount-2).fill('minion'),...Array(players.length-evilCount-2).fill('servant')],rng);
    return {players:structuredClone(players),roles:Object.fromEntries(players.map((p,i)=>[p.id,deck[i]])),stage:'propose',leader:Math.floor(rng()*players.length),team:[],votes:{},results:[],failCounts:[],rejections:0,publicVotes:{},winner:null,log:['圆桌已就绪。']};
  },
  view(s,id,spectator=false){if(spectator)id='';
    if(!spectator&&!s.players.some(p=>p.id===id)) throw new Error('不是本局玩家');
    const role=s.roles[id], quest=Math.min(s.results.length+1,5), sizes=avalonTeamSizes(s.players.length), name=(id:string)=>s.players.find(p=>p.id===id)!.name;
    const choices=(ids:string[])=>ids.map(id=>({id,title:name(id)}));
    const knowledge=spectator?[]:[{id:'role',title:labels[role],detail:evil(role)?'邪恶阵营':'正义阵营'}];
    if(evil(role)||role==='merlin')knowledge.push({id:'evil',title:'邪恶玩家',detail:s.players.filter(p=>p.id!==id&&evil(s.roles[p.id])).map(p=>p.name).join('、')});
    if(role==='percival')knowledge.push({id:'merlin',title:'梅林 / 莫甘娜',detail:s.players.filter(p=>['merlin','morgana'].includes(s.roles[p.id])).map(p=>p.name).join('、')});
    const actions:GameView['actions']=[];
    if(!spectator&&!s.winner){
      if(s.stage==='propose'&&s.players[s.leader].id===id)actions.push(action('propose',`选择 ${sizes[s.results.length]} 名队员`,choices(s.players.map(p=>p.id)),sizes[s.results.length],sizes[s.results.length]));
      if(s.stage==='approve'&&!Object.hasOwn(s.votes,id))actions.push(action('approve','队伍表决',[{id:'yes',title:'赞成'},{id:'no',title:'反对'}],1,1));
      if(s.stage==='mission'&&s.team.includes(id)&&!Object.hasOwn(s.votes,id))actions.push(action('mission','秘密任务',[{id:'success',title:'成功'},...(evil(role)?[{id:'fail',title:'失败'}]:[])],1,1,s.players.length>=7&&s.results.length===3?'两张失败牌才会失败':''));
      if(s.stage==='assassinate'&&role==='assassin')actions.push(action('assassinate','刺杀梅林',choices(s.players.filter(p=>!evil(s.roles[p.id])).map(p=>p.id)),1,1));
    }
    const phase=s.winner??(s.stage==='assassinate'?'刺杀梅林':`第 ${quest} 次任务 · ${{propose:'组队',approve:'表决',mission:'执行',assassinate:''}[s.stage]}`);
    return {kind:'avalon',phase,instruction:s.winner?'本局结束':actions.length?'轮到你了':'等待其他玩家',finished:!!s.winner,actions,sections:[{id:'identity',title:'你的身份',private:true,items:knowledge}],log:[...s.log],logText:structuredClone(s.logText||{}),board:{stage:s.winner?'finished':s.stage,ownRole:labels[role],ownKnowledge:knowledge,players:s.players.map(p=>({...p,alive:true,leader:s.players[s.leader].id===p.id,team:s.team.includes(p.id),...(p.id===id||s.winner?{role:labels[s.roles[p.id]]}:{})})),leader:s.players[s.leader].id,team:[...s.team],quest,teamSize:sizes[Math.min(s.results.length,4)],teamSizes:sizes,results:[...s.results],failCounts:[...s.failCounts],rejections:s.rejections,publicVotes:{...s.publicVotes},twoFailsRequired:s.players.length>=7&&s.results.length===3,winner:s.winner}};
  },
  apply(state,id,command){
    validateCommand(avalon.view(state,id),command); const s=structuredClone(state), value=command.values[0], name=(id:string)=>s.players.find(p=>p.id===id)!.name;
    if(s.stage==='propose'){s.team=[...command.values];s.votes={};s.stage='approve';}
    else if(s.stage==='approve'){
      s.votes={...s.votes,[id]:value==='yes'};
      if(Object.keys(s.votes).length===s.players.length){
        s.publicVotes={...s.votes};recordGameText(s,'表决：'+s.players.map(p=>`${p.name} ${s.votes[p.id]?'赞成':'反对'}`).join('；'),{template:'表决：{votes}',values:{votes:textList(s.players.map(p=>({template:`{name} ${s.votes[p.id]?'赞成':'反对'}`,values:{name:p.name}})))}});
        if(Object.values(s.votes).filter(Boolean).length>s.players.length/2){s.rejections=0;s.stage='mission';}
        else{s.rejections++;s.leader=(s.leader+1)%s.players.length;s.stage='propose';s.team=[];if(s.rejections===5)s.winner='邪恶获胜 · 连续五次否决';}s.votes={};
      }
    }else if(s.stage==='mission'){
      s.votes={...s.votes,[id]:value==='success'};
      if(Object.keys(s.votes).length===s.team.length){
        const fails=Object.values(s.votes).filter(v=>!v).length, success=fails<(s.players.length>=7&&s.results.length===3?2:1);
        s.results.push(success);s.failCounts.push(fails);s.log.push(`第 ${s.results.length} 次任务${success?'成功':'失败'}，${fails} 张失败牌。`);s.votes={};
        if(s.results.filter(v=>!v).length===3)s.winner='邪恶获胜 · 三次任务失败';
        else if(s.results.filter(Boolean).length===3)s.stage='assassinate';
        else{s.leader=(s.leader+1)%s.players.length;s.stage='propose';s.team=[];}
      }
    }else{s.log.push(`刺客选择了 ${name(value)}。`);s.winner=s.roles[value]==='merlin'?'邪恶获胜 · 梅林被刺杀':'正义获胜 · 梅林幸存';}
    return s;
  }
};
