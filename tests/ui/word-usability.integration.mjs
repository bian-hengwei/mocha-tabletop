import {collectWordPages,findWordPage} from './word-test-pages.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const errors=[];
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));
  const seat=async index=>{const id='word-player-'+index;await page.getByRole('combobox',{name:'Seat'}).selectOption(id);await page.waitForFunction(id=>document.querySelector('main').dataset.viewer===id,id);};
  let acknowledgements=0;const settled=()=>page.waitForFunction(expected=>Number(document.querySelector('[data-testid=network-state]').dataset.completed)>=expected,++acknowledgements);
  const confirm=()=>page.locator('.action-sheet footer button').click();
  await page.goto(base+'/tests/ui/word-usability.fixture.html');await page.locator('.wg-table').waitFor();const red=await page.locator('.wg-team.wg-active.wg-red').count()>0;let captain=red?0:1,operative=red?2:3;await seat(captain);
  const invalid=await page.locator('.wg-word>strong').first().textContent();await page.locator('.wg-clue-form input').fill(invalid);await page.locator('.wg-clue-form button[type=submit]').click();await settled();await page.waitForFunction(()=>document.querySelector('[data-testid=network-error]').textContent.length>0);
  assert.equal(await page.locator('.wg-clue-form input').inputValue(),invalid,'A later server rejection must preserve the clue draft');
  const words=await collectWordPages(page,'.wg-word>strong'),clue=['Journey','Harmony','Mystery'].find(word=>!words.includes(word));
  for(let turn=0;turn<3;turn++){
   await seat(captain);if(turn)assert.equal(await page.locator('.wg-clue-form input').inputValue(),'','A confirmed previous clue must not reappear next round');
   await page.locator('.wg-clue-form select').selectOption('0');assert.match(await page.locator('.wg-clue-guidance').textContent(),locale==='zh'?/不相关/:/Unrelated/);await page.locator('.wg-clue-form select').selectOption('1');
   await page.locator('.wg-key-toggle').click();await page.waitForFunction(()=>document.querySelector('.wg-key-toggle').getAttribute('aria-pressed')==='true');const target=await (await findWordPage(page,page.locator('.wg-word.wg-'+(captain===0?'red':'blue')+':not(.wg-revealed)'))).locator('.wg-cell-index').first().textContent();
   await page.locator('.wg-clue-form input').fill(clue);await page.locator('.wg-clue-form button[type=submit]').click();await settled();await page.locator('.wg-clue-form').waitFor({state:'hidden'});assert.match(await page.locator('.wg-clue-panel').textContent(),new RegExp(clue));
   await seat(operative);await (await findWordPage(page,page.locator('.wg-word').filter({has:page.locator('.wg-cell-index',{hasText:new RegExp('^'+target+'$')})}))).click();await confirm();await settled();await page.locator('.wg-guess-status .wg-button').click();await settled();captain=captain===0?1:0;operative=captain+2;
  }
  console.log(`PASS ${locale} delayed rejection retains draft, confirmed clue clears, same clue reused across 3 rounds, zero clue explanation`);
  acknowledgements=0;await page.goto(base+'/tests/ui/word-usability.fixture.html?kind=undercover');await page.locator('.wg-table').waitFor();const ready=page.locator('.wg-secret-panel>.wg-primary');assert.equal(await ready.isEnabled(),false);
  await page.locator('.wg-secret').click();await page.locator('.wg-secret').click();assert.equal(await ready.isEnabled(),true,'Players can hide a read word before confirming readiness');await seat(1);assert.equal(await ready.isEnabled(),false,'A new seat must read its own word');await seat(0);assert.equal(await ready.isEnabled(),false,'Returning to a seat resets its read acknowledgement');
  for(let index=0;index<3;index++){await seat(index);await page.locator('.wg-secret').click();await page.locator('.wg-secret').click();assert.equal(await page.locator('.wg-secret.wg-open').count(),0);await ready.click();await settled();if(index<2)assert.match(await page.locator('.wg-phase-progress').textContent(),new RegExp(`${index+1} / 3`));}
  for(let index=0;index<3;index++){await seat(index);assert.match(await page.locator('.wg-phase-progress').textContent(),new RegExp(`${index+1} / 3`));if(index<2)assert.match(await page.locator('.wg-next-speaker').textContent(),new RegExp(['Blair','Casey'][index]));else assert.equal(await page.locator('.wg-next-speaker').count(),0);await page.locator('.wg-speaking>.wg-primary').click();await settled();}
  assert.match(await page.locator('.wg-phase-progress').textContent(),/0 \/ 3/);await seat(0);await page.locator('.wg-odd-player').nth(1).click();await confirm();await settled();assert.match(await page.locator('.wg-phase-progress').textContent(),/1 \/ 3/);await page.locator('.wg-speaking>.wg-button').click();await settled();assert.match(await page.locator('.wg-phase-progress').textContent(),/0 \/ 3/);
  for(const [width,height]of [[320,740],[568,320],[1440,900]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  console.log(`PASS ${locale} hide-before-ready, seat reset, ready/vote progress, next speaker, cancel vote updates progress, responsive controls`);
  await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
