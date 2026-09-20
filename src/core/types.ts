export type GameKind = 'gems' | 'bombs' | 'werewolf' | 'avalon' | 'sushi' | 'century' | 'uno' | 'codenames' | 'undercover' | 'doudizhu' | 'guandan' | 'mahjong';
export interface Player { id: string; name: string; avatar: string }
export interface GameOptions { mahjongMode?: 'guangdong' | 'sichuan' | 'bloodflow' | 'laizi'; werewolfMode?: 'standard' | 'judge' | 'deal'; moderatorID?: string; werewolfPreset?: 'auto' | 'hunter' | 'guard' | 'classic9' | 'classic' | 'idiot' | 'wolfKing'; werewolfWin?: 'sides' | 'parity'; language?: 'zh' | 'en'; unoMode?: 'single' | 'match'; unoChallenge?: boolean }
export interface Choice { id: string; title: string; subtitle?: string }
export interface Action { id: string; title: string; choices: Choice[]; min: number; max: number; help?: string }
export interface Item { id: string; title: string; detail?: string; symbol?: string }
export interface Section { id: string; title: string; items: Item[]; private?: boolean }
export interface GameView {
  kind: GameKind; phase: string; instruction: string; finished: boolean;
  actions: Action[]; sections: Section[]; log: string[];
  /** Game-specific REDACTED render data. Never put other hands/roles/deck here. */
  board: Record<string, any>;
}
export interface Command { action: string; values: string[]; text?: string }
export interface GameModule<S = any> {
  create(players: Player[], seed: number, options?: GameOptions): S;
  view(state: S, playerID: string): GameView;
  /** Returns new serializable state. Invalid commands throw, original stays intact. */
  apply(state: S, playerID: string, command: Command): S;
}
export const GAMES: Record<GameKind, { name: string; min: number; max: number; color: string; tagline: string }> = {
  doudizhu: {name:'斗地主',min:3,max:3,color:'#e8b77c',tagline:'叫分抢地主，农民联手，先出完牌获胜'},
  guandan: {name:'掼蛋',min:4,max:4,color:'#dca2a0',tagline:'双副牌对家合作，从 2 升级到 A'},
  mahjong: {name:'麻将',min:4,max:4,color:'#8fcab5',tagline:'广麻、川麻、血流与红中赖子，四人同桌'},
  gems: {name:'晶石商会',min:2,max:4,color:'#73d7ba',tagline:'收宝石、买折扣，争取 15 分'},
  bombs: {name:'喵喵危机',min:2,max:5,color:'#ee9671',tagline:'抽到爆炸？拆弹保命，活到最后'},
  werewolf: {name:'月夜议会',min:6,max:18,color:'#c7b4f2',tagline:'狼人、神职与平民，夜晚行动白天投票'},
  avalon: {name:'迷雾远征',min:5,max:10,color:'#ecc780',tagline:'好坏阵营组队做任务，三胜后刺杀先知'},
  sushi: {name:'寿司小宴',min:2,max:5,color:'#f4ae9b',tagline:'选一张传一手，凑料理组合比三轮分数'},
  century: {name:'香料商旅',min:2,max:5,color:'#dfb675',tagline:'收集、升级、交易香料，完成订单'},
  uno: {name:'七彩接龙',min:2,max:10,color:'#8cb9e0',tagline:'同色同数接牌，剩一张记得喊'},
  codenames: {name:'密语行动',min:4,max:12,color:'#c7ab86',tagline:'队长给一个词，队员找出己方特工'},
  undercover: {name:'异词同伴',min:3,max:12,color:'#b9acd9',tagline:'描述相近词，投票找出卧底'}
};
export const AVATARS = ['🦊','🐼','🐱','🐻','🐰','🐨','🐯','🐸','🦁','🐧','🦉','🐙','🦋','🐳','🌵','🍄','🐶','🐺','🐹','🐷','🐮','🐵','🦝','🦦','🦥','🦔','🐿️','🦜','🦚','🦩','🐢','🦎','🦖','🐉','🐬','🦈','🪼','🐝','🐞','🌻','🌷','🍀','🍓','🍒','🍑','🥑','🍩','🧋'];
export function action(id:string,title:string,choices:Choice[]=[],min=0,max=0,help=''):Action {return {id,title,choices,min,max,help};}
export function validateCommand(view:GameView,command:Command):Action {
  const a=view.actions.find(a=>a.id===command.action);
  if(!a || !Array.isArray(command.values) || command.values.length<a.min || command.values.length>a.max || new Set(command.values).size!==command.values.length || command.values.some(id=>!a.choices.some(c=>c.id===id))) throw new Error('这个操作已失效，请重新选择');
  return a;
}
export function seeded(seed:number):()=>number {let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};}
export function shuffle<T>(items:T[],rng:()=>number):T[]{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function assertPlayers(players:Player[],min:number,max:number){if(players.length<min||players.length>max||new Set(players.map(p=>p.id)).size!==players.length)throw new Error(`需要 ${min}–${max} 位不同玩家`);}
