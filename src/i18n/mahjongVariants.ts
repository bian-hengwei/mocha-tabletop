import {MAHJONG_RULES,MAHJONG_MODES,type MahjongMode} from '../core/mahjongModes';
import type {Guide} from '../ui/RuleGuide';
export const mahjongModeNotes:Record<MahjongMode,[string,string]>={
 guangdong:['136 张 · 无鬼 · 单局推倒胡','136 tiles · No wilds · One winning round'],
 laizi:['136 张 · 红中作赖子 · 单局推倒胡','136 tiles · Red Dragon wilds · One winning round'],
 sichuan:['108 张 · 同花色换三张 · 胡后离场','108 tiles · Exchange three of one suit · Winners leave'],
 bloodflow:['108 张 · 同花色换三张 · 可多次胡','108 tiles · Exchange three of one suit · Repeated wins'],
 bloodflowAny:['108 张 · 开局与牌墙任意换 · 可多次胡','108 tiles · Any opening exchange with the wall · Repeated wins'],
 bloodflowThree:['108 张 · 不限花色换三张 · 可多次胡','108 tiles · Exchange any three · Repeated wins'],
 redBloodflow:['114 张 · 六红中 · 任意换三张','114 tiles · Six Red Dragons · Exchange any three'],
 redBattle:['112 张 · 四红中 · 胡后离场','112 tiles · Four Red Dragons · Winners leave'],
 guangdongFan:['136 张 · 鸡平胡番表 · 可吃牌','136 tiles · Chicken-and-flat scoring · Chow allowed'],
 guangdongGhost:['翻一张定鬼 · 鸡平胡番表 · 可吃牌','Reveal an indicator · Chicken-and-flat scoring · Chow allowed']
};
export function mahjongVariantGuide(mode:MahjongMode,locale:'zh'|'en'):Guide{
 const r=MAHJONG_RULES[mode],zh=locale==='zh',sichuan=r.missing,gd=r.family==='guangdong',flow=r.family==='flow';
 const section=(title:string,enTitle:string,text:string[],enText:string[])=>({title:zh?title:enTitle,text:zh?text:enText});
 const sections:Guide['sections']=[section('牌组与开局','Tiles and opening',[
  mahjongModeNotes[mode][0]+'。四人一桌，东家为本局庄家；每次开桌打一局。',
  r.exchange==='none'?'不换牌、不定缺。庄家起手 14 张，其他人各 13 张。':r.exchange==='any'?'开局可选 0–14 张自己的手牌与牌墙交换，不限花色。四人全部确认后一起补入相同数量的新牌，再把换出的牌洗回牌墙；本次不会拿回任何一家刚换出的牌。':`${r.exchange==='sameThree'?'选同一花色的三张牌':'选任意花色的三张牌'}，四人确认后统一按开局随机选定的方向交换：下家、对家或上家。鬼牌不能换出。`,
  ...(sichuan?['换完牌再定缺万、筒、条中的一门。手里还有缺门时，必须先打缺门，清完后才可碰杠和胡牌；定缺全部完成前不公开其他人的选择。']:[])
 ],[
  mahjongModeNotes[mode][1]+'. Four players; East deals. Each new table plays one deal.',
  r.exchange==='none'?'No exchange or missing-suit choice. The dealer receives 14 tiles, others 13.':r.exchange==='any'?'Choose 0–14 tiles to exchange with the wall, without suit restrictions. Once all four confirm, receive equal-size replacements before the exchanged tiles return to the shuffled wall. Nobody redraws an outgoing tile in this exchange.':`Choose ${r.exchange==='sameThree'?'three tiles of one suit':'any three suited tiles'}. After all four confirm, everyone passes in the same randomly selected direction: next, opposite or previous seat. Wild tiles cannot be exchanged.`,
  ...(sichuan?['Then choose Characters, Dots or Bamboo as your missing suit. Discard it before other tiles and clear it before claiming melds or winning. Choices stay private until everyone has chosen.']:[])
 ])];
 if(r.ghost)sections.push(section('鬼牌怎么用','Using wild tiles',[
  mode==='guangdongGhost'?'开局从牌墙翻出一张指示牌；同花色下一点为鬼，9 回到 1。字牌按东、南、西、北、中、发、白循环。本局鬼牌会在牌桌顶部展示；指示牌留在桌上，不再参与摸打。':`红中作赖子，牌组里共有 ${r.redCount} 张红中。`,
  '鬼牌可以代替顺子、刻子或将需要的牌；不能用鬼牌凑吃碰杠，也不能胡别人打出的鬼。',
  mode==='laizi'?'本模式允许把红中作为普通弃牌打出，别人不能认领。':'鬼牌不能换出或直接打出。',
  ...(mode==='redBloodflow'?['采用六红中的任意换三张版本。新版发财选牌、红中单张开杠、无限换牌和复活道具属于其他玩法，不混入本模式。']:[])
 ],[
  mode==='guangdongGhost'?'Reveal one indicator from the wall. The next number in its suit is wild, with 9 wrapping to 1. Honors cycle East, South, West, North, Red, Green, White. The table shows the wild tile; the indicator stays out of play.':`Red Dragons are wild; this deck contains ${r.redCount}.`,
  'Wilds may complete runs, triplets or the pair, but cannot substitute in claimed melds. A discarded wild cannot be claimed to win.',
  mode==='laizi'?'This variant allows discarding a Red Dragon as an unclaimable tile.':'Wilds cannot be exchanged or discarded.',
  ...(mode==='redBloodflow'?['Uses the six-Dragon, any-three opening version. Newer Green Dragon selection, single-Dragon kongs, unlimited exchanges and revival items belong to other variants.']:[])
 ]));
 sections.push(section('吃碰杠与胡牌','Claims and winning',[
  gd?'可以吃上家的牌，也可以碰、明杠、暗杠和补杠。胡牌优先，其次碰杠，最后吃。':'可以碰、明杠、暗杠和补杠，不吃牌；手里的顺子仍可用于胡牌。胡牌优先于碰杠。',
  gd?'胡牌为四组顺子或刻子加一对将，或十三幺；此鸡平胡版本不采用七对。':'支持四组顺子或刻子加一对将、七对；四张相同可作两对。'+(!sichuan?'无赖子的十三幺也可以胡。':''),
  '允许一炮多响。补杠先等抢杠胡，没人胡才成杠并补摸；暗杠不被抢。暗杠牌面仅自己可见，终局才公开。',
  gd?'漏胡：放过某个牌值后，在自己下一次摸牌、吃、碰、杠前不能再胡同一牌值。':'过手胡：放过一次可胡的牌后，到自己下次摸牌前，只有基础胡分更高的点炮胡才可再胡。',
  flow?'第一次胡牌后保留 13 张等价手牌并锁定听口，不再碰杠；胡到的自摸牌单独收起，直接轮到下家。后续可以继续胡；不能胡的新摸牌可直接打出。':r.family==='battle'?'胡牌后退出本局，后续摸打和付款跳过该玩家；三家胡牌或牌墙摸完时结算。':'一轮胡牌响应结束后结算本局，其他玩家不再继续摸打。'
 ],[
  gd?'Chow from the previous player, pung, exposed/concealed/added kong. Wins take priority, then pung/kong, then chow.':'Pung and exposed/concealed/added kongs are allowed; chow is not. Runs in your concealed hand still count toward a win. Wins take priority over melds.',
  gd?'Four sets and a pair, or thirteen orphans. This chicken-and-flat ruleset does not use seven pairs.':'Four sets and a pair, or seven pairs; a quad may count as two pairs.'+(!sichuan?' Natural thirteen orphans also wins.':''),
  'Multiple discard winners are allowed. An added kong waits for robbing decisions before it completes and draws a replacement. Concealed kongs cannot be robbed and their faces remain private until the deal ends.',
  gd?'After passing a winning value, you cannot win on that value again until you draw, chow, pung or kong.':'After passing a win, only a discard win with a higher base value is allowed until your next draw.',
  flow?'Your first win locks the equivalent 13-tile waiting hand; no further melds. A self-drawn winning tile is set aside, and play goes directly to the next seat. You may win again on later tiles; a non-winning drawn tile can be discarded.':r.family==='battle'?'Winners leave the deal and no longer draw, discard or pay. End after three winners or wall exhaustion.':'The deal ends after the winning response window resolves.'
 ]));
 sections.push(section('番型与结算','Patterns and payments',gd?[
  '采用腾讯 QQ 游戏公开鸡平胡番表：鸡胡 1、平胡 2、碰碰胡 4、混一色 4。普通牌型可加门风、东圈风、三元刻与自摸番，最多 8 分。',
  '特殊牌型取最高的一种，不再叠普通番：清一色/混碰 16，清碰/混幺九/小三元/小四喜 32，字一色/清幺九/大三元/大四喜/九莲宝灯/十三幺 64。',
  '杠上花、海底自摸、抢杠和一炮三响不足 8 分按 8 分；天胡、人胡、地胡不足 64 分按 64 分。普通点炮由放炮者支付，自摸由其他三家支付。抢杠按自摸，由被抢者包三家。',
  '十二张落地、最后一组大三元/大四喜的供牌者承担包自摸；十二张落地同一供牌者只包先成立的一家。点杠后的补牌自摸由放杠者包三家。这个版本不单独即时结杠分。',
  ...(r.ghost?['单鬼选项：无鬼胡牌按硬胡翻倍，普通番仍以 8 分封顶。']:[]),
  '本桌一次打一局，使用东圈风；不自动连庄、不买马，也不使用游戏币或道具。'
 ]:sichuan?[
  '基础牌型择一：平胡 1、碰碰胡 2、七对 4、金钩钓 4。金钩钓为已有四组副露、手里只剩一对将。',
  '叠加倍数：每一根（四张同值实体牌）×2，断幺九 ×2，清一色 ×4，将（全为 2/5/8）×4 且不再计断幺九，带幺九 ×4。按同一种完整拆牌方式计算，取分最高者。',
  '自摸 ×2、杠上花/杠上炮/抢杠 ×2、海底 ×2、天胡/地胡 ×32。此配置不设番数封顶。点炮者向每位胡者付款；自摸由其他仍在局者各付。',
  '直杠收放杠者 2 分；暗杠收各家 2 分；补杠收各家 1 分。抢杠成功不收杠分。杠上炮呼叫转移：这次杠收到的杠分再转付给胡牌者。',
  ...(mode==='redBloodflow'?['六红中额外番型：硬胡/连六/双同刻 ×2，三暗刻/一条龙/三连刻 ×4，全双刻/十二金钗 ×8，四连刻/四暗刻 ×16，一色双龙会/红中金钩钓 ×32，九莲宝灯 ×64。高级番不重复计算已包含的基础番，详细分解见胡牌记录。']:[]),
  '牌墙用完：花猪向每位已清缺门的在局玩家付 16；所有未听玩家（含花猪）向听牌者支付其最高基础胡分，并退还收到的杠分。已离场的血战玩家不参与；血流已胡者仍在局。'
 ]:[
  '推倒胡只判断成牌：基础 1 分，自摸 ×2；杠后胡或抢杠再 ×2。普通点炮由放炮者付款，自摸由其他三家各付。',
  '直杠由放杠者付 2；暗杠其他三家各付 2；补杠各付 1。牌墙空时保留杠分，不查叫。',
  '一轮胡牌后结束。想按番型做大牌，可选择广东做牌、血战或血流。'
 ],gd?[
  'Uses Tencent QQ Games’ published chicken-and-flat table: chicken 1, all sequences 2, all triplets 4, mixed one suit 4. Seat wind, East round wind, Dragon triplets and self-draw add doubles, capped at 8 for ordinary hands.',
  'Special hands select the highest base without ordinary bonuses: pure suit/mixed triplets 16; pure triplets/mixed terminals/little Dragons/little Winds 32; all honors/pure terminals/big Dragons/big Winds/nine gates/thirteen orphans 64.',
  'Kong replacement wins, last-tile self-draws, robbed kongs and triple discard wins pay at least 8. Heavenly, human and earthly wins pay at least 64. A discarder pays; on self-draw all three opponents pay. A robbed kong is paid as a self-draw entirely by its declarer.',
  'The player supplying the fourth exposed set, or completing big Dragons/big Winds, bears self-draw liability. For four-set exposure, one supplier covers only the first recipient. A win on an exposed kong’s replacement is covered by its supplier. There are no immediate kong payments.',
  ...(r.ghost?['Single-wild option: a hand without wilds receives the hard-win double; ordinary hands still cap at 8.']:[]),
  'One deal with East as round wind; no automatic dealer continuation, horses, game currency or items.'
 ]:sichuan?[
  'Choose one base: ordinary hand 1, all triplets 2, seven pairs 4, single-pair wait with four melds 4.',
  'Stacking multipliers: each root (four natural copies) ×2; all simples ×2; pure suit ×4; only 2/5/8 ×4, replacing simples; outside hand ×4. Score one coherent decomposition and choose the highest value.',
  'Self-draw ×2; kong replacement, kong discard or robbed kong ×2; last tile ×2; heavenly/earthly win ×32. This configuration has no fan cap. A discarder pays every winner; all active opponents pay on self-draw.',
  'Exposed kong: supplier pays 2. Concealed kong: each active opponent pays 2. Added kong: each pays 1. A robbed kong earns nothing. A winning discard after a kong transfers that kong’s income to the winner.',
  ...(mode==='redBloodflow'?['Six-Dragon bonuses: hard win/six-tile straight/twin triplets ×2; three concealed triplets/straight/consecutive triplets ×4; all-even triplets/three kongs ×8; four consecutive or concealed triplets ×16; twin dragons/Red Dragon single wait ×32; nine gates ×64. Included lower patterns are excluded; win history shows the breakdown.']:[]),
  'At wall exhaustion, a missing-suit holder pays 16 to each cleared active player. All non-ready players, including missing-suit holders, pay each ready player’s highest base value and refund kong income. Departed Blood Battle winners are exempt; Blood Flow winners remain active.'
 ]:[
  'Push Down uses a base of 1, doubled for self-draw and again for a kong-related win. A discarder pays; all three opponents pay on self-draw.',
  'Exposed kong: supplier pays 2; concealed kong: each opponent pays 2; added kong: each pays 1. Keep kong scores at wall exhaustion, without readiness penalties.',
  'End after one winning response window. Choose Guangdong scoring, Blood Battle or Blood Flow for pattern-based scoring.'
 ]));
 return{edition:zh?MAHJONG_MODES[mode]:mahjongModeNotes[mode][1],quick:[],sections};
}
