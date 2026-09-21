# 测试

所有命令均在仓库根目录运行，使用 Node.js 22+。

## 每次提交的检查

```sh
npm ci
npm run check
```

这会运行 Vitest 单元测试、Worker 类型检查和前端生产构建。GitHub Actions 使用相同命令，并运行 Chromium 的首次进入、语言切换、规则与十二款游戏入口回归。单元测试覆盖规则、隐藏信息、房间选项与配对；它们不依赖在线服务或浏览器。

## 浏览器与联机回归

先按根目录 README 启动 Worker（8787）和 Vite（5174）。安装浏览器：

```sh
npx playwright install chromium webkit
# Linux 环境可能还需要系统依赖：npx playwright install --with-deps chromium webkit
```

按修改范围选择回归：

| 命令 | 验证范围 |
| --- | --- |
| `node tests/ui/classic-assets.integration.mjs` | 90 张本地牌面/底板/背面与三张封面解码，大小王颜色映射；支持 WebKit |
| `node tests/ui/classic-orientation.integration.mjs` | 六种新玩法，中英文九种尺寸、手牌滚动到末张、44px 触控与旋转保留选择；支持 WebKit |
| `node tests/ui/table-layout.integration.mjs` | 麻将四方座位/牌河、换座方位盘、对手仅背面、斗地主出牌方向与叫分/不出标记；中英八尺寸，支持 WebKit |
| `node tests/ui/classic-dense.integration.mjs` | 密集牌河与副露、血流锁牌、记录弹窗焦点与旋转；支持 WebKit |
| `node tests/ui/classic-cloud.integration.mjs` | 四个独立浏览器上下文，全部麻将模式、访客只读规则、刷新重连和两款扑克云端出牌；可对实际部署运行 |
| `node tests/ui/poker-declaration.integration.mjs` | 掼蛋同花顺默认解释与手动宣告普通顺子；27 张手牌领出/跟牌、双语八尺寸、牌型弹窗旋转与焦点、清空重选及实际出牌；支持 WebKit |
| `node tests/ui/poker-feedback.integration.mjs` | 掼蛋级牌与斗地主跟牌：区分无效牌型和无法压过、改选后正常出牌；满手牌且无法压过时按钮文字完整、无需纵向滚动并实际不出；双语八尺寸与旋转，支持 WebKit |
| `node tests/ui/classic-games.integration.mjs` | 六种新玩法，中英文四尺寸、点选/取消/换座、刷新恢复、扑克完整一轮与跨轮进贡；支持 WebKit |
| `node tests/ui/mahjong-experience.integration.mjs` | 麻将双击/双触、键盘与慢速取消、定缺及自动过牌；中英七尺寸，支持 WebKit |
| `node tests/ui/hand-experience.integration.mjs` | 寿司单张双击/双触、筷子顺序与取消锁定；商旅固定操作区；猫牌换选/组合与双击；中英八尺寸，支持 WebKit |
| `node tests/ui/uno-experience.integration.mjs` | UNO 双击/双触、万能牌选色、28 张单行手牌、10 人座位、八尺寸与旋转，支持 WebKit |
| `node tests/ui/mahjong-actions.integration.mjs` | 麻将确定性场景：自摸、血流继续、暗杠、抢杠、胡优先、碰与流局；支持 WebKit |
| `node tests/network/message-text.integration.mjs` | 真实 Worker 的结构化姓名、投票公开时机、私密狼队计划与断线重连；使用 TEST_API_BASE |
| `node tests/network/classic-games.integration.mjs` | 六种玩法的真实 Worker WebSocket 指令、私密视图、幂等与重连 |
| `node tests/ui/language.integration.mjs` | 十二款英文入口与双版本规则，检查未翻译文本 |
| `node tests/ui/identity-portraits.integration.mjs` | 14 个身份 × 10 种尺寸，完整插画、相邻角色遮罩、关闭可达性、长记录和旋转；支持 WebKit |
| `node tests/ui/illustrated-games.integration.mjs` | 寿司/商旅/接龙双语插画、牌面数值与手机/桌面尺寸 |
| `node tests/ui/word-privacy.integration.mjs` | 秘密信息换座再切回隐藏、完整重开与词语游戏布局 |
| `node tests/ui/setup-selection.integration.mjs` | 固定人数标签、开桌模式选中状态、固定关闭/创建按钮、键盘/指针操作、中英七尺寸与弹窗旋转；支持 WebKit |
| `node tests/ui/header-controls.integration.mjs` | 十二款游戏从首页进入试玩，检查顶部控件可见、无遮挡、44px 触控范围及长昵称；中英七尺寸与旋转，支持 WebKit |
| `node tests/ui/app-usability.integration.mjs` | 首次进入语言切换、原生语言名称、语言记忆、精确教程和多层弹窗键盘操作 |
| `node tests/ui/player-names.integration.mjs` | 中英昵称与系统术语隔离：座位、秘密情报、法官面板、选人及真实库存弹窗；支持 WebKit |
| `node tests/ui/action-sheet.integration.mjs` | 最新操作与失效选项、数量范围、错误恢复、取消、竖屏十人完整选项、短横屏可见翻页，以及真实投票昵称和牌面词确认；中英七尺寸与旋转，需 Vite，支持 WebKit |
| `node tests/ui/pwa-update.integration.mjs` | 独立临时 HTTP 服务上的真实 Service Worker 升级、安装等待、旧缓存清理、断网资源与 API 不缓存；Chromium，无需启动应用服务 |
| `node tests/ui/history-names.integration.mjs` | 历史记录、附近房主及离线名单在中英切换后保留原名；本地模拟网络；支持 WebKit |
| `node tests/ui/profile-input.integration.mjs` | 中英昵称输入：输入法候选确认不提前提交，普通回车保存、关闭及刷新记忆；支持 WebKit |
| `node tests/ui/dialog-boundaries.integration.mjs` | 安装说明焦点约束、背景不可交互、旋转和关闭后焦点恢复；帮助内容滚到底部仍可关闭，中英七尺寸触控范围；输入法 Escape/Tab 不触发弹窗快捷键；支持 WebKit |
| `node tests/ui/finished-recovery.integration.mjs` | 玩家离线或刷新后仍可查看终局结果与记录，未结束的新局仍暂停；本地模拟消息，中英七尺寸，支持 WebKit |
| `node tests/ui/storage-boundaries.integration.mjs` | 存储区属性不可读时首屏、临时身份及标签页恢复入口可用；恢复 socket 在测试内拦截，不连接真实房间；支持 WebKit |
| `node tests/ui/lobby-usability.integration.mjs` | 开局等待原因、访客只读规则、修改规则后重新准备和手机布局 |
| `node tests/ui/lobby-layout.integration.mjs` | 狼人杀长规则、入桌申请的房间与昵称提示、待审批请求的中英七尺寸旋转、取消申请后刷新不再自动申请、按钮触控、实际批准/准备/开局；需要本地 Worker，支持 WebKit |
| `node tests/ui/dialogs.integration.mjs` | 宝石、卡牌与秘密身份弹窗的焦点保护、Escape 和恢复；支持 WebKit |
| `node tests/ui/i18n.integration.mjs` | 九款牌桌正文/无障碍标签英文检查、词库独立切换、确认出牌、私密 +4 核验与手机/短横屏 |
| `node tests/ui/uno-selection.integration.mjs` | 接龙选牌高亮/抬升/取消、确认出牌、万能选色、换座清理、质疑开关与双语三尺寸 |
| `node tests/ui/new-games.integration.mjs` | 寿司、香料、七彩接龙实际回合操作 |
| `node tests/ui/word-games.integration.mjs` | 两款词语游戏中英文终局、全部词卡分页与切换语言保留词面；支持 WebKit |
| `node tests/ui/offline.integration.mjs` | 生产预览 5176 的缓存、断网重载及十二款试玩 |
| `node tests/ui/install.integration.mjs` | 直接安装提示、取消/完成状态、iOS/桌面帮助与竖屏 |
| `node tests/ui/personal.integration.mjs` | 48 头像、身份保存、试玩恢复、战绩去重/删除、重置身份、存储禁用 |
| `node tests/ui/responsive.integration.mjs` | 320px 手机至桌面、短横屏、数字溢出、全部座位与操作可达性 |
| `node tests/ui/cards.integration.mjs` | 晶石商会、喵喵危机的实际界面操作，遍历所有市场层级；支付摘要在中英八尺寸与旋转后可见，取消恢复库存且不购买；支持 WebKit |
| `node tests/ui/gems-layout.integration.mjs` | 宝石牌桌布局 |
| `node tests/ui/bombs-table.integration.mjs` | 喵喵危机牌桌布局 |
| `node tests/ui/social.integration.mjs` | 月夜议会单次闭眼、女巫阶段等待与迷雾远征直接投票、座位操作；支持 WebKit |
| `node tests/ui/social-hosted.integration.mjs` | 月夜议会法官、发身份界面 |
| `node tests/ui/social-max.integration.mjs` | 最大人数的身份和座位布局 |
| `node tests/ui/social-modes.integration.mjs` | 从首页进入月夜议会不同模式 |
| `node tests/network/cloud.integration.mjs` | 云端加入、权限与房间指令 |
| `node tests/network/discovery.integration.mjs` | 房间发现 |
| `node tests/network/lan-fallback.integration.mjs` | 直连失败后的明确提示与手动云端回退，支持 Chromium/WebKit |
| `node tests/network/lan.integration.mjs` | WebRTC 直连与断线行为 |
| `node tests/network/client-terminal.integration.mjs` | 客户端退出及终止状态 |
| `node tests/network/werewolf-options.integration.mjs` | 月夜议会模式切换和联机流程 |
| `node tests/network/werewolf-capacity.integration.mjs` | 月夜议会人数与法官席位 |

