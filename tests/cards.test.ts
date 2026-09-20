import { describe,it,expect } from 'vitest';
import catalogFixture from './fixtures/gem-catalog.csv?raw';
import { gems,GEM_CATALOG,NOBLE_CATALOG,GEM_COLORS,gemScore,type GemsState,type GemCard } from '../src/core/games/gems';
import { bombs,BOMB_KINDS,type BombsState,type BombKind,type BombCard } from '../src/core/games/bombs';
import { seeded,type Player,type Command } from '../src/core/types';
const players=(n:number):Player[]=>Array.from({length:n},(_,i)=>({id:`p${i}`,name:`玩家${i}`,avatar:'🦊'}));
const g=(s:GemsState,action:string,values:string[]=[])=>gems.apply(s,s.players[s.current].id,{action,values});
const b=(s:BombsState,action:string,values:string[]=[],id=s.current)=>bombs.apply(s,id,{action,values});
const json=(v:unknown)=>JSON.stringify(v);
function gc(id:string,cost:number[],bonus='white',points=0):GemCard{return{id,tier:1,bonus,points,cost};}
function gemFixture(){const s=gems.create(players(2),7);s.market=[[],[],[]];s.decks=[[],[],[]];s.nobles=[];return s;}
let serial=1000;
function bc(kind:BombKind):BombCard{return{id:`fixture-${serial++}`,kind,title:kind};}
function bombFixture(n=3){const s=bombs.create(players(n),19);s.hands=Object.fromEntries(s.players.map(p=>[p.id,[]]));s.deck=[bc('moonCat'),bc('cloudCat'),bc('leafCat'),bc('bomb'),bc('bomb')];s.discard=[];s.eliminatedCards=[];return s;}
function passAll(s:BombsState){while(s.phase.kind==='response'){const id=s.alive.find(id=>s.phase.kind==='response'&&!s.phase.effect.passed.includes(id))!;s=b(s,'pass',[],id);}return s;}
function playKind(s:BombsState,kind:BombKind){return b(s,'play',[s.hands[s.current].find(c=>c.kind===kind)!.id]);}
function gemConservation(s:GemsState){
  const supply=s.players.length===2?4:s.players.length===3?5:7;
  expect(s.bank.map((n,i)=>n+s.merchants.reduce((n,m)=>n+m.tokens[i],0))).toEqual([supply,supply,supply,supply,supply,5]);
  const cs=[...s.decks.flat(),...s.market.flat(),...s.merchants.flatMap(m=>[...m.reserved,...m.bought])];expect(cs).toHaveLength(90);expect(new Set(cs.map(c=>c.id)).size).toBe(90);
  expect(s.nobles.length+s.merchants.reduce((n,m)=>n+m.nobles.length,0)).toBe(s.players.length+1);
}
function bombConservation(s:BombsState,total:number){const cs=[...s.deck,...Object.values(s.hands).flat(),...s.discard,...s.eliminatedCards];if(s.phase.kind==='bomb'||s.phase.kind==='insert')cs.push(s.phase.card);expect(cs).toHaveLength(total);expect(new Set(cs.map(c=>c.id)).size).toBe(total);const liveBombs=s.deck.filter(c=>c.kind==='bomb').length+(['bomb','insert'].includes(s.phase.kind)?1:0);expect(liveBombs).toBe(s.alive.length-1);}

