# 中式棋牌桌规

新增斗地主、掼蛋和麻将；均使用现有云端、WebRTC 局域网与同屏试玩通道。无自动代打、现金、金币或强制倒计时。每款游戏在界面内提供中英文快速入门和完整规则，以下是开发与版本边界。

## 斗地主

三人、54 张，每人 17 张，地主得到三张公开底牌。顺序叫 1/2/3 分，须高于前一叫分；3 分立即确定地主，全员不叫则重洗并轮换起叫者。

支持单、对、三张、三带单/对、顺子、连对、飞机及其单/对翼、四带二、四带两对、炸弹、王炸。2 与王不能进入连续主体；单翼可成对，但不允许用主体的第四张作翼或同时带大小王；对翼须不同点数。四带牌不按炸弹计算。两人连续不出清空当前牌组。提示提供合法出法，选牌后仍需确认。

地主先出完则地主胜，否则两位农民共同获胜。炸弹/王炸与春天/反春天分别翻倍；地主输赢两份，每位农民一份，总分为零。单轮即结算，不含加倍竞叫与癞子扩展。

## 掼蛋

固定四人，隔座为队友，双副牌共 108 张，每人 27 张。两队从 2 开始各保留自己的等级，下一轮打上一轮赢家的等级。红桃级牌在组合中为逢人配，可代非王牌；单出时仍为级牌。

普通牌为单、对、三、三带对、恰五张顺子、恰三连对、恰两组连三张。炸弹从四张起；四王最高，六张以上炸弹高于同花顺，同花顺高于四炸/五炸。同型同张数比点数；级牌在连续组合里按自然数字，A 可低可高但不能 K-A-2 环绕。选牌可能有多种合法解释，界面允许明确宣告，服务端重新核验；默认使用最强合法解释。

头游方按对家为第二、第三或末位升 3/2/1 级，最多升到 A。必须实际打 A 并拿到头游且对家不末位才完成比赛。双上立即结算，其余两名按座次记录；贡牌分配仍按实际贡牌大小。

进贡由系统选出非红桃级牌的最大牌。双贡时大贡给头游，等大按从头游顺时针座次分配。受贡者选择非级牌且不大于 10 的牌还贡；若无此类牌则可还任意牌。单贡者/大贡者先出；贡方合持两张大王可抗贡，由上轮头游先出。贡牌和还贡牌公开。上家出完后无人接牌时，由仍持牌的对家接风。

不包含固定轮数锦标赛或三次冲 A 失败降级。界面分数为当轮升数，最终队伍胜负进入个人战绩。

## 麻将

四人、单局、东家先出，不吃牌，不使用花牌。四个预设如下：

| 模式 | 牌组 | 开局 | 胡牌后 |
| --- | --- | --- | --- |
| 广东推倒胡 | 136 张，含字牌 | 普通发牌 | 该响应窗口内所有胡者结算后结束 |
| 四川血战 | 108 张序数牌 | 同花色换三张给下家、定缺 | 胡者离场，三家胡或牌墙空结束 |
| 血流成河 | 108 张序数牌 | 同上 | 锁定手牌继续，仅打新摸牌，可重复胡，牌墙空结束 |
| 红中赖子 | 136 张，红中万能 | 普通发牌 | 同广东；红中不碰杠，不胡别人打出的红中 |

标准胡形为四组加一对；支持闭门七对（四张同点可作两对）和无赖子的十三幺。赖子可补将、顺子、刻子与七对，不用于抢红中。

每次弃牌或补杠后，引擎自动为没有合法碰、杠、胡机会的在局对手提交「过」；其他座位仍手动选择响应或过。全员无可选响应时立即继续摸牌或结算，不依赖客户端在线计时器。旧存档中已经打开的响应窗口仍接受原合法响应，并在下一次有效操作后自动补齐强制过牌。响应选择对其他玩家不可见。胡优先，支持一炮多响；无胡时，碰杠按从出牌者顺时针最近者处理。暗杠牌面隐藏；补杠先开抢杠窗口，被抢只扣第四张，原碰不变；牌墙空时禁止杠。血流第一次胡后不再碰杠，防止改变锁定听牌手。

计分为 Mocha 聚会桌规：基础 1；七对 ×2、清一色 ×4、碰碰胡 ×2，基础封顶 16。碰碰胡按当前手牌点数分组判断，不做复杂多解番型择优。自摸及杠后/抢杠各 ×2，最终每个付款者封顶 32。点炮者向每个胡者支付；自摸由其他在局者各付。直杠放杠者付 2；暗杠其余在局者各付 2；补杠各付 1。抢杠成功不收补杠分。

四川/血流牌墙空时，未清缺门者向每位已清缺门在局者支付 16；清缺未听者向每个听牌者付其最高基础胡分；未听者退还收到的杠分。血战已胡离场者不参与查叫/查花猪。广东/赖子流局只保留既有杠分。所有转账零和；最高正积分者胜，同分共享，零分全桌和局。

不包含买马、根、龙七对等扩展番、海底特殊番、过手胡限制或胡后杠等地方扩展。腾讯参考限于玩法组织、换三张/定缺及便捷手机操作的产品方向，不声称复刻腾讯某房间的完整规则，也不使用其素材。

## 实现与验证

