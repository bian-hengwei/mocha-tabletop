# Mocha 桌游 · 美术第二版

采用内置 imagegen 工具（非 API/CLI），生成原始插画，再用 macOS sips 调整发布尺寸和 JPEG 压缩。
生成中间原稿本地归档，不随仓库分发；发布素材在 public/art/*-v2.jpg。当前 Mocha 小狗图标见 [design/README.md](../../design/README.md)。

18 幅宝石场景用于 90 张牌的插图；点数、颜色、成本均由游戏数据独立绘制。12 幅身份画像由两幅规则网格 atlas 裁切展示。宝石与炸弹猫图形是项目原创 SVG。

## 生成提示词
### table

Use case: stylized-concept. A luxurious top-down tabletop texture for a mobile boardgame, wide 2:1 composition. Deep dark emerald velvet center, subtle tactile fibers, warm dark walnut and thin brass edges only at perimeter. Atmospheric low warm light. Entire central 85% empty and evenly dark, no objects, no text, no cards.

### cards-1

Original premium tabletop boardgame illustration, painterly detailed cinematic art. No text, lettering, logos, watermark, UI, symbols, numbers, borders or gutters. Asset: illustration sprite atlas, exactly 3 columns by 2 rows, six equally sized independent landscape 4:3 paintings tiled edge to edge, total canvas 2:1 ratio 1536x768. Tier one gemstone gathering: row1 marble quarry with workers and wheelbarrow; sapphire mine glowing blue cavern; emerald forest excavation. Row2 ruby desert mine; onyx volcanic quarry; river panning camp at dawn. Each scene distinct and independently framed, no characters crossing tile boundaries.

### cards-2

Original premium tabletop boardgame illustration, painterly detailed cinematic art. No text, lettering, logos, watermark, UI, symbols, numbers, borders or gutters. Asset: illustration sprite atlas, exactly 3 columns by 2 rows, six equally sized independent landscape 4:3 paintings tiled edge to edge, total canvas 2:1 ratio 1536x768. Tier two renaissance gem commerce: row1 sunlit Mediterranean trading harbor; merchant caravan crossing dunes; emerald lapidary workshop. Row2 ruby bazaar arcade; canal merchant warehouse at dusk; jeweler polishing gems under warm window light. Each scene independently framed, no objects crossing tile boundaries.

### cards-3

Original premium tabletop boardgame illustration, painterly detailed cinematic art. No text, lettering, logos, watermark, UI, symbols, numbers, borders or gutters. Asset: illustration sprite atlas, exactly 3 columns by 2 rows, six equally sized independent landscape 4:3 paintings tiled edge to edge, total canvas 2:1 ratio 1536x768. Tier three renaissance gem patronage: row1 ivory marble palace; moonlit sapphire observatory palace; emerald royal garden pavilion. Row2 burgundy royal jewel gallery; onyx and gold ducal hall; sunlit grand jeweler salon with a crown. Each scene independently framed, no objects crossing tile boundaries.

### roles-wolf

Original premium tabletop boardgame illustration, painterly detailed cinematic art. No text, lettering, logos, watermark, UI, symbols, numbers, borders or gutters. Asset: character portrait sprite atlas. Square canvas 1536x1536 divided precisely into 3 columns and 2 rows, six independent portrait 2:3 paintings flush with no gutters or frames. Each face centered upper third within their own tile. Medieval gothic fairytale, sophisticated and beautiful, teal moonlight and amber highlights, strong distinct silhouettes. Exact row1 left-to-right: fierce gray werewolf in forest; mysterious silver-haired female seer holding luminous crystal; elegant dark-haired witch with green potion and red potion. Row2: rugged hunter with crossbow; armored vigilant guard with shield; warm humble village baker carrying bread. Bust portraits each within own cell, no overlapping cells. No gore.

### roles-avalon

Original premium tabletop boardgame illustration, painterly detailed cinematic art. No text, lettering, logos, watermark, UI, symbols, numbers, borders or gutters. Asset: character portrait sprite atlas. Square canvas 1536x1536 divided precisely into 3 columns and 2 rows, six independent portrait 2:3 paintings flush with no gutters or frames. Each face centered upper third within their own tile. Arthurian medieval fantasy oil painting, sophisticated beauty, gold and midnight blue palette, strong distinct silhouettes. Exact row1 left-to-right: Merlin wise silver-haired mage with blue luminous staff; Percival young noble knight with white cloak; Morgana beautiful dangerous sorceress in deep violet. Row2: hooded assassin with subtle dagger; loyal servant of Arthur a noble female knight in cream and blue; evil minion a sinister dark-armored courtier with crimson cloak. Bust portraits each within own cell, no overlapping cells. No gore.
