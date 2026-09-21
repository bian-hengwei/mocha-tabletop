# Mocha Tabletop — Development Guide

This file applies to the repository. Read the relevant implementation, tests, and documentation before changing behavior. If `.local/AGENTS.md` exists, read it for local instructions. Local instructions and working notes must remain untracked and must never enter public descriptions, build output, or deployment assets.

## Project and architecture

Mocha Tabletop is a mobile-first collection of multiplayer board games. The application supports Chinese and English, browser use and PWA installation, cloud rooms, WebRTC host-based rooms, and single-device practice.

- Frontend: React, TypeScript, and Vite. Backend: Cloudflare Workers and Durable Objects. Static frontend hosting: Cloudflare Pages.
- `src/core/`: game state, rules, player views, and room models.
- `src/net/` and `worker/`: connections, pairing, authoritative room state, and recovery.
- `src/ui/`: components, game tables, and styles. `src/i18n.ts` and `src/i18n/`: localization. `src/local/`: browser persistence.
- `public/`: deployment assets; `design/`: retained design sources; `tests/`: rule, network, and browser verification.
- Treat the game registry and actual implementation as the current feature inventory. Update all relevant layers when adding a game.
- See [architecture](docs/ARCHITECTURE.md), [tests](tests/README.md), [assets](docs/ASSETS.md), and [deployment](docs/DEPLOYMENT.md).

## Rules and state

- Establish the supported rule version, player counts, options, and exclusions before changing a game. Record technical rule references alongside the implementation or relevant documentation.
- Check setup, card counts and values, legal actions, costs, timing, simultaneous actions, ties, elimination, final rounds, and scoring. Tutorials, options, actions, and outcomes must agree.
- Validate commands at the authoritative boundary. Reject invalid actions without partially modifying the original state. State must remain serializable.
- Keep rules in `GameModule.create/apply/view`; the UI renders the player's view and available actions rather than maintaining a second rules engine.
- Use independently checked expected data for catalogs and scoring tests; do not generate fixtures from the same implementation they validate.
- Preserve stable game, action, player, and match identifiers across display-name changes. Explicitly handle persisted-state migrations.

## Localization

- Chinese and English must cover onboarding, lobby, rules, tables, dialogs, results, history, recovery, installation, errors, logs, accessibility labels, and image descriptions.
- Language choices use their native labels: `中文` and `English`. Make the selector accessible during onboarding and persist the selected language.
- Add both translations together using the existing localization modules. Check terminology, placeholders, quantities, conditions, plural forms, and long labels.
- Keep user-entered names and game content separate from system translations. Changing UI language must not redeal words, reset a match, or reveal hidden information.
- Test both directions of language switching, reload persistence, dynamic messages, and error states. A scan for untranslated characters does not establish semantic correctness.

## Interface and accessibility

- Maintain a coherent visual system with readable cards, clear hierarchy, useful illustrations, and concise wording. Avoid repeated instructions, decorative slogans, and unnecessary text.
- Do not add AI-sounding explanatory filler (奇怪的解释性文字). Every visible phrase must help the player identify a control, understand the current state, make a decision, recover from an error, or learn a necessary game rule. Remove decorative slogans, redundant subtitles, generic interaction narration, implementation commentary, and claims about how carefully the app was built or checked. Do not replace removed filler with a different slogan.
- Examples to omit: “48款头像 · 上下滑动查看更多”, “随时开一桌 / 今天玩什么？”, game-cover labels such as “经典 · 竞技” and “叫分抢地主”, and “按当前牌桌实现编写；遇到有选择的操作，只有符合当前阶段的选项会亮起。” Apply the same standard to Chinese and English, including onboarding, game covers, setup, tables, help, and empty states. Keep concise control labels, useful counts, rule conditions, non-obvious choices, privacy boundaries, and actionable waiting/error messages; show help where it is needed rather than repeating it permanently.
- Portrait and landscape must both work well; different layouts are welcome. Do not require rotation as a substitute for a usable layout.
- For layout changes, check at least 320×568, 390×844, 430×932, 844×390, 932×430, 768×1024, and 1440×900 CSS pixels, in both languages. Rotate while a game and dialog are open.
- Include safe areas, browser chrome, dynamic viewport height, the software keyboard, long names, large hands, maximum player counts, long logs, and empty states.
- Prevent unintended page overflow. Deliberately scrollable card regions must be discoverable, with costs, quantities, and primary actions still readable and reachable.
- Show selection clearly with highlighting and restrained elevation. Allow deselection; enable confirmation only for valid choices. Clear stale selections on turn, seat, round, and state changes.
- Make public resources and card values legible at thumbnail size. Show meaningful waiting and invalid-action explanations without repeating them on every card.
- Hide private identities by default and hide them again when switching seats or redealing. Enlarged artwork must display the intended image without adjacent atlas cells.
- Aim for touch targets around 44×44 CSS pixels. Provide semantic controls, keyboard support, visible focus, reduced motion, and state cues beyond color.
- Dialogs must handle focus, Escape, reachable close controls, and focus restoration, including nested dialogs.
- Inspect actual screenshots and interactions. Element presence and overflow checks alone do not demonstrate visual quality or usability.