describe('宝石商人 catalog/setup',()=>{
  it('matches all 90 independently verified numerical components',()=>{const expected=catalogFixture.trim().split('\n');expect(GEM_CATALOG.map(c=>[c.id,c.tier,GEM_COLORS.indexOf(c.bonus),c.points,...c.cost].join(','))).toEqual(expected);expect([1,2,3].map(t=>GEM_CATALOG.filter(c=>c.tier===t).length)).toEqual([40,30,20]);expect(NOBLE_CATALOG).toHaveLength(10);});
  it.each([2,3,4])('sets up %i players reproducibly',n=>{const s=gems.create(players(n),8);expect(s).toEqual(gems.create(players(n),8));expect(s.market.map(m=>m.length)).toEqual([4,4,4]);expect(s.decks.map(d=>d.length)).toEqual([36,26,16]);gemConservation(s);expect(JSON.parse(json(s))).toEqual(s);});
  it('rejects bad seats and excludes observers',()=>{expect(()=>gems.create(players(1),1)).toThrow();expect(()=>gems.create([players(2)[0],players(2)[0]],1)).toThrow();expect(gems.view(gems.create(players(2),1),'stranger').board).toEqual({});});
});
describe('宝石商人 rules',()=>{
  it('requires all 3 different colors when available and four bank tokens before pairs',()=>{let s=gems.create(players(2),3);expect(()=>g(s,'take_distinct',['white','blue'])).toThrow();s=g(s,'take_pair',['white']);expect(s.bank[0]).toBe(2);expect(gems.view(s,'p1').actions.find(a=>a.id==='take_pair')?.choices.some(c=>c.id==='white')).toBe(false);});
  it('takes fewer colors only if supply lacks 3',()=>{const s=gemFixture();s.bank=[0,2,1,0,0,0];const next=g(s,'take_distinct',['blue','green']);expect(next.merchants[0].tokens).toEqual([0,1,1,0,0,0]);});
  it('records face-up reservations, grants gold, refills, and caps at 3',()=>{let s=gems.create(players(2),2);const old=s.market[0][0];s=g(s,'reserve',[old.id]);expect(s.market[0]).toHaveLength(4);expect(s.merchants[0].tokens[5]).toBe(1);expect(s.merchants[0].reserved[0]).toEqual(old);expect(gems.view(s,'p1').board.players[0].reservedCards).toEqual([{id:old.id,tier:old.tier,public:true,card:old}]);s.current=0;s.bank[5]=0;s=g(s,'reserve',['deck:1']);expect(s.merchants[0].reserved).toHaveLength(2);s.current=0;s=g(s,'reserve',['deck:2']);s.current=0;expect(gems.view(s,'p0').actions.some(a=>a.id==='reserve')).toBe(false);});
  it('enforces 10-token end-of-turn limit including gold',()=>{let s=gems.create(players(2),4);s.merchants[0].tokens=[2,2,2,2,1,0];s=g(s,'reserve',['deck:1']);expect(s.current).toBe(1);s.current=0;s=g(s,'reserve',['deck:1']);expect(s.phase).toBe('discard');expect(s.current).toBe(0);expect(()=>g(s,'discard',[])).toThrow();s=g(s,'discard',['gold:0']);expect(s.merchants[0].tokens.reduce((a,b)=>a+b)).toBe(10);expect(s.current).toBe(1);});
  it('buys using discounts and gold, paying only after confirmation',()=>{let s=gemFixture();const c=gc('buy',[2,1,0,0,0]);s.market[0]=[c];s.merchants[0].bought=[gc('discount',[0,0,0,0,0])];s.merchants[0].tokens=[1,0,0,0,0,1];s=g(s,'buy',[c.id]);expect(s.phase).toBe('payment');expect(s.merchants[0].tokens).toEqual([1,0,0,0,0,1]);expect(gems.view(s,'p0').board.payment.needed).toEqual([1,1,0,0,0]);s=g(s,'pay_auto');expect(s.merchants[0].tokens).toEqual([0,0,0,0,0,0]);expect(s.merchants[0].bought).toHaveLength(2);});
  it('allows gold substitution even when colored tokens are available',()=>{let s=gemFixture();s.market[0]=[gc('buy',[1,0,0,0,0])];s.merchants[0].tokens=[1,0,0,0,0,1];s=g(s,'buy',['buy']);s=g(s,'pay_custom',['gold:0']);expect(s.merchants[0].tokens).toEqual([1,0,0,0,0,0]);});
  it('invalid custom payment is atomic; cancel restores action selection',()=>{let s=gemFixture();s.market[0]=[gc('buy',[1,1,0,0,0])];s.merchants[0].tokens=[2,1,0,0,0,0];s=g(s,'buy',['buy']);const before=json(s);expect(()=>g(s,'pay_custom',['white:0','white:1'])).toThrow();expect(json(s)).toBe(before);s=g(s,'cancel_buy');expect(s.phase).toBe('action');expect(s.merchants[0].bought).toHaveLength(0);});
  it('purchases reserved cards for zero cost after discounts',()=>{let s=gemFixture();s.merchants[0].reserved=[gc('reserved',[0,0,0,0,0])];s=g(s,'buy',['reserved']);s=g(s,'pay_custom');expect(s.merchants[0].reserved).toHaveLength(0);expect(s.merchants[0].bought[0].id).toBe('reserved');});
  it('grants exactly one noble, choosing between multiple eligible nobles',()=>{let s=gemFixture();s.nobles=[{id:'n1',cost:[0,0,0,0,0]},{id:'n2',cost:[0,0,0,0,0]}];s=g(s,'take_pair',['white']);expect(s.phase).toBe('noble');s=g(s,'noble',['n2']);expect(s.merchants[0].nobles.map(n=>n.id)).toEqual(['n2']);expect(s.nobles.map(n=>n.id)).toEqual(['n1']);expect(gemScore(s.merchants[0])).toBe(3);});
  it('ends after equal turns and breaks score ties by fewer development cards',()=>{let s=gemFixture();s.merchants[0].bought=[gc('a',[0,0,0,0,0],'white',15),gc('b',[0,0,0,0,0])];s.merchants[1].bought=[gc('c',[0,0,0,0,0],'white',15)];s=g(s,'take_pair',['white']);expect(s.finished).toBe(false);expect(s.finalRound).toBe(true);s=g(s,'take_pair',['blue']);expect(s.finished).toBe(true);expect(s.winners).toEqual(['p1']);expect(gems.view(s,'p1').actions).toEqual([]);});
  it('allows shared victory after both tie-breakers',()=>{let s=gemFixture();s.merchants.forEach((m,i)=>m.bought=[gc(`win-${i}`,[0,0,0,0,0],'white',15)]);s=g(s,'take_pair',['white']);s=g(s,'take_pair',['blue']);expect(s.winners).toEqual(['p0','p1']);});
  it('does not leak a private reserved purchase to opponents',()=>{let s=gemFixture();s.merchants[0].reserved=[gc('secret-reserve',[0,0,0,0,0])];s=g(s,'buy',['secret-reserve']);expect(json(gems.view(s,'p1'))).not.toContain('secret-reserve');expect(gems.view(s,'p1').actions).toEqual([]);});
  it('settles token overflow before a noble and final round',()=>{let s=gemFixture();s.merchants[0].tokens=[2,2,2,2,2,0];s.merchants[0].bought=[gc('points',[0,0,0,0,0],'white',12)];s.nobles=[{id:'visitor',cost:[1,0,0,0,0]}];s=g(s,'take_pair',['white']);expect(s.phase).toBe('discard');expect(s.finalRound).toBe(false);expect(s.merchants[0].nobles).toHaveLength(0);s=g(s,'discard',['white:0','white:1']);expect(s.merchants[0].nobles).toHaveLength(1);expect(s.finalRound).toBe(true);expect(s.current).toBe(1);});
  it('views cannot mutate authoritative state, invalid actors and duplicate values reject',()=>{const s=gems.create(players(2),9),before=json(s);gems.view(s,'p0').board.bank[0]=999;expect(json(s)).toBe(before);expect(()=>gems.apply(s,'p1',{action:'take_pair',values:['blue']})).toThrow();expect(()=>g(s,'take_distinct',['blue','blue','white'])).toThrow();expect(json(s)).toBe(before);});
});