浏览器测试默认使用 Playwright 安装的 Chromium。需要本机 Chrome 时可设置 `CHROME_PATH`；支持双引擎的脚本可以用 `TEST_BROWSER=webkit` 切换。界面脚本用 `BASE_URL` 指定前端地址，网络浏览器脚本用 `TEST_FRONTEND`，纯 API 脚本使用 `TEST_API_BASE`。具体脚本支持的变量见文件开头。

截图和报告输出到被 Git 忽略的 `test-results/` 或 `tests/ui/artifacts/`。HTML / TSX fixture 是测试入口，需要保留；生成的截图不需要提交。

## 生产构建回归

该脚本连接真实服务并创建测试房间，应对自己维护的部署运行：

```sh
BASE_URL=https://mocha-tabletop-web.pages.dev node tests/ui/production.integration.mjs
TEST_BROWSER=webkit BASE_URL=https://mocha-tabletop-web.pages.dev node tests/ui/production.integration.mjs
```

它覆盖九款游戏的真实多人房间、断线恢复、三种狼人模式和缓存资源。可用 `TEST_GAMES=gems,bombs,avalon,undercover` 选择补充浏览器的联机场景；默认运行全部，未知或空的场景名称会在创建房间前报错。连续验收应遵守每 IP 每 10 分钟最多创建 15 个房间的限制，本地大批量测试可以使用独立的 Wrangler `--persist-to` 临时目录。离线检查等待已激活的页面控制器及当前页面所需缓存资源，而非仅统计缓存条数。离线导航由 Chromium 回归验证；WebKit 仅验证控制器和缓存资源，因为测试环境中的最小独立 Service Worker 也无法通过模拟断网导航。真实 iPhone 的主屏幕安装和离线行为仍需真机检查。针对联机的单独复测可设置 `TEST_SKIP_OFFLINE=1`，输出会明确标记跳过。

