# 维护 Mocha 桌游

当前维护入口是 `web/`，需要 Node.js 22 或更新的 LTS 版本。Swift 原生目录保留作参考。

```sh
cd web
npm ci
npm run check
```

规则或联网行为修改应包含相应测试；玩家投影不得泄露其他人的手牌或身份。UI 修改请在 iPhone 横屏和竖屏安装页面检查，涉及操作流程时运行 `tests/ui/` 对应的浏览器脚本。线上验收脚本会建立真实测试房间，应只在自己有权限的部署上运行。

提交前运行 `npm run check`。凭据、本地 `.dev.vars`、私人照片、生成中间文件和测试截图不应提交。图像来源和生成提示词记录在 `web/docs/` 与 `design/README.md`。Cloudflare 部署由维护者登录后执行，不在仓库或 CI 中硬编码令牌。