describe('炸弹猫 setup/privacy',()=>{
  it.each([2,3,4,5])('sets up %i players with eight cards and N-1 bombs',n=>{const s=bombs.create(players(n),9);expect(s).toEqual(bombs.create(players(n),9));for(const hand of Object.values(s.hands)){expect(hand).toHaveLength(8);expect(hand.filter(c=>c.kind==='defuse')).toHaveLength(1);expect(hand.some(c=>c.kind==='bomb')).toBe(false);}expect(s.deck.filter(c=>c.kind==='bomb')).toHaveLength(n-1);expect(s.deck.filter(c=>c.kind==='defuse')).toHaveLength(Math.min(2,6-n));expect(JSON.parse(json(s))).toEqual(s);});
  it('redacts hidden cards, PRNG, deck order and eliminated hands from every view',()=>{const s=bombs.create(players(4),12);for(const p of s.players){const view=bombs.view(s,p.id),text=json(view);for(const card of s.deck)expect(text).not.toContain(`"${card.id}"`);for(const other of s.players.filter(o=>o.id!==p.id))for(const card of s.hands[other.id])expect(text).not.toContain(`"${card.id}"`);expect(view.board.rng).toBeUndefined();}expect(bombs.view(s,'intruder').board).toEqual({});});
  it('rejects invalid actor/duplicate input atomically and returns isolated views',()=>{const s=bombs.create(players(2),8),before=json(s);expect(()=>b(s,'draw',[],'p1')).toThrow();expect(()=>b(s,'play',['x','x'])).toThrow();bombs.view(s,'p0').board.hand.pop();expect(json(s)).toBe(before);});
});
describe('炸弹猫 effects',()=>{
  it('draw ends one normal turn',()=>{const s=bombFixture(),card=s.deck[0];const next=b(s,'draw');expect(next.hands.p0).toEqual([card]);expect(next.current).toBe('p1');expect(next.turnsRemaining).toBe(1);});
  it('attack stacks remaining turns, skip only removes one',()=>{let s=bombFixture();s.hands.p0=[bc('attack')];s.hands.p1=[bc('attack')];s.hands.p2=[bc('skip')];s=passAll(playKind(s,'attack'));expect(s.current).toBe('p1');expect(s.turnsRemaining).toBe(2);s=passAll(playKind(s,'attack'));expect(s.current).toBe('p2');expect(s.turnsRemaining).toBe(4);s=passAll(playKind(s,'skip'));expect(s.turnsRemaining).toBe(3);expect(s.current).toBe('p2');s=b(s,'draw');expect(s.turnsRemaining).toBe(2);});
  it('an attack after one attacked draw passes remaining+2',()=>{let s=bombFixture();s.hands.p0=[bc('attack')];s.hands.p1=[bc('attack')];s=passAll(playKind(s,'attack'));s=b(s,'draw');expect(s.current).toBe('p1');s=passAll(playKind(s,'attack'));expect(s.current).toBe('p2');expect(s.turnsRemaining).toBe(3);});
  it('nope cancels an effect, another nope restores it and clears confirmations',()=>{let s=bombFixture();s.hands.p0=[bc('attack'),bc('nope')];s.hands.p1=[bc('nope')];s=playKind(s,'attack');s=b(s,'pass',[],'p2');s=b(s,'nope',[s.hands.p1[0].id],'p1');expect(s.phase.kind==='response'&&s.phase.effect.passed).toEqual([]);expect(s.phase.kind==='response'&&s.phase.effect.cancelled).toBe(true);s=b(s,'nope',[s.hands.p0[0].id],'p0');s=passAll(s);expect(s.current).toBe('p1');expect(s.turnsRemaining).toBe(2);expect(s.discard).toHaveLength(3);});
  it('cancelled skip does not end the turn',()=>{let s=bombFixture();s.hands.p0=[bc('skip')];s.hands.p1=[bc('nope')];s=playKind(s,'skip');s=b(s,'nope',[s.hands.p1[0].id],'p1');s=passAll(s);expect(s.current).toBe('p0');expect(s.phase.kind).toBe('turn');});
  it('favor lets the target choose, keeping given card private',()=>{let s=bombFixture();s.hands.p0=[bc('favor')];s.hands.p1=[bc('defuse'),bc('skip')];s=playKind(s,'favor');expect(s.hands.p0).toHaveLength(1);s=b(s,'target',['p1']);s=passAll(s);expect(s.phase.kind).toBe('give');expect(bombs.view(s,'p0').actions).toEqual([]);const given=s.hands.p1[0];s=b(s,'give',[given.id],'p1');expect(s.hands.p0).toEqual([given]);expect(json(bombs.view(s,'p2'))).not.toContain(given.id);expect(s.current).toBe('p0');});
  it('cancelling target/triple request does not consume cards',()=>{let s=bombFixture();s.hands.p0=[bc('moonCat'),bc('moonCat'),bc('moonCat')];s=b(s,'triple',['moonCat']);s=b(s,'target',['p1']);s=b(s,'cancel');expect(s.hands.p0).toHaveLength(3);expect(s.discard).toHaveLength(0);});
  it('pairs steal deterministically and same-kind functional cards may form combos',()=>{let s=bombFixture();s.hands.p0=[bc('skip'),bc('skip')];s.hands.p1=[bc('defuse'),bc('future')];s=b(s,'pair',['skip']);s=b(s,'target',['p1']);const next=passAll(s);expect(next).toEqual(passAll(JSON.parse(json(s))));expect(next.hands.p0).toHaveLength(1);expect(next.hands.p1).toHaveLength(1);expect(next.current).toBe('p0');});
  it.each([true,false])('triple requests a named card; present=%s',present=>{let s=bombFixture();s.hands.p0=[bc('moonCat'),bc('moonCat'),bc('moonCat')];s.hands.p1=[bc(present?'defuse':'skip')];s=b(s,'triple',['moonCat']);s=b(s,'target',['p1']);s=b(s,'request',['defuse']);s=passAll(s);expect(s.hands.p0).toHaveLength(present?1:0);expect(s.hands.p1).toHaveLength(present?0:1);});
  it('empty target resolves pair/favor without waiting forever',()=>{for(const kind of ['favor','moonCat'] as BombKind[]){let s=bombFixture();s.hands.p0=kind==='favor'?[bc(kind)]:[bc(kind),bc(kind)];s=kind==='favor'?playKind(s,kind):b(s,'pair',[kind]);s=b(s,'target',['p1']);s=passAll(s);expect(s.phase.kind).toBe('turn');}});
  it('future reveals only top 3 to actor and does not end turn',()=>{let s=bombFixture();s.hands.p0=[bc('future')];const top=s.deck.slice(0,3).map(c=>c.kind);s=passAll(playKind(s,'future'));expect(bombs.view(s,'p0').board.privateFuture.map((c:BombCard)=>c.kind)).toEqual(top);expect(bombs.view(s,'p1').board.privateFuture).toBeUndefined();expect(bombs.view(s,'p1').sections.some(sec=>sec.id==='future')).toBe(false);s=b(s,'done');expect(s.current).toBe('p0');});
  it('future supports a short deck and observers cannot acknowledge it',()=>{let s=bombFixture();s.deck=s.deck.slice(0,1);s.hands.p0=[bc('future')];s=passAll(playKind(s,'future'));expect(bombs.view(s,'p0').board.privateFuture).toHaveLength(1);expect(()=>b(s,'done',[],'p1')).toThrow();});
  it('invalid secret insertion leaves state and RNG unchanged',()=>{let s=bombFixture();s.hands.p0=[bc('defuse')];s.deck.unshift(bc('bomb'));s=b(s,'draw');s=b(s,'defuse');const before=json(s);expect(()=>b(s,'insert',['-1'])).toThrow();expect(()=>b(s,'insert',[String(s.deck.length+1)])).toThrow();expect(json(s)).toBe(before);s=b(s,'insert',[String(s.deck.length)]);expect(s.deck.at(-1)?.kind).toBe('bomb');});
  it('a successful attacked defuse consumes one of the owed turns',()=>{let s=bombFixture();s.hands.p0=[bc('defuse')];s.attacked=true;s.turnsRemaining=3;s.deck.unshift(bc('bomb'));s=b(s,'draw');s=b(s,'defuse');s=b(s,'insert',[String(s.deck.length)]);expect(s.current).toBe('p0');expect(s.turnsRemaining).toBe(2);expect(s.attacked).toBe(true);});
  it('shuffle advances persisted RNG and conserves deck',()=>{let s=bombFixture();s.hands.p0=[bc('shuffle')];const before=s.deck.map(c=>c.id).sort();s=playKind(s,'shuffle');const rng=s.rng,next=passAll(s);expect(next).toEqual(passAll(JSON.parse(json(s))));expect(next.rng).not.toBe(rng);expect(next.deck.map(c=>c.id).sort()).toEqual(before);});
  it('defuse cannot be noped; insert supports every position and is private',()=>{let s=bombFixture();s.hands.p0=[bc('defuse')];s.deck.unshift(bc('bomb'));s=b(s,'draw');expect(s.phase.kind).toBe('bomb');expect(bombs.view(s,'p1').actions).toEqual([]);s=b(s,'defuse');expect(s.phase.kind).toBe('insert');expect(bombs.view(s,'p0').actions[0].choices).toHaveLength(s.deck.length+1);s=b(s,'insert',['0']);expect(s.deck[0].kind).toBe('bomb');expect(s.current).toBe('p1');expect(json(bombs.view(s,'p1'))).not.toContain(s.deck[0].id);});
  it('explosion eliminates the player and hand, resets attacked turns, skips dead seats',()=>{let s=bombFixture();s.current='p1';s.turnsRemaining=4;s.attacked=true;s.hands.p1=[bc('nope')];s.deck.unshift(bc('bomb'));s=b(s,'draw');expect(s.alive).toEqual(['p0','p2']);expect(s.current).toBe('p2');expect(s.turnsRemaining).toBe(1);expect(s.attacked).toBe(false);expect(s.hands.p1).toEqual([]);expect(s.eliminatedCards).toHaveLength(2);expect(bombs.view(s,'p1').actions).toEqual([]);});
  it('allows voluntarily refusing defuse and identifies last survivor',()=>{let s=bombFixture(2);s.hands.p0=[bc('defuse')];s.deck.unshift(bc('bomb'));s=b(s,'draw');s=b(s,'explode');expect(bombs.view(s,'p1').finished).toBe(true);expect(bombs.view(s,'p1').board.winners).toEqual(['p1']);expect(bombs.view(s,'p1').actions).toEqual([]);});
});

