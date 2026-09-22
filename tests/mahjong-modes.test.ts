import {describe,it,expect} from 'vitest';
import {mahjong,mahjongTiles,type MahjongState,type Tile,type Meld} from '../src/core/games/mahjong';
import {legacyMahjong} from '../src/core/games/mahjongLegacy';
import {scoreMahjongHand} from '../src/core/games/mahjongScoring';
import {MAHJONG_RULES,type MahjongMode} from '../src/core/mahjongModes';
import {normalizeGameOptions,validateMatchForRoom,createMatch} from '../src/core/room';
const players=['a','b','c','d'].map(id=>({id,name:id,avatar:'🐱'}));
const tiles=(v:number[],prefix='t'):Tile[]=>v.map((value,i)=>({value,id:prefix+i}));
const waiting=[0,1,2,3,4,5,9,10,11,12,13,14,6];
const modes=['guangdong','laizi','sichuan','bloodflow','bloodflowAny','bloodflowThree','redBloodflow','redBattle','guangdongFan','guangdongGhost'] as const;
const act=(s:MahjongState,i:number,action:string,values:string[]=[])=>mahjong.apply(s,players[i].id,{action,values});
const actions=(s:MahjongState,i:number)=>mahjong.view(s,players[i].id).actions;
function setup(mode:MahjongMode='guangdongFan'){const s=mahjong.create(players,19,{mahjongMode:mode});s.phase='discard';s.turn=8;s.missing={0:2,1:2,2:2,3:2};s.hands=[tiles([...waiting,6]),...['b','c','d'].map(p=>tiles([0,2,4,6,8,9,11,13,15,17,18,20,22],p))];s.drawn='t13';return s;}
function pass(s:MahjongState){for(let i=0;i<4;i++)if(actions(s,i).some(a=>a.id==='pass'))s=act(s,i,'pass');return s;}
function conservation(s:MahjongState){const all=[...s.hands.flat(),...s.wall,...s.discards.flat(),...s.melds.flat().flatMap(m=>m.tiles),...(s.winningTiles??[]),...(s.indicator?[s.indicator]:[])];expect(all).toHaveLength(mahjongTiles(s.mode).length);expect(new Set(all.map(t=>t.id)).size).toBe(all.length);expect(s.scores.reduce((a,b)=>a+b,0)).toBe(0);}
const score=(v:number[],mode:MahjongMode='guangdongFan',melds:Meld[]=[],wild=-1)=>scoreMahjongHand(mode,tiles(v),melds,wild);

