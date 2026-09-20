# 测试

所有命令均在仓库根目录运行，使用 Node.js 22+。

## 每次提交的检查

```sh
npm ci
npm run check
```

这会运行 Vitest 单元测试、Worker 类型检查和前端生产构建。GitHub Actions 使用相同命令。单元测试覆盖规则、隐藏信息、房间选项与配对；它们不依赖在线服务或浏览器。

## 浏览器与联机回归

先按根目录 README 启动 Worker（8787）和 Vite（5174）。安装浏览器：

```sh
npx playwright install chromium webkit
# Linux 环境可能还需要系统依赖：npx playwright install --with-deps chromium webkit
```

按修改范围选择回归：

| 命令 | 验证范围 |
| --- | --- |
| `node tests/ui/install.integration.mjs` | 名称、图标、横竖屏安装说明 |
| `node tests/ui/cards.integration.mjs` | 宝石商人、炸弹猫的实际界面操作 |
| `node tests/ui/gems-layout.integration.mjs` | 宝石牌桌布局 |
| `node tests/ui/bombs-table.integration.mjs` | 炸弹猫牌桌布局 |
| `node tests/ui/social.integration.mjs` | 狼人杀与阿瓦隆界面 |
| `node tests/ui/social-hosted.integration.mjs` | 狼人杀法官、发身份界面 |
| `node tests/ui/social-max.integration.mjs` | 最大人数的身份和座位布局 |
| `node tests/ui/social-modes.integration.mjs` | 从首页进入狼人杀不同模式 |
| `node tests/network/cloud.integration.mjs` | 云端加入、权限与房间指令 |
| `node tests/network/discovery.integration.mjs` | 房间发现 |
| `node tests/network/lan.integration.mjs` | WebRTC 直连与断线行为 |
| `node tests/network/client-terminal.integration.mjs` | 客户端退出及终止状态 |
| `node tests/network/werewolf-options.integration.mjs` | 狼人杀模式切换和联机流程 |
| `node tests/network/werewolf-capacity.integration.mjs` | 狼人杀人数与法官席位 |

浏览器测试默认使用 Playwright 安装的 Chromium。需要本机 Chrome 时可设置 `CHROME_PATH`；支持双引擎的脚本可以用 `TEST_BROWSER=webkit` 切换。界面脚本用 `BASE_URL` 指定前端地址，网络浏览器脚本用 `TEST_FRONTEND`，纯 API 脚本使用 `TEST_API_BASE`。具体脚本支持的变量见文件开头。

截图和报告输出到被 Git 忽略的 `test-results/` 或 `tests/ui/artifacts/`。HTML / TSX fixture 是测试入口，需要保留；生成的截图不需要提交。

## 生产构建回归

该脚本连接真实服务并创建测试房间，应对自己维护的部署运行：

```sh
BASE_URL=https://mocha-tabletop-web.pages.dev node tests/ui/production.integration.mjs
TEST_BROWSER=webkit BASE_URL=https://mocha-tabletop-web.pages.dev node tests/ui/production.integration.mjs
```

它覆盖实际页面、多人房间和缓存资源。离线导航由 Chromium 回归验证；WebKit 自动化不等同于真实 iPhone 的主屏幕安装和离线行为，这部分仍需真机检查。