describe('complete serializable seeded matches',()=>{
  it.each([2,3,4])('finishes %i-player gems matches with conservation after every command',n=>{
    for(let seed=1;seed<=3;seed++){
      let s=gems.create(players(n),seed),steps=0;const rng=seeded(seed*97);
      while(!s.finished&&steps++<3000){const id=s.players[s.current].id,view=gems.view(s,id),acts=view.actions;let command:Command;
        const buy=acts.find(a=>a.id==='buy');
        if(buy){const cards=[...s.market.flat(),...s.merchants[s.current].reserved].filter(c=>buy.choices.some(x=>x.id===c.id));cards.sort((a,b)=>(b.points*3+6-b.cost.reduce((x,y)=>x+y,0)*.15)-(a.points*3+6-a.cost.reduce((x,y)=>x+y,0)*.15));command={action:'buy',values:[cards[0].id]};}
        else{const a=acts.find(a=>a.id==='pay_auto')??acts.find(a=>a.id==='take_distinct')??acts.find(a=>a.id==='discard')??acts.find(a=>a.id==='noble')??acts[0];const choices=[...a.choices].sort(()=>rng()-.5);command={action:a.id,values:choices.slice(0,a.min).map(c=>c.id)};}
        const original=json(s);const next=gems.apply(s,id,command);expect(json(s)).toBe(original);s=JSON.parse(json(next));gemConservation(s);
      }
      expect(s.finished,`seed ${seed} after ${steps} commands`).toBe(true);expect(s.winners.length).toBeGreaterThan(0);
    }
  },60000);
  it.each([2,3,4,5])('finishes %i-player bombs matches while conserving every component',n=>{
    for(let seed=1;seed<=8;seed++){
      let s=bombs.create(players(n),seed),steps=0;const total=s.deck.length+Object.values(s.hands).flat().length,rng=seeded(seed*1337);
      while(!bombs.view(s,s.current).finished&&steps++<2500){const active=s.players.map(p=>({id:p.id,view:bombs.view(s,p.id)})).filter(x=>x.view.actions.length);expect(active.length).toBeGreaterThan(0);const actor=active[Math.floor(rng()*active.length)];let a=actor.view.actions[Math.floor(rng()*actor.view.actions.length)];if(s.phase.kind==='turn'&&rng()<.4)a=actor.view.actions.find(a=>a.id==='draw')!;if(a.id==='explode'&&rng()<.8)a=actor.view.actions.find(a=>a.id==='defuse')!;const shuffled=[...a.choices].sort(()=>rng()-.5),values=shuffled.slice(0,a.min).map(c=>c.id),before=json(s),original=s;s=bombs.apply(s,actor.id,{action:a.id,values});expect(json(original)).toBe(before);s=JSON.parse(json(s));bombConservation(s,total);}
      expect(bombs.view(s,s.current).finished,`seed ${seed} after ${steps}`).toBe(true);
    }
  },60000);
});

