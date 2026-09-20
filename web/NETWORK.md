# Room transport

The same `GameModule` runs either in a Cloudflare Durable Object (`cloud`) or exclusively on the host phone (`lan`). `src/net/client.ts` exports `RoomClient`. Every guest receives only `GameModule.view(state, theirOwnID)`, never a raw game state. The host is necessarily trusted in LAN mode because it deals the cards.

## Cloud

A SQLite Durable Object owns one room. State, game, per-player action revisions, member credentials, and deduplication IDs are persisted before snapshots are sent. WebSockets use the hibernation API. There are no polling loops or application heartbeat requests to Cloudflare. Actions require the player credential, active membership, current per-player revision, a fresh request ID, and game-engine validation. Independent simultaneous votes do not invalidate other players' still-valid actions. Disconnection pauses the game until that player reconnects.

## LAN

Cloudflare handles lobby, approval, readiness, and WebRTC signaling. Host-star ordered DataChannels use `iceServers: []`: there is no STUN/TURN or cloud game relay. Both ends exchange random nonce proofs before the peer is eligible to start. Game actions and personalized snapshots go only over DataChannels. Local ping/pong detects a suspended or lost peer; it does not contact Cloudflare. Lost channels pause play and receive bounded renegotiation attempts through the signaling socket. Closing all signaling sockets after pairing does not stop a working direct game.

The host privately checkpoints the game in tab session storage before broadcasting. A same-tab refresh can restore that game. Losing the host tab/storage permanently loses the unrevealed state; guests cannot reconstruct it from redacted views. The UI must let the host end the lost game. `switchToCloud()` is an explicit host action: it transfers the authoritative state once to the room Durable Object and then uses cloud actions. It is never selected automatically.

A browser has no native Bonjour/SSID API. Discovery is a list of **candidate rooms sharing a public IPv4 egress address or IPv6 /64 prefix**, salted and hashed entirely server-side. The raw address/hash is not returned. Temporary IPv6 interface IDs within a /64 are normalized server-side before hashing. IPv4-mapped IPv6 is normalized to its exact IPv4 address. Invalid literals, address lists, zones, and prefixes are rejected. IPv4 hash inputs are preserved for existing rooms. Pre-update IPv6 rooms retain their old discovery hash until recreated (their room codes/invites continue to work). VPN, CGNAT, campus Wi-Fi, different /64 assignments, mixed IPv4/IPv6 paths, iCloud Private Relay, and hotspot isolation can produce misses/false candidates. A successful DataChannel proves direct reachability, not a shared SSID. Do not label these candidates as definitely the same Wi-Fi. Short room-code joins require host approval. A high-entropy invite grants access directly. Discovery excludes started/closed/expired rooms. Rooms expire after six hours.

## Frontend integration

- `subscribe(listener)`: immediately emits `ClientState` and returns unsubscribe.
- `create(profile, kind, mode)`, `join(profile, code, invite?)`, `connect()` restore/retry.
- `discover()` is an explicit request, not a timer.
- `ready`, `approve`, `selectGame`, `start`, `action`, `replay`/`endGame`, `switchToCloud`, `leave`, `clearError`, `destroy`.
- Invite is in `?room=ABC234#invite=<secret>`; read the token from the hash. It is not sent in referrers or static page request paths.
- `VITE_API_BASE` defaults to same origin. Set it when the PWA is on Pages and API on Workers.
- Worker `ALLOWED_ORIGINS` is a comma-separated exact origin list. The Worker origin itself is also accepted. Configure production values rather than allowing arbitrary origins.

## Verification

- `npm exec vitest -- run tests/network/room.test.ts`: input validation, immutable game transition, retry deduplication, per-actor simultaneous voting revisions.
- Start `npm exec wrangler -- dev --local --port 8787 --assets public`.
- `node tests/network/cloud.integration.mjs`: actual local Durable Objects/WebSockets; approvals, invitations, member isolation, dedup, stale action rejection, impersonation rejection, pause/reconnect, return-to-lobby discovery, CORS, room dissolve.
- Start Vite at port 5174 (the development default allows localhost/127.0.0.1 ports 5173/5174).
- `node tests/network/lan.integration.mjs`: two isolated Chromium contexts; nonce-verified direct play, no cloud action messages, channel failure pause/renegotiation, host-controller reconstruction, continuation after both signaling sockets close, explicit cloud handoff.
- `npm exec wrangler -- types`, followed by a worker TypeScript check, validates runtime binding types.

Desktop loopback WebRTC is not proof of physical iPhone Safari, personal-hotspot routing, screen-lock behavior, or multi-device offline PWA operation. Those remain device acceptance tests. A router may isolate clients, in which case LAN cannot work and the user can explicitly choose cloud mode.

