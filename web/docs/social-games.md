# Social-game rules and state boundary

Both engines are pure JSON state machines. `create(players, seed)` shuffles reproducibly; `apply` validates against that player's current allowed actions and returns a cloned state. Rejected commands leave the original state unchanged. Only `view(state, authenticatedPlayerID)` is safe to send to a player. The complete engine state contains everybody's identities and must stay on the authoritative room host or server. Unknown IDs are rejected. A client must never choose another player's view ID without connection authentication.

## Werewolf / 狼人杀

Supported counts: **6–18**. The familiar 12-player 预女猎守 setup is 4 wolves, 4 villagers, seer, witch, hunter, guard. Other counts use a fixed, clearly defined small/large party preset: `floor(n / 3)` wolves, seer and witch at every count, hunter from 8 players, guard from 12 players, all remaining seats villagers. These flexible presets should not be advertised as a universally standardized tournament rulebook; local variants differ. At 6 there are 2 wolves, 2 villagers, seer and witch; at 9 there are 3 wolves, 3 villagers, seer/witch/hunter.

Win condition is 屠边: all wolves gone means good wins; otherwise all villagers OR all gods gone means wolves win. A legally triggered hunter shot happens before victory evaluation, including a last-god / last-wolf simultaneous elimination. The engine prioritizes good victory if the hunter removes the final wolf.

First night resolves actions privately before sheriff signup, but deaths are withheld until the election ends. All living players submit in both night stages; no public readiness count, submitted-player list, killer identity, witch knife target, or internal night substage is projected. Only the wolves see other wolves' proposed knife targets. All living wolves must agree or the kill is skipped. Seer results and witch potion inventory are private. Witch cannot self-save and can use at most one potion per night. Once antidote is gone, knife information is no longer shown. Guard cannot protect the same player on consecutive nights. Guard plus antidote on the same knife victim kills that victim (守救同死). Poison bypasses guard and antidote; a poisoned hunter cannot shoot.

Sheriff supports signup, discussion, withdrawal, voting, a single tie runoff, no-sheriff ties/abstentions, 1.5 exile votes, and badge transfer/tearing after death. Election candidates do not vote; during election PK, the tied candidates do not vote. Everyone initially signing up yields no sheriff unless somebody withdraws before voting. Wolves can publicly explode during election speeches, daytime discussion, and day PK; never during voting. The first election explosion postpones election with surviving candidates, resolves the pending night's deaths, then starts another night. A second election explosion consumes the badge. Daytime explosion ends the day and handles any badge before the next night.

Day exile vote is private until all eligible votes are submitted. Ties produce one PK discussion and runoff. Tied nominees cannot vote in the runoff. A second tie or all-abstain vote means nobody is exiled. A sheriff is counted at 1.5 votes only if eligible to vote. Hunter shots are followed by badge transfer if necessary. Dead players have no actions except their pending hunter/badge resolution. Normal deceased identities remain hidden until game end; a publicly exploding wolf or a hunter using their skill is revealed.

**Board contract:** `stage` (both night substages are `night`), `night`, `players`, `ownRole`, `ownKnowledge`, `candidates`, `sheriff`, `publicVotes` (last completed ballot only), `winner`. `players[].role` exists only for the viewing player, publicly revealed characters, or after game end. `ownKnowledge` is an array of display items `{id,title,detail}`. Do not show it on a shared screen. `actions` exposes only allowed current moves.

## Avalon / 阿瓦隆

Supports 5–10. Evil counts: 2 / 2 / 3 / 3 / 3 / 4. Every game includes Merlin, Percival, Morgana and Assassin; remaining slots are loyal servants and evil minions. Mordred, Oberon, Lady of the Lake, Excalibur, and other optional variants are not enabled.

Team sizes by quest:

| Players | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| 5 | 2 | 3 | 2 | 3 | 3 |
| 6 | 2 | 3 | 4 | 3 | 4 |
| 7 | 2 | 3 | 3 | 4 | 4 |
| 8–10 | 3 | 4 | 4 | 5 | 5 |

A strict majority approves a proposed team; tie means rejection. Five consecutive rejections gives evil victory. Leader rotates after rejected teams and completed quests. A completed quest resets the rejection track (implementation resets on approval, as no new team votes occur while that quest executes). Good players can only submit success. Mission votes are secret; only the count of failures is revealed after all team members submit. For 7+ players, quest four needs two failures. Three failed quests give evil victory; three successes lead to the Assassin's one attempt to identify Merlin. Evil knows evil teammates; Merlin sees all evil roles in this preset; Percival sees Merlin and Morgana without differentiating them. Other good players see no additional identities.

