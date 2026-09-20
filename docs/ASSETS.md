# 素材与测试数据

## 当前素材

| 文件 | 用途与来源 |
| --- | --- |
| `public/art/gems.jpg`、`bombs.jpg`、`werewolf.jpg`、`avalon.jpg` | 四种游戏的首页封面，为本项目生成的插画 |
| `public/art/cards-*-v2.jpg` | 三个等级的宝石卡画面，每张图含 6 个场景，界面按图集裁切使用 |
| `public/art/roles-*-v2.jpg` | 狼人杀、阿瓦隆身份插画图集 |
| `public/art/table-v2.jpg` | 游戏桌面背景 |
| `design/mocha-icon-1024.png` | 以 Mocha 小狗为参考生成的图标原图，用于重新导出尺寸 |
| `public/mocha-icon-*.png` | 180、192、512 像素的主屏幕及 PWA 图标 |

上述插画为本项目生成，并非从桌游官方卡面截取。私人参考照片不入库。宝石和部分牌面装饰使用代码绘制；通用界面图标使用 `lucide-react`，字体使用系统字体。

在 macOS 上执行 `sh scripts/make-icons.sh` 可以从原图重新导出图标。修改图集时保持当前网格和排列，或同步修改 `src/ui/Art.tsx`、牌桌组件与样式中的裁切规则。

## 宝石卡测试数据

`tests/fixtures/gem-catalog.csv` 是独立校验规则模块的 90 张卡牌数值表，不包含卡面图片。每行依次是：

```text
id,tier,colorIndex,points,white,blue,green,red,black
```

颜色索引按白、蓝、绿、红、黑排列。来源为 [anicolao/splendor](https://github.com/anicolao/splendor) 的 `data/verified_card_properties.csv`，并以 [bouk/splendimax 的数值表](https://github.com/bouk/splendimax/blob/master/Splendor%20Cards.csv) 交叉核对。修改规则表时不应从待测实现自动生成这份期望数据，否则会失去独立校验作用。

## 香料商旅基础牌表

`centuryCatalog.ts` 使用 43 张市场商人（34 交易、8 收获、1 升级）与 36 张订单的基础数值，不使用近似定价公式。数值由 [spice-trader 数据表](https://github.com/yohanlaunay/spice-trader/blob/master/src/games/spices/data.js) 整理，逐张与 [独立卡牌编码](https://github.com/phate09/century-spice-road-env/blob/main/century_env/cards.py) 比较；测试 fixture 保留后者的独立编码次序。另对照 [Java 订单数据](https://github.com/ShaPhi7/CenturySpiceRoad/blob/main/src/main/resources/point-card-deck.csv)。只使用数值，不使用这些项目的图片或游戏逻辑。流程依据 [发行方基础规则](https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Century-Spice-Road-Rules_2024_compressed.pdf)。

新增游戏封面 SVG 为项目自行绘制，词语游戏使用自行整理的中英文词库；页面名称、角色展示和猫牌称谓采用原创命名，内部游戏 ID 保持兼容旧存档。

## 中式棋牌牌面与封面

扑克使用 [Adrian Kennard 的免费牌组](https://www.me.uk/cards/)，麻将使用 [FluffyStuff 的麻将牌面](https://github.com/FluffyStuff/riichi-mahjong-tiles)。两者均按 CC0-1.0 提供。SVG 已下载到 public/art/classic/，无运行时外链。完整许可见该目录的 LICENSE-CC0.txt；作者、固定版本、生成参数、牌值映射和文件校验值见 SOURCES.json。

扑克采用标准花色、双向人头牌和红黑龙形大小王；麻将采用万、筒、条与七种字牌，白板保留传统空白牌面。移除 SVG 编辑器元数据，保留原画路径。麻将底板与牌面叠放，暗牌采用墨绿背面；封面在 Mocha 桌面背景上组合相同授权牌面。可访问名称与真实牌值由游戏状态提供。

## 2026-09-20 插画更新

新增三张原创建图集，通过内置 image_gen 生成，以本项目的晶石封面作为画风参考。只保留压缩 JPEG 于 public，总计约 1.94 MiB；生成的高分辨率 PNG 原图不进入部署。

| 文件 | 网格与用途 |
| --- | --- |
| public/art/game-covers-v3.jpg | 3 列 × 2 行；寿司、商旅、接龙、密语、异词、Mocha 场景。前五格用于首页与游戏场景 |
| public/art/sushi-cards-v3.jpg | 4 列 × 3 行；天妇罗、刺身、饺子、1/2/3 卷、玉子、三文鱼、鱿鱼、芥末、布丁、筷子 |
| public/art/century-cards-v3.jpg | 3 列 × 2 行；香料摊、商人、工匠、港口、订单、商队 |

完整生成提示见 design/illustration-prompts-v3.json。src/ui/IllustratedTile.tsx 在界面中读取单格，费用、分值、数量、词语均由实际游戏数据绘制。接龙牌面与香料方块由 src/ui/NewGameArt.tsx 的 SVG 绘制，数值不会依赖生成图片。旧版 SVG 封面保留作历史源素材，当前界面改用新图集。

身份图集仍使用既有原插画。完整身份弹窗采用 meet 显示完整源画面，并显式限定单格裁切，避免相邻角色泄露；小头像仍允许居中裁切。