## 独立副本验收

避免占用已有服务，可运行 `npm run worker:dev -- --port 8794 --var ALLOWED_ORIGINS:http://127.0.0.1:5184 --persist-to .wrangler/classic-test` 与 `MOCHA_DEV_API=http://127.0.0.1:8794 npm run dev -- --port 5184 --strictPort`。测试分别设置 `BASE_URL` / `UI_BASE_URL` / `TEST_FRONTEND=http://127.0.0.1:5184`、`TEST_API_BASE=http://127.0.0.1:8794`。新脚本也支持默认开发端口。

所有云端测试都会真实创建测试房间。服务保留每个来源十分钟内最多 15 次建房的限制；批量本地回归需分批执行，或停止仅供测试的 Worker 后换用新的 `--persist-to` 测试目录。不要关闭生产限流。

语言选择器刻意使用目标语言的原生名称（中文 / English），不计为未翻译文案。首次昵称填写弹窗也提供语言切换。浏览器回归使用独立上下文，避免影响日常牌局。

如果默认端口已被其他工作副本占用，可以给新 Worker 指定其他端口和 inspector 端口，前端通过 `VITE_API_BASE` 连接它；前端来源仍须位于 `ALLOWED_ORIGINS`。网络回归的 `TEST_API_BASE` 必须与之保持一致。

WebKit 自动化环境可能无法建立本机 WebRTC ICE 连接；这不算 LAN 通过。此时应保留失败证据，并验证云端房间和 `lan-fallback.integration.mjs` 的回退路径。Chrome 的真实 LAN 测试仍须单独通过。

