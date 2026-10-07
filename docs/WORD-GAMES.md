# Word games: implementation and rule references

## Secret Signals / 密语行动

Implements the standard two-team Codenames rules under an original display name and visual design. Seats alternate red/blue; the first member of each team is captain. A seeded random starting team receives 9 agents; the opposing team receives 8, alongside 7 bystanders and 1 assassin. Only the two captains receive the secret key in their server projection. Operatives can privately mark unrevealed words with ? or ×; only the author receives those marks, and marking does not consume a guess or turn.

Clues consist of one word plus a number. Operatives must make at least one guess and can make the clue count plus one guesses; zero and unlimited clues remove the guess cap. Incorrect guesses end the turn; an assassin loses immediately. Completing either team's agents wins for that team, including on its opponent's turn. Captains can concede an invalid clue after the table agrees; this ends their turn and lets the opposing captain optionally reveal one own agent before giving a new clue.

The engine enforces command authority, format, direct unrevealed-word matches/inflections and guess limits. Meaning, compound-word boundaries and impermissible nonverbal hints still need the players' judgement, as at a physical table. The 454-entry bilingual everyday word list is original; words are fixed to the match language selected at creation.

Sources checked 2026-09-20:
- Publisher overview: https://www.czechgames.com/games/codenames
- Publisher base-game rules (may redirect to current product page): https://czechgames.com/files/rules/codenames-rules-en.pdf
- Official clues and zero/infinity reference: https://faq.codenamesapp.com/en/gameplay/how-to-play/rules-and-clues/

## Odd Word Out / 异词同伴

A private word-dealing tool with an original 287-pair bilingual word bank and no blank-word role. Everyone receives only their own word, never their role or the other word. Acknowledgements are public; discussion, voting, elimination and victory decisions happen at the physical table. There are no online speaking turns, ballots or automatic results.

Setup uses 1 odd-word player for 3–6 participants, 2 for 7–10, and 3 for 11–12. Hide the word after acknowledgement, on seat changes and when redealing. The host can return to setup from the menu to deal again. Legacy checkpoints retain their assigned words but render the same dealing-only interface.

Primary implementation references for the underlying word/description/vote structure and variant differences:
- https://www.undercovergame.com/
- https://www.undercoverword.com/faq

## Verification

`tests/word-games.test.ts` covers bilingual data, complete wins, secret projection boundaries, captain/operative authority, guess limits, assassin/opponent wins, acknowledgements, dealing-only authority, legacy checkpoint compatibility, private personal Codenames marks and actual `applyMatch` actor revisions. Browser integration lives in `tests/ui/word-games.integration.mjs` and uses real App controls.
