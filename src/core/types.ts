export type GameKind = 'gems' | 'bombs' | 'werewolf' | 'avalon' | 'sushi' | 'century' | 'uno' | 'codenames' | 'undercover';
export interface Player { id: string; name: string; avatar: string }
export interface GameOptions { werewolfMode?: 'standard' | 'judge' | 'deal'; moderatorID?: string; werewolfPreset?: 'auto' | 'hunter' | 'guard'; werewolfWin?: 'sides' | 'parity'; language?: 'zh' | 'en'; unoMode?: 'single' | 'match'; unoChallenge?: boolean }
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
  gems: {name:'晶石商会',min:2,max:4,color:'#73d7ba',tagline:'建立你的宝石王朝'},
  bombs: {name:'喵喵危机',min:2,max:5,color:'#ee9671',tagline:'好运，请留到最后一张'},
  werewolf: {name:'月夜议会',min:6,max:18,color:'#c7b4f2',tagline:'天黑了，谁还值得相信'},
  avalon: {name:'迷雾远征',min:5,max:10,color:'#ecc780',tagline:'王座之下，各怀秘密'},
  sushi: {name:'寿司小宴',min:2,max:5,color:'#f4ae9b',tagline:'选一口美味，传一手惊喜'},
  century: {name:'香料商旅',min:2,max:5,color:'#dfb675',tagline:'交换香料，经营你的商队'},
  uno: {name:'七彩接龙',min:2,max:10,color:'#8cb9e0',tagline:'最后一张，就是胜利的前奏'},
  codenames: {name:'密语行动',min:4,max:12,color:'#c7ab86',tagline:'一个线索，找到你的同伴'},
  undercover: {name:'异词同伴',min:3,max:12,color:'#b9acd9',tagline:'相似的词，不同的秘密'}
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
