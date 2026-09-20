# Web card engines

`src/core/games/gems.ts` and `bombs.ts` port the validated native engines into the shared `GameModule` contract. Both are complete base-game implementations; they do not include expansion packs. All state is JSON serializable, including the evolving PRNG state. Every accepted `apply` returns a new state; every rejected command leaves the input untouched. IDs identify physical components and never contain PRNG output. `view` returns a deep-cloned, player-specific projection.

Only the authority (LAN host or Cloudflare room) should retain `create` / `apply` state. Send `view(state, authenticatedPlayerID)` to that individual player. Do not broadcast full state, deck order, seed, or projections belonging to other seats. Rules alone are not a security boundary if transport permits a client to impersonate another player.

## 宝石商人

2–4 players. Includes the exact 90-card numerical catalog and ten nobles from `../../Sources/MochaCore/GemsEngine.swift` (provenance in `../../docs/GEMS.md`). Costs use `[white, blue, green, red, black]`; tokens add `gold` as the sixth value. Cards expose a string `bonus`, e.g. `white`.

Supported rules: supply scaling by player count, three distinct colors (fewer only with insufficient supply), pair threshold of four, market replacement, blind reserves, three-card reserve limit, gold availability, permanent discounts, automatic and custom gold payment, free purchases, mandatory return above ten tokens, one noble per turn with selection when necessary, 15-point final round, equal turn counts, fewer-development-cards tie-break, shared wins. A pass only exists when no legal action remains.

Commands retain native identifiers: `take_distinct`, `take_pair`, `reserve`, `buy`, `pay_auto`, `pay_custom`, `cancel_buy`, `discard`, `noble`, `pass`. Read choices and required counts from `view.actions`. Token selections use physical choice IDs such as `white:0` and `gold:1`; this allows multiple same-color tokens without duplicate option IDs. `buy` starts a confirmation phase; it does not itself spend tokens.

`board` contains:

- `phase`: `action | payment | discard | noble`; `current`: player ID; `round`, `finalRound`, `winners`.
- `market`: flattened card array; `decks`: three **counts**, never card identities; `bank`: six token counts; `nobles`.
- `players`: profile, public tokens/bonuses/score, reserved **count**, source-filtered `reservedCards` (see below), bought cards and nobles.
- `hand`: only the viewer's reserved cards.
- `payment`: `{card, needed, auto}` only for the current buyer; otherwise null. This prevents leaking a reserved card during payment.

## 炸弹猫

2–5 players. Follows the native engine's current Original Edition base rules (provenance in `../../docs/BOMBS.md`). Every player gets seven non-bomb ordinary cards and one defuse. Add N−1 bombs and up to two spare defuses to the draw pile. Functional cards, five types of cats, same-kind pairs and triples are included; the obsolete five-different-cards combo and expansion packs are not.

Supports stacking attack debt, one-turn skips, chosen favor gifts, random pair theft, named triple theft with misses, private future, deterministic shuffle, defuse and secret insertion at every position, voluntary explosion, eliminated hands kept face down, and last-survivor victory. Any same-kind cards can form pairs/triples, including functional cards.

Effects enter an explicit response barrier. Every living player confirms with `pass`, regardless of whether they own a Nope, so automatic responses cannot leak that fact. `nope` toggles cancellation and clears all confirmations. A player who already confirmed may still Nope until the last confirmation resolves. Effects are resolved only after the barrier; future cards, random theft and gifts are never revealed before cancellation is settled. This barrier has no timeout and needs transport-level reconnection for disconnected seats.

Commands: `draw`, `play`, `pair`, `triple`, `target`, `request`, `cancel`, `pass`, `nope`, `give`, `done`, `defuse`, `explode`, `insert`. Target/request cancellation happens before cards are discarded. Defuse, insertion, draw and explosion cannot be Noped.

`board` contains:

- `phase`: `turn | target | request | response | give | future | bomb | insert`.
- `hand`: only the viewer's cards (`id`, `kind`, `title`). `players`: profile, alive flag and hand count.
- `current`, `turnsRemaining`, `attacked`, `deckCount`, `winners`.
- `discard`: latest twelve public cards, most recent first.
- During response: `response: {actor, cards, target, requested, cancelled, passed}`.
- During a gift: `give: {actor, target}`.
- During future: `privateFuture` only for its owner. Uses positional IDs, never deck component IDs.

Logs never show drawn/given card identity, death hands or bomb insertion position. Unknown player IDs receive empty views for both games. A dead player can see public state and their now-empty hand, but cannot act.

## Verification

