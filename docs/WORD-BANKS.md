# Bilingual word banks

`src/core/games/wordBank.ts` contains 454 Chinese/English entries for Secret Signals and 287 related pairs for Odd Word Out. Both games choose from the entire respective bank. Words are fixed when a match starts and saved in the game state; changing interface language or expanding the bank does not replace words in a saved match.

The selection covers animals, food, nature, buildings, household objects, tools, clothing, arts, sports, occupations and abstract concepts. Secret Signals uses single English words. Odd Word Out also uses familiar compound nouns. Each pair names related but distinguishable things, with the distinction retained in both languages. Translations are chosen for the intended meaning, rather than literal character substitutions.

## Reference and editorial process

Reviewed September 20, 2026:

- [British Council A1–A2 vocabulary](https://learnenglish.britishcouncil.org/free-resources/vocabulary/a1-a2): everyday subject categories and accessible vocabulary level.
- [Moby Word Lists, Project Gutenberg](https://www.gutenberg.org/files/3201/3201-h/3201-h.htm): reference for ordinary English vocabulary; the underlying Moby lists were released into the public domain.
- [Roget’s Thesaurus, Project Gutenberg](https://www.gutenberg.org/files/10681/old/old/10681-h-body.htm): related-concept exploration.

Entries and Chinese/English pairings were independently selected and reviewed. No commercial game deck, website exercise, definition, or complete external list is imported. Sources are references for vocabulary research, not runtime services.

When adding entries, check both languages for duplicates, meaning, length, familiarity and accidental synonyms within a pair. Run `tests/word-bank-quality.test.ts` and the word-game browser regressions. The quality checks also exercise varied deterministic deals, secret-word persistence and representative independently reviewed translations. Semantic clue fairness remains a player responsibility as described in the game rules.
