# Mahjong rulesets

麻将的吃牌、番型、鬼牌和换牌规则随地区与版本不同。界面使用传统玩法名称，不表示腾讯授权或与其当前所有房间配置一致。所有模式为四人一局、东家起庄，不含花牌、买马、游戏币和商业道具。中英教程分别提供快速入门、通用完整规则和当前模式规则。

## Stable modes

| ID | 中文 / English | Tiles | Opening | End |
| --- | --- | --- | --- | --- |
| `guangdong` | 广东推倒胡 / Guangdong Push Down | 136 | No exchange | One winning response window |
| `laizi` | 红中赖子 / Red Dragon Wild | 136, four red wilds | No exchange | One winning response window |
| `sichuan` | 四川血战 / Sichuan Blood Battle | 108 | Same-suit three, missing suit | Three winners leave or wall empty |
| `bloodflow` | 血流成河 / Blood Flow | 108 | Same-suit three, missing suit | Wall empty, repeat wins |
| `bloodflowAny` | 血流 · 任意换 / Blood Flow · Any exchange | 108 | Any opening count with wall, missing suit | Wall empty, repeat wins |
| `bloodflowThree` | 血流 · 任意换三张 / Blood Flow · Any three | 108 | Any three suits, missing suit | Wall empty, repeat wins |
| `redBloodflow` | 红中血流 / Red Dragon Blood Flow | 114, six red wilds | Any three suited tiles, missing suit | Wall empty, repeat wins |
| `redBattle` | 红中血战 / Red Dragon Blood Battle | 112, four red wilds | Same-suit three, missing suit | Three winners leave or wall empty |
| `guangdongFan` | 广东做牌 · 无鬼牌 / Guangdong Scoring · No wilds | 136 | No exchange | One winning response window |
| `guangdongGhost` | 广东做牌 · 单鬼牌 / Guangdong Scoring · Single wild | 136 including indicator | Reveal indicator | One winning response window |

All three-tile exchanges use one shared seeded direction (next/opposite/previous). Any-count exchange is an opening option: select zero to the entire hand, receive replacements before any outgoing tile returns to the shuffled wall. It is not the commercial unlimited-exchange mode with a personal reserve. Ghost tiles cannot be exchanged.

## Selected references and boundaries

References checked September 21, 2026. Published versions differ; do not silently combine their incompatible claims or scoring.

