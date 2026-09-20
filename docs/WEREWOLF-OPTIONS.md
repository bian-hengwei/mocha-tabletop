# Werewolf options

`GameOptions` accepts two optional werewolf-only settings:

- `werewolfPreset: 'auto' | 'hunter' | 'guard'`
- `werewolfWin: 'sides' | 'parity'`

Defaults remain `auto` and `sides`, including existing saves that omit these keys. The room layer canonicalizes explicit default values to the previous representation, preventing reconnect/checkpoint mismatches.

`auto` preserves the prior 6–18-player allocation: `floor(players / 3)` wolves, one Seer, one Witch, Hunter from 8 players, Guard from 12 players, and Villagers in remaining seats. `hunter` always includes Seer/Witch/Hunter and no Guard; `guard` includes Seer/Witch/Guard and no Hunter. Both specialized presets require at least 8 actual players. A judge is an extra nonplaying seat, so their minimum room size is 9.

Under `sides`, good wins when all wolves are eliminated; wolves win when all Villagers or all special good roles are eliminated. Under `parity`, good still wins by eliminating all wolves, while wolves win once living wolves equal or exceed all living good players. Dying Hunter actions resolve before either victory check.

Standard, judge and deal modes share the allocation and preserve options. Judge-mode outcomes use the same victory evaluator as standard. Deal mode remains a physical, manually hosted game; its role cards and redeals retain the selected preset and victory rule. Both rules are included as `board.preset` and `board.winRule` for display.

`tests/werewolf-presets.test.ts` verifies all populations and modes, exact role counts, nonplaying judge exclusion, invalid configuration rejection, room sizes, default-save compatibility, checkpoint rule mismatch rejection, terminal conditions and Hunter resolution order.