- `tests/ui/werewolf-lineups.integration.mjs`：四种固定板型的中英选择、角色配比、三模式、独立身份插画、刷新后重开保留规则（支持 TEST_BROWSER=webkit）。
- `tests/ui/proactive-new-games.integration.mjs`：手机付款/升级操作无需滚动、短横屏商人市场逐卡可达、UNO无可出牌时抽牌优先、寿司确认状态；中英八尺寸，支持 WebKit。
- `tests/ui/word-usability.integration.mjs`：异步拒绝保留线索、成功清空、隐藏词后准备、投票和发言进度。

输入法回归使用浏览器 DOM 键盘事件覆盖 `isComposing` 和兼容性的 `keyCode=229` 路径，随后用真实键盘事件验证普通 Enter/Escape；这不等同于系统输入法真机验收。事件边界依据 [MDN 的 IME 键盘事件说明](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event#keydown_events_with_ime)。

网络延迟回归：`TEST_GAMES=century TEST_ACTION_DELAY_MS=600 TEST_SKIP_OFFLINE=1 BASE_URL=http://127.0.0.1:5174 node tests/ui/production.integration.mjs`。对真实 Worker 的回包延迟 600ms，验证提交中阻止后续操作，并在回包后继续升级/结束回合；也支持 WebKit。

- `tests/ui/gems-viewport.integration.mjs`：晶石商会中英八尺寸无纵向滚动、全部市场层级、费用完整、牌面查看、宝石银行可见翻页、选择时布局稳定、实际拿取及库存入口；支持 WebKit。
- `tests/ui/gems-results.integration.mjs`：晶石商会真实 App 的四人终局分数、已购牌/贵族数量及同分胜者，双语八尺寸、结束时清除选择、结算收起/重开、刷新和新局恢复；使用本地模拟 WebSocket，支持 WebKit。
- `tests/ui/century-results.integration.mjs`：商旅真实 App 的五人终局分数、订单/金币/银币数量及同分胜者，房主/访客双语八尺寸、结算收起/重开、刷新、三人末轮目标及新局恢复；使用本地模拟 WebSocket，支持 WebKit。
- `tests/ui/uno-sushi-viewport.integration.mjs`：寿司与七彩接龙中英七尺寸，公共区及手牌无纵向滚动、28 张手牌与溢出滑动提示、最大人数密集盘面逐张可达、选色、报单、私人质疑核验、筷子选牌/取消；支持 WebKit。 另检查真实 App 的五人寿司总分、逐轮与布丁明细、结算收起/重开及旋转。

- `tests/ui/social-viewport.integration.mjs`：双语八尺寸、狼人三模式座位分页和阿瓦隆十席同屏、规则入口、身份隐藏、法官选择、直接表决与任务提交及按钮文字边界；支持 WebKit。
- `tests/ui/social-app-viewport.integration.mjs`：真实 App 在中英八尺寸下的默认及最大人数、阿瓦隆全席同屏、表决/任务按钮文字边界、终局公开身份、结算关闭与重开；支持 WebKit。

- `tests/ui/century-viewport.integration.mjs`：商旅双语八尺寸，市场/订单/商队/已用商人切换、费用完整、末张牌横向可达、付款、五人密集手牌与空手牌说明；订单详情显示香料名称及所需/持有/差额，覆盖可交单、材料不足、等待回合、旋转、Escape 与焦点恢复；支持 WebKit。
- `tests/ui/game-viewport.integration.mjs`：按注册表遍历十二款游戏，最大人数、中英八尺寸，检查页面和所有桌面容器没有纵向滚动或内容裁剪；配合各游戏的状态/操作测试及实际截图验收，不能单独代表完整游戏流程。
- `tests/ui/bombs-viewport.integration.mjs`：喵喵危机中英八尺寸、最大五人，初始/选牌/响应/目标/索要/交牌/预知/拆弹/插入/结束十种状态，所有容器纵向溢出与裁切检查；出牌自动确认、直接否决/反制及其余玩家重新响应；预知时手牌不响应选择、私密换座隐藏及查看结束后恢复选牌；支持 WebKit。

- `tests/ui/guandan-results.integration.mjs`：真实 App 配合模拟房间回包，四人本轮/全场结算、名次/队伍/本轮得分/余牌、54 张公开剩余牌详情、房主/访客双语八尺寸、旋转和焦点、下一轮/重开、刷新及新局手牌恢复；支持 WebKit。