## Artwork

- Use ImageGen for substantial new raster illustrations when appropriate; preserve the existing visual style. Documentation-only changes do not require new art.
- Generate illustration layers without letters, numbers, watermarks, or pseudo-text. Render names, quantities, scores, and rules from actual data in HTML or SVG.
- Inspect the full image and its in-app crop for malformed details, stray marks, awkward composition, and atlas bleed. Regenerate or replace defective assets.
- Record atlas dimensions, cell order, aspect ratios, and padding; update rendering components and CSS together. Prefer full-image fitting for enlarged role portraits.
- Reuse the icon library for interface symbols and code/SVG for precise geometric shapes and values. Compress deployed images and inspect mobile loading and decoding costs.
- Keep [asset documentation](docs/ASSETS.md) accurate. Private reference inputs and generation logs do not belong in the public repository.

## Networking and data

- Cloud rooms use authoritative Durable Object state. Send only the receiving player's permitted view; do not send secrets to everyone and hide them with CSS.
- Protect hidden hands, decks, identities, word keys, and private challenge evidence in payloads, logs, errors, DOM, and caches. The LAN host holds full state and is a trust boundary.
- A room code is not an identity credential. Preserve room credentials, invitation/approval checks, origin validation, input limits, and permission checks.
- Exercise create, join, approval, rejection, cancellation, full rooms, readiness, start, restart, exit, and dissolution. Rule changes invalidate readiness where required.
- Preserve seats during disconnection and support recovery without silently replacing players or resetting the game. Provide understandable handling of timeouts, host loss, stale messages, duplicate connections, and failed WebRTC pairing.
- Browser LAN discovery is not a scan of Wi-Fi networks. Do not assume direct connectivity; test real LAN behavior and the explicit cloud fallback.
- Use existing storage helpers; handle unavailable storage, quota failures, corrupt data, and version changes without blank screens.
- Persist profile preferences and resumable sessions. Deduplicate result history by match ID; support deletion without recreating deleted records on reload. Keep practice/moderator results distinguishable.
- Clear appropriate recovery data on deliberate exit, dissolution, expiration, or reset. Destructive in-app reset actions require clear confirmation.
- Avoid unnecessary polling, repeated requests, and retained room data. Do not introduce paid infrastructure silently.

## PWA and offline behavior

- Use native installation prompts where supported and accurate platform instructions elsewhere. Handle installed, cancelled, and unsupported states.
- Generate the service-worker manifest through `scripts/build-sw.mjs`; do not hand-edit `dist/` or cache inventories.
- Verify cache creation, version updates, offline reload, practice games, and artwork. Never put credentials or private room responses into public offline caches.
- Distinguish browser automation from actual device installation testing. Do not claim untested iPhone standalone behavior has been verified.

## Repository practices

- Use Node.js 22+, npm, the existing lockfile, and project-local tools. Install with `npm ci`; keep unrelated dependency upgrades and architecture changes out of scoped work.
- Prefer clear types, small functions, and existing module boundaries. Do not expand unchecked `any`, disable type checking, or duplicate rules to work around an issue.
- Use reproducible game randomness for tests; use appropriate secure randomness for identity credentials.
- Work in isolated branches/checkouts. Preserve unrelated work and never change another active checkout's branch or discard its uncommitted changes.
- Keep source, necessary assets, independent fixtures, and useful documentation. Exclude dependencies, build output, credentials, private notes, conversation summaries, local instructions, screenshots, and generated reports.
- Stage explicit paths and inspect the staged diff and commit/PR descriptions before publishing. Do not copy local working records into project documentation.
- Keep README focused on use, setup, verification, and maintenance. Update relevant technical documentation when behavior or commands change.

