import {describe,it,expect} from 'vitest';
import {SIGNAL_WORDS,ODD_WORD_PAIRS} from '../src/core/games/wordBank';
import {codenames} from '../src/core/games/codenames';
import {undercover} from '../src/core/games/undercover';
const players=Array.from({length:4},(_,i)=>({id:`p${i}`,name:`Player ${i}`,avatar:'🐶'}));
describe('expanded everyday vocabulary',()=>{
 it('has broad bilingual coverage without duplicate words or reversed pairs',()=>{
  expect(SIGNAL_WORDS.length).toBeGreaterThanOrEqual(450);
  expect(ODD_WORD_PAIRS.length).toBeGreaterThanOrEqual(280);
  for(const language of [0,1]){
   expect(new Set(SIGNAL_WORDS.map(w=>w[language].normalize('NFKC').toLowerCase())).size).toBe(SIGNAL_WORDS.length);
   expect(new Set(ODD_WORD_PAIRS.map(pair=>pair.map(w=>w[language].normalize('NFKC').toLowerCase()).sort().join('|'))).size).toBe(ODD_WORD_PAIRS.length);
  }
  for(const word of [...SIGNAL_WORDS,...ODD_WORD_PAIRS.flat()]){
   expect(word[0]).toMatch(/[\u3400-\u9fff]/);expect(word[1]).toMatch(/^[A-Za-z][A-Za-z -]*$/);
   expect(word.every(w=>w.trim()===w&&w.length<=24)).toBe(true);
  }
  // Secret Signals intentionally uses single English words, even where Odd Word Out uses compound nouns.
  expect(SIGNAL_WORDS.every(w=>/^[A-Za-z]+$/.test(w[1]))).toBe(true);
 });
 it('keeps independently reviewed meanings and related but different concepts in both languages',()=>{
  for(const word of [['鼓','Drum'],['白银','Silver'],['气球','Balloon'],['犀牛','Rhinoceros'],['蒲公英','Dandelion'],['回形针','Paperclip']])expect(SIGNAL_WORDS).toContainEqual(word);
  for(const pair of [[['海浪','Wave'],['潮汐','Tide']],[['长笛','Flute'],['竖笛','Recorder']],[['日历','Calendar'],['课程表','Timetable']]])expect(ODD_WORD_PAIRS).toContainEqual(pair);
  const translations=new Map<string,string>();
  for(const [zh,en] of [...SIGNAL_WORDS,...ODD_WORD_PAIRS.flat()]){if(translations.has(zh))expect(en).toBe(translations.get(zh));translations.set(zh,en);}
 });
 it('deals diverse, unique boards and preserves already persisted words across UI languages',()=>{
  for(const language of ['zh','en'] as const){
   const seen=new Set<string>(),pairSeen=new Set<string>();
   for(let seed=1;seed<=100;seed++){
    const signals=codenames.create(players,seed,{language});
    expect(new Set(signals.cards.map(c=>c.word)).size).toBe(25);
    signals.cards.forEach(c=>seen.add(c.word));
    const odd=undercover.create(players,seed,{language});pairSeen.add([...odd.words].sort().join('|'));
    const restored=JSON.parse(JSON.stringify(odd));expect(undercover.view(restored,players[0].id).board.word).toBe(undercover.view(odd,players[0].id).board.word);
   }
   expect(seen.size).toBeGreaterThan(400);expect(pairSeen.size).toBeGreaterThan(60);
  }
 });
});
