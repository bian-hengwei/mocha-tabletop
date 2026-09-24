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

`/admin/reactions` 提供管理员登录、上传草稿、静态预览、上架/下架和确认删除。上传一次配置完成后不需要修改代码或重新部署。内置奶牛仍随应用发布；上传表情通过动态目录加载，云端和局域网房间均由 Worker 验证已上架状态。

存储使用 `REACTIONS` 绑定的 SQLite Durable Object `ReactionCatalog`，由 `v2-reactions` migration 创建，不需要 R2 或新增付款方式。部署前确认账户仍为 Workers Free；该计划额度耗尽后相关操作失败，不自动转为付费。表情与联机功能共享账户额度，可能同时受限；若以后主动升级为付费计划，适用该计划的计费规则。参见 [DO 定价与免费限制](https://developers.cloudflare.com/durable-objects/platform/pricing/)。

首次启用需设置独立的 Worker secret `REACTION_ADMIN_TOKEN`（至少 32 字符，建议密码生成器生成 64 位随机十六进制字符串）。通过 `npx wrangler secret put REACTION_ADMIN_TOKEN` 安全输入，不写入源码、前端环境变量或公共配置；该命令会部署新版本。未配置凭据时管理接口返回 503，内置表情照常使用。保管凭据，仅分享给管理员；需要撤销访问时更换该 secret。

管理员打开 `/admin/reactions`，输入凭据，选择 GIF/PNG 和一张不带动画的 PNG 预览，填写中英文名称并保存草稿，检查预览后点击上架。每张图片上限 2 MiB、1024 × 1024；最多保存 100 个自定义表情，可确认删除误传或不再使用的素材以释放名额。静态预览用于减少动态效果。登录仅保留于当前页面内存，刷新或退出后需要重新输入。下架会撤销公共图片访问和新发送权限；已下载的图片无法从用户设备撤回。

目录与图片保存在专用 `catalog-v1` 对象内，图片分成 64 KiB SQLite 行。更新使用版本比较和同步事务，避免并发覆盖；上传、目录变更与删除原子提交，失败不会留下半份目录或孤立图片。素材使用独立随机 ID，草稿仅管理员可读取。上传资源不加入 service worker 缓存，离线使用内置表情；存储通过内部绑定访问，不向浏览器暴露存储凭据。