## Validation and release

- Every PR, including documentation-only PRs, has a mandatory independent agent review gate before merge. A subagent or separate agent that did not author the changes must read the applicable `AGENTS.md` instructions and review every rule against the complete final PR diff and affected behavior. The author’s self-review, passing CI, or an automated text scan does not satisfy this gate.
- The reviewer must explicitly assess qualitative requirements as well as code correctness: unnecessary or AI-sounding copy, visual quality, portrait and landscape usability, both languages, accessibility, privacy, and all other rules. For each rule, record pass with evidence, not applicable with a reason, or a violation/unverified requirement. UI review must inspect actual screenshots and interactions for the required viewports and languages; lack of test coverage is not evidence of compliance.
- Record the independent reviewer, reviewed commit SHA, rule-by-rule assessment, validation evidence, and resolved findings in the PR review. Keep private local instructions and working notes out of the PR; report only a compliance conclusion for private requirements. Merge is blocked while any applicable requirement is violated or unverified. Fix findings and obtain an independent re-review; any subsequent change invalidates approval until the reviewer checks the new final commit. Reconfirm the gate immediately before merge. If no independent reviewer is available, leave the PR unmerged and report the missing gate.
- Run `git diff --check`. Choose local tests from the changed behavior and its shared callers, and state the scope before running them. Use focused rule, UI, network, storage, or PWA checks as appropriate; documentation-only changes need content/link checks. Run the full `npm run check` when the scope warrants it; CI always runs it for unit tests, Worker/frontend types, and the production build.
- Broaden local testing when a shared dependency changes or a failure exposes a wider impact. UI changes still require the applicable language, viewport, interaction, and visual checks above. Honor explicitly requested full acceptance coverage.
- Reuse successful evidence only when the relevant source, fixtures, dependencies, assets, configuration, and environment are unchanged. Identify the tested commit and distinguish reused results from new runs. Stop repeating passed checks unless a new change, failure, or unresolved concern warrants it.
- Read [tests/README.md](tests/README.md) and the script's environment requirements. Use separate ports for concurrent checkouts; do not stop unrelated services.
- Investigate failures instead of removing assertions, weakening rules, or treating skipped paths as passed. Report environmental limitations and unexecuted checks accurately.
- Seed valid game and persistence fixtures through supported options. Check restored state immediately so rejected checkpoints fail with the scenario name instead of an unrelated selector timeout. Keep rule/scoring expectations independent of the implementation under test.
- Keep CI coverage explicit in `.github/ci-integration.json`. Run independent groups on isolated runners, with sequential scripts inside each group to avoid shared service/fixture contention. Preserve script parameters and build/service dependencies when regrouping tests; share the current run's tested build and use recorded timings to balance groups.
- Every PR head must pass the aggregate `check`: unit/type/build checks and all four integration groups. Failed, cancelled, or skipped prerequisites must not produce a successful aggregate. New commits may cancel superseded runs of the same PR; never cancel unrelated work.
- Optimize CI execution and diagnostics before reducing coverage: parallel groups, script names and timings, bounded service readiness, and useful failure logs. Do not add automatic retries or path-based omissions to hide failures; any future selective CI policy must document shared-dependency triggers and where full coverage still runs.
- Before an authorized release, review the diff, pass CI, merge, fetch the final main commit, and build that version. Recheck main before deployment so unrelated merged work is preserved.
- Follow [deployment instructions](docs/DEPLOYMENT.md), using the configured Worker and Pages projects. Verify the account, origins, bindings, migrations, and remote configuration; do not create duplicate projects.
- Use the installed Wrangler's command help. A dry run establishes packaging validity, not production behavior. CI success does not imply deployment occurred.
- Verify deployment records, both production frontend entries, API health, asset/cache version consistency, and appropriate multiplayer recovery checks. Clean up test rooms.
- Report the actual commit, deployment, validation results, and remaining limitations. Completion requires evidence for the requested scope.
