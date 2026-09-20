# Mocha 桌游 · iPhone PWA

横屏桌游合集：宝石商人（2–4）、炸弹猫（2–5）、狼人杀（6–18）、阿瓦隆（5–10）。不用账号，昵称与头像仅保存在本机。首次加载并缓存完成后可离线进行同屏试玩。

## 使用

用 iPhone Safari 打开 **https://mocha-tabletop.bianhengwei.com**，点击首页“添加到 iPhone 主屏幕”查看步骤，再在 Safari 分享菜单中完成添加。横屏后进入游戏。首次填写昵称并选头像。

创建牌桌时选择同 Wi-Fi 或云端联机。邀请链接可直接入桌；输入房间码或发现附近牌桌时需房主同意。每位玩家准备后房主开局。

狼人杀有三种模式：玩家操作（6–18 人，各手机操作）；法官主持（1 法官 + 6–18 玩家，房主为法官不参牌，玩家只看身份）；只发身份（6–18 人，房主也参牌，后续线下进行）。法官模式的技能与现场投票结果由法官统一记录。

“附近”是相同公网出口的候选房间，不是浏览器扫描 Wi-Fi。Wi-Fi 模式通过 Cloudflare 配对，再用 WebRTC 在手机之间传输操作；不提供 TURN 中继，路由器隔离或 Safari 网络限制可能阻止直连。房主可明确切换到云端。断线时暂停，恢复后继续。关闭房主的 LAN 标签页可能丢失牌局，刷新同一标签页有本地恢复。

## 开发与部署

需要 Node.js 22+。以下命令在 `web/` 中执行。自己的部署需要更改 `.env.production` 中的公开 API 地址、`wrangler.jsonc` 中的账户 ID 与允许来源，再登录 Wrangler。

```sh
npm ci
npm run worker:dev
# 另一个终端
npm run dev
npm run check
npm run deploy:worker
npm run deploy:web
```

.env.production 只包含公开 URL，不含任何凭据。正式构建的公开 API 地址保存在 `.env.production`；本地默认代理到 8787。站点静态文件托管于 Cloudflare Pages，房间服务在 Cloudflare Workers 的 SQLite Durable Objects，启用 WebSocket 休眠。没有账号数据库、付费套餐或持续轮询任务。

Pages 项目：`mocha-tabletop-web`。Worker：`mocha-tabletop`。自定义域名：`mocha-tabletop.bianhengwei.com`，阿里云 CNAME → `mocha-tabletop-web.pages.dev`。该子域名指向 Pages。

旧入口以兼容方式保留。Cloudflare 在资源创建时生成的历史标识与审计记录不重写；主站、Worker、安装名称和代码均使用 Mocha。

注意：Wrangler 新版本的 `pages project create` 默认重定向为 Workers。本项目已有正式 Pages 项目，更新时运行 `deploy:web`，不要重复创建。

## 扩展游戏

1. 在 `src/core/games/` 实现 `GameModule`：`create`、`view`、`apply`。
2. `apply` 拒绝非法命令且不得修改输入；状态应能 JSON 往返保存。
3. `view` 返回该玩家可见的数据、合法操作和私密信息，绝不返回其他手牌或身份。
4. 在 `types.ts` 和 `registry.ts` 注册游戏，在 `ui/` 增加独立牌桌组件，在 `App.tsx` 接入。
5. 加入规则、隐私、序列化和实际浏览器交互测试。联网层无需复制规则实现。

引擎规则：[牌类游戏](docs/WEB-CARDS.md)、[社交游戏](docs/social-games.md)。网络协议与限制：[NETWORK.md](NETWORK.md)。图片来源和提示词：[初版封面](docs/ART.md)、[游戏美术](docs/ART-V2.md)、[Mocha 小狗图标](../design/README.md)。

## 验证

- `npm test`：牌库数值、完整随机对局、隐私隔离、非法操作、去重与多人同时投票。
- `node tests/network/cloud.integration.mjs`：实际 Durable Object 协议测试（可设置 `TEST_API_BASE`）。
- `node tests/network/lan.integration.mjs`：真实 Chromium WebRTC、断线重连、断开配对服务继续玩、云端交接。
- `node tests/ui/cards.integration.mjs`、`node tests/ui/bombs-table.integration.mjs`、`node tests/ui/social.integration.mjs`：通过页面控件完成多个规则阶段，两个 iPhone 横屏尺寸。
- `node tests/ui/production.integration.mjs`：正式房间、四款游戏、主屏幕清单和离线缓存。`TEST_BROWSER=webkit` 可用 Safari 引擎测试；`BASE_URL` 切换正式域名。

浏览器测试不等于物理 iPhone 的路由器、热点或锁屏验收。无法直连时请手动切换云端；PWA 后台不会保证手机持续联网。