describe('宝石商人 public reservation memory',()=>{
  it('allows any visible tier regardless of affordability but never arbitrary deck cards, nobles or opponents reservations',()=>{
    let s=gems.create(players(2),91);const expensive=s.market[2][0],hidden=s.decks[2][0];const before=json(s);
    expect(()=>g(s,'reserve',[hidden.id])).toThrow();expect(()=>g(s,'reserve',[s.nobles[0].id])).toThrow();expect(json(s)).toBe(before);
    s=g(s,'reserve',[expensive.id]);expect(s.merchants[0].reserved[0].id).toBe(expensive.id);
    expect(()=>g(s,'reserve',[expensive.id])).toThrow();
    expect(gems.view(s,'p1').board.players[0].reservedCards[0]).toEqual({id:expensive.id,tier:3,public:true,card:expensive});
  });
  it('exposes only tier and opaque slot ID for a blind reservation, even beside a public one',()=>{
    let s=gems.create(players(2),17);const publicCard=s.market[0][0];s=g(s,'reserve',[publicCard.id]);s.current=0;s=g(s,'reserve',['deck:3']);
    const secret=s.merchants[0].reserved[1],view=gems.view(s,'p1'),entries=view.board.players[0].reservedCards;
    expect(entries[0].card).toEqual(publicCard);expect(entries[1]).toEqual({id:'reserved-p0-1',tier:3,public:false});
    expect(json(view)).not.toContain(secret.id);expect(entries[1].card).toBeUndefined();expect(gems.view(s,'p0').board.hand[1]).toEqual(secret);
  });
  it('treats all unknown legacy reservation sources as private and records only newly visible sources',()=>{
    let s=gems.create(players(2),13);s=g(s,'reserve',['deck:2']);delete s.merchants[0].publicReserved;
    const blind=s.merchants[0].reserved[0];expect(json(gems.view(s,'p1'))).not.toContain(blind.id);
    s.current=0;const publicCard=s.market[0][0];s=g(JSON.parse(json(s)),'reserve',[publicCard.id]);
    expect(s.merchants[0].publicReserved).toEqual([publicCard.id]);const entries=gems.view(s,'p1').board.players[0].reservedCards;
    expect(entries[0].public).toBe(false);expect(entries[1].card).toEqual(publicCard);expect(json(gems.view(s,'p1'))).not.toContain(blind.id);
  });
  it('removes public reservation metadata on purchase and keeps the development card public',()=>{
    let s=gemFixture();const card=gc('public-free',[0,0,0,0,0]);s.market[0]=[card];s=g(s,'reserve',[card.id]);s.current=0;s=g(s,'buy',[card.id]);s=g(s,'pay_auto');
    expect(s.merchants[0].publicReserved).toEqual([]);const p=gems.view(s,'p1').board.players[0];expect(p.reservedCards).toEqual([]);expect(p.bought).toEqual([card]);
  });
  it('does not allow voluntary under-taking or reservation discard',()=>{
    const s=gems.create(players(2),12);expect(()=>g(s,'take_distinct',['white'])).toThrow();expect(()=>g(s,'take_distinct',['white','blue'])).toThrow();expect(()=>g(s,'discard',['deck:1'])).toThrow();
    s.bank=[0,2,0,1,0,0];expect(()=>g(s,'take_distinct',['blue'])).toThrow();expect(g(s,'take_distinct',['blue','red']).merchants[0].tokens).toEqual([0,1,0,1,0,0]);
  });
});
