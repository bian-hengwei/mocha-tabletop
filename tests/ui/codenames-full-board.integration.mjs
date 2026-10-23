import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5173';
const out='test-results/codenames-full-board';
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});

function cards(page){return page.locator('.wg-signals.wg-whole-board .wg-word');}
async function assertWholeBoard(page,{longWords=false}={}){
 await expect(cards(page)).toHaveCount(25);
 assert.deepEqual(await cards(page).locator('.wg-cell-index').allTextContents(),Array.from({length:25},(_,index)=>String(index+1)),'Whole-board mode keeps the 5x5 card order');
 const rects=await cards(page).evaluateAll(nodes=>nodes.map(card=>{
  const rect=card.getBoundingClientRect(),label=card.querySelector('strong').getBoundingClientRect();
  return {width:rect.width,height:rect.height,top:rect.top,bottom:rect.bottom,labelTop:label.top,labelBottom:label.bottom,labelHeight:label.height,scrollHeight:card.querySelector('strong').scrollHeight,clientHeight:card.querySelector('strong').clientHeight,word:card.querySelector('strong').textContent};
 }));
 const viewport=page.viewportSize();
 assert(rects.every(card=>card.width>=44&&card.height>=44&&card.top>=0&&card.bottom<=viewport.height+1),'Every full-board card remains a 44px reachable target');
 const clipped=rects.filter(card=>card.labelTop<card.top||card.labelBottom>card.bottom||card.scrollHeight>card.clientHeight+1);
 assert.equal(clipped.length,0,`Word labels stay inside their cards: ${JSON.stringify(clipped)}`);
 if(longWords)assert(rects.some(card=>card.word==='Password-free payment'),'The independent modern long-word fixture is active');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Whole-board mode has no horizontal page overflow');
}

try{
 for(const locale of ['zh','en']){
  for(const [width,height] of sizes){
   const context=await browser.newContext({viewport:{width,height}});
   await context.addInitScript(value=>localStorage.setItem('mocha-locale',value),locale);
   const page=await context.newPage();page.setDefaultTimeout(8_000);
   await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=codenames&players=max${locale==='en'?'&scenario=modern-long-words':''}`);
   await page.locator('.wg-table').waitFor();
   const whole=page.locator('.wg-whole-toggle');
   await whole.click();await expect(whole).toHaveAttribute('aria-pressed','true');
   await assertWholeBoard(page,{longWords:locale==='en'});
   await page.screenshot({path:`${out}/whole-${locale}-${width}x${height}.png`});
   await page.setViewportSize({width:height,height:width});await assertWholeBoard(page,{longWords:locale==='en'});
   await page.setViewportSize({width,height});
   await whole.click();await expect(page.locator('.wg-word')).toHaveCount(width<650&&height>=500?9:width<650||height<500?10:25);
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(value=>localStorage.setItem('mocha-locale',value),locale);
  const page=await context.newPage();page.setDefaultTimeout(8_000);
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=codenames&players=max`);await page.locator('.wg-table').waitFor();
  const red=await page.locator('.wg-team.wg-active.wg-red').count()>0, captain=red?0:1,operative=red?2:3;
  await page.getByLabel('Seat').selectOption(`english-player-${captain}`);
  const whole=page.locator('.wg-whole-toggle');await whole.click();
  await page.locator('.wg-key-toggle').click();await expect(page.locator('.wg-word.wg-assassin')).toHaveCount(1);
  await page.getByLabel('Seat').selectOption(`english-player-${operative}`);await expect(page.locator('.wg-word.wg-assassin')).toHaveCount(0);
  await expect(cards(page)).toHaveCount(25);
  const mark=page.locator('.wg-mark-toggle');await mark.click();
  const target=cards(page).nth(0);await target.click();await expect(target.locator('.wg-personal-mark')).toHaveText('?');await target.click();await expect(target.locator('.wg-personal-mark')).toHaveText('×');
  await whole.click();await whole.click();await expect(target.locator('.wg-personal-mark')).toHaveText('×');
  await page.getByLabel('Seat').selectOption(`english-player-${captain}`);
  await page.locator('.wg-clue-form input').fill('Orbiting');await page.locator('.wg-clue-form button[type=submit]').click();await expect(page.locator('.wg-clue-form')).toHaveCount(0);
  await page.getByLabel('Seat').selectOption(`english-player-${operative}`);
  await target.click();await expect(page.locator('.action-sheet')).toBeVisible();await expect(cards(page)).toHaveCount(25);
  await page.locator('.action-sheet .sheet-heading>.icon').click();await expect(page.locator('.action-sheet')).toHaveCount(0);
  await expect(target.locator('.wg-personal-mark')).toHaveText('×');
  await page.screenshot({path:`${out}/operative-mark-${locale}.png`});
  await context.close();
 }
}finally{await browser.close();}