describe('Mahjong selected rulesets',()=>{
 it.each(modes)('%s has literal deck counts, stable options and serializable new state',mode=>{
  const expected={guangdong:136,laizi:136,sichuan:108,bloodflow:108,bloodflowAny:108,bloodflowThree:108,redBloodflow:114,redBattle:112,guangdongFan:136,guangdongGhost:136};
  const deck=mahjongTiles(mode);expect(deck).toHaveLength(expected[mode]);expect(new Set(deck.map(t=>t.id)).size).toBe(expected[mode]);
  expect(deck.filter(t=>t.value===33)).toHaveLength(mode==='redBloodflow'?6:mode==='redBattle'||!MAHJONG_RULES[mode].missing?4:0);
  expect(normalizeGameOptions('mahjong',{mahjongMode:mode},'a')).toEqual({mahjongMode:mode});const s=mahjong.create(players,5,{mahjongMode:mode});expect(s).toEqual(mahjong.create(players,5,{mahjongMode:mode}));conservation(s);expect(s.rulesVersion).toBe(2);
  const match=createMatch('mahjong',players,{mahjongMode:mode});const room={code:'ABCDEF',kind:'mahjong',mode:'cloud',hostID:'a',players,options:{mahjongMode:mode}};expect(validateMatchForRoom(JSON.parse(JSON.stringify(match)),room as Parameters<typeof validateMatchForRoom>[1]).game.mode).toBe(mode);
 });
 it('preserves each original saved rule version and next action',()=>{for(const mode of ['guangdong','sichuan','bloodflow','laizi'] as const){const old=legacyMahjong.create(players,9,{mahjongMode:mode});expect(mahjong.view(old,'a')).toEqual(legacyMahjong.view(old,'a'));const a=legacyMahjong.view(old,'a').actions[0];let values=a.choices.slice(0,a.min).map(c=>c.id);if(a.id==='exchange')values=[0,1,2].map(suit=>old.hands[0].filter(t=>Math.floor(t.value/9)===suit)).find(g=>g.length>=3)!.slice(0,3).map(t=>t.id);expect(mahjong.apply(old,'a',{action:a.id,values})).toEqual(legacyMahjong.apply(old,'a',{action:a.id,values}));}});
 it('exchanges zero or all tiles with the wall without drawing outgoing tiles',()=>{let s=mahjong.create(players,2,{mahjongMode:'bloodflowAny'});const original=structuredClone(s),out=s.hands.flatMap((h,i)=>i===0?[]:h).map(t=>t.id);s=act(s,0,'exchange',[]);for(let i=1;i<4;i++)s=act(s,i,'exchange',s.hands[i].map(t=>t.id));expect(s.hands[0]).toEqual(original.hands[0]);expect(s.hands.map(h=>h.length)).toEqual([14,13,13,13]);expect(s.hands.flat().some(t=>out.includes(t.id))).toBe(false);expect(s.phase).toBe('que');conservation(s);});
 it('passes mixed-suit triples in the chosen shared direction and hides selections',()=>{let s=mahjong.create(players,4,{mahjongMode:'bloodflowThree'});s.exchangeDirection=2;const old=structuredClone(s),chosen=s.hands.map(h=>h.slice(0,3).map(t=>t.id));for(let i=0;i<4;i++){s=act(s,i,'exchange',chosen[i]);if(i===0)expect(JSON.stringify(mahjong.view(s,'b').board)).not.toContain(chosen[0][0]);}for(let i=0;i<4;i++)expect(s.hands[i].slice(-3).map(t=>t.id)).toEqual(chosen[(i+2)%4]);expect(old.hands[0]).toHaveLength(14);conservation(s);});
 it('rejects invalid exchange and ghost selection atomically',()=>{for(const mode of ['sichuan','redBloodflow'] as const){const s=mahjong.create(players,2,{mahjongMode:mode}),old=structuredClone(s);expect(()=>act(s,0,'exchange',[s.hands[0][0].id])).toThrow();expect(()=>act(s,0,'exchange',Array(3).fill(s.hands[0][0].id))).toThrow();if(mode==='redBloodflow')expect(actions(s,0)[0].choices.every(c=>s.hands[0].find(t=>t.id===c.id)!.value!==33)).toBe(true);expect(s).toEqual(old);}});
 it('reveals the indicator and correctly wraps numbered/honor ghosts',()=>{const seen=new Set<number>();for(let seed=0;seed<300;seed++){const s=mahjong.create(players,seed,{mahjongMode:'guangdongGhost'}),v=s.indicator!.value;seen.add(v);expect(s.wall).toHaveLength(82);expect(s.wildValue).toBe(v<27?Math.floor(v/9)*9+(v%9+1)%9:({27:28,28:29,29:30,30:33,33:32,32:31,31:27} as Record<number,number>)[v]);expect(mahjong.view(s,'b').board.indicator).toEqual(s.indicator);conservation(s);}expect(seen.size).toBe(34);});
});

