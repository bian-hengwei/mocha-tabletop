import { action, assertPlayers, validateCommand, type Action, type GameModule, type GameView, type Player, type Choice } from '../types';

export const BOMB_KINDS=['bomb','defuse','attack','skip','favor','shuffle','future','nope','moonCat','cloudCat','leafCat','starCat','sunCat'] as const;
export type BombKind=typeof BOMB_KINDS[number];
export interface BombCard { id:string; kind:BombKind; title:string }
const TITLES:Record<BombKind,string>={bomb:'炸弹',defuse:'拆弹',attack:'攻击',skip:'跳过',favor:'索取',shuffle:'洗牌',future:'预见未来',nope:'否决',moonCat:'月亮猫',cloudCat:'云朵猫',leafCat:'叶子猫',starCat:'星星猫',sunCat:'太阳猫'};
const HELP:Record<BombKind,string>={bomb:'没有拆弹牌就出局',defuse:'拆除炸弹，并秘密放回牌堆',attack:'剩余攻击回合再加 2，交给下家',skip:'不抽牌，结束一个回合',favor:'对方选择一张手牌交给你',shuffle:'打乱抽牌堆',future:'秘密查看顶部 3 张',nope:'否决当前效果，或取消否决',moonCat:'同名对子随机拿牌，三张指定牌名',cloudCat:'同名对子随机拿牌，三张指定牌名',leafCat:'同名对子随机拿牌，三张指定牌名',starCat:'同名对子随机拿牌，三张指定牌名',sunCat:'同名对子随机拿牌，三张指定牌名'};
const PLAYABLE:BombKind[]=['attack','skip','favor','shuffle','future'];
export interface BombEffect { actor:string; cards:BombCard[]; target?:string; requested?:BombKind; cancelled:boolean; passed:string[] }
export type BombPhase={kind:'turn'}|{kind:'target';cards:BombCard[]}|{kind:'request';cards:BombCard[];target:string}|{kind:'response';effect:BombEffect}|{kind:'give';actor:string;target:string}|{kind:'future';cards:BombCard[]}|{kind:'bomb'|'insert';card:BombCard};
export interface BombsState {players:Player[];hands:Record<string,BombCard[]>;deck:BombCard[];discard:BombCard[];eliminatedCards:BombCard[];alive:string[];current:string;turnsRemaining:number;attacked:boolean;phase:BombPhase;history:string[];rng:number;serial:number}
const finished=(s:BombsState)=>s.alive.length===1;
function random(s:BombsState) {s.rng=(s.rng+0x6D2B79F5)>>>0;let t=Math.imul(s.rng^(s.rng>>>15),1|s.rng);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;}
function shuffle(s:BombsState) {for(let i=s.deck.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[s.deck[i],s.deck[j]]=[s.deck[j],s.deck[i]];}}
const name=(s:BombsState,id:string)=>s.players.find(p=>p.id===id)?.name??'玩家';
function record(s:BombsState,text:string){s.history.push(text);s.history=s.history.slice(-40);}
const effectTitle=(e:BombEffect)=>e.cards.length===1?e.cards[0].title:`${e.cards.length} 张同名组合`;
const choices=(cards:BombCard[]):Choice[]=>cards.map(c=>({id:c.id,title:c.title,subtitle:HELP[c.kind]}));
function nextPlayer(s:BombsState,id:string){const index=s.players.findIndex(p=>p.id===id);for(let i=1;i<=s.players.length;i++){const p=s.players[(index+i)%s.players.length];if(s.alive.includes(p.id))return p.id;}throw Error('没有存活玩家');}
function endTurn(s:BombsState){s.turnsRemaining--;if(s.turnsRemaining===0){s.current=nextPlayer(s,s.current);s.turnsRemaining=1;s.attacked=false;}s.phase={kind:'turn'};}
function explode(s:BombsState,bomb:BombCard){const victim=s.current;s.eliminatedCards.push(...s.hands[victim],bomb);s.hands[victim]=[];s.alive=s.alive.filter(id=>id!==victim);record(s,`${name(s,victim)} 爆炸出局`);s.current=nextPlayer(s,victim);s.turnsRemaining=1;s.attacked=false;s.phase={kind:'turn'};if(finished(s))record(s,`${name(s,s.alive[0])} 成为最后的幸存者`);}
function beginEffect(s:BombsState,cards:BombCard[],target?:string,requested?:BombKind){const e:BombEffect={actor:s.current,cards,cancelled:false,passed:[],...(target?{target}:{}),...(requested?{requested}:{})};s.hands[e.actor]=s.hands[e.actor].filter(c=>!cards.some(x=>x.id===c.id));s.discard.push(...cards);s.phase={kind:'response',effect:e};record(s,`${name(s,e.actor)} 打出${effectTitle(e)}${target?` → ${name(s,target)}`:''}`);}
function resolve(s:BombsState,e:BombEffect){
  s.phase={kind:'turn'};
  if(e.cancelled){record(s,'效果被否决');return;}
  if(e.cards.length>1&&e.target){const hand=s.hands[e.target],i=e.requested?hand.findIndex(c=>c.kind===e.requested):hand.length?Math.floor(random(s)*hand.length):-1;if(i>=0){s.hands[e.actor].push(hand.splice(i,1)[0]);record(s,`${name(s,e.actor)} 从 ${name(s,e.target)} 获得一张牌`);}else record(s,`${name(s,e.actor)} 没有取得牌`);return;}
  switch(e.cards[0].kind){
    case 'attack':s.turnsRemaining=s.attacked?s.turnsRemaining+2:2;s.attacked=true;s.current=nextPlayer(s,s.current);record(s,`${name(s,s.current)} 需要完成 ${s.turnsRemaining} 个回合`);break;
    case 'skip':endTurn(s);break;
    case 'shuffle':shuffle(s);record(s,'抽牌堆已洗匀');break;
    case 'future':s.phase={kind:'future',cards:s.deck.slice(0,3)};break;
    case 'favor':if(e.target&&s.hands[e.target].length)s.phase={kind:'give',actor:e.actor,target:e.target};else record(s,'目标没有手牌');break;
  }
}
export const bombs:GameModule<BombsState>={
  create(players,seed){
    assertPlayers(players,2,5);if(players.some(p=>!p.id))throw Error('玩家 ID 不能为空');
    const s:BombsState={players:structuredClone(players),hands:Object.fromEntries(players.map(p=>[p.id,[]])),deck:[],discard:[],eliminatedCards:[],alive:players.map(p=>p.id),current:players[0].id,turnsRemaining:1,attacked:false,phase:{kind:'turn'},history:['每人 7 张普通牌和 1 张拆弹牌'],rng:seed>>>0,serial:0};
    const make=(kind:BombKind):BombCard=>({id:`bombs-card-${++s.serial}`,kind,title:TITLES[kind]});
    for(const p of players)s.hands[p.id].push(make('defuse'));
    for(const kind of BOMB_KINDS.filter(k=>k!=='bomb'&&k!=='defuse'))for(let i=0;i<(['future','nope'].includes(kind)?5:4);i++)s.deck.push(make(kind));
    shuffle(s);for(const p of players)s.hands[p.id].push(...s.deck.splice(0,7));
    for(let i=0;i<Math.min(2,6-players.length);i++)s.deck.push(make('defuse'));
    for(let i=0;i<players.length-1;i++)s.deck.push(make('bomb'));
    shuffle(s);return s;
  },
  view(s,playerID){
    if(!s.players.some(p=>p.id===playerID))return{kind:'bombs',phase:'不在本局',instruction:'仅本局玩家可查看',finished:finished(s),actions:[],sections:[],log:[],board:{}};
    const mine=s.current===playerID&&s.alive.includes(playerID)&&!finished(s),hand=s.hands[playerID],phase=s.phase;
    let label='自由出牌',instruction=mine?'出牌，或抽一张':`等待 ${name(s,s.current)}`;
    const actions:Action[]=[],sections:GameView['sections']=[{id:'hand',title:'我的手牌',private:true,items:hand.map(c=>({id:c.id,title:c.title,detail:HELP[c.kind]}))},{id:'discard',title:'最近弃牌',items:s.discard.slice(-12).reverse().map(c=>({id:c.id,title:c.title}))}];
    const board:Record<string,any>={phase:phase.kind,hand,players:s.players.map(p=>({...p,alive:s.alive.includes(p.id),count:s.hands[p.id].length})),current:s.current,deckCount:s.deck.length,discard:s.discard.slice(-12).reverse(),turnsRemaining:s.turnsRemaining,attacked:s.attacked,winners:finished(s)?s.alive:[]};
    if(!finished(s))switch(phase.kind){
      case 'turn':if(mine){actions.push(action('draw','抽牌'));const singles=hand.filter(c=>PLAYABLE.includes(c.kind));if(singles.length)actions.push(action('play','出牌',choices(singles),1,1));for(const n of [2,3]){const combo=BOMB_KINDS.filter(k=>hand.filter(c=>c.kind===k).length>=n).map(k=>({id:k,title:`${n} 张${TITLES[k]}`}));if(combo.length)actions.push(action(n===2?'pair':'triple',n===2?'对子':'三张',combo,1,1));}}break;
      case 'target':label='选择目标';instruction=mine?'选择一位玩家':`等待 ${name(s,s.current)} 选择目标`;if(mine)actions.push(action('target','选择目标',s.alive.filter(id=>id!==s.current).map(id=>({id,title:name(s,id)})),1,1),action('cancel','取消'));break;
      case 'request':label='指定牌名';instruction=mine?'想要哪张牌？':`等待 ${name(s,s.current)} 指定牌名`;if(mine)actions.push(action('request','指定牌名',BOMB_KINDS.filter(k=>k!=='bomb').map(k=>({id:k,title:TITLES[k]})),1,1),action('cancel','取消'));break;
      case 'response':{const e=phase.effect;label='否决响应';instruction=`${name(s,e.actor)} · ${effectTitle(e)}${e.cancelled?' · 已否决':''}`;board.response={actor:e.actor,cards:e.cards,target:e.target??null,requested:e.requested??null,cancelled:e.cancelled,passed:e.passed};sections.push({id:'responses',title:'响应',items:s.alive.map(id=>({id,title:name(s,id),detail:e.passed.includes(id)?'已确认':'待响应'}))});if(s.alive.includes(playerID)){if(!e.passed.includes(playerID))actions.push(action('pass','继续'));const nopes=hand.filter(c=>c.kind==='nope');if(nopes.length)actions.push(action('nope',e.cancelled?'恢复效果':'否决',choices(nopes),1,1));}break;}
      case 'give':label='交出手牌';instruction=`${name(s,phase.target)} → ${name(s,phase.actor)}`;board.give={actor:phase.actor,target:phase.target};if(playerID===phase.target)actions.push(action('give','交出一张',choices(hand),1,1));break;
      case 'future':label='查看未来';instruction=mine?'顶部三张 · 仅你可见':`等待 ${name(s,s.current)}`;if(mine){board.privateFuture=phase.cards.map((c,i)=>({...c,id:`future-${i}`}));sections.push({id:'future',title:'牌堆顶',private:true,items:phase.cards.map((c,i)=>({id:`future-${i}`,title:`${i+1} · ${c.title}`}))});actions.push(action('done','继续'));}break;
      case 'bomb':label='抽到炸弹';instruction=`${name(s,s.current)} 抽到了炸弹`;if(mine)actions.push(action('defuse','拆弹'),action('explode','放弃拆弹'));break;
      case 'insert':label='秘密放回';instruction=mine?'选择炸弹位置':`等待 ${name(s,s.current)} 放回炸弹`;if(mine)actions.push(action('insert','放回炸弹',Array.from({length:s.deck.length+1},(_,i)=>({id:String(i),title:i===0?'最上面':i===s.deck.length?'最底下':`第 ${i+1} 张`})),1,1));break;
    }
    else{label='游戏结束';instruction=`${name(s,s.alive[0])} 获胜`;}
    return structuredClone({kind:'bombs',phase:label,instruction,finished:finished(s),actions,sections,board,log:s.history} satisfies GameView);
  },
  apply(state,playerID,command){
    validateCommand(bombs.view(state,playerID),command);
    const s=structuredClone(state),v=command.values,p=s.phase;
    switch(command.action){
      case 'draw':{if(!s.deck.length)throw Error('牌堆为空');const c=s.deck.shift()!;if(c.kind==='bomb'){record(s,`${name(s,s.current)} 抽到了炸弹`);if(s.hands[s.current].some(c=>c.kind==='defuse'))s.phase={kind:'bomb',card:c};else explode(s,c);}else{s.hands[s.current].push(c);record(s,`${name(s,s.current)} 抽了一张牌`);endTurn(s);}break;}
      case 'play':case 'pair':case 'triple':{const cards=command.action==='play'?s.hands[s.current].filter(c=>c.id===v[0]):s.hands[s.current].filter(c=>c.kind===v[0]).slice(0,command.action==='pair'?2:3);if(cards.length>1||cards[0].kind==='favor')s.phase={kind:'target',cards};else beginEffect(s,cards);break;}
      case 'target':if(p.kind!=='target')throw Error('阶段无效');if(p.cards.length===3)s.phase={kind:'request',cards:p.cards,target:v[0]};else beginEffect(s,p.cards,v[0]);break;
      case 'request':if(p.kind!=='request')throw Error('阶段无效');beginEffect(s,p.cards,p.target,v[0] as BombKind);break;
      case 'cancel':s.phase={kind:'turn'};break;
      case 'pass':if(p.kind!=='response')throw Error('阶段无效');p.effect.passed.push(playerID);if(p.effect.passed.length===s.alive.length)resolve(s,p.effect);break;
      case 'nope':{if(p.kind!=='response')throw Error('阶段无效');const i=s.hands[playerID].findIndex(c=>c.id===v[0]);s.discard.push(s.hands[playerID].splice(i,1)[0]);p.effect.cancelled=!p.effect.cancelled;p.effect.passed=[];record(s,`${name(s,playerID)} 否决 · ${p.effect.cancelled?'取消':'恢复'}效果`);break;}
      case 'give':{if(p.kind!=='give')throw Error('阶段无效');const i=s.hands[p.target].findIndex(c=>c.id===v[0]);s.hands[p.actor].push(s.hands[p.target].splice(i,1)[0]);record(s,`${name(s,p.target)} 交给 ${name(s,p.actor)} 一张牌`);s.phase={kind:'turn'};break;}
      case 'done':s.phase={kind:'turn'};break;
      case 'defuse':{if(p.kind!=='bomb')throw Error('阶段无效');const i=s.hands[s.current].findIndex(c=>c.kind==='defuse');if(i<0)throw Error('没有拆弹牌');s.discard.push(s.hands[s.current].splice(i,1)[0]);s.phase={kind:'insert',card:p.card};record(s,`${name(s,s.current)} 使用拆弹牌`);break;}
      case 'explode':if(p.kind!=='bomb')throw Error('阶段无效');explode(s,p.card);break;
      case 'insert':if(p.kind!=='insert')throw Error('阶段无效');s.deck.splice(Number(v[0]),0,p.card);record(s,`${name(s,s.current)} 已秘密放回炸弹`);endTurn(s);break;
      default:throw Error('未知操作');
    }
    return s;
  }
};
