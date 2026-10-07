/** Gamewright Sushi Go Party! (2016), base box. See docs/SUSHI_PARTY.md. */
export const SUSHI_ROLLS=['maki','temaki','uramaki'] as const;
export const SUSHI_APPETIZERS=['tempura','sashimi','dumpling','eel','tofu','onigiri','edamame','miso'] as const;
export const SUSHI_SPECIALS=['chopsticks','soy','tea','menu','spoon','order','takeout','wasabi'] as const;
export const SUSHI_DESSERTS=['pudding','icecream','fruit'] as const;
export interface SushiMenu {roll:typeof SUSHI_ROLLS[number];appetizers:typeof SUSHI_APPETIZERS[number][];specials:typeof SUSHI_SPECIALS[number][];dessert:typeof SUSHI_DESSERTS[number]}
export const DEFAULT_SUSHI_MENU:SushiMenu={roll:'maki',appetizers:['tempura','sashimi','dumpling'],specials:['chopsticks','wasabi'],dessert:'pudding'};
export const SUSHI_MENU_NAMES:Record<string,string>={nigiri:'握寿司',maki:'寿司卷',temaki:'手卷',uramaki:'反卷',tempura:'天妇罗',sashimi:'刺身',dumpling:'饺子',eel:'鳗鱼',tofu:'豆腐',onigiri:'饭团',edamame:'毛豆',miso:'味噌汤',chopsticks:'筷子',soy:'酱油',tea:'茶',menu:'菜单',spoon:'勺子',order:'特别点单',takeout:'打包盒',wasabi:'芥末',pudding:'布丁',icecream:'抹茶冰淇淋',fruit:'水果'};
export function validateSushiMenu(input:unknown,players?:number):SushiMenu{
 const m=input as SushiMenu;
 if(!m||typeof m!=='object'||Array.isArray(m)||Object.keys(m).some(k=>!['roll','appetizers','specials','dessert'].includes(k))||!SUSHI_ROLLS.includes(m.roll)||!SUSHI_DESSERTS.includes(m.dessert)||!Array.isArray(m.appetizers)||m.appetizers.length!==3||new Set(m.appetizers).size!==3||m.appetizers.some(v=>!SUSHI_APPETIZERS.includes(v))||!Array.isArray(m.specials)||m.specials.length!==2||new Set(m.specials).size!==2||m.specials.some(v=>!SUSHI_SPECIALS.includes(v)))throw new Error('菜单需选 1 种卷、3 种前菜、2 种特殊牌和 1 种甜点');
 if(players===2&&(m.appetizers.includes('edamame')||m.specials.includes('spoon')))throw new Error('两人局不能使用毛豆或勺子');
 if(players&&players>=7&&(m.specials.includes('menu')||m.specials.includes('order')))throw new Error('七至八人局不能使用菜单或特别点单');
 return structuredClone(m);
}
export type ExtraSushiKind='temaki'|'uramaki3'|'uramaki4'|'uramaki5'|'eel'|'tofu'|'onigiriCircle'|'onigiriTriangle'|'onigiriSquare'|'onigiriRectangle'|'edamame'|'miso'|'soy'|'tea'|'menu'|'spoon'|'order'|'takeout'|'icecream'|'fruitWW'|'fruitOO'|'fruitPP'|'fruitWO'|'fruitWP'|'fruitOP';
export const PARTY_INFO:Record<ExtraSushiKind,{title:string;symbol:string;detail:string}>={
 temaki:{title:'手卷',symbol:'🍙',detail:'最多 +4，最少 −4；两人局不扣分'},
 uramaki3:{title:'反卷 · 3',symbol:'🍥',detail:'先达 10 卷：8 / 5 / 2 分'},uramaki4:{title:'反卷 · 4',symbol:'🍥',detail:'先达 10 卷：8 / 5 / 2 分'},uramaki5:{title:'反卷 · 5',symbol:'🍥',detail:'先达 10 卷：8 / 5 / 2 分'},
 eel:{title:'鳗鱼',symbol:'🐟',detail:'1 张 −3；2 张以上 7 分'},tofu:{title:'豆腐',symbol:'◻',detail:'1 张 2 分；2 张 6 分；3 张以上 0 分'},
 onigiriCircle:{title:'饭团 · 圆形',symbol:'●',detail:'不同形状一组：1 / 4 / 9 / 16 分'},onigiriTriangle:{title:'饭团 · 三角',symbol:'▲',detail:'不同形状一组：1 / 4 / 9 / 16 分'},onigiriSquare:{title:'饭团 · 方形',symbol:'■',detail:'不同形状一组：1 / 4 / 9 / 16 分'},onigiriRectangle:{title:'饭团 · 长方形',symbol:'▬',detail:'不同形状一组：1 / 4 / 9 / 16 分'},
 edamame:{title:'毛豆',symbol:'🫛',detail:'每张按其他有毛豆的玩家数计分，最多 4 分'},miso:{title:'味噌汤',symbol:'🥣',detail:'3 分；同一手出现多张时全部弃掉'},
 soy:{title:'酱油',symbol:'🫙',detail:'牌面颜色种类最多时，每张 4 分'},tea:{title:'茶',symbol:'🍵',detail:'每张按本轮最大同色组的张数计分'},
 menu:{title:'菜单',symbol:'📜',detail:'抽 4 张选 1 张，不能选菜单；余牌洗回'},spoon:{title:'勺子',symbol:'🥄',detail:'后续一手索取指定牌，交换给左侧首位持有者'},order:{title:'特别点单',symbol:'✦',detail:'复制自己本轮已打出的 1 张牌'},takeout:{title:'打包盒',symbol:'🍱',detail:'翻转任意此前打出的牌，每张改计 2 分'},
 icecream:{title:'抹茶冰淇淋',symbol:'🍨',detail:'三轮后，每 4 张得 12 分'},
 fruitWW:{title:'水果 · 西瓜 ×2',symbol:'🍉🍉',detail:'每种水果 0–5 个：−2 / 0 / 1 / 3 / 6 / 10 分'},fruitOO:{title:'水果 · 橙子 ×2',symbol:'🍊🍊',detail:'每种水果 0–5 个：−2 / 0 / 1 / 3 / 6 / 10 分'},fruitPP:{title:'水果 · 菠萝 ×2',symbol:'🍍🍍',detail:'每种水果 0–5 个：−2 / 0 / 1 / 3 / 6 / 10 分'},fruitWO:{title:'水果 · 西瓜 + 橙子',symbol:'🍉🍊',detail:'每种水果 0–5 个：−2 / 0 / 1 / 3 / 6 / 10 分'},fruitWP:{title:'水果 · 西瓜 + 菠萝',symbol:'🍉🍍',detail:'每种水果 0–5 个：−2 / 0 / 1 / 3 / 6 / 10 分'},fruitOP:{title:'水果 · 橙子 + 菠萝',symbol:'🍊🍍',detail:'每种水果 0–5 个：−2 / 0 / 1 / 3 / 6 / 10 分'}
};
