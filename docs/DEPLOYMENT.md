# 部署

## 当前服务

| 用途 | 配置 |
| --- | --- |
| Pages 项目 | `mocha-tabletop-web` |
| 公共入口 | <https://mocha-tabletop-web.pages.dev/> |
| 自定义域名 | <https://mocha-tabletop.bianhengwei.com/> |
| Worker | `mocha-tabletop` |
| API | <https://mocha-tabletop.mocha-tabletop-web.workers.dev> |
| Durable Objects | `GameRoom` 保存房间，`RoomDirectory` 管理发现与配对 |

`pages.dev` 是 Pages 提供的项目地址，无需单独购买域名；项目保留时可以持续使用。前端 API 地址在 `.env.production` 中，构建时写入客户端，不属于密钥。

## 发布现有项目

在仓库根目录执行：

```sh
npm ci
npx wrangler login
npm run check
npm run deploy
```

也可以只发布对应部分：

```sh
npm run deploy:worker
npm run deploy:web
```

两条命令均会先构建。`scripts/build-sw.mjs` 根据实际构建文件生成带内容哈希的离线缓存清单；不要手工维护清单或提交 `dist/`。

发布后检查首页、添加到主屏幕的图标，以及两台设备创建和加入同一个云端房间。浏览器生产回归命令见 [测试说明](../tests/README.md)。

## 部署到自己的 Cloudflare 账户

1. 执行 `npx wrangler login`，再用 `npx wrangler whoami` 确认账户。
2. 修改 `wrangler.jsonc` 的 `account_id` 和 `name`。保留 `ROOMS`、`DIRECTORY` 绑定和首次创建 SQLite Durable Objects 的 `v1` migration。
3. 选择自己的 Pages 项目名，并修改 `package.json` 中 `deploy:web` 的 `--project-name`。使用 `npx wrangler pages project create <项目名> --production-branch main` 创建项目。
4. 执行 `npm run deploy:worker`，从输出中取得自己的 Worker HTTPS 地址，写入 `.env.production` 的 `VITE_API_BASE`。
5. 在 `wrangler.jsonc` 的 `ALLOWED_ORIGINS` 中填入自己的 Pages 来源和需要的自定义域名；本地开发可保留 localhost 项。来源只含协议和主机，不含路径或尾随斜杠。
6. 执行 `npm run check` 和 `npm run deploy`，让 Worker 使用新的来源配置，前端使用新的 API 地址。

现有项目升级时不要删除已经应用的 Durable Objects migration。新增状态迁移应采用新的 tag，并检查旧房间状态的读取逻辑。

如果需要自定义域名，在 Pages 项目中绑定，并按控制台提示配置 DNS。自定义域名不是运行游戏的前提。

## 配置边界

- `.env.production`、项目名和账户 ID 是公开配置；登录令牌、`.dev.vars` 和 `.env.local` 不应提交。
- 前端采用 HTTPS；跨来源 API 请求由 Worker 的允许来源列表校验。
- 局域网房间仍通过 Worker 完成首次配对，不能把“局域网”理解为完全不需要后端。
- 本仓库的 GitHub Actions 只验证构建和测试。发布由维护者运行 CLI，仓库不需要保存 Cloudflare 令牌。

## 管理上传表情

`/admin/reactions` 提供管理员登录、上传草稿、静态预览和上架/下架。上传一次配置完成后不需要修改代码或重新部署。内置奶牛仍随应用发布；上传表情通过动态目录加载，云端和局域网房间均由 Worker 验证已上架状态。

首次启用需要一个专用的私有 R2 bucket 和 Worker secret。默认配置不创建 R2 资源，未配置时管理接口返回 503，内置表情照常使用。先确认账户已经开通 R2、所选 bucket 和当前计费，再在 `wrangler.jsonc` 添加绑定：

```json
"r2_buckets": [
  { "binding": "REACTION_ASSETS", "bucket_name": "<existing-private-bucket>" }
]
```

使用 `npx wrangler types` 重新生成本地绑定类型，并通过 `npx wrangler secret put REACTION_ADMIN_TOKEN` 的交互输入配置至少 32 字符的随机凭据。不要使用房间密码、昵称或可猜口令；不要将凭据放入 URL、前端变量或仓库。该命令会更新线上 Worker，按正常发布流程协调首次启用和后续轮换。生产配置完成后按本页发布流程部署前后端。

管理员打开 `/admin/reactions`，输入凭据，选择 GIF/PNG 和一张不带动画的 PNG 预览，填写中英文名称并保存草稿，检查预览后点击上架。每张图片上限 2 MiB、1024 × 1024；最多保存 100 个自定义表情。静态预览用于减少动态效果。登录仅保留于当前页面内存，刷新或退出后需要重新输入。下架会撤销公共图片访问和新发送权限；已下载的图片无法从用户设备撤回。

目录保存在 `reactions/catalog.json`，更新使用 R2 ETag 条件写入防止覆盖并发更新。素材使用独立随机 ID，草稿仅管理员可读取。上传资源不加入 service worker 缓存，离线使用内置表情；不要公开整个 bucket，否则会绕过草稿和下架的访问限制。后端写入和读取由绑定完成，不向浏览器暴露 R2 凭据。
