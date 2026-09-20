# Mocha 桌游 · Mocha Mocha

朋友围桌，用 iPhone 玩四款桌游。SwiftUI 原生界面，昵称＋内置头像，本机保存，无账号、无游戏服务器。同一 Wi-Fi／热点通过 Bonjour 发现房间，由房主手机主持规则和同步状态。

## 打开与构建

用完整 Xcode 16 或更新版本打开 `MochaTabletop.xcodeproj`，选择 `MochaTabletop` scheme。最低 iOS 17，仅 iPhone。所有代码为本地 Swift Package，无第三方依赖。

1. 模拟器：选择 iPhone Simulator，直接 Run，不需要付费账号。
2. 真机个人测试：在 Signing & Capabilities 选择你的 Apple ID Team，并改成自己唯一的 Bundle Identifier。
3. TestFlight：需要 Apple Developer Program；见 [发布与设备验收](docs/RELEASE.md)。

完整 Xcode 尚未安装时，Mac Command Line Tools 可以编译整个共享 UI/网络/内核并运行规则测试：

```sh
swift build --target MochaUI
./scripts/test.sh
```

`test.sh` 自动补齐 CLT 的 Swift Testing 框架搜索路径。测试会模拟完整牌局、验证非法动作原子拒绝、隐私投影、筹码/牌库守恒、断线身份、重复请求和 TCP 分帧；网络集成测试真实运行本机 TCP/Bonjour。测试通过不等于 iPhone 跨设备或 TestFlight 已验收。

## 游戏

| 游戏 | 人数 | 内容 |
| --- | --- | --- |
| 宝石商人 | 2–4 | 基础版 90 发展牌、10 贵族、黄金支付、预留、弃筹码、贵族选择、最后一轮 |
| 拆弹猫 | 2–5 | 抽牌/爆炸/拆弹、攻击叠加、跳过、洗牌、预见、索取、否决/反否决、对子/三张组合 |
| 狼人杀 | 12 | 4 狼 4 民＋预女猎守，第一夜后上警、退水、警徽、PK、自爆与双爆吞警徽 |
| 阿瓦隆 | 5–10 | 梅林/派西维尔/莫甘娜/刺客、组队、公投、秘密任务、刺杀 |

具体板子、边界规则和来源：[宝石商人](docs/GEMS.md) · [拆弹猫](docs/BOMBS.md) · [狼人杀／阿瓦隆](docs/SOCIAL.md)。应用内也有玩法说明。拆弹猫使用全员点击“放行／否决”的响应阶段，无计时器，保证每个人有机会反应。

## 局域网与隐私

- `Network.framework` 的 Bonjour + TCP，可容纳房主＋11 客户端；不受 Multipeer 的 8 人限制。
- 房主负责状态、随机发牌和校验；逐个连接发送只属于对应玩家的 `GameView`，不发送完整引擎、牌库或其他人手牌。
- 房间使用重连凭据绑定玩家，命令带版本号和请求 UUID，拒绝过时操作、防止重复执行。
- 掉线暂停牌局，同一台手机、同一应用资料可重新加入。房主应保持应用前台；锁屏／后台挂起后必须回前台恢复。不做房主迁移。
- App 进程被系统杀死或房主主动关闭房间，会丢失当前牌局。当前没有断电存档。
- 本地资料存在 UserDefaults；不采集分析、不加广告、不上传个人资料。房间内昵称、头像和规则所需信息直接发给朋友的设备。
- 只适用于可信朋友与可信局域网。传输目前为本地 TCP，无应用层 TLS；身份保密依赖正确客户端和房主，不是防御修改客户端、网络抓包或被攻陷房主的密码学方案。
- 酒店、公司 Wi-Fi 可能隔离客户端，个人热点的发现行为也受具体 iOS/运营商配置影响，需要按设备清单实测。首页提供权限提示和刷新。

## 结构与新增游戏

```
Sources/MochaCore/  规则引擎、房间状态机、线协议、玩家投影
Sources/MochaLAN/   Bonjour / TCP 传输
Sources/MochaUI/    原生 SwiftUI、资料、大厅、通用操作表单
Tests/                Swift Testing 规则与网络测试
iOS/                  iPhone App 入口、图标、本地网络权限、隐私清单
```

新增游戏：添加 `GameKind` 元数据，实现值类型 `GameEngine`（`apply`、`view`、`isFinished`），在 `GameRegistry` 注册。用 `ActionPrompt` 声明操作、`DisplaySection` 声明公开／私有牌面，就会自动接入同一房间和手机界面。多选通过唯一 choice ID 表达，每个 ID 最多选一次；重复筹码用独立 ID。失败操作必须不修改状态。公共信息不要放入私有卡片，秘密也不能放入公共日志。

工程已提交可直接打开的 `.xcodeproj`。如需重建它，运行 `python3 scripts/generate-project.py`；重建会覆盖工程内手动改过的签名设置。App 图标使用 Mocha 小狗插画，尺寸由 `scripts/make-icons.sh` 导出。