describe('independent fan examples from the selected published tables',()=>{
 // Literal fixtures, deliberately not generated by the scorer.
 it.each([
  ['鸡胡',[0,1,2,9,10,11,18,19,20,4,4,4,13,13],1],
  ['平胡',[0,1,2,3,4,5,9,10,11,12,13,14,6,6],2],
  ['碰碰胡',[0,0,0,4,4,4,9,9,9,13,13,13,18,18],4],
  ['混一色',[0,1,2,3,4,5,6,7,8,28,28,28,1,1],4],
  ['清一色',[0,1,2,3,4,5,6,7,8,1,2,3,4,4],16],
  ['混碰',[0,0,0,4,4,4,8,8,8,28,28,28,2,2],16],
  ['清碰',[0,0,0,2,2,2,4,4,4,6,6,6,8,8],32],
  ['混幺九',[0,0,0,8,8,8,9,9,9,27,27,27,17,17],32],
  ['小三元',[31,31,31,32,32,32,0,1,2,9,10,11,33,33],32],
  ['小四喜',[27,27,27,28,28,28,29,29,29,0,1,2,30,30],32],
  ['字一色',[27,27,27,28,28,28,31,31,31,32,32,32,29,29],64],
  ['清幺九',[0,0,0,8,8,8,9,9,9,17,17,17,18,18],64],
  ['大三元',[31,31,31,32,32,32,33,33,33,0,1,2,9,9],64],
  ['大四喜',[27,27,27,28,28,28,29,29,29,30,30,30,0,0],64],
  ['九莲宝灯',[0,0,0,1,2,3,4,5,6,7,8,8,8,4],64],
  ['十三幺',[0,8,9,17,18,26,27,28,29,30,31,32,33,0],64],
 ] as [string,number[],number][])('%s has the published base value',(name,hand,expected)=>{const result=score(hand);expect(result.points).toBe(expected);expect(result.patterns[0].name).toBe(name);});
 it('does not allow seven pairs in chicken-and-flat, but scores it in Sichuan',()=>{const hand=[0,0,3,3,8,8,9,9,12,12,17,17,18,18];expect(score(hand).points).toBe(0);expect(score(hand,'sichuan').points).toBe(4);});
 it('caps ordinary wind/dragon doubles, while special hands keep their table value',()=>{expect(score([27,27,27,31,31,31,0,1,2,9,10,11,5,5]).points).toBe(8);expect(score([0,0,0,4,4,4,8,8,8,27,27,27,2,2]).points).toBe(16);});
 it('scores roots, single-pair wait, pure seven pairs and excludes simples from all 258',()=>{
  expect(score([0,0,0,0,3,3,8,8,9,9,12,12,17,17],'sichuan').points).toBe(8);
  expect(score([0,0,1,1,2,2,3,3,4,4,5,5,6,6],'sichuan').points).toBe(16);
  expect(score([1,1,1,4,4,4,10,10,10,13,13,13,16,16],'sichuan').points).toBe(8);
  const melds=[0,3,9,12].map((v,i)=>({type:'pong' as const,tiles:tiles([v,v,v],'m'+i),from:1}));expect(score([7,7],'sichuan',melds).points).toBe(4);
 });
 it('stacks independent red bonuses but excludes their included lower patterns',()=>{const result=score([1,1,1,3,3,3,5,5,5,7,7,7,10,10],'redBloodflow',[],33);expect(result.points).toBe(256);expect(result.patterns.map(p=>p.name)).toEqual(['全双刻','四暗刻','硬胡']);});
 it('requires the nine-sided pre-win nine-gates hand and a pre-win Red Dragon singleton',()=>{
  expect(score([0,0,0,0,1,2,3,4,5,6,7,8,8,8]).points).toBe(16);
  const melds=[0,10,12,22].map((v,i)=>({type:'pong' as const,tiles:tiles([v,v,v],'m'+i),from:1}));
  expect(score([4,33],'redBloodflow',melds,33).points).toBe(4);
  expect(score([33,4],'redBloodflow',melds,33).points).toBe(32);
 });
 it('uses coherent wildcard decompositions and handles all six reds within a bounded time',()=>{const start=performance.now();const r=score([0,1,2,9,10,11,6,6,33,33,33,33,33,33],'redBloodflow',[],33);expect(r.points).toBeGreaterThan(0);expect(performance.now()-start).toBeLessThan(2000);expect(score([0,1,2,3,4,5,9,10,11,12,13,33,6,6],'laizi',[],33).points).toBe(1);});
});

