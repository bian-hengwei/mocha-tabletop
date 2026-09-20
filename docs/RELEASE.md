# iPhone 安装、TestFlight 与验收

## 费用与安装方式

Apple Developer Program 每年 99 美元，按地区以当地货币收费；不是一次性买断。开发者一人付费即可，朋友作为 TestFlight 测试者无需购买开发者资格。普通朋友建议作为外部测试组，首个构建需要 TestFlight App Review。每个构建最多使用 90 天，期满前上传新构建续测。

免费 Apple ID 可通过 Xcode Personal Team 个人真机调试，但签名有效期 7 天，需重新安装。它不满足“朋友直接在手机上安装、无需电脑”的使用目标。Ad Hoc 也依赖付费会员，还要登记设备；它不比 TestFlight 更适合这里。

网页 PWA 可在 Safari 添加到主屏幕，不需要付费开发者会员；但浏览器版必须重新设计联网，不能直接复用原生 Network/Bonjour 自动发现。当前交付仍是原生 iPhone 工程。

官方依据（查询于 2026-09-19）：
- https://developer.apple.com/support/compare-memberships/
- https://developer.apple.com/help/account/membership/program-enrollment
- https://developer.apple.com/testflight/
- https://beta.itunes.apple.com/
- https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27

## 环境准备

1. 从 Mac App Store 安装完整 Xcode，首次打开完成组件安装和许可步骤。命令行工具本身不含 iPhone SDK。
2. `xcode-select -p` 应指向 `/Applications/Xcode.app/Contents/Developer`；如需切换，运行 `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer`。
3. `xcodebuild -version`、`xcrun simctl list devices` 应成功。
4. 在 Xcode 设置中登录 Apple Account。所有登录、双重验证和会员购买由账户本人完成，不需要把密码发给任何人。

## 构建与发布

- 打开 `MochaTabletop.xcodeproj` → `MochaTabletop` target → Signing & Capabilities → Team 选择自己的团队。
- Bundle Identifier 当前为 `com.hengwei.mochatabletop`，如有冲突改为自己的唯一标识；Display Name 为“Mocha 桌游”。
- 先用 iPhone Simulator 执行以下设备验收，再在真实 iPhone 上测试局域网权限和连接。
- 在 App Store Connect 新建 iOS App，使用相同 Bundle Identifier。填写隐私、分级、联系信息、测试说明；内容应与实际行为一致。
- 选择 Any iOS Device (arm64)，Product → Archive → Distribute App → App Store Connect。
- 在 TestFlight 中建立外部测试组，填写 Beta Review 联系信息与说明，添加处理完成的构建，按 Apple 流程提交。审核通过后再分享邀请。
- 后续上传增加 `CURRENT_PROJECT_VERSION`。不要选择仅限内部团队的发布选项去邀请普通朋友。

已配置 Bonjour 类型 `_mocha-tabletop._tcp`、本地网络用途说明、UserDefaults 的 required reason 隐私清单、1024px 无透明 AppIcon。没有第三方 SDK。iPhone SDK 编译、签名、Archive 和上传结果需要实际完成后才能认定成功。

## 必须完成的真机验收

- [ ] 首次昵称／头像输入、杀进程后资料保留、重名提示、16 字限制。
- [ ] iPhone 小屏／大屏、动态字体、竖屏安全区、长手牌与超长选项可滚动。
- [ ] 第一次本地网络允许／拒绝，设置中重新允许后可发现；空房间态与刷新正常。
- [ ] 至少两部 iPhone 同一 Wi-Fi：发现、加入、准备、开始、逐步同步。
- [ ] iPhone 热点：热点提供者做房主和客户端分别测试；不能仅用模拟器推断可用。
- [ ] 12 台客户端规模（含房主）狼人杀连接，保证第一夜、上警、投票全部能提交。
- [ ] 每款游戏完整玩一局，各身份手机检查手牌／角色／任务票不串台。
- [ ] 买牌、索取、否决、警徽、猎人、PK 等多步动作从 UI 全部走通。
- [ ] 两人同时提交、反复点击、不同网络延迟时没有双重执行，也不打断未失效选择。
- [ ] 客户端断 Wi-Fi、切后台、锁屏后回到 App：正确暂停、重连、恢复原身份。
- [ ] 房主切后台后回前台；房主主动离开、客户端离开大厅座位清除、结束本局重开。
- [ ] App 切后台时遮住角色和牌面，回前台私密区默认收起。
- [ ] 使用真实付费团队 Archive、App Store Connect 上传处理成功、朋友用 TestFlight 安装成功。

未勾选项表示待验收，不代表已经验证。网络隔离、后台执行限制、房主进程被杀等情况需要明确给测试者说明。
