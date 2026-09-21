import {describe,expect,it} from 'vitest';
import {standardWerewolf as game,type WerewolfState,type WolfRole} from '../src/core/games/werewolf';

const create=()=>game.create(Array.from({length:12},(_,i)=>({id:`night-${i}`,name:`Player ${i+1}`,avatar:'🦊'})),47);
const role=(s:WerewolfState,r:WolfRole)=>s.players.find(p=>s.roles[p.id]===r)!.id;
const restore=(s:WerewolfState):WerewolfState=>JSON.parse(JSON.stringify(s));
const act=(s:WerewolfState,id:string,action:string,value?:string)=>game.apply(s,id,{action,values:value===undefined?[]:[value]});
function firstStep(state:WerewolfState,victim='skip'){
  let s=state;
  for(const id of [...s.alive]){
    if(s.stage!=='nightFirst')break;
    const a=game.view(s,id).actions[0];
    if(a)s=act(s,id,a.id,a.id==='wolf'?victim:a.choices.length?'skip':undefined);
  }
  return s;
}

describe('Werewolf night acknowledgements',()=>{
  it('keeps an ordinary player waiting after one acknowledgement without exposing the potion step',()=>{
    let s=create();const villager=role(s,'villager'),witch=role(s,'witch');
    s=act(s,villager,'sleep');const waiting=game.view(s,villager);
    s=restore(firstStep(s));
    expect(s.stage).toBe('nightSecond');
    expect(game.view(s,villager)).toEqual(waiting);
    for(const id of s.alive)expect(game.view(s,id).actions.map(a=>a.id)).toEqual(id===witch?['potion']:[]);
    const before=JSON.stringify(s);
    expect(()=>act(s,villager,'sleep')).toThrow();
    expect(JSON.stringify(s)).toBe(before);
    s=act(s,witch,'potion','skip');
    expect(s.stage).toBe('signup');
    expect(s.alive).toHaveLength(12);
  });

  it('lets a witch attacked tonight act and keeps deaths hidden through sheriff signup',()=>{
    let s=create();const witch=role(s,'witch'),victim=role(s,'villager');
    s=firstStep(s,witch);
    expect(s.stage).toBe('nightSecond');
    const potion=game.view(s,witch).actions[0];
    expect(potion.choices.some(c=>c.id==='save')).toBe(false);
    expect(potion.choices.some(c=>c.id===`poison:${victim}`)).toBe(true);
    s=act(s,witch,'potion',`poison:${victim}`);
    expect(s.stage).toBe('signup');expect(s.alive).toHaveLength(12);
    for(const id of [...s.alive])s=act(s,id,'signup','no');
    expect(s.alive).not.toContain(witch);expect(s.alive).not.toContain(victim);
    expect(s.stage).toBe('discussion');
  });

  it.each([false,true])('advances automatically with a previously dead witch (election pending: %s)',electionPending=>{
    let s=create();const witch=role(s,'witch'),victim=role(s,'villager');
    s.alive=s.alive.filter(id=>id!==witch);s.electionPending=electionPending;
    s=restore(firstStep(s,victim));
    expect(s.stage).toBe(electionPending?'signup':'discussion');
    expect(s.alive.includes(victim)).toBe(electionPending);
    expect(game.view(s,witch).actions).toEqual([]);
    if(electionPending)for(const id of [...s.alive])s=act(s,id,'signup','no');
    expect(s.stage).toBe('discussion');expect(s.alive).not.toContain(victim);
    expect(s.log.filter(line=>line.includes('天出局'))).toHaveLength(1);
  });

  it('preserves a hunter death action when the potion step is automatic',()=>{
    let s=create();const witch=role(s,'witch'),hunter=role(s,'hunter');
    s.alive=s.alive.filter(id=>id!==witch);s.electionPending=false;
    s=firstStep(s,hunter);
    expect(s.stage).toBe('hunter');expect(s.hunterID).toBe(hunter);
    s=act(s,hunter,'shoot','skip');
    expect(s.stage).toBe('discussion');expect(s.winner).toBeNull();
  });

  it.each(['nightFirst','nightSecond'] as const)('finishes a legacy %s checkpoint before upgrading the next night',checkpoint=>{
    let s=create();delete s.nightFlowVersion;const witch=role(s,'witch');
    if(checkpoint==='nightFirst'){
      const a=game.view(s,s.players[0].id).actions[0];
      s=act(s,s.players[0].id,a.id,a.choices.length?'skip':undefined);
      s=firstStep(restore(s));
    }else s=firstStep(s);
    expect(s.stage).toBe('nightSecond');
    expect(s.alive.filter(id=>game.view(s,id).actions.some(a=>a.id==='sleep'))).toHaveLength(11);
    s=restore(act(s,witch,'potion','skip'));
    expect(s.stage).toBe('nightSecond');
    for(const id of [...s.alive])if(id!==witch)s=act(s,id,'sleep');
    expect(s.stage).toBe('signup');
    for(const id of [...s.alive])s=act(s,id,'signup','no');
    for(const id of [...s.alive])s=act(s,id,'ready');
    for(const id of [...s.alive])s=act(s,id,'vote','skip');
    expect(s.night).toBe(2);expect(s.nightFlowVersion).toBe(2);
    s=firstStep(restore(s));
    for(const id of s.alive)expect(game.view(s,id).actions.map(a=>a.id)).toEqual(id===witch?['potion']:[]);
    s=act(s,witch,'potion','skip');expect(s.stage).toBe('discussion');
  });
});