- [Tencent QQ Games chicken-and-flat rules](https://game.qq.com/help/rule32.html): primary source for `guangdongFan`. It allows chow, excludes seven pairs, includes thirteen orphans, and provides the score table, missed-win rule and supplier liability. This table runs one East-wind deal rather than an automatic sequence of dealer continuations.
- [Tencent Guangdong overview](https://majiang.qq.com/webplat/info/news_version3/7207/31873/33020/33021/m18795/201808/748028.shtml): context for regional variation.
- [Xiaomi Game Center Guangdong guide, 2021](https://game.xiaomi.com/viewpoint/1359077112_1632363037252_9): describes a different mobile version (no chow), indicator-following wilds and hard wins. `guangdongGhost` is an explicitly selected single-wild option on the QQ chicken-and-flat table, not a claim to reproduce that mobile room. Indicator cycles numbered suits 1–9; honors East, South, West, North, Red, Green, White. It is removed from play. Natural wins double; ordinary scores still cap at eight.
- [Sichuan scoring reference, 2023](https://www.sgfox.cc/archives/mahjong-scoring.html): secondary reference for the traditional blood-battle/flow scoring configuration, kong transfers and wall settlement. No single publisher controls these traditional rules. The configuration below is the supported ruleset.
- [Six-Dragon Blood Flow version, 2024](https://mydown.yesky.com/news/117987.html): corroborates six red wilds and any-three exchange. [Game Center bonus explanation, 2021](https://game.xiaomi.com/viewpoint/1359077112_1633666506438_9) supplies the additional red-flow patterns and included-pattern exclusions.
- [Opening any-count exchange description, 2025](https://www.sohu.com/a/852534099_121124835): reference for the wall-exchange option. Newer Green Dragon selection, single-wild kongs, personal reserves and revival items are separate commercial modes and are not enabled here.

`redBattle` selects the four-red-wild option with the same-suit blood-battle opening and base Sichuan fan table; it does not inherit the six-red-flow bonus table. `guangdong` and `laizi` are explicitly simple push-down tables, without the former arbitrary capped fan mix. Their score is base one, self-draw double, kong-related double; they end after a winning window. Only `laizi` permits discarding an unclaimable wild.

## Claims and scoring

All modes support wins before pung/kong and simultaneous discard winners. Only the two Guangdong scoring tables allow chow, only from the previous seat, after higher-priority claims. Real tiles are required for all claimed melds. Added kongs wait for robbing wins; a robbed kong retains its original pung. Concealed kongs cannot be robbed and are private until the deal ends. No kong is offered without a replacement tile.

General wins use four sets and a pair, or seven pairs; a natural quad can count as two pairs. Guangdong chicken-and-flat excludes seven pairs. Honor decks also support natural thirteen orphans. A missing suit must be cleared before winning or claiming. After passing a win, Sichuan tables block an equal/lower base-value discard win until the next draw; Guangdong scoring blocks the same passed tile value until drawing or claiming a meld.

Blood Battle winners leave and stop paying. Blood Flow locks the equivalent thirteen-tile waiting hand on the first win: no further melds, only the new drawn tile can be discarded, and self-drawn wins go into a separate physical winning-tile area before the next player draws. Discard wins reference the shared river tile without duplicating it.

### Guangdong chicken-and-flat

| Base | Points |
| --- | ---: |
| 鸡胡 | 1 |
| 平胡 (all sequences) | 2 |
| 碰碰胡 / 混一色 | 4 |
| 清一色 / 混碰 | 16 |
| 清碰 / 混幺九 / 小三元 / 小四喜 | 32 |
| 字一色 / 清幺九 / 大三元 / 大四喜 / 九莲宝灯 / 十三幺 | 64 |

Take the highest base pattern. Ordinary patterns add seat wind, East round wind, dragon triplets and self-draw doubles, capped at eight. Special patterns do not add ordinary bonuses. Kong-replacement self-win, last-tile self-win, robbing a kong and triple discard wins have a minimum of eight; heavenly/human/earthly wins have a minimum of 64.

A discard supplier pays one share. Self-draw collects three shares, except a liable supplier pays all three. Robbing an added kong is also three shares from its declarer. Exposed-kong replacement wins are covered by the kong supplier. Supplying the fourth exposed set, or the last open set of Big Dragons/Big Winds, establishes self-draw liability; for the fourth-set rule a supplier only covers the first qualifying recipient. No immediate kong payments.

### Sichuan and Blood Flow

Take one base: plain one, all triplets two, seven pairs four, single-pair wait with four melds four. Add each natural root ×2, simples ×2, pure suit ×4, all 2/5/8 ×4 (replaces simples), outside hand ×4. Evaluate coherent decompositions and select the highest score. This configuration has no fan cap.

Self-draw ×2, kong replacement/discard/rob ×2, last tile ×2, heavenly/earthly ×32. An exposed kong collects two from its supplier; concealed kongs collect two from each active opponent, added kongs one. A kong's income transfers to each winner on its immediate winning discard and is removed from the refundable ledger.

Six-red Blood Flow also evaluates hard win / six-tile straight / twin triplets ×2; three concealed triplets / full straight / three consecutive triplets ×4; all-even triplets / three kongs ×8; four consecutive or concealed triplets ×16; twin dragons / Red Dragon single wait ×32; nine gates ×64. Higher patterns exclude their included lower patterns; history displays the actual decomposition. A Red Dragon single wait requires four exposed sets and a wild in the remaining pair.

At wall exhaustion, missing-suit holders pay 16 to each cleared active player. Cleared non-ready players pay each ready player's maximum base hand value. Non-ready players, including missing-suit holders, refund their recorded kong income. Departed Blood Battle winners are excluded. All payments are zero-sum.

## State compatibility and verification

New deals carry `rulesVersion: 2`; existing four-mode deals without it continue through `mahjongLegacy.ts`, preserving their original behavior and displaying their original mode guide. Stable IDs are unchanged. New fields are serializable, and public views omit wall order, other hands, exchange selections, response choices and concealed kong faces.

`tests/mahjong-modes.test.ts` contains literal published score examples, deck counts, exchange/privacy checks, wildcard and claim boundaries, legacy comparisons, and seeded terminal games with unique physical-tile and zero-sum invariants. UI tests cover both languages, all ten openings, seven required viewports, dense rivers, long names, dialogs, keyboard selection, rotation and reload. Network regression uses four independently credentialed clients and checks replay protection and reconnect.
