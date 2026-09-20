# 熟悉的玩法与原创展示

本轮以九款已上线游戏为范围。游戏名、插画、配色、故事与词库保留 Mocha 自己的表达；操作名称使用玩家能直接理解的功能词。规则、牌数、费用、分值和胜负条件不为改名而调整。底层游戏、角色和行动 ID 保持兼容，旧房间与试玩存档无需重开。

## 展示原则

- 首页和建房面板直接说明怎样玩、怎样赢，不再只用气氛标语。
- 猫牌使用「爆炸牌、拆弹、攻击、跳过、索取、洗牌、预知三张、否决」。猫咪组合牌仍用原创的月亮猫、云朵猫等名称。牌面、按钮、提示、规则与日志采用一致的功能词；旧存档的手牌按稳定的 `kind` 显示。
- 远征继续叫「迷雾远征」，身份展示为先知、守望者、伪先知、刺客、远征队员与暗影同伴。规则和身份页解释各自知道什么、能做什么。英文采用 Seer / Watcher / False Seer / Assassin。
- 狼人角色使用通用的 Werewolf / Villager / Seer / Witch / Hunter / Guard / Fool / Wolf King；密语危险牌显示为刺客 / Assassin。寿司、宝石、香料、颜色和词语游戏继续使用直观的食物、资源与操作名称。
- 中文旧称、旧日志和旧角色 ID 保留翻译兼容。新版、旧版日志的正则分别匹配，避免为了替换术语而改写玩家姓名。

## 规则版本与逐项核对

核对日期：2026-09-20。以下来源用于核对规则与数值，应用内说明为自行编写，未加入官方卡面、标志或规则书扫描件。

| 游戏 | 明确的规则范围 | 核对项目与回归 |
| --- | --- | --- |
| 晶石商会 | Splendor 基础版 | 90 张发展牌与 10 贵族；2/3/4 人各色筹码 4/5/7，黄金 5；拿取、预留、支付、10 枚容量、贵族、15 分末轮与同分比较。`cards.test.ts` 的独立牌表、守恒和完整牌局。 |
| 喵喵危机 | Exploding Kittens Original Edition 2025 规则，启用两张与三张组合 | 7 普通牌 + 1 拆弹起手；N−1 爆炸；额外两张拆弹（5 人时一张）；功能牌 4/4/4/4/5/5，五种猫咪各 4。逐个完成攻击叠加、跳过、索取、洗牌、预知、否决链、组合、拆弹放回和淘汰。`cards.test.ts`、`recognizable-rules.test.ts`、猫牌完整 UI 牌局。此版不含旧版五张不同牌回收弃牌，不启用快速删牌变体。 |
| 月夜议会 | 中文常见狼人桌规，保留并展示本桌选项 | 自动与灵活人数配置、固定九人预女猎、十二人预女猎白/预女猎守/狼王守卫、屠边/人数胜利；女巫不可自救、守救同死、毒死猎人不开枪、警长 1.5 票。三种主持方式与 6–18 人边界见 `werewolf-presets.test.ts`、`werewolf-hosted.test.ts` 和 `social.test.ts`。该类游戏没有覆盖所有版本的统一规则。 |
| 迷雾远征 | Avalon 基础任务，加入 Percival 与 Morgana 角色组合 | 5–10 人阵营和任务人数、过半通过、连续五否决、7 人起第四任务双失败、三成功后刺杀。`social.test.ts`、`game-identities.test.ts`、`recognizable-rules.test.ts`。不启用其他角色或湖中仙女。 |
| 寿司小宴 | Sushi Go! 108 张基础版 | 2–5 人每轮 10/9/8/7 张；三轮向左传牌、筷子、芥末顺序、料理组合、卷寿司排名分配、布丁及双人例外、同分布丁比较。`new-games.test.ts`、`new-games-boundary.test.ts` 与完整 UI 操作。 |
| 香料商旅 | Century: Spice Road 基础版 | 43 商人、36 订单独立数据对照；初始资源、付费招募、任意次交易、逐级升级、10 容量、金币转银币、5/6 订单末轮及后手破同分。`century-catalog.test.ts`、`century-playthrough.test.ts` 和 `new-games.test.ts`。 |
| 七彩接龙 | UNO 经典 108 张规则；默认累计 500 分与 +4 质疑 | 7 张起手、开局功能牌、同色/同数/同功能、只出刚摸的牌、罚牌后跳过、无叠加、+4 私密核验、漏喊罚 2、末张罚牌计分、双人反转。`uno-full-rules.test.ts`、`new-games.test.ts`。单轮和关闭质疑是建房时明确选择的模式。 |
| 密语行动 | Codenames 双队基础桌游规则 | 25 格、9/8 特工、7 路人、1 刺客；一词加数字、至少一猜、数字加一、0/不限、错猜换队、刺客立即输、违规线索补偿及密钥隐私。`word-games.test.ts`。词库为原创；含义、复合词与非语言暗示由双方按规则判断。 |
| 异词同伴 | 相近词「平民/卧底」桌规，不启用白板 | 3–6/7–10/11–12 人配 1/2/3 少数者、依次描述、秘密投票、平票辩护复投、再次平票无人出局、少数达到人数平衡获胜。`word-games.test.ts`。不同商业版本的身份与胜负条件不同，当前配置完整列在规则中。 |

