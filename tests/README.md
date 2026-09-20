# 测试

所有命令均在仓库根目录运行，使用 Node.js 22+。

## 每次提交的检查

```sh
npm ci
npm run check
```

这会运行 Vitest 单元测试、Worker 类型检查和前端生产构建。GitHub Actions 使用相同命令，并运行 Chromium 的首次进入、语言切换、规则与九款游戏入口回归。单元测试覆盖规则、隐藏信息、房间选项与配对；它们不依赖在线服务或浏览器。

## 浏览器与联机回归

先按根目录 README 启动 Worker（8787）和 Vite（5174）。安装浏览器：

```sh
npx playwright install chromium webkit
# Linux 环境可能还需要系统依赖：npx playwright install --with-deps chromium webkit
```

按修改范围选择回归：

| 命令 | 验证范围 |
| --- | --- |
| `node tests/ui/identity-portraits.integration.mjs` | 12 个身份 × 6 种尺寸，完整插画、相邻角色遮罩、关闭可达性、长记录和旋转；支持 WebKit |
| `node tests/ui/illustrated-games.integration.mjs` | 寿司/商旅/接龙双语插画、牌面数值与手机/桌面尺寸 |
| `node tests/ui/word-privacy.integration.mjs` | 秘密信息换座再切回隐藏、完整重开与词语游戏布局 |
| `node tests/ui/app-usability.integration.mjs` | 首次进入语言切换、原生语言名称、语言记忆、精确教程和多层弹窗键盘操作 |
| `node tests/ui/lobby-usability.integration.mjs` | 开局等待原因、访客只读规则、修改规则后重新准备和手机布局 |
| `node tests/ui/dialogs.integration.mjs` | 宝石、卡牌与秘密身份弹窗的焦点保护、Escape 和恢复 |
| `node tests/ui/language.integration.mjs` | 九款英文入口与双版本规则，检查未翻译文本 |
| `node tests/ui/i18n.integration.mjs` | 九款牌桌正文/无障碍标签英文检查、词库独立切换、确认出牌、私密 +4 核验与手机/短横屏 |
| `node tests/ui/uno-selection.integration.mjs` | 接龙选牌高亮/抬升/取消、确认出牌、万能选色、换座清理、质疑开关与双语三尺寸 |
| `node tests/ui/new-games.integration.mjs` | 寿司、香料、七彩接龙实际回合操作 |
| `node tests/ui/word-games.integration.mjs` | 两款词语游戏中英文终局与切换语言保留词面 |
| `node tests/ui/offline.integration.mjs` | 生产预览 5176 的缓存、断网重载及九款试玩 |
| `node tests/ui/install.integration.mjs` | 直接安装提示、取消/完成状态、iOS/桌面帮助与竖屏 |
| `node tests/ui/personal.integration.mjs` | 48 头像、身份保存、试玩恢复、战绩去重/删除、重置身份、存储禁用 |
| `node tests/ui/responsive.integration.mjs` | 320px 手机至桌面、短横屏、数字溢出、全部座位与操作可达性 |
| `node tests/ui/cards.integration.mjs` | 晶石商会、喵喵危机的实际界面操作 |
| `node tests/ui/gems-layout.integration.mjs` | 宝石牌桌布局 |
| `node tests/ui/bombs-table.integration.mjs` | 喵喵危机牌桌布局 |
| `node tests/ui/social.integration.mjs` | 月夜议会与迷雾远征界面 |
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

它覆盖实际页面、多人房间和缓存资源。离线导航由 Chromium 回归验证；WebKit 自动化不等同于真实 iPhone 的主屏幕安装和离线行为，这部分仍需真机检查。

语言选择器刻意使用目标语言的原生名称（中文 / English），不计为未翻译文案。首次昵称填写弹窗也提供语言切换。浏览器回归使用独立上下文，避免影响日常牌局。

如果默认端口已被其他工作副本占用，可以给新 Worker 指定其他端口和 inspector 端口，前端通过 `VITE_API_BASE` 连接它；前端来源仍须位于 `ALLOWED_ORIGINS`。网络回归的 `TEST_API_BASE` 必须与之保持一致。

WebKit 自动化环境可能无法建立本机 WebRTC ICE 连接；这不算 LAN 通过。此时应保留失败证据，并验证云端房间和 `lan-fallback.integration.mjs` 的回退路径。Chrome 的真实 LAN 测试仍须单独通过。
