import { action, assertPlayers, validateCommand, type Action, type GameModule, type GameView, type Player } from '../types';

export const GEM_COLORS = ['white', 'blue', 'green', 'red', 'black', 'gold'];
const LABELS = ['白钻', '蓝宝石', '祖母绿', '红宝石', '黑玛瑙', '黄金'];
const SYMBOLS = ['⚪', '🔵', '🟢', '🔴', '⚫', '🟡'];
export interface GemCard { id: string; tier: number; bonus: string; points: number; cost: number[] }
export interface Noble { id: string; cost: number[] }
export interface Merchant { tokens: number[]; bought: GemCard[]; reserved: GemCard[]; nobles: Noble[]; /** Only face-up market reservations are remembered publicly; missing in legacy saves. */ publicReserved?: string[] }
export interface GemsState {
  players: Player[]; merchants: Merchant[]; bank: number[]; decks: GemCard[][]; market: GemCard[][]; nobles: Noble[];
  current: number; phase: 'action' | 'payment' | 'discard' | 'noble'; payment: GemCard | null;
  finalRound: boolean; round: number; winners: string[]; finished: boolean; history: string[]; rng: number;
}
const sum = (xs:number[]) => xs.reduce((a,b)=>a+b,0);
export const gemBonuses = (m:Merchant) => GEM_COLORS.slice(0,5).map(c=>m.bought.filter(x=>x.bonus===c).length);
export const gemScore = (m:Merchant) => m.bought.reduce((n,c)=>n+c.points,0)+m.nobles.length*3;
const describe = (xs:number[]) => xs.map((n,i)=>n?`${SYMBOLS[i]}×${n}`:'').filter(Boolean).join(' ') || '无';
const title = (c:GemCard) => `${LABELS[GEM_COLORS.indexOf(c.bonus)]}${['矿场','商路','工坊'][c.tier-1]} · ${c.points} 分`;
const needs = (s:GemsState,c:GemCard) => c.cost.map((n,i)=>Math.max(0,n-gemBonuses(s.merchants[s.current])[i]));
function payment(s:GemsState,c:GemCard):number[]|null {
  const result=[0,0,0,0,0,0], tokens=s.merchants[s.current].tokens;
  needs(s,c).forEach((n,i)=>{result[i]=Math.min(n,tokens[i]);result[5]+=n-result[i];});
  return result[5]<=tokens[5]?result:null;
}
function random(s:{rng:number}) { s.rng=(s.rng+0x6D2B79F5)>>>0; let t=Math.imul(s.rng^(s.rng>>>15),1|s.rng);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296; }
function shuffled<T>(s:{rng:number}, xs:T[]):T[] {const a=[...xs];for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const eligible = (s:GemsState) => s.nobles.filter(n=>n.cost.every((v,i)=>gemBonuses(s.merchants[s.current])[i]>=v));
const available = (s:GemsState) => [...s.market.flat(),...s.merchants[s.current].reserved];
const tokenChoices = (s:GemsState) => s.merchants[s.current].tokens.flatMap((n,i)=>Array.from({length:n},(_,j)=>({id:`${GEM_COLORS[i]}:${j}`,title:`${SYMBOLS[i]} ${LABELS[i]} · ${j+1}`})));
const cardChoices = (cs:GemCard[]) => cs.map(c=>({id:c.id,title:title(c),subtitle:describe(c.cost)}));
function actions(s:GemsState):Action[] {
  if(s.finished)return [];
  const m=s.merchants[s.current];
  if(s.phase==='discard'){const n=sum(m.tokens)-10;return[action('discard',`归还 ${n} 枚`,tokenChoices(s),n,n)];}
  if(s.phase==='noble')return[action('noble','选择贵族',eligible(s).map(n=>({id:n.id,title:`${n.id} · 3 分`,subtitle:describe(n.cost)})),1,1)];
  if(s.phase==='payment')return [action('pay_auto','确认购买',[],0,0,`支付 ${describe(payment(s,s.payment!)!)}`),action('pay_custom','选择筹码',tokenChoices(s),sum(needs(s,s.payment!)),sum(needs(s,s.payment!))),action('cancel_buy','取消')];
  const result:Action[]=[];
  const different=GEM_COLORS.slice(0,5).filter((_,i)=>s.bank[i]>0), n=Math.min(3,different.length);
  if(n)result.push(action('take_distinct',`拿取 ${n} 种宝石`,different.map(c=>({id:c,title:LABELS[GEM_COLORS.indexOf(c)]})),n,n));
  const pairs=GEM_COLORS.slice(0,5).filter((_,i)=>s.bank[i]>=4);
  if(pairs.length)result.push(action('take_pair','拿取同色 ×2',pairs.map(c=>({id:c,title:LABELS[GEM_COLORS.indexOf(c)]})),1,1));
  const buyable=available(s).filter(c=>payment(s,c)!==null);
  if(buyable.length)result.push(action('buy','购买',cardChoices(buyable),1,1));
  if(m.reserved.length<3){const choices=[...cardChoices(s.market.flat()),...s.decks.flatMap((d,i)=>d.length?[{id:`deck:${i+1}`,title:`盲抽 ${i+1} 级`,subtitle:'仅你可见'}]:[])];if(choices.length)result.push(action('reserve','预留',choices,1,1));}
  if(!result.length)result.push(action('pass','跳过'));
  return result;
}
function removeMarket(s:GemsState,id:string):GemCard {
  for(let tier=0;tier<3;tier++){const index=s.market[tier].findIndex(c=>c.id===id);if(index>=0){const [c]=s.market[tier].splice(index,1);const next=s.decks[tier].pop();if(next)s.market[tier].splice(index,0,next);return c;}}
  throw Error('这张牌已不在市场');
}
function finishTurn(s:GemsState) {
  if(gemScore(s.merchants[s.current])>=15&&!s.finalRound){s.finalRound=true;s.history.push('进入最后一轮');}
  if(s.finalRound&&s.current===s.players.length-1){s.finished=true;const high=Math.max(...s.merchants.map(gemScore));const fewest=Math.min(...s.merchants.filter(m=>gemScore(m)===high).map(m=>m.bought.length));s.winners=s.players.filter((_,i)=>gemScore(s.merchants[i])===high&&s.merchants[i].bought.length===fewest).map(p=>p.id);s.history.push(`胜者：${s.players.filter(p=>s.winners.includes(p.id)).map(p=>p.name).join('、')} · ${high} 分`);}
  else{s.current=(s.current+1)%s.players.length;if(!s.current)s.round++;}
  s.phase='action';s.payment=null;
}
function settle(s:GemsState) {
  s.payment=null;
  if(sum(s.merchants[s.current].tokens)>10){s.phase='discard';return;}
  const ns=eligible(s);
  if(ns.length>1){s.phase='noble';return;}
  if(ns.length){s.nobles=s.nobles.filter(n=>n.id!==ns[0].id);s.merchants[s.current].nobles.push(ns[0]);s.history.push(`${s.players[s.current].name} 获得贵族 · +3 分`);}
  finishTurn(s);
}
function selectedTokens(values:string[]) { const result=[0,0,0,0,0,0];for(const v of values)result[GEM_COLORS.indexOf(v.split(':')[0])]++;return result; }
export const gems:GameModule<GemsState>={
  create(players,seed){
    assertPlayers(players,2,4);if(players.some(p=>!p.id))throw Error('玩家 ID 不能为空');
    const s:GemsState={players:structuredClone(players),merchants:players.map(()=>({tokens:[0,0,0,0,0,0],bought:[],reserved:[],nobles:[],publicReserved:[]})),bank:[...Array(5).fill(({2:4,3:5,4:7} as Record<number,number>)[players.length]),5],decks:[],market:[],nobles:[],current:0,phase:'action',payment:null,finalRound:false,round:1,winners:[],finished:false,history:[`${players[0].name} 先手 · 15 分触发最后一轮`],rng:seed>>>0};
    s.decks=[1,2,3].map(t=>shuffled(s,structuredClone(GEM_CATALOG.filter(c=>c.tier===t))));s.market=s.decks.map(d=>d.splice(-4));s.nobles=shuffled(s,structuredClone(NOBLE_CATALOG)).slice(0,players.length+1);return s;
  },
  view(s,playerID){
    const viewer=s.players.findIndex(p=>p.id===playerID);
    if(viewer<0)return{kind:'gems',phase:'不在本局',instruction:'仅本局玩家可查看',finished:s.finished,actions:[],sections:[],log:[],board:{}};
    const mine=s.current===viewer;
    const instruction=s.finished?`胜者：${s.players.filter(p=>s.winners.includes(p.id)).map(p=>p.name).join('、')}`:mine?({action:'轮到你了',payment:'确认支付',discard:'归还多余筹码',noble:'选择来访贵族'}[s.phase]):`等待 ${s.players[s.current].name}`;
    const view:GameView={kind:'gems',phase:s.finished?'游戏结束':`第 ${s.round} 轮${s.finalRound?' · 最后一轮':''}`,instruction,finished:s.finished,actions:mine?actions(s):[],sections:[{id:'bank',title:'供应',items:s.bank.map((n,i)=>({id:GEM_COLORS[i],title:LABELS[i],detail:`${n}`}))},...s.market.map((cards,i)=>({id:`market:${i}`,title:`${i+1} 级市场`,items:cards.map(c=>({id:c.id,title:title(c),detail:describe(c.cost)}))})),{id:'reserved',title:'我的预留',private:true,items:s.merchants[viewer].reserved.map(c=>({id:c.id,title:title(c),detail:describe(c.cost)}))},{id:'nobles',title:'贵族',items:s.nobles.map(n=>({id:n.id,title:n.id,detail:describe(n.cost)}))}],log:s.history,
      board:{phase:s.phase,market:s.market.flat(),bank:s.bank,nobles:s.nobles,players:s.players.map((p,i)=>({...p,tokens:s.merchants[i].tokens,bonuses:gemBonuses(s.merchants[i]),score:gemScore(s.merchants[i]),reservedCount:s.merchants[i].reserved.length,reservedCards:s.merchants[i].reserved.map((card,slot)=>s.merchants[i].publicReserved?.includes(card.id)?{id:card.id,tier:card.tier,public:true,card}:{id:'reserved-'+p.id+'-'+slot,tier:card.tier,public:false}),bought:s.merchants[i].bought,nobles:s.merchants[i].nobles})),hand:s.merchants[viewer].reserved,current:s.players[s.current].id,decks:s.decks.map(d=>d.length),round:s.round,finalRound:s.finalRound,winners:s.winners,payment:mine&&s.payment?{card:s.payment,needed:needs(s,s.payment),auto:payment(s,s.payment)}:null}};
    return structuredClone(view);
  },
  apply(state,playerID,command){
    validateCommand(gems.view(state,playerID),command);
    const s=structuredClone(state), m=s.merchants[s.current], name=s.players[s.current].name, v=command.values;
    switch(command.action){
      case 'take_distinct':for(const c of v){const i=GEM_COLORS.indexOf(c);s.bank[i]--;m.tokens[i]++;}s.history.push(`${name} 拿取 ${v.map(c=>LABELS[GEM_COLORS.indexOf(c)]).join('、')}`);settle(s);break;
      case 'take_pair':{const i=GEM_COLORS.indexOf(v[0]);s.bank[i]-=2;m.tokens[i]+=2;s.history.push(`${name} 拿取 ${LABELS[i]} ×2`);settle(s);break;}
      case 'reserve':{const blind=v[0].startsWith('deck:');const card=blind?s.decks[Number(v[0].split(':')[1])-1].pop()!:removeMarket(s,v[0]);m.reserved.push(card);if(!blind)(m.publicReserved??=[]).push(card.id);if(s.bank[5]){s.bank[5]--;m.tokens[5]++;}s.history.push(`${name} 预留 ${card.tier} 级牌`);settle(s);break;}
      case 'buy':s.payment=available(s).find(c=>c.id===v[0])!;s.phase='payment';break;
      case 'cancel_buy':s.payment=null;s.phase='action';break;
      case 'pay_auto':case 'pay_custom':{const card=s.payment!, paid=command.action==='pay_auto'?payment(s,card)!:selectedTokens(v);const required=needs(s,card);if(paid.some((n,i)=>n>m.tokens[i])||paid.slice(0,5).some((n,i)=>n>required[i])||sum(required)-sum(paid.slice(0,5))!==paid[5])throw Error('筹码与价格不匹配');paid.forEach((n,i)=>{m.tokens[i]-=n;s.bank[i]+=n;});const reserved=m.reserved.findIndex(c=>c.id===card.id);if(reserved>=0){m.reserved.splice(reserved,1);if(m.publicReserved)m.publicReserved=m.publicReserved.filter(id=>id!==card.id);}else removeMarket(s,card.id);m.bought.push(card);s.history.push(`${name} 购买 ${title(card)}`);settle(s);break;}
      case 'discard':selectedTokens(v).forEach((n,i)=>{m.tokens[i]-=n;s.bank[i]+=n;});s.history.push(`${name} 归还多余筹码`);settle(s);break;
      case 'noble':{const index=s.nobles.findIndex(n=>n.id===v[0]);m.nobles.push(s.nobles.splice(index,1)[0]);s.history.push(`${name} 获得贵族 · +3 分`);finishTurn(s);break;}
      case 'pass':s.history.push(`${name} 跳过`);settle(s);break;
      default:throw Error('未知操作');
    }
    s.history=s.history.slice(-40);return s;
  }
};

// Numerical component facts from the verified native catalog. No commercial illustrations or rulebook text.
export const GEM_CATALOG:GemCard[]=`white-L1-01,1,0,0,0,3,0,0,0
white-L1-02,1,0,1,0,0,4,0,0
white-L1-03,1,0,0,0,0,0,2,1
white-L1-04,1,0,0,0,2,0,0,2
white-L1-05,1,0,0,3,1,0,0,1
white-L1-06,1,0,0,0,2,2,0,1
white-L1-07,1,0,0,0,1,1,1,1
white-L1-08,1,0,0,0,1,2,1,1
white-L2-01,2,0,2,0,0,0,5,0
white-L2-02,2,0,3,6,0,0,0,0
white-L2-03,2,0,2,0,0,0,5,3
white-L2-04,2,0,2,0,0,1,4,2
white-L2-05,2,0,1,0,0,3,2,2
white-L2-06,2,0,1,2,3,0,3,0
white-L3-01,3,0,4,0,0,0,0,7
white-L3-02,3,0,4,3,0,0,3,6
white-L3-03,3,0,3,0,3,3,5,3
white-L3-04,3,0,5,3,0,0,0,7
blue-L1-01,1,1,0,0,0,0,0,3
blue-L1-02,1,1,1,0,0,0,4,0
blue-L1-03,1,1,0,1,0,0,0,2
blue-L1-04,1,1,0,0,0,2,0,2
blue-L1-05,1,1,0,0,1,3,1,0
blue-L1-06,1,1,0,1,0,2,2,0
blue-L1-07,1,1,0,1,0,1,1,1
blue-L1-08,1,1,0,1,0,1,2,1
blue-L2-01,2,1,2,0,5,0,0,0
blue-L2-02,2,1,3,0,6,0,0,0
blue-L2-03,2,1,2,5,3,0,0,0
blue-L2-04,2,1,2,2,0,0,1,4
blue-L2-05,2,1,1,0,2,2,3,0
blue-L2-06,2,1,1,0,2,3,0,3
blue-L3-01,3,1,4,7,0,0,0,0
blue-L3-02,3,1,4,6,3,0,0,3
blue-L3-03,3,1,3,3,0,3,3,5
blue-L3-04,3,1,5,7,3,0,0,0
green-L1-01,1,2,0,0,0,0,3,0
green-L1-02,1,2,1,0,0,0,0,4
green-L1-03,1,2,0,2,1,0,0,0
green-L1-04,1,2,0,0,2,0,2,0
green-L1-05,1,2,0,1,3,1,0,0
green-L1-06,1,2,0,0,1,0,2,2
green-L1-07,1,2,0,1,1,0,1,1
green-L1-08,1,2,0,1,1,0,1,2
green-L2-01,2,2,2,0,0,5,0,0
green-L2-02,2,2,3,0,0,6,0,0
green-L2-03,2,2,2,0,5,3,0,0
green-L2-04,2,2,2,4,2,0,0,1
green-L2-05,2,2,1,2,3,0,0,2
green-L2-06,2,2,1,3,0,2,3,0
green-L3-01,3,2,4,0,7,0,0,0
green-L3-02,3,2,4,3,6,3,0,0
green-L3-03,3,2,3,5,3,0,3,3
green-L3-04,3,2,5,0,7,3,0,0
red-L1-01,1,3,0,3,0,0,0,0
red-L1-02,1,3,1,4,0,0,0,0
red-L1-03,1,3,0,0,2,1,0,0
red-L1-04,1,3,0,2,0,0,2,0
red-L1-05,1,3,0,1,0,0,1,3
red-L1-06,1,3,0,2,0,1,0,2
red-L1-07,1,3,0,1,1,1,0,1
red-L1-08,1,3,0,2,1,1,0,1
red-L2-01,2,3,2,0,0,0,0,5
red-L2-02,2,3,3,0,0,0,6,0
red-L2-03,2,3,2,3,0,0,0,5
red-L2-04,2,3,2,1,4,2,0,0
red-L2-05,2,3,1,2,0,0,2,3
red-L2-06,2,3,1,0,3,0,2,3
red-L3-01,3,3,4,0,0,7,0,0
red-L3-02,3,3,4,0,3,6,3,0
red-L3-03,3,3,3,3,5,3,0,3
red-L3-04,3,3,5,0,0,7,3,0
black-L1-01,1,4,0,0,0,3,0,0
black-L1-02,1,4,1,0,4,0,0,0
black-L1-03,1,4,0,0,0,2,1,0
black-L1-04,1,4,0,2,0,2,0,0
black-L1-05,1,4,0,0,0,1,3,1
black-L1-06,1,4,0,2,2,0,1,0
black-L1-07,1,4,0,1,1,1,1,0
black-L1-08,1,4,0,1,2,1,1,0
black-L2-01,2,4,2,5,0,0,0,0
black-L2-02,2,4,3,0,0,0,0,6
black-L2-03,2,4,2,0,0,5,3,0
black-L2-04,2,4,2,0,1,4,2,0
black-L2-05,2,4,1,3,2,2,0,0
black-L2-06,2,4,1,3,0,3,0,2
black-L3-01,3,4,4,0,0,0,7,0
black-L3-02,3,4,4,0,0,3,6,3
black-L3-03,3,4,3,3,3,5,3,0
black-L3-04,3,4,5,0,0,0,7,3`.split('\n').map(line=>{const [id,tier,bonus,points,...cost]=line.split(',');return{id,tier:Number(tier),bonus:GEM_COLORS[Number(bonus)],points:Number(points),cost:cost.map(Number)};});
export const NOBLE_CATALOG:Noble[]=[[4,4,0,0,0],[0,4,4,0,0],[0,0,4,4,0],[0,0,0,4,4],[4,0,0,0,4],[3,3,3,0,0],[0,3,3,3,0],[0,0,3,3,3],[3,0,0,3,3],[3,3,0,0,3]].map((cost,i)=>({id:'贵族 '+(i+1),cost}));