describe('claims, passed wins and settlement',()=>{
 it('offers chow only to the next seat and lets pung override it',()=>{let s=setup();s.hands[0]=tiles([2],'a');s.hands[1]=tiles([0,1,3,4,8,10,12,14,16,18,20,22,24],'b');s.hands[2]=tiles([2,2,5,7,9,11,13,15,17,19,21,23,25],'c');s=act(s,0,'discard',['a0']);expect(actions(s,1).find(a=>a.id==='chow')!.choices.map(c=>c.id)).toEqual(['2','1','0']);expect(actions(s,2).some(a=>a.id==='chow')).toBe(false);s=act(s,1,'chow',['0']);s=act(s,2,'pong');s=pass(s);expect(s.current).toBe(2);expect(s.melds[1]).toEqual([]);expect(s.melds[2][0].type).toBe('pong');});
 it('claims a run without an extra draw and prevents ghost substitution',()=>{let s=setup();s.hands[0]=tiles([2],'a');s.hands[1]=tiles([0,1,4,6,8,10,12,14,16,18,20,22,24],'b');const wall=s.wall.length;s=act(s,0,'discard',['a0']);s=act(s,1,'chow',['0']);s=pass(s);expect(s.current).toBe(1);expect(s.wall).toHaveLength(wall);expect(s.melds[1][0].tiles.map(t=>t.value)).toEqual([0,1,2]);expect(s.drawn).toBeNull();const g=setup('guangdongGhost');g.wildValue=1;g.hands=s.hands;g.hands[1]=tiles([0,1,4,6,8,10,12,14,16,18,20,22,24],'b');g.pending={tile:{value:2,id:'pending'},from:0,responses:{}};g.phase='respond';expect(actions(g,1).some(a=>a.id==='chow')).toBe(false);});
 it('blocks a passed same-value Guangdong win until drawing or claiming',()=>{let s=setup();s.hands[0]=tiles([6],'a');s.hands[1]=tiles(waiting,'b');s=act(s,0,'discard',['a0']);s=act(s,1,'pass');s=pass(s);expect(s.passedTiles?.[1]).toBeUndefined(); // The next seat draws, clearing the restriction.
  s.hands[1]=tiles(waiting,'b');s.passedTiles={1:[6]};s.pending={tile:{id:'p',value:6},from:2,responses:{}};s.phase='respond';expect(actions(s,1).some(a=>a.id==='hu')).toBe(false);s.pending.tile.value=3;expect(actions(s,1).some(a=>a.id==='hu')).toBe(true);
 });
 it('a passed Sichuan win stays blocked after pung until the next draw',()=>{let s=setup('sichuan');s.hands[1]=tiles([6,6,0,1,2,3,4,5,9,10,11,12,12],'b');s.hands[0]=tiles([6],'a');s=act(s,0,'discard',['a0']);expect(actions(s,1).some(a=>a.id==='hu')).toBe(true);s=act(s,1,'pong');s=pass(s);expect(s.passedHu?.[1]).toBeGreaterThan(0);});
 it('records repeated flow self-wins without discarding the winning physical tile',()=>{let s=setup('redBloodflow');s.hands[0]=tiles([...waiting,33]);s.drawn='t13';s=act(s,0,'hu');expect(s.current).toBe(1);expect(s.hands[0]).toHaveLength(13);expect(s.winningTiles!.map(t=>t.id)).toEqual(['t13']);expect(actions(s,0)).toEqual([]);s.current=0;s.phase='discard';s.hands[0].push({id:'second',value:33});s.drawn='second';s.selfWon=false;s=act(s,0,'hu');expect(s.wins).toHaveLength(2);expect(s.winningTiles!.map(t=>t.id)).toEqual(['t13','second']);expect(s.discards[0]).toEqual([]);});
 it('applies Guangdong self-draw and kong minimum with supplier liability, without instant kong pay',()=>{let s=setup();s=act(s,0,'hu');expect(s.wins[0].points).toBe(4);expect(s.scores).toEqual([12,-4,-4,-4]);s=setup();s.afterKong=true;s.lastKongFrom=2;s=act(s,0,'hu');expect(s.wins[0].points).toBe(8);expect(s.scores).toEqual([24,0,-24,0]);s=setup();s.hands[0]=tiles([6,6,6,6,0,1,2,3,4,5,9,10,11,12]);s=act(s,0,'concealed:6',['6']);expect(s.scores).toEqual([0,0,0,0]);});
 it('robbing a Guangdong added kong makes the declarer pay for all three opponents',()=>{let s=setup();s.hands[0]=tiles([6,0,1,2,3,4,5,9,10,11,12]);s.melds[0]=[{type:'pong',tiles:tiles([6,6,6],'meld'),from:2}];s.hands[1]=tiles(waiting,'b');s=act(s,0,'added:6',['6']);s=act(s,1,'hu');s=pass(s);expect(s.scores).toEqual([-24,24,0,0]);expect(s.melds[0][0].type).toBe('pong');});
 it('records fourth-open-set liability and charges its supplier on the later self-win',()=>{
  let s=setup();s.hands[0]=tiles([6],'a');s.hands[1]=tiles([6,6,9,17],'b');s.melds[1]=[0,3,12].map((v,j)=>({type:'pong',tiles:tiles([v,v,v],'m'+j),from:2}));
  s=act(s,0,'discard',['a0']);s=act(s,1,'pong');s=pass(s);expect(s.liability?.[1]).toBe(0);
  s.hands[1]=tiles([9,9],'later');s.drawn='later1';s.phase='discard';s.pending=null;s.selfWon=false;s=act(s,1,'hu');expect(s.scores).toEqual([-24,24,0,0]);expect(s.wins[0].gained).toBe(24);
 });
 it('uses literal triple, heavenly, human and earthly Guangdong minimum payments',()=>{
  let s=setup();s.hands[0]=tiles([6],'a');for(let i=1;i<4;i++)s.hands[i]=tiles(waiting,'p'+i);s=act(s,0,'discard',['a0']);for(let i=1;i<4;i++)s=act(s,i,'hu');expect(s.scores).toEqual([-24,8,8,8]);
  s=setup();s.turn=1;s=act(s,0,'hu');expect(s.scores).toEqual([192,-64,-64,-64]);expect(s.history.at(-1)).toBe('本局结束');expect(s.history).toContain('a · 自摸 · +192');
  s=setup();s.turn=1;s.hands[0]=tiles([6],'a');s.hands[1]=tiles(waiting,'b');s=act(s,0,'discard',['a0']);s=act(s,1,'hu');s=pass(s);expect(s.scores).toEqual([-64,64,0,0]);
  s=setup();s.turn=2;s.current=1;s.hands[1]=tiles([...waiting,6],'b');s.drawn='b13';s.discards[0]=tiles([17],'out');s=act(s,1,'hu');expect(s.scores).toEqual([-64,192,-64,-64]);
 });
 it('transfers a kong income to simultaneous discard winners and removes refundable entries',()=>{
  let s=setup('bloodflow');s.afterKong=true;s.turn=8;s.scores=[6,-2,-2,-2];s.kongPayments=[1,2,3].map(from=>({from,to:0,points:2,turn:8}));s.hands[0]=tiles([6],'a');s.hands[1]=tiles(waiting,'b');s.hands[2]=tiles(waiting,'c');
  s=act(s,0,'discard',['a0']);s=act(s,1,'hu');s=act(s,2,'hu');s=pass(s);expect(s.scores).toEqual([-10,6,6,-2]);expect(s.wins.map(w=>w.gained)).toEqual([8,8]);expect(s.history).toContain('b · 呼叫转移 · +6');expect(s.kongPayments).toEqual([]);
 });
 it.each(modes)('reaches terminal %s states with physical conservation and zero-sum scores',mode=>{for(let seed=1;seed<=4;seed++){let s=mahjong.create(players,seed,{mahjongMode:mode}),steps=0;while(!s.finished&&steps++<650){conservation(s);const i=players.findIndex((_,i)=>actions(s,i).length);expect(i).toBeGreaterThanOrEqual(0);const legal=actions(s,i);const a=legal.find(a=>a.id==='hu')??legal.find(a=>a.id.startsWith('concealed:'))??legal.find(a=>a.id==='kong')??legal.find(a=>a.id==='pong')??legal[0];let values=a.choices.slice(0,a.min).map(c=>c.id);if(a.id==='exchange'&&MAHJONG_RULES[mode].exchange==='sameThree')values=[0,1,2].map(suit=>s.hands[i].filter(t=>Math.floor(t.value/9)===suit)).find(g=>g.length>=3)!.slice(0,3).map(t=>t.id);s=act(s,i,a.id,values);if(steps%25===0)s=JSON.parse(JSON.stringify(s));}expect(s.finished).toBe(true);conservation(s);}},30000);
});
