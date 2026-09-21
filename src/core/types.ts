export type GameKind = 'gems' | 'bombs' | 'werewolf' | 'avalon' | 'sushi' | 'century' | 'uno' | 'codenames' | 'undercover' | 'doudizhu' | 'guandan' | 'mahjong';
export interface Player { id: string; name: string; avatar: string; bot?: {difficulty: import('./bots/types').BotDifficulty} }
export interface GameOptions { mahjongMode?: 'guangdong' | 'sichuan' | 'bloodflow' | 'laizi'; werewolfMode?: 'standard' | 'judge' | 'deal'; moderatorID?: string; werewolfPreset?: 'auto' | 'hunter' | 'guard' | 'classic9' | 'classic' | 'idiot' | 'wolfKing'; werewolfWin?: 'sides' | 'parity'; language?: 'zh' | 'en'; unoMode?: 'single' | 'match'; unoChallenge?: boolean }
export interface Choice { id: string; title: string; subtitle?: string; /** False for literal player names and dealt words. */ translateTitle?:boolean }
export interface Action { id: string; title: string; choices: Choice[]; min: number; max: number; help?: string }
/** Strings in values are literal data; only templates are localized. */
export interface GameText {template:string;values?:Record<string,string|GameText|(string|GameText)[]>}
export interface Item { id: string; title: string; detail?: string; detailText?:GameText; symbol?: string }
export interface Section { id: string; title: string; items: Item[]; private?: boolean }
export interface GameView {
  kind: GameKind; phase: string; instruction: string; finished: boolean;
  actions: Action[]; sections: Section[]; log: string[]; logText?:Record<number,GameText>;
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
export const GAMES: Record<GameKind, { name: string; min: number; max: number; color: string }> = {
  doudizhu: {name:'斗地主',min:3,max:3,color:'#e8b77c'},
  guandan: {name:'掼蛋',min:4,max:4,color:'#dca2a0'},
  mahjong: {name:'麻将',min:4,max:4,color:'#8fcab5'},
  gems: {name:'晶石商会',min:2,max:4,color:'#73d7ba'},
  bombs: {name:'喵喵危机',min:2,max:5,color:'#ee9671'},
  werewolf: {name:'月夜议会',min:6,max:18,color:'#c7b4f2'},
  avalon: {name:'迷雾远征',min:5,max:10,color:'#ecc780'},
  sushi: {name:'寿司小宴',min:2,max:5,color:'#f4ae9b'},
  century: {name:'香料商旅',min:2,max:5,color:'#dfb675'},
  uno: {name:'七彩接龙',min:2,max:10,color:'#8cb9e0'},
  codenames: {name:'密语行动',min:4,max:12,color:'#c7ab86'},
  undercover: {name:'异词同伴',min:3,max:12,color:'#b9acd9'}
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
export function assertPlayers(players:Player[],min:number,max:number){if(players.length<min||players.length>max||new Set(players.map(p=>p.id)).size!==players.length)throw new Error(`需要 ${min===max?min:`${min}–${max}`} 位不同玩家`);}