原始规则来源：

- [Splendor 出版方规则](https://cdn.svc.asmodee.net/production-spacecowboys/uploads/2025/10/SCSPL01EN_SPLENDOR_RULES_LIGHT.pdf)
- [Exploding Kittens 规则入口](https://www.explodingkittens.com/pages/rules-kittens)与[2025 英文规则](https://cdn.shopify.com/s/files/1/0345/9180/1483/files/ekoe-instructions-english.pdf?v=1743802429)
- [Avalon 出版方验证规则](https://rules.dized.com/game/rZluqS52QmGdpoVxcmVLtg/the-resistance-avalon)，包括角色替换、任务与刺杀章节
- [Gamewright Sushi Go!](https://www.gamewright.com/product/Sushi-Go)；[出版方 2014 规则镜像](https://s3.amazonaws.com/ai-assets/weymouth/sushigotm-rules_1381_orig.pdf)
- [Century 出版方基础规则](https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Century-Spice-Road-Rules_2024_compressed.pdf)，独立牌表来源见 [ASSETS.md](ASSETS.md)
- [Mattel 108 张 UNO 产品与规则入口](https://m.service.mattel.com/us/Technical/productDetail?prodno=W2085)；[英文规则](https://service.mattel.com/instruction_sheets/W2085-Eng.pdf)
- [CGE Codenames](https://www.czechgames.com/games/codenames)；[原版规则镜像](https://cdn.1j1ju.com/medias/89/5e/99-codenames-rule.pdf)。采用桌游规则，不以手机 App 的放宽线索规则替代。
- 相近词游戏变体差异见 [WORD-GAMES.md](WORD-GAMES.md)，狼人具体配置见 [WEREWOLF-OPTIONS.md](WEREWOLF-OPTIONS.md)。

## 狼人角色与板型对照

稳定 ID 与中文名称来自 `src/core/werewolfPresets.ts`，英文由应用翻译入口显示。旧角色 ID 不因新增板型或调整英文术语而变化。下表「角色规则」指上面的网易公开规则；「赛事板型」指 WPL 配置表。

| 内部 ID | 中文展示 | 英文展示 | 规则功能与来源 |
| --- | --- | --- | --- |
| `wolf` | 狼人 | Werewolf | 夜间与狼队共同选择袭击目标；角色规则。 |
| `villager` | 平民 | Villager | 无夜间技能，白天发言与投票；角色规则。 |
| `seer` | 预言家 | Seer | 夜间查验一人的好人/狼人阵营；角色规则。 |
| `witch` | 女巫 | Witch | 一次解药、一次毒药，同夜一瓶、不可自救；角色规则。 |
| `hunter` | 猎人 | Hunter | 被刀、放逐或狼王枪击可开枪；被毒不可开枪；角色规则。 |
| `guard` | 守卫 | Guard | 保护一人免受普通狼刀，不可连续两夜同守；角色规则。 |
| `idiot` | 白痴 | Fool | 被放逐时翻牌存活，失去投票权，非放逐伤害仍会死亡；角色规则，赛事标准场称「愚者」。 |
| `wolfKing` | 狼王 | Wolf King | 属于狼队，出局可开枪，被猎人带走可继续开枪，被毒不能开枪；角色规则与赛事板型。不是自爆带人的白狼王。 |

| 板型 ID | 固定配置 / 人数范围 |
| --- | --- |
| `classic9` | 9 人：3 狼人、3 平民、预言家、女巫、猎人。沿用本桌九人预女猎配比。 |
| `idiot` | 12 人：4 狼人、4 平民、预言家、女巫、猎人、白痴。对应赛事标准场四狼、四民、四神。 |
| `classic` | 12 人：4 狼人、4 平民、预言家、女巫、猎人、守卫；普通四狼桌规。 |
| `wolfKing` | 12 人：3 狼人、1 狼王、4 平民、预言家、女巫、猎人、守卫。对应公开规则与赛事狼王守卫。 |
| `auto` | 6–18 人：狼人为人数除以三向下取整；固定预言家与女巫，8 人起加猎人，12 人起加守卫，其余平民。 |
| `hunter` / `guard` | 8–18 人：按人数分配狼人、平民，神职固定为预女猎或预女守。保留旧选项，不把灵活板型冒称固定标准板型。 |

法官不参与身份发牌，固定九人、十二人板型在法官模式分别需要 10、13 个房间座位。仅发身份模式保留同样配置，技能与胜负由现场主持。

以下细节是明确展示的 **Mocha 本桌约定**，不声称适用于所有 App：白痴放逐时自动翻牌，之后不能再成为放逐对象，持有警徽时直接销毁且不能接收警徽；狼王自爆不触发开枪，最后一狼死亡后立即判好人胜利，不追加狼王枪。其他待结算的猎人/狼王连锁枪先于后续流程，猎人枪仍保留既有胜负判断顺序。狼王板型的开枪标题和公共日志不公开枪手究竟是猎人还是狼王。毒药压制开枪，包括同一夜同时被刀和被毒；警上自爆的角色不能在天亮重复结算为夜间死亡后重新获得枪。

## 数字界面的处理

否决与漏喊使用全员确认窗口，避免实时计时延迟决定是否错失响应；任务票和选牌保持同时揭晓。身份与牌堆仍由引擎过滤后交给各玩家。更换名字没有改变指令权限、状态结构、费用或胜负算法。

`tests/recognizable-rules.test.ts` 另核对基础组件数量、任务人数、默认比赛规则、新旧术语翻译和旧牌局恢复。引擎翻译测试现在调用实际应用翻译入口，避免测试另一套简化翻译器而漏掉真实界面问题。

## 本轮验收记录

- 合入 main 的新版插画后，`npm run check`：22 个测试文件、298 项测试通过，Worker 类型检查和生产构建通过。
- Chrome：九款中英文入口、九款英文牌桌、手机/短横屏/桌面布局、猫牌三局完整流程、寿司三轮、接龙单轮及累计分、香料操作、两款词语终局、狼人和远征完整流程通过；新增插画、身份隐私与重开隐私回归通过。
- WebKit：首次进入、语言保存、九款英文入口/规则、弹窗和移动布局通过；Chrome 实际 WebRTC 与 WebKit 直连失败后的明确云端回退通过。
- 七组网络回归通过；真实页面创建九款多人房间、重连恢复、三种狼人模式、六组狼人规则配置以及访客规则同步通过。
- 生产构建的断网重载、九款试玩、封面与新版卡面缓存通过。自动化 WebKit 不代表 iPhone 主屏幕安装的真机验收。
