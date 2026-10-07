# Sushi editions and menu rules

Sources: [Gamewright Sushi Go Party! rules, 2016](https://gamewright.com/pdfs/Rules/SushiGoPartyTM-RULES.pdf), and the [expanded Gamewright product manual](https://m.media-amazon.com/images/I/B1lSYxH1W1L.pdf), accessed 2026-10-07. The latter explicitly clarifies one bonus action per player per turn and Takeout color grouping. Original Mocha illustrations and interface labels are retained; official card art is not distributed.

Classic remains the default 108-card, 2–5-player edition. Party supports the complete base-box selection of 181 physical cards across 22 menu families plus mandatory nigiri. Promo cards and expansions are excluded. `sushiEdition` selects the engine without changing the stable `sushi` game ID. Existing Classic checkpoints remain Classic.

Party menus contain nigiri, one roll, three different appetizers, two different specials and one dessert. Edamame and Spoon require 3–8 players. Menu and Special order require 2–6 players. The selected menu determines the room's legal capacity. Both the authority and setup UI enforce these restrictions.

Hands contain 10/9/8/7 cards at 2–3/4–5/6–7/8 players. Add desserts 5/3/2 each round at 2–5 players, or 7/5/3 at 6–8. At each round end, keep played desserts aside and reshuffle other cards with the unused deck. Play three rounds; score desserts last. The most dessert cards break a score tie.

Players lock one card simultaneously. Declare at most one previously played Chopsticks or Spoon before locking. Resolve bonus actions after the initial reveal, in printed-number order; Menu and Takeout participate in that order. Menu's four cards go only to its owner. A Spoon request searches left; the first holder chooses the matching variant. Special order selects an existing card before reveal and copies its effective type. Pending choices are authoritative, persistable and reconnectable.

Party Maki ties award full points and retain the next distinct rank. Temaki, Uramaki, Miso, Wasabi, Takeout, copying, color groups, appetizers and desserts use the Party rules, separately from Classic scoring. Individual pending actions are validated against the current player's permitted choices before cloning and mutation.

## Names and stable IDs

| Internal ID | 中文 | English / rule function |
|---|---|---|
| maki1–3 | 寿司卷 | Maki roll icons |
| temaki | 手卷 | Temaki |
| uramaki3–5 | 反卷 | Uramaki icons |
| tempura / sashimi / dumpling | 天妇罗 / 刺身 / 饺子 | Tempura / Sashimi / Dumpling |
| eel / tofu / edamame / miso | 鳗鱼 / 豆腐 / 毛豆 / 味噌汤 | Eel / Tofu / Edamame / Miso soup |
| onigiriCircle/Triangle/Square/Rectangle | 饭团及形状 | Onigiri shapes |
| chopsticks / spoon | 筷子 / 勺子 | Deferred bonus actions |
| menu / order / takeout | 菜单 / 特别点单 / 打包盒 | Menu / Special order / Takeout box |
| soy / tea / wasabi | 酱油 / 茶 / 芥末 | Soy sauce / Tea / Wasabi |
| pudding / icecream / fruit* | 布丁 / 抹茶冰淇淋 / 水果 | Desserts; fruit suffixes W/O/P denote watermelon/orange/pineapple |

Independent expected quantities, scoring fixtures, privacy, rejection, state restoration and full-menu game simulations are in `tests/sushi-party.test.ts`.
