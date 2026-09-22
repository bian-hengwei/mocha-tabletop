# Werewolf options

`GameOptions` accepts `werewolfPreset` and `werewolfWin: 'sides' | 'parity'`. Existing saves retain the default `auto` / `sides` behavior. All three modes share the same role catalog, room limits and victory rules.

| Preset ID | Players | Lineup |
| --- | --- | --- |
| `auto` | 6–18 | One third Werewolves, Seer, Witch; Hunter from eight and Guard from twelve; remaining Villagers |
| `classic9` | 9 | 3 Werewolves, 3 Villagers, Seer, Witch, Hunter |
| `classic` | 12 | 4 Werewolves, 4 Villagers, Seer, Witch, Hunter, Guard |
| `idiot` | 12 | 4 Werewolves, 4 Villagers, Seer, Witch, Hunter, Fool |
| `wolfKing` | 12 | 3 Werewolves, Wolf King, 4 Villagers, Seer, Witch, Hunter, Guard |
| `hunter` | 8–18 | One third Werewolves; Seer, Witch, Hunter; remaining Villagers |
| `guard` | 8–18 | One third Werewolves; Seer, Witch, Guard; remaining Villagers |

A moderator occupies one extra seat and receives no role. Fixed boards require the exact participant count. Setup previews the role quantities; changing a room's configuration resets readiness. Checkpoints must match the selected role distribution, not merely the participant list.

Under `sides`, good wins when all wolves are eliminated; wolves win when all Villagers or all special good roles are eliminated. Under `parity`, wolves instead win once living wolves equal or outnumber living good players. Fool is a special good role; Wolf King counts as a wolf.

The Fool reveals and survives exile, then loses voting rights and cannot be exiled again. A night attack, poison or shot still eliminates them. Wolf King acts with the wolf team and receives the same Seer result as an ordinary wolf. Hunter and Wolf King can trigger one another's death shots; poison and self-explosion suppress a Wolf King shot. Public shot labels do not disclose which of the two roles fired.

This table explicitly destroys the Sheriff badge when its Fool holder reveals, and ends the game immediately when the last Wolf King is eliminated. A pending Hunter shot retains the existing resolution priority. These are stated table conventions, not a claim that every platform uses identical tie-breaking or death-resolution rules. Deal-only mode distributes roles for an in-person moderator and does not automate subsequent play.

In standard mode, each player acts or closes their eyes once at the start of each night. Only the Witch then receives the potion decision; everyone else continues waiting without another acknowledgement. A Witch eliminated on an earlier night is skipped automatically. A Witch attacked tonight still acts before dawn, and first-night deaths remain hidden until the Sheriff election resolves. Public views do not reveal the internal night step. Unversioned saved games finish their current night using the original acknowledgements and adopt `nightFlowVersion: 2` at the next night boundary.

Role capabilities and common configurations were checked on 2026-09-20 against [NetEase's published rules](https://langrensha.com/wanfa/guize/2017/10/18/26899_719311.html) and [WPL configuration guidance](https://langrensha.com/2022/wpl/20221009/37768_1045993.html). This implementation does not include every advanced role on those platforms.

Coverage: `werewolf-presets.test.ts`, `werewolf-expanded.test.ts`, network `werewolf-lineups.integration.mjs`, and UI `werewolf-lineups.integration.mjs`. These cover allocation, exact counts, moderator exclusion, invalid actions, Fool voting/death, shot chains, self-knife followed by election explosion, private views, checkpoint mismatch, bilingual setup and replay after reload.
