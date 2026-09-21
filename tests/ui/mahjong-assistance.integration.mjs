import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',out='test-results/mahjong-assistance';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
try{for(const locale of ['zh','en']){
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const helper=()=>page.locator('.mahjong-assist-button'),dialog=page.getByRole('dialog');
 for(const [width,height]of sizes){
  await page.setViewportSize({width,height});await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=quick`);
  await page.locator('.classic-hand button').last().click();await helper().click();
  await expect(dialog).toBeVisible();await expect(page.locator('.mahjong-wait')).toHaveCount(3);
  await expect(page.locator('.mahjong-assist-summary')).toHaveText(locale==='zh'?'听 3 种 · 未见 9 张':'3 tile types · 9 unseen');
  await expect(page.locator('.mahjong-assist-discard select')).toHaveValue('26');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const rect=await dialog.boundingBox();assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1);
  if(locale==='en')assert(!/[\u3400-\u9fff]/u.test(await dialog.innerText()));
  await page.screenshot({path:`${out}/${locale}-${width}.png`});
  // Previewing a different discard never changes the real hand or actual selection.
  await page.locator('.mahjong-assist-discard select').selectOption('0');await expect(page.locator('.mahjong-wait')).toHaveCount(1);await expect(page.locator('.mahjong-wait strong')).toHaveText(locale==='zh'?'9条':'9 Bamboo');
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(helper()).toBeFocused();
  await expect(page.locator('.classic-hand button')).toHaveCount(14);await expect(page.locator('.classic-hand button[aria-pressed="true"]')).toHaveCount(1);
 }
 await helper().click();await page.setViewportSize({width:844,height:390});await expect(dialog).toBeVisible();await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)));await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Toggle language'}).click();await helper().click();await expect(dialog).toHaveAttribute('aria-label',locale==='zh'?'Tile helper':'听牌助手');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Toggle language'}).click();await page.getByRole('combobox',{name:'Seat'}).selectOption('1');await expect(page.locator('.classic-hand button[aria-pressed="true"]')).toHaveCount(0);await helper().click();await expect(page.locator('.mahjong-assist-discard')).toHaveCount(0);await page.keyboard.press('Escape');
 await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=wide-waits&mode=laizi`);await helper().click();await expect(page.locator('.mahjong-wait')).toHaveCount(33);await page.locator('.mahjong-wait').last().scrollIntoViewIfNeeded();await expect(page.locator('.mahjong-wait').last()).toBeVisible();await page.screenshot({path:`${out}/${locale}-wide-waits.png`});await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${locale}: helper waits, counts, preview, seven sizes, rotation, focus, seat and language switching`);
}}finally{await browser.close();}
