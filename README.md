# Mocha 桌游

<img src="design/mocha-icon-1024.png" alt="Mocha 小狗玩桌游" width="160" />

[![Checks](https://github.com/bian-hengwei/mocha-tabletop/actions/workflows/ci.yml/badge.svg)](https://github.com/bian-hengwei/mocha-tabletop/actions/workflows/ci.yml)

当前交付版本是横屏 iPhone 网页 App：**https://mocha-tabletop.bianhengwei.com**。用 Safari 打开，首页有“添加到 iPhone 主屏幕”入口。无需 Apple 付费开发者账号。

包含宝石商人（2–4 人）、炸弹猫（2–5 人）、狼人杀（6–18 玩家，法官模式另加 1 位法官）、阿瓦隆（5–10 人）。昵称与头像本机保存，无登录。支持 Cloudflare 配对后的 Wi-Fi 直连、Cloudflare 云端房间，以及离线同屏试玩。

源码、开发方式、部署与扩展游戏说明见 [web/README.md](web/README.md)。规则、联机和浏览器验收记录位于 web/docs 和 web/NETWORK.md。

原 SwiftUI 实现保留作为规则移植参考，不是当前安装入口。旧构建说明移至 [原生版本归档](docs/NATIVE-ARCHIVE.md)。

开发需 Node.js 22+：`cd web && npm ci && npm run check`。维护约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。
