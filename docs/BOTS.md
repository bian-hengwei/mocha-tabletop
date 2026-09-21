# 房间人机 / Room bots

斗地主、掼蛋、麻将、晶石商会、喵喵危机、寿司小宴、香料商旅、七彩接龙支持人机。准备室中由房主添加或移除人机，并为每个席位选择简单、普通或困难。至少保留房主这一位真人；真人与人机合计遵守原有游戏人数限制，一个真人可以将所有剩余席位加为人机，也可以和朋友混合组桌。点击空座“＋”，选择邀请朋友或简单、普通、困难人机。

Doudizhu, Guan Dan, Mahjong, Crystal Guild, Kitten Chaos, Sushi Social, Spice Caravan and Color Dash support bots. The host clicks an empty seat’s “+” to invite a friend or add an Easy, Normal or Hard bot. One human can fill every remaining seat with bots. Existing bots can be removed or have their difficulty changed in the lobby. At least one human host is required. Humans and bots together must satisfy the game's existing player limits.

月夜议会、迷雾远征、密语行动、异词同伴依赖自由交流，不提供人机。带有人机的房间切换到这些游戏前须先移除人机。更换人机或难度后，其他真人需要重新准备；进行中的牌局不能增删人机或调整难度。返回准备后保留人机和难度配置。

Moonlit Council, Mistbound Quest, Secret Signals and Odd Word Out require free-form conversation and do not support bots. Remove bots before switching to one of these games. Changes to bots or difficulty reset human readiness. Bot settings remain fixed during a game and are retained when returning to the lobby.

## 单人人机 / Solo vs bots

在游戏开局页的“单机游玩”中选择总人数与难度，再点击“单人人机”。第一席由你操作，所有剩余席位使用同一难度；固定人数游戏会显示规则要求的人数。同屏试玩仍可独立选择人数并切换座位，交流类游戏仅提供此模式。月夜议会的总人数包含法官席位（如启用）。

Choose a total player count and difficulty under Local play, then select Solo vs bots. You control the first seat; all other seats use the selected difficulty. Fixed-count games show their required count. Pass & play remains available with a player-count selector and seat switching; discussion games offer this local mode only. Moonlit Council's total includes the moderator when enabled.

首次完成资源缓存后，两种单机模式均可离线游玩。刷新恢复及终局重开保留人数、难度和规则；单人人机只显示你的视图，战绩单独标记。轮间确认与人机重试沿用房间人机的操作。

Both local modes work offline after assets are cached. Reloading and replaying preserve player count, difficulty and rules. Solo renders only your seat's view and labels its results separately. Between-round confirmation and bot retry work as in room games.

## 决策与恢复 / Decisions and recovery

人机使用本地策略，不调用付费模型服务。简单侧重基础合法操作，普通使用手牌与资源估值，困难增加组合、目标及公开对手信息的分析。这些级别是策略强度选项，不承诺固定胜率。任何级别都只使用该席位的过滤视图，不读取其他玩家的秘密牌、未公开身份或牌堆顺序，也不修改规则与发牌概率。

Bots run built-in policies without an external model service. Easy favors basic legal choices, Normal evaluates hands and resources, and Hard adds combination, goal and public-opponent analysis. Levels do not guarantee a fixed win rate. Every level receives only its seat's filtered view; it cannot inspect other hands or the deck, and it uses the same rules and deals as humans.

云端由房间的 Durable Object 执行、保存和广播每一步人机操作；闹钟与房间过期及连接清理共用一个持久调度。局域网由房主设备执行并保存，机器人不建立伪造的 WebRTC 连接。真人掉线时暂停；恢复后继续同一席位与牌局。局域网转云端沿用已有状态。人机执行故障会显示重试入口，不自动跳过回合或重发牌。

Cloud rooms execute and persist bot turns in their authoritative Durable Object. LAN rooms execute and save them on the host device, without artificial WebRTC peers for bots. Human disconnection pauses progress. Reconnection and explicit LAN-to-cloud transfer preserve the match. A failed bot turn exposes a retry action instead of skipping turns or redealing.

人机席位没有用户登录凭据。房间控制只接受已认证的真人身份；人机 ID 使用保留命名空间。客户端不能借添加人机获得其他席位的视图。带人机的终局战绩单独标记，不计入纯真人联机胜场统计。

Bot seats have no login credential and use a reserved ID namespace. Adding a bot never grants its private view to a client. Results involving bots are labeled and excluded from the human multiplayer win summary.

规则范围与来源继续以 [规则版本说明](RECOGNIZABLE-RULES.md) 和 [经典游戏说明](CLASSIC-GAMES.md) 为准。人机不会改变寿司三轮、掼蛋升级过 A、七彩接龙累计 500 分等终局目标；轮间结算由真人确认下一轮；轮到人机确认时，由房主继续。

Rule versions and sources remain documented in [RECOGNIZABLE-RULES.md](RECOGNIZABLE-RULES.md) and [CLASSIC-GAMES.md](CLASSIC-GAMES.md). Bots preserve full match goals, including three Sushi rounds, Guan Dan through Ace and Color Dash to 500 points. Humans confirm between-round score screens; when a bot owns the continuation, the host continues on its behalf.