**Board contract:** `stage`, `players`, `ownRole`, `ownKnowledge`, `leader` (player ID), `team` (player IDs), `quest`, `teamSize`, `teamSizes`, `results` (success booleans), `failCounts`, `rejections`, `publicVotes` (last completed approval ballot only), `twoFailsRequired`, `winner`. Pending approval/mission votes and their progress are never projected. All identities are revealed at game end.

## Verification

`npm test -- --run tests/social.test.ts` exercises compositions; both types of private information; invalid-command atomicity; JSON round trips; five rejected teams; mission restrictions; quest four's two-failure rule; both assassination outcomes; guard/witch/hunter interactions; sheriff and badge flows; tie PK and weighted voting; single/double explosions; all supported Werewolf counts; and seeded projection-driven simulations across 78 Werewolf and 60 Avalon games. Native iPhone browser/multi-device runtime and transport authentication are separate integration checks.

## Hosted modes (2026-09 revision)

`GameOptions.werewolfMode` selects `standard` (the original engine), `judge`, or `deal`. `moderatorID` must be the room host, enforced at the room/network boundary. Hosted states store the normalized `options` and a full room `players` roster; `participants: Player[]` excludes the judge only in judge mode.

- **Judge:** 6–18 playing people plus one non-playing judge, therefore 7–19 room seats. The judge receives all assigned identities and privately records face-to-face decisions. Players receive only their own identity and have no game actions. Their projections remain identical while the judge progresses through secret night stages. The judge records guard, wolf, witch, and seer decisions; first-night sheriff selection occurs before publishing deaths. The engine resolves guard/save/poison interactions, hunter shot, badge transfer, vote outcome, explosions, postponed elections, double election explosions, and victory. Offline discussion, votes and PK take place face-to-face; the judge enters the final outcome. The app does not fabricate individual ballots.
- **Deal:** 6–18 players including the host. The host receives no extra role knowledge. Only the host can invoke `redeal`, and that action requires `values: ['confirm']`; new roles are shuffled and `dealNumber` increments. No night workflow or online voting is imposed. Players see only their own identity.

`werewolf.ts` dispatches hosted states to `werewolfHosted.ts`; standard state serialization remains compatible. The hosted board has `mode`, `moderatorID`, `isModerator`, `dealNumber`, `ownRole`, `ownRoleKey`, and `players`. Only judge views contain `moderatorOnly` (night target, protections, potions, checks, pending deaths, stage prompt and private notes). Only the judge and the subject of a role see that role field; even finished hosted games do not send all roles to ordinary players.

The official [Zygomatic moderator rules](https://www.zygomatic-games.com/wp-content/uploads/2020/04/werewolvesofmillershollow_en_rules_compressed.pdf) informed the separation of moderator decisions, secret character cards, and delayed morning announcements. This project keeps its documented Chinese-style 预女猎守 / 屠边 preset: the original Miller's Hollow potion, sheriff and victory variations are not silently substituted.

Avalon presentation uses distinct team selection, approval, secret quest cards, and task history, consistent with the game structure described by [Indie Boards & Cards](https://indieboardsandcards.com/our-games/the-resistance-avalon/). [Avalon Online](https://avalon-game.com/) was inspected for practical role/quest navigation. Its rule page includes online-specific variants (fifth team automatically accepted, combined assassin duties); those are **not** adopted into this project's standard engine.

### UI audit

`SocialTable.tsx` replaces the generic tiny identity tile with a concealed card and a full portrait/knowledge overlay. Hosted players get a single personal identity card; the judge gets a private role roster and stage control. Avalon adds physical vote/quest tokens in the center, while all existing standard-game actions remain available.

Self-review fixes: removed literary slogans and invented faction names, kept factual abilities; maintained concealment across seat/deal changes; tested 18-player judge rosters, 18-player deal mode, and 10-player Avalon at both 667×375 and 844×390. `tests/ui/social-hosted.integration.mjs` drives real displayed controls, verifies every living judge seat is targetable, checks that player views have no moderator controls, checks redeal confirmation, and captures identity/phase layouts. Screenshots and structured bounds reports are in `tests/ui/artifacts/`.
