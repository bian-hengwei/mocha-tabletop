import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',safari=process.env.TEST_BROWSER==='webkit';
const browser=await(safari?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/classic-dense-${safari?'webkit':'chromium'}`;await fs.mkdir(out,{recursive:true});
try{for(const locale of ['zh','en'])for(const [width,height] of [[320,568],[390,844],[568,320],[844,390],[430,932],[932,430],[768,1024],[1440,900]]){
 const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=dense&mode=bloodflow`);await expect(page.locator('.mj-melds .mj-back')).toHaveCount(4);
 for(const river of await page.locator('.mj-river').all()){
  await expect(river.locator('.mj-face')).toHaveCount(12);await river.locator('button').click();await expect(page.locator('.mj-all-discards .mj-face')).toHaveCount(24);await page.keyboard.press('Escape');
 }
 const overflow=await page.locator('.game-surface, .game-surface *').evaluateAll(es=>es.filter(e=>e.clientHeight>0&&e.scrollHeight>e.clientHeight+2&&['auto','scroll','hidden'].includes(getComputedStyle(e).overflowY)).map(e=>({c:e.className,h:e.clientHeight,sh:e.scrollHeight})));assert.deepEqual(overflow,[],'no vertical scrolling or cropped table content');
 assert(await page.evaluate(()=>{const overlap=(a,b)=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1;};return !overlap(document.querySelector('.seat-across'),document.querySelector('.mj-rack-across'))&&!overlap(document.querySelector('.mj-history'),document.querySelector('.seat-right .mj-avatar'));}),'seat labels, racks and history control have separate space');
 await page.screenshot({path:`${out}/${locale}-${width}.png`});
 const history=page.getByRole('button',{name:locale==='zh'?'胡牌记录 (1)':'Win history (1)',exact:true});await history.click();await expect(page.getByRole('dialog')).toBeVisible();await page.setViewportSize({width:height,height:width});const box=await page.getByRole('dialog').boundingBox();assert(box.y>=0&&box.y+box.height<=width+1);await page.keyboard.press('Escape');await expect(history).toBeFocused();await expect(page.locator('.mj-status')).toContainText(locale==='zh'?'已胡牌':'Hand locked');assert.deepEqual(errors,[]);
 console.log('PASS',locale,width,'dense rivers, full discard inspection, concealed melds, locked hand and dialog rotation');await context.close();
}}finally{await browser.close();}
