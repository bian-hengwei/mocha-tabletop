export const classicText:Record<string,string>={
 '听牌助手':'Tile helper','试算打出':'Preview discard','当前可自摸':'Self-draw available','当前可胡牌':'Win available','普通胡牌':'Discard win','仅自摸':'Self-draw only','打出此牌后未听牌':'No waits after this discard','当前未听牌':'No winning waits yet',
 '未见数 = 4 − 自己手牌及公开可见牌，可能在对手手中或牌墙内；0 张也保留显示。':'Unseen = 4 minus your own and publicly visible tiles. These may be in other hands or the wall; zero-count waits remain visible.',
 '倍数按本桌规则估算，按每位付款玩家计算；不含未来杠上花、抢杠及杠分。试算不会出牌。':'Multipliers follow this table’s rules, per paying player. Future kong bonuses and kong payments are excluded. Previewing does not discard a tile.',
 '玩家名':'Player','本轮得分':'Round score',
 '查看剩余手牌':'View remaining cards','剩余手牌':'Remaining cards','手牌':'Cards','手牌已出完':'All cards played','等待开始下一轮':'Waiting for the next round',

 '行动中':'Playing','座位方位':'Seat directions',
 '已胡牌：只打新摸牌':'Hand locked: discard only the drawn tile',
 '手牌可左右滑动':'Swipe to see your hand','滑动查看手牌':'Swipe hand',
 '出牌牌型':'Declare combination','牌型':'Type',
 '这组牌压不过上家':'Cannot beat the previous play','牌型不成立':'Not a valid combination',
 '本局和局':'Draw', '提示':'Hint',
 '斗地主':'Dou Dizhu','掼蛋':'Guan Dan','麻将':'Mahjong',
 '广东推倒胡':'Guangdong Push Down','四川血战':'Sichuan Blood Battle','血流成河':'Blood Flow','红中赖子':'Red Dragon Wild','麻将玩法':'Mahjong variant','可碰、杠，不吃牌':'Pung and kong, no chow',
 '小王':'Small joker','大王':'Big joker','单张':'Single','对子':'Pair','三张':'Triple','三带一':'Triple + single','三带二':'Triple + pair','顺子':'Straight','连对':'Consecutive pairs','飞机':'Airplane','飞机带单':'Airplane + singles','飞机带对':'Airplane + pairs','四带二':'Four + two singles','四带两对':'Four + two pairs','炸弹':'Bomb','王炸':'Rocket','四大天王':'Four jokers','三连对':'Three pairs','钢板':'Two triples','同花顺':'Straight flush',
 '春天 ×2':'Spring ×2','抗贡':'Tribute cancelled','叫分':'Bid','不叫':'Pass bid','还贡':'Return tribute','出牌':'Play','不出':'Pass','叫地主':'Landlord bidding','出牌阶段':'Playing','进贡还贡':'Tribute exchange','轮到你了':'Your turn','等待其他玩家操作':'Waiting for another player','无人叫分，重新发牌':'No bids; redealing','牌型无效或无法压过上一手':'Invalid combination or cannot beat the previous play',
 '万':'Characters','筒':'Dots','条':'Bamboo','东':'East','南':'South','西':'West','北':'North','白板':'White','发财':'Green','红中':'Red',
 '流局结算：查花猪、查大叫、未听退杠':'Wall settlement: missing-suit penalties, readiness payments and kong refunds','牌墙已空，本局结束':'Wall empty; game over','自摸':'Self-draw','胡牌':'Win','换三张':'Exchange three','选择同一花色的三张牌，交给下家':'Choose three same-suit tiles to pass clockwise','选择定缺':'Choose missing suit','过':'Pass','碰':'Pung','杠':'Kong','打出':'Discard','暗杠':'Concealed kong','补杠':'Added kong','选择一门花色，本局优先打完':'Choose the suit you must discard first','等待碰杠胡响应':'Waiting for claim responses','换三张需要相同花色':'Exchange tiles must share a suit',
 '双副牌 · 对家合作':'Two decks · Partner teams','经典叫分 · 三人局':'Classic bidding · Three seats','余牌':'Wall','级牌':'Level','轮次':'Round','底分':'Base','张':'cards','地主':'Landlord','农民':'Farmer','队伍':'Team','缺':'Missing','已胡牌':'Won','名次':'Place','出牌区':'Played cards','每人依次叫 1–3 分或不叫':'Take turns bidding 1–3, or pass','自由领出，选择一组手牌':'Free lead: select a combination','底牌':'Bottom cards','两队级数':'Team levels','红桃级牌为逢人配':'Heart-level cards are wild',
 '公共牌池':'Public tiles','抢杠响应':'Robbing a kong','最新打出':'Latest discard','红中可代替任意牌；不能碰杠红中':'Red dragons are wild; no pung or kong on red dragons','牌河':'Discards','副露':'Meld','我的手牌':'My hand','同花色三张':'Three tiles of one suit','选择还贡牌':'Choose a return card','已选':'Selected','可以确认':'Ready to confirm','请调整选牌':'Adjust your selection','确认换牌':'Confirm exchange','确认还贡':'Return card','无可压过的牌':'No higher play','清空选择':'Clear selection','血流继续：手牌已锁定，只打新摸牌，可再次胡牌':'Blood Flow continues: hand locked; discard only the drawn tile and win again later','胡牌记录':'Win history'
};
export const classicPatterns:[RegExp,string,number[]?][]=[[/^听 1 种 · 未见 (\d+) 张$/,'1 tile type · $1 unseen'],[/^听 1 种$/,'1 tile type'],[/^听 (\d+) 种 · 未见 (\d+) 张$/,'$1 tile types · $2 unseen'],[/^听 (\d+) 种$/,'$1 tile types'],[/^未见 (\d+) 张$/,'$1 unseen'],[/^(.+) · (自摸|胡牌) · \+(\d+)$/,'$1 · $2 · +$3',[2]],[/^(.+) → (.+) · ([♠♥♣♦](?:[2-9]|10|J|Q|K|A)|小王|大王)$/,'$1 → $2 · $3',[3]],[/^(.+) · (单张|对子|三张|三带一|三带二|顺子|连对|飞机|飞机带单|飞机带对|四带二|四带两对|炸弹|王炸|四大天王|三连对|钢板|同花顺)$/,'$1 · $2',[2]],[/^(.+) · ([1-9][万筒条]|东|南|西|北|白板|发财|红中)$/,'$1 · $2',[2]],[/^升级 \+(\d+)$/,'Level gain +$1'],[/^(\d+)(万|筒|条)$/,'$1 $2',[2]]];
