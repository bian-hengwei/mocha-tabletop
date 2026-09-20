<p align="center">
  <img src="public/mocha-icon-192.png" width="112" height="112" alt="小狗 Mocha 在玩桌游" />
</p>
<h1 align="center">Mocha 桌游</h1>
<p align="center">给朋友聚会用的手机桌游，打开浏览器就能玩。</p>
<p align="center">
  <a href="https://mocha-tabletop-web.pages.dev/">打开游戏</a> ·
  <a href="docs/DEPLOYMENT.md">部署说明</a> ·
  <a href="tests/README.md">测试说明</a>
</p>
<p align="center">
  <a href="https://github.com/bian-hengwei/mocha-tabletop/actions/workflows/ci.yml"><img src="https://github.com/bian-hengwei/mocha-tabletop/actions/workflows/ci.yml/badge.svg" alt="持续集成" /></a>
</p>

## 玩什么

| 游戏 | 人数 | 玩法 |
| --- | --- | --- |
| 晶石商会 | 2–4 | 收集宝石、购买发展卡、争取贵族 |
| 喵喵危机 | 2–5 | 抽牌、出牌和拆弹，生存到最后 |
| 月夜议会 | 6–18 | 标准模式、法官主持、仅发身份三种模式 |
| 迷雾远征 | 5–10 | 组队、投票、秘密执行任务和刺杀 |
| 寿司小宴 | 2–5 | 同时选牌、传递手牌、三轮寿司计分 |
| 香料商旅 | 2–5 | 43 张商人、36 张订单；交易、升级和收集 |
| 七彩接龙 | 2–10 | 500 分比赛或单轮；可选 +4 质疑、选牌后出牌、手动喊牌和抓漏 |
| 密语行动 | 4–12 | 双队词语线索、秘密密钥、零/不限猜词、违规线索补偿 |
| 异词同伴 | 3–12 | 相近词语、顺序描述、秘密投票、平票辩护与复投 |

月夜议会的**法官主持**模式另需一名不参与游戏的法官：法官操作流程，玩家只查看自己的身份。**仅发身份**模式随机分配身份，后续由大家线下主持。

本项目采用自己的游戏名称、界面与插画，牌面使用直观的功能名称。规则版本与数值核对见 [玩法与命名说明](docs/RECOGNIZABLE-RULES.md)，架构见 [实现说明](docs/ARCHITECTURE.md)。

## 怎么玩

1. 用手机打开 **[mocha-tabletop-web.pages.dev](https://mocha-tabletop-web.pages.dev/)**，横竖屏均可使用，填写昵称并从 48 款头像中选择。
2. 选择游戏并创建房间，把邀请链接分享给朋友；也可以通过房间码申请加入。
3. 玩家准备后，由房主开始游戏。不需要注册账号。首页可切换中文/English，每款游戏都有快速入门和完整规则。

另一个入口：[mocha-tabletop.bianhengwei.com](https://mocha-tabletop.bianhengwei.com/)。

在 iPhone 上，用 Safari 打开后选择「分享 → 添加到主屏幕」，就能获得独立窗口和 Mocha 小狗图标。支持安装提示的 Android / 桌面浏览器可通过首页按钮直接打开系统安装确认；iPhone 仍需系统分享菜单，网页无法静默自动安装。

| 模式 | 网络要求 | 适合场景 |
| --- | --- | --- |
| 云端房间 | 游戏过程中保持联网 | 大家用各自的手机，异地也能加入 |
| 局域网房间 | 创建和配对时需要联网；设备之间还需能直接连通 | 同一网络聚会，游戏数据通过 WebRTC 直连房主 |
| 同屏试玩 | 首次加载并完成缓存后可离线 | 一台设备切换座位，熟悉规则和操作 |

同屏试玩不是隐藏身份的多人房间。局域网模式没有 TURN 中继，访客 Wi-Fi 的设备隔离等限制可能使直连失败，此时可以使用云端房间。

## 本机记忆与恢复

昵称、头像使用已有的本地存储，下次打开无需重填。个人战绩自动保存已收到的终局结果（最多 500 局），支持单条删除、全部删除；同屏试玩和法官主持单独标记，不计入个人联机胜负。删除后重新打开终局不会重复添加。

关闭网页后，在同一浏览器重新打开可自动恢复尚未过期的房间；首页也提供恢复入口。云端牌局由服务端保存，局域网房主的牌局在本机保存。同屏试玩也可恢复，保存期限为 7 天。主动离开、房主解散、房间过期或清理本机数据后无法恢复。浏览器与主屏幕 App 可能使用不同存储空间，恢复和战绩不跨设备同步。

有人掉线时保留座位并暂停对局，重连后继续；房主可在准备大厅移除离线玩家。游戏中不自动替玩家操作，若有人无法回来，房主可结束本局再开桌。昵称编辑界面提供「重置本机用户与战绩」，需要先离开当前牌桌，确认后清除本机身份、战绩和恢复信息。

## 开发规范

开发与维护请阅读 [AGENTS.md](AGENTS.md)，其中说明架构、双语、界面、测试与发布规范。

## 本地开发

需要 **Node.js 22+** 和 npm。在仓库根目录运行：

```sh
git clone https://github.com/bian-hengwei/mocha-tabletop.git
cd mocha-tabletop
npm ci
npm run build
```

分别在两个终端启动后端和前端：

```sh
# 终端一：本地 Cloudflare Worker，默认端口 8787
npm run worker:dev
```

```sh
# 终端二：前端开发服务器
npm run dev -- --port 5174 --strictPort
```

打开 <http://127.0.0.1:5174>。开发服务器将 `/api` 和 WebSocket 请求代理到本地 Worker。首次启动前的构建用于准备 Worker 的静态资源目录；之后修改前端即可热更新。

```sh
npm test                 # 游戏规则、隐私过滤和房间逻辑测试
npm run check            # 单元测试、Worker 类型检查、前端类型检查及生产构建
npm run preview          # 查看生产构建；默认连接 .env.production 中的后端
```

浏览器和联机回归的环境、命令见 [测试说明](tests/README.md)。GitHub Actions 在推送和 PR 时执行 `npm ci` 与 `npm run check`，并验证 Chromium 的语言切换、规则和九款游戏入口。

## 代码结构

```text
src/core/       游戏规则、玩家视图与房间模型
src/net/        WebSocket / WebRTC 客户端
src/ui/         React 界面、游戏桌面与样式
worker/         Cloudflare 房间服务、配对与发现
public/         游戏插画、PWA 图标、manifest 和缓存入口
scripts/        构建缓存清单、生成图标尺寸
design/        图标原图
tests/         单元测试、浏览器回归和测试数据
```

构建产物、依赖、截图和本地凭据不入库。美术文件的用途和来源见 [素材说明](docs/ASSETS.md)。

## 部署与维护

当前前端部署到 **Cloudflare Pages**，联机服务运行在 **Cloudflare Workers + Durable Objects**。不需要维护虚拟机。静态托管本身只能承载前端，完整联机功能还需要 Worker。

维护现有站点时，先完成 Cloudflare CLI 登录，再检查和部署：

```sh
npx wrangler login
npm run check
npm run deploy
```

`npm run deploy` 依次部署 Worker 与 Pages；GitHub CI 只做检查，不会自动发布。首次在自己的账户部署时，需要修改账户、项目名、API 地址和允许的来源，具体步骤见 [部署说明](docs/DEPLOYMENT.md)。

修改玩法时，同时更新相应规则测试和每个玩家可见的视图；修改联机协议时，运行相关房间与网络回归。请勿把密钥、私人照片或测试截图提交到仓库。
