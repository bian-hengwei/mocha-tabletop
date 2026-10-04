import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:5311';
const out='test-results/drawguess';
const viewports=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
try {
 for(const language of ['en','zh']) for(const [width,height] of viewports) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true});
  await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),language);
  const page=await context.newPage();
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=drawguess&players=max`);
  await page.locator('.dg-table').waitFor();
  assert.equal(await page.locator('.dg-private-choice button').count(),3);
  await page.locator('.dg-private-choice button').first().click();
  assert.equal(await page.locator('.dg-private-answer').count(),1);
  assert.equal(await page.locator('.dg-canvas').getAttribute('tabindex'),'0');
  await page.locator('.dg-canvas').press('ArrowRight');
  await page.locator('.dg-canvas').dispatchEvent('pointerdown',{clientX:30,clientY:30,pointerId:1});
  await page.locator('.dg-canvas').dispatchEvent('pointermove',{clientX:140,clientY:120,pointerId:1});
  await page.locator('.dg-canvas').dispatchEvent('pointerup',{clientX:180,clientY:150,pointerId:1});
  await page.locator('.dg-draw-tools button').click();
  assert.equal(await page.locator('.dg-draw-tools [role="status"]').count(),1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.dg-draw-tools [role="status"]').count(),0);
  await page.getByLabel('Seat').selectOption('english-player-1');
  assert.equal(await page.locator('.dg-private-answer').count(),0);
  await page.locator('.dg-guess-form input').fill('wrong answer');
  await page.locator('.dg-guess-form').press('Enter');
  assert.equal(await page.locator('.dg-guesses p').count()>0,true);
  if(language==='en') assert(!/[\u3400-\u9fff]/u.test(await page.locator('.dg-table').innerText()),'English drawing view contains Chinese');
  await page.screenshot({path:`${out}/${language}-${width}x${height}.png`,fullPage:true});
  assert.equal(await page.locator('.dg-table').evaluate(node=>node.scrollWidth>node.clientWidth+2),false);
  await context.close();
  console.log('PASS drawguess',language,width,height);
 }
} finally { await browser.close(); }