- `poker.ts` 负责两款扑克，纯函数解析与比较牌型；指令验证后才修改克隆状态。
- `mahjong.ts` 负责牌型求解、各模式流程与零和结算。暗杠、换牌决定、响应、牌墙及他人手牌均由引擎视图过滤。
- 新模式进入房间选项的白名单，存档恢复再次核对玩法；沿用 actor revision 与 request ID 防止重放。
- 新增规则测试覆盖牌型边界、私密视图、牌张守恒、计分、完整掼蛋升级赛与序列化恢复。新 UI 脚本覆盖六种玩法的四尺寸双语操作以及麻将关键结算场景；联机脚本使用真实本地 Worker。

## 参考与取舍

[JJ 掼蛋规则](https://www.jj.cn/news/320/20120613160600024346.shtml)提供牌型、接风及进贡的参考，其中升级表与本项目不同，不能直接等同；本项目采用明示的 3/2/1 级桌规。[中国企业体育协会赛事规则附件](https://cesa.org.cn/res/file/%E4%BC%81%E4%BD%93%E5%87%BD%E3%80%942023%E3%80%9512%E5%8F%B7%E4%B8%AD%E5%9B%BD%E4%BC%81%E4%B8%9A%E4%BD%93%E8%82%B2%E5%8D%8F%E4%BC%9A%E6%8E%BC%E8%9B%8B%E4%B8%93%E4%B8%9A%E5%A7%94%E5%91%98%E4%BC%9A%E6%88%90%E7%AB%8B%E4%BB%AA%E5%BC%8F%E6%9A%A8%E2%80%9C2023%E4%B8%AD%E4%BC%81%E4%BD%93%E5%8D%8F%E6%8E%BC%E8%9B%8B%E9%82%80%E8%AF%B7%E8%B5%9B%E2%80%9D%E9%82%80%E8%AF%B7%E5%87%BD.pdf)可用于了解赛事语境，Mocha 不实现赛事裁判与处罚系统。

[小米游戏中心的腾讯麻将换三张介绍](https://game.xiaomi.com/viewpoint/1359077112_1634697725762_9)说明同花色换三张与血流胡后继续的玩法方向。地域规则存在差异，本项目实现与计分以上述表格及游戏内规则为准。

## 界面与牌面

麻将点选手牌后抬起，再点同一张牌打出；点桌面或按 Escape 取消。换三张仍需选满同花色三张后确认；定缺直接选择花色。可用的碰、杠、胡和过位于手牌右上方，合法性继续由引擎控制。

牌桌延续 Mocha 的墨绿桌面、象牙色牌面与低饱和金色反馈。所有手牌、出牌、副露、暗牌背面和结算展示均使用本地 SVG；牌面来自明确 CC0 授权的完整素材，来源见 [素材说明](ASSETS.md)；英文界面保留麻将的传统图案，辅助名称与控件按语言切换。

麻将手机竖屏以两行完整展示手牌，横屏和宽屏使用单行；新摸牌保留原 ID，移到显示顺序最右端并留出间距。旋转保留选择，换座和回合改变清空选择。独立的麻将布局为旋转牌面预留真实占位，副露与牌河分开。小屏桌面展示各家最近六张弃牌，宽屏展示最近十二张；点击牌河数量查看完整记录，支持换家、Escape 和关闭后焦点恢复。胡牌记录使用同样的弹窗交互。

出牌动画从公开牌河的新增牌计算，自动过牌后也能播放：由出牌方向移到中央展示，再落向对应牌河。不依赖仍在等待中的响应窗口，不延迟权威状态。初次加载和换座不重播旧牌；新局通过 match ID 重置。减少动态效果设置下保留静态牌面提示，不做位移动画。

布局参考公开截图中的“手牌位于底部、对手沿桌边、当前出牌居中、操作与牌面分离”层次：[欢乐麻将界面](https://game.xiaomi.com/viewpoint/1270322523_1686536294223_149)、[欢乐斗地主界面](https://game.xiaomi.com/viewpoint/1359077112_1683765830867_100)。仅参考信息组织，不复用代码、插画、标识或资源。

## Table presentation

Mahjong seats and discard rivers are positioned relative to the viewer: self at the bottom, next seat at the right, opposite above, previous seat at the left. Tile faces in the three opponents' rivers point toward their owners while names and counts remain upright. The central wind indicator rotates its labels with the selected seat; its number is the remaining wall count. Opponent racks contain only backs derived from public hand counts. The table shows recent discards; each river opens its complete public history. Portrait phones show a two-row hand, while landscape and larger screens use one row. The drawn tile sits at the end with a separate gap. Pung, kong, win and pass actions sit above the right side of the hand.

Dou Dizhu places bottom cards above the table, the viewer below and opponents at either side. The latest play moves toward the player who made it. Bid and pass labels use public authoritative state. Selection remains explicit: tap to select or deselect, then confirm; changing seat or turn clears stale selection. The shared Guan Dan rule handling is unchanged.

Layout references: Tencent's publisher listings for [Mahjong](https://apps.apple.com/cn/app/%E6%AC%A2%E4%B9%90%E9%BA%BB%E5%B0%86/id689180123) and [Dou Dizhu](https://apps.apple.com/cn/app/%E8%85%BE%E8%AE%AF%E6%AC%A2%E4%B9%90%E6%96%97%E5%9C%B0%E4%B8%BB/id446324234), reviewed September 20, 2026. These informed conventional table positioning only. Mocha retains its own jade-and-brass interface and the licensed card assets documented in `public/art/classic/SOURCES.json`.

Mahjong interaction and table-layout reference: [Tencent Happy Mahjong screenshots](https://game.xiaomi.com/viewpoint/1270322523_1686536294223_149), reviewed September 21, 2026. The reference informs spatial grouping and direct tile interaction; artwork and rules remain those documented above.