References: [Cloudflare hibernation WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [Worker assets binding](https://developers.cloudflare.com/workers/static-assets/binding/).

## Deployed backend

- Worker: `mocha-tabletop`
- API base: `https://mocha-tabletop.mocha-tabletop-web.workers.dev`
- Initial deployment version: `211989d6-102d-4146-949c-4cc34ce685b3`
- Frontend production origins allowed: `https://mocha-tabletop-web.pages.dev`, `https://mocha-tabletop.bianhengwei.com` (plus this Worker's own origin and local development origins).
- SQLite Durable Objects use free-plan-compatible bindings. Deployment did not enable a paid plan.
- Initial deployment automatically registered the account's workers.dev subdomain. The provider warned that DNS can take a few minutes; immediately after deployment TLS was not yet ready. Production acceptance status is recorded below when checked.
- HTTPS became ready and the full cloud integration suite passed against the production API on 2026-09-20 UTC. The synthetic test room was dissolved afterward.
- `tests/network/client-terminal.integration.mjs` verifies browser behavior for malformed/nonexistent room codes, rejected approval, and host dissolution during a game. Terminal events clear the room, private view, connection state, and resumable session so a guest can immediately start another room. Initial WebSocket handshakes have a ten-second timeout.

- IPv6 discovery verification: 27 normalization cases plus an actual local Worker/Directory integration test passed. Two synthetic interface addresses in one /64 discover the same candidate; adjacent /64 addresses do not. Full IPs, normalized prefixes, salted hashes, and invite secrets remain absent from discovery responses.
- IPv6-normalization deployment version: `fc09ec3a-6d23-4443-9553-a02ccc2a2f8f`. Wrangler dry run, deployment, and the production cloud multiplayer regression suite passed on 2026-09-20 UTC. The existing frontend `dist` was reused without rebuilding it.
- WebKit LAN acceptance also passed locally: `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/tabletop-playwright TEST_BROWSER=webkit node tests/network/lan.integration.mjs`. This runs WebKit 2203 with two isolated 844×390 mobile/touch browser contexts and covers nonce-verified DataChannels, direct actions with zero cloud action messages, peer failure pause/recovery, host controller restoration, continued play after both signaling sockets close, and explicit cloud handoff. It is desktop WebKit evidence, not a physical iPhone/personal-hotspot test. The suite uses an isolated blank HTML test route for WebKit and a real same-origin manifest document for Chromium (whose synthetic-document local-network access checks otherwise block the fixture). Neither document runs the app hot-reload client.

## Werewolf room options

`RoomInfo.options?: GameOptions` and `RoomClient.create(profile, kind, transport, options?)` / `selectGame(kind, options?)` carry the selected mode. `roomLimits(kind, options)` is exported from both `core/room` and `net/client` for lobby counts. Old rooms with no options remain standard games. Judge rooms have 7–19 total seats: the host is the nonplaying judge and 6–18 guests receive roles. Deal and standard rooms have 6–18 total seats.

The server normalizes judge/deal `moderatorID` to the authenticated room host and rejects a supplied different ID. Only the host can change room options. Match schema version 2 includes canonical options; immutable actions retain that metadata. LAN checkpoints include options and validate them against the live room before restoration. Cloud handoff validates both match-envelope and engine-state options, the complete room roster, participant/role lists, action revisions, and deduplication records. A valid envelope cannot conceal a forged engine moderator ID. Legacy standard matches with no schema/options remain compatible.

Verification: `tests/network/options.test.ts` covers option validation, default compatibility, JSON checkpoint validation, and forged state rejection. `tests/network/werewolf-options.integration.mjs` exercises judge/deal on both cloud and LAN with 7/6 independent browser contexts, including role privacy, host actions, option changes, reconnect, checkpoint restoration, and rejected/successful cloud handoff. `tests/network/werewolf-capacity.integration.mjs` verifies the 19-seat judge maximum against the actual local Worker, refusal at 6 seats, refusal of a 20th connection without a snapshot, and refusal to switch a 19-seat lobby to an 18-seat mode.

A bounded eight-second pairing watchdog also retries an initial WebRTC connection stuck in `new` (observed in WebKit) without a failure event. It shares the existing four-retry budget, never polls the server, and never silently switches to cloud. ICE callbacks from replaced peer connections are ignored.

## iPhone installation API boundary

Safari does not expose a web page API to directly open its Add to Home Screen installation dialog. Apple's supported flow is Safari's Share menu → Add to Home Screen → Open as Web App → Add. An in-app button can show those steps; `navigator.share()` is not an installation API and should not be presented as one. Chromium's `beforeinstallprompt` can be a feature-detected enhancement on platforms that implement it. Sources checked: [Apple iPhone User Guide](https://support.apple.com/guide/iphone/iphea86e5236/ios), [WebKit's 2026 BeforeInstallPromptEvent position, opposed](https://github.com/WebKit/standards-positions/issues/619).

Current option-mode evidence: Chromium and WebKit each passed cloud/judge, cloud/deal, LAN/judge, and LAN/deal. WebKit exposed the initial-ICE stall described above; the bounded watchdog resolved it. Existing two-person LAN recovery/offline-signaling/cloud-handoff regression still passes. All 47 network unit tests and frontend/Worker typechecks pass. These changes have not been deployed; release remains coordinated by the root task.

Redesigned App acceptance: `tests/ui/production.integration.mjs` now uses seven independent mobile/touch browser contexts and the current `.g-table`, `.bt-table`, and `.social-table-v2` UI. It explicitly selects standard werewolf, then separately verifies judge (7 people) and deal (6 people): hidden/revealed identity dialog, host-only judge roster and progress, private guest views, confirmed redeal clearing identity reveals, and reloaded room state. The full six-scenario cloud UI suite passed on local port 5174 in both Chromium and WebKit. Use `BASE_URL=http://127.0.0.1:5174 TEST_SKIP_OFFLINE=1` for dev (no service worker registration); production defaults retain manifest/cache checks and Chromium offline practice checks. No deployment was performed for this test update.