Run `npx vitest run tests/cards.test.ts`. Coverage includes every rule group, exact native catalog parity, setup for all player counts, command validation, invalid-payment atomicity, isolated views, private reserves/payments/future/gifts/decks, deterministic state replay, and full seeded matches. Complete matches check card/token/noble conservation after every command and survive a JSON serialize/deserialize boundary between commands.

These tests validate game rules and projection privacy. Device layout, touch interaction, transport authentication, reconnect behavior and live multi-device networking require separate integration testing.

## 2026-09-19 rule recheck and public reservation memory

Rechecked the publisher's current [official rules, page 2](https://cdn.svc.asmodee.net/production-spacecowboys/uploads/2025/10/SCSPL01EN_SPLENDOR_RULES_LIGHT.pdf). Any face-up development card in the market can be reserved, at any level and regardless of affordability; alternatively the top card of any of the three decks may be drawn secretly. This does not permit choosing a particular hidden deck card, taking somebody else's reservation, or reserving a noble. Three reserved cards is the limit; reservations cannot be discarded, and lack of bank gold does not prevent reserving.

The distinct-color action takes three colors when available. It takes two or one only when the supply has fewer than three colors. Players cannot voluntarily under-take. Overflow is resolved afterwards by returning any excess tokens, including newly taken tokens. Every player's token inventory and score must be public. Existing engine rules implement these requirements without changing legality.

`Merchant.publicReserved?: string[]` now remembers cards reserved visibly from the market. `board.players[].reservedCards` exposes `{id,tier,public:true,card}` for those remembered cards; a blind/unknown-source reservation is `{id:'reserved-PLAYER-SLOT',tier,public:false}` with no card or component ID. This persistent display remembers an already-public selection; the official rule itself keeps reserved cards in the hand and does not require continuously displaying their faces. Blind reservation content remains private. The owner still receives all their own cards through `board.hand`.

Legacy saves without `publicReserved` conservatively keep every reservation hidden. New face-up reservations add their own IDs without retroactively revealing any old card. Buying a public reservation removes its tracking entry. Tests cover public/secret coexistence, legacy migration, source legality, purchase cleanup and insufficient-supply selection counts.

## Redesigned cat tabletop

`src/ui/BombsTable.tsx` with `bombs-table.css` is a self-contained replacement for the old cat board **and its generic action dock**. It accepts `view`, `selfID`, `command` (and optional unused `open` for compatibility). All commands still come from the player's legal `view.actions`; no rules or secret-state access live in the UI.

Changes: original inline vector cat art replaces emoji-only cards; hand sorting places same kinds together; narrow/large hands remain scrollable. Target selection uses player seats; combo naming, NoPe responses, chosen gifts, private future, defuse and secret insertion happen at the table. A native range slider plus ± / top / bottom controls selects every valid insertion position. A separate confirmation protects voluntary explosion. The selected card panel explains its effect without a full-screen generic action form.

`tests/ui/bombs-harness.html` mounts this component independently while the app shell is being integrated. `node tests/ui/bombs-table.integration.mjs` drives three complete seeded matches only through visible browser controls, covering all phases, all functional cards, NoPe, pairs and triples. It additionally checks fully visible cards and reachable hand scrolling at 852×393, 667×375 and 568×320. `LAYOUT_ONLY=1` runs only the viewport checks. The harness and tests are development fixtures and are not Vite build inputs.

## Integrated gem-table review

`GemsTable.tsx` / `gems-table.css` were reviewed at 844×390 and 667×375, including four-player density and a valid mid-game state generated through the rules engine. Fixed an accidental sixth (gold) purchased-card column, four-color miniature cost clipping, and narrow-card sizing that could overlap adjacent purchased columns. Miniature costs now wrap to two rows, each cost has an accessible color/count label, and blind decks are disabled when reservation is unavailable. Zero-cost pending purchases say `免费`.

`tests/ui/gems-layout.integration.mjs` measures every visible cost digit against the bounds of its market/noble/inventory/enlarged card, checks stock figures stay within each of four player panels, and captures the two sizes. Its development fixture is `tests/ui/gems-harness.html`.

The updated `tests/ui/cards.integration.mjs` runs against the actual app shell, using the new direct gem interactions rather than the old mode-toggle UI. It verifies repeated same-color taps, three-color collection, reserves/gold, mandatory excess-token return, purchase/payment, and public versus blind reservation visibility. Default execution buys with automatic payment; `CUSTOM_PAYMENT=1` selects the actual payment tokens in the custom-payment sheet and completes that purchase. Opponents see remembered face-up reservations plus card backs for blind ones; owners see both cards. It also smoke-tests the newly integrated cat table.
