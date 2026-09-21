import {describe,it,expect} from 'vitest';
import {avalon,avalonTeamSizes,type AvalonState} from '../src/core/games/avalon';
import {werewolf,werewolfPreset,type WerewolfState} from '../src/core/games/werewolf';
import {seeded,shuffle,type Player} from '../src/core/types';
const players=(n:number):Player[]=>Array.from({length:n},(_,i)=>({id:`p${i}`,name:`玩家${i}`,avatar:'🦊'}));
const role=(s:WerewolfState,r:string)=>s.players.find(p=>s.roles[p.id]===r)!.id;
const act=(s:WerewolfState,id:string,action:string,values:string[]=[])=>werewolf.apply(s,id,{action,values});
function nightFirst(state:WerewolfState,knife='skip',guard='skip'){
  let s=state;for(const p of s.players){const a=werewolf.view(s,p.id).actions[0];if(!a)continue;s=act(s,p.id,a.id,a.id==='wolf'?[knife]:a.id==='guard'?[guard]:a.id==='inspect'?['skip']:[]);}return s;
}
function nightSecond(state:WerewolfState,potion='skip'){
  let s=state;for(const p of s.players){if(s.stage!=='nightSecond')break;const a=werewolf.view(s,p.id).actions[0];if(!a)continue;s=act(s,p.id,a.id,a.id==='potion'?[potion]:[]);}return s;
}
function election(state:WerewolfState,candidates:string[]=[]){let s=state;for(const p of s.players)if(s.alive.includes(p.id))s=act(s,p.id,'signup',[candidates.includes(p.id)?'yes':'no']);return s;}
function ready(state:WerewolfState){let s=state;for(const p of s.players)if(werewolf.view(s,p.id).actions.some(a=>a.id==='ready'))s=act(s,p.id,'ready');return s;}
function quest(state:AvalonState,fails=0){
  let s=state;const evil=s.players.filter(p=>['morgana','assassin','minion'].includes(s.roles[p.id]));const good=s.players.filter(p=>!evil.includes(p));
  const team=[...evil.slice(0,fails),...good,...evil.slice(fails)].slice(0,avalonTeamSizes(s.players.length)[s.results.length]).map(p=>p.id);
  s=avalon.apply(s,s.players[s.leader].id,{action:'propose',values:team});for(const p of s.players)s=avalon.apply(s,p.id,{action:'approve',values:['yes']});
  for(const id of team)s=avalon.apply(s,id,{action:'mission',values:[evil.slice(0,fails).some(p=>p.id===id)?'fail':'success']});return s;
}
describe('Avalon',()=>{
  it('uses correct compositions, exact knowledge, and no unowned identities',()=>{
    for(let n=5;n<=10;n++){
      const s=avalon.create(players(n),42);expect(Object.values(s.roles).filter(r=>['morgana','assassin','minion'].includes(r))).toHaveLength(({5:2,6:2,7:3,8:3,9:3,10:4} as Record<number,number>)[n]);
      for(const p of s.players){const v=avalon.view(s,p.id);expect(v.board.players.filter((p:any)=>p.role)).toHaveLength(1);if(s.roles[p.id]==='servant')expect(v.board.ownKnowledge).toHaveLength(1);if(s.roles[p.id]==='percival')expect(v.board.ownKnowledge[1].detail.split('、')).toHaveLength(2);}
      expect(()=>avalon.view(s,'stranger')).toThrow();
    }
  });
  it('rejects invalid proposals atomically and ends on five rejected teams',()=>{
    let s=avalon.create(players(6),9);
    for(let i=0;i<5;i++){
      const before=JSON.stringify(s);expect(()=>avalon.apply(s,s.players[s.leader].id,{action:'propose',values:['p0','p0']})).toThrow();expect(JSON.stringify(s)).toBe(before);
      s=avalon.apply(s,s.players[s.leader].id,{action:'propose',values:['p0','p1']});const publicBefore=avalon.view(s,'p0').board.publicVotes;
      for(const p of s.players.slice(0,-1))s=avalon.apply(s,p.id,{action:'approve',values:['no']});expect(avalon.view(s,'p0').board.publicVotes).toEqual(publicBefore);
      s=avalon.apply(s,s.players.at(-1)!.id,{action:'approve',values:['no']});
    }expect(s.winner).toContain('五次');
  });
  it('keeps mission votes secret and prevents good players failing',()=>{
    let s=avalon.create(players(7),19), good=s.players.find(p=>s.roles[p.id]==='servant')!,evil=s.players.find(p=>s.roles[p.id]==='assassin')!;
    s=avalon.apply(s,s.players[s.leader].id,{action:'propose',values:[good.id,evil.id]});for(const p of s.players)s=avalon.apply(s,p.id,{action:'approve',values:['yes']});
    expect(()=>avalon.apply(s,good.id,{action:'mission',values:['fail']})).toThrow();const before=avalon.view(s,good.id);s=avalon.apply(s,evil.id,{action:'mission',values:['fail']});expect(avalon.view(s,good.id)).toEqual(before);
    s=avalon.apply(s,good.id,{action:'mission',values:['success']});expect(s.results).toEqual([false]);expect(s.failCounts).toEqual([1]);
  });
  it('uses two failures on quest four for 7+ and permits both assassination outcomes',()=>{
    for(let n=7;n<=10;n++)for(const hit of [true,false]){
      let s=avalon.create(players(n),55);s=quest(s,0);s=quest(s,0);s=quest(s,1);s=quest(s,1);expect(s.results).toEqual([true,true,false,true]);expect(s.stage).toBe('assassinate');
      const target=s.players.find(p=>hit?s.roles[p.id]==='merlin':s.roles[p.id]==='percival')!;const assassin=s.players.find(p=>s.roles[p.id]==='assassin')!;
      s=avalon.apply(s,assassin.id,{action:'assassinate',values:[target.id]});expect(s.winner).toContain(hit?'邪恶获胜':'正义获胜');expect(avalon.view(s,'p0').board.players.every((p:any)=>p.role)).toBe(true);
    }
  });
  it('terminates projection-driven games for each player count',()=>{
    for(let seed=0;seed<60;seed++){
      let s=avalon.create(players(5+seed%6),seed),rng=seeded(seed+919);
      for(let step=0;step<400&&!s.winner;step++){
        const p=s.players.find(p=>avalon.view(s,p.id).actions.length)!;expect(p).toBeTruthy();const a=avalon.view(s,p.id).actions[0];
        const values=a.id==='approve'?[rng()<.2?'no':'yes']:shuffle(a.choices,rng).slice(0,a.min).map(c=>c.id);s=avalon.apply(s,p.id,{action:a.id,values});s=JSON.parse(JSON.stringify(s));
      }expect(s.winner,`seed ${seed}`).toBeTruthy();
    }
  });
});
describe('Werewolf',()=>{
  it('supports 6–18 balanced preset composition',()=>{
    for(let n=6;n<=18;n++){const deck=werewolfPreset(n);expect(deck).toHaveLength(n);expect(deck.filter(r=>r==='wolf')).toHaveLength(Math.floor(n/3));expect(deck.includes('hunter')).toBe(n>=8);expect(deck.includes('guard')).toBe(n>=12);expect(deck.filter(r=>r==='villager').length).toBeGreaterThan(0);expect(werewolf.create(players(n),1).alive).toHaveLength(n);}
  });
  it('hides first-night deaths until sheriff decision, supports withdrawal and badge',()=>{
    let s=werewolf.create(players(12),1);const victim=role(s,'villager'),seer=role(s,'seer');s=nightSecond(nightFirst(s,victim));expect(s.stage).toBe('signup');expect(werewolf.view(s,seer).board.players.every((p:any)=>p.alive)).toBe(true);s=election(s,[victim,seer]);s=act(s,seer,'withdraw');expect(s.stage).toBe('badge');expect(s.alive).not.toContain(victim);s=act(s,victim,'badge',[seer]);expect(s.sheriff).toBe(seer);expect(s.stage).toBe('discussion');
  });
  it('keeps public night view identical and implements guard plus antidote death',()=>{
    let s=werewolf.create(players(12),4),civilian=role(s,'villager'),witch=role(s,'witch');const before=werewolf.view(s,civilian);s=nightFirst(s,civilian,civilian);const after=werewolf.view(s,civilian);expect(before.board).toEqual(after.board);expect(before.log).toEqual(after.log);expect(werewolf.view(s,witch).actions[0].help).toContain(s.players.find(p=>p.id===civilian)!.name);
    s=election(nightSecond(s,'save'));expect(s.alive).not.toContain(civilian);expect(s.antidote).toBe(false);
  });
  it('poisoned hunter cannot shoot and double medication rejects atomically',()=>{
    let s=werewolf.create(players(12),4),hunter=role(s,'hunter'),witch=role(s,'witch');s=nightFirst(s);const before=JSON.stringify(s);expect(()=>act(s,witch,'potion',['save','poison:'+hunter])).toThrow();expect(JSON.stringify(s)).toBe(before);s=election(nightSecond(s,'poison:'+hunter));expect(s.stage).toBe('discussion');expect(werewolf.view(s,hunter).actions).toEqual([]);
  });
  it('allows hunter shot before victory and serializes badge transfer',()=>{
    let s=werewolf.create(players(12),71);const hunter=role(s,'hunter'),civilian=role(s,'villager'),seer=role(s,'seer');s=election(nightSecond(nightFirst(s,hunter)),[hunter]);expect(s.stage).toBe('hunter');s=act(s,hunter,'shoot',[civilian]);expect(s.stage).toBe('badge');s=act(s,hunter,'badge',[seer]);expect(s.sheriff).toBe(seer);expect(s.stage).toBe('discussion');
    // Last god's legally triggered shot can eliminate the last wolf before checking victory.
    let t=werewolf.create(players(8),2);const h=role(t,'hunter'),w=role(t,'wolf'),v=role(t,'villager');t.alive=[h,w,v];t.stage='vote';t.electionPending=false;t.submissions={[w]:h,[h]:h};t=act(t,v,'vote',[h]);expect(t.stage).toBe('hunter');expect(t.winner).toBeNull();t=act(t,h,'shoot',[w]);expect(t.winner).toContain('好人获胜');
  });
  it('handles PK with candidates not voting, ties, guard repeat and atomic validation',()=>{
    let s=werewolf.create(players(12),84),guard=role(s,'guard');s=ready(election(nightSecond(nightFirst(s,'skip',guard))));for(let i=0;i<12;i++)s=act(s,`p${i}`,'vote',[i<6?'p0':'p1']);expect(s.stage).toBe('pk');s=ready(s);expect(werewolf.view(s,'p0').actions).toEqual([]);for(let i=2;i<12;i++)s=act(s,`p${i}`,'vote',['skip']);expect(s.stage).toBe('nightFirst');expect(werewolf.view(s,guard).actions[0].choices.some(c=>c.id===guard)).toBe(false);const before=JSON.stringify(s);expect(()=>act(s,guard,'guard',[guard])).toThrow();expect(JSON.stringify(s)).toBe(before);
  });
  it('uses sheriff 1.5 votes',()=>{
    let s=werewolf.create(players(6),8);s.stage='vote';s.electionPending=false;s.sheriff='p0';for(let i=0;i<6;i++)s=act(s,`p${i}`,'vote',[i<3?'p4':'p5']);expect(s.alive).not.toContain('p4');expect(s.alive).toContain('p5');
  });
  it('double election explosion swallows badge and preserves night deaths',()=>{
    let s=werewolf.create(players(12),105),wolves=s.players.filter(p=>s.roles[p.id]==='wolf').map(p=>p.id),victim=role(s,'villager'),seer=role(s,'seer');s=election(nightSecond(nightFirst(s,victim)),[wolves[0],wolves[1],seer]);s=act(s,wolves[0],'explode');expect(s.night).toBe(2);expect(s.alive).not.toContain(victim);s=nightSecond(nightFirst(s));expect(s.stage).toBe('electionSpeech');s=act(s,wolves[1],'explode');expect(s.night).toBe(3);expect(s.electionPending).toBe(false);s=nightSecond(nightFirst(s));expect(s.stage).toBe('discussion');expect(s.sheriff).toBeNull();
  });
  it('ends all-gone wolf games by voting, for every supported count',()=>{
    for(let n=6;n<=18;n++){
      let s=werewolf.create(players(n),12);const wolves=s.players.filter(p=>s.roles[p.id]==='wolf').map(p=>p.id);
      for(const wolf of wolves){s=nightSecond(nightFirst(s));if(s.stage==='signup')s=election(s);s=ready(s);for(const p of s.players)if(werewolf.view(s,p.id).actions.some(a=>a.id==='vote'))s=act(s,p.id,'vote',[wolf]);}
      expect(s.winner).toContain('好人获胜');
    }
  });
  it('projection-driven varied games terminate, serialize, and preserve public night privacy',()=>{
    for(let seed=0;seed<78;seed++){
      let s=werewolf.create(players(6+seed%13),seed),rng=seeded(seed+127);
      for(let step=0;step<1800&&!s.winner;step++){
        const p=s.players.find(p=>werewolf.view(s,p.id).actions.length);expect(p,`deadlock seed ${seed} stage ${s.stage}`).toBeTruthy();const actions=werewolf.view(s,p!.id).actions,a=actions[Math.floor(rng()*actions.length)];let values=shuffle(a.choices,rng).slice(0,a.min).map(c=>c.id);if(['vote','elect','wolf'].includes(a.id)&&rng()<.8)values=[a.choices[0].id];
        const previous=werewolf.view(s,p!.id);if(step%31===0){const before=JSON.stringify(s);expect(()=>act(s,p!.id,'invalid')).toThrow();expect(()=>act(s,'stranger',a.id,values)).toThrow();expect(JSON.stringify(s)).toBe(before);}
        s=JSON.parse(JSON.stringify(act(s,p!.id,a.id,values)));const next=werewolf.view(s,p!.id);
        if(previous.board.stage==='night'&&next.board.stage==='night'&&previous.board.night===next.board.night){expect(previous.board.players).toEqual(next.board.players);expect(previous.log).toEqual(next.log);expect(previous.board.sheriff).toEqual(next.board.sheriff);}
        for(const viewer of s.players){const v=werewolf.view(s,viewer.id);for(const other of v.board.players)if(!s.winner&&other.id!==viewer.id&&!s.revealed.includes(other.id))expect(other.role).toBeUndefined();expect(v.board.submissions).toBeUndefined();expect(v.board.victim).toBeUndefined();}
      }expect(s.winner,`seed ${seed}`).toBeTruthy();
    }
  },60000);
});
