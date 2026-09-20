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
