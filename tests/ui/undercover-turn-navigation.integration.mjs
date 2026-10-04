import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit.launch():chromium.launch());
const output=`test-results/undercover-turn-navigation-${engine}`;
await fs.mkdir(output,{recursive:true});
const errors=[];
try{
 for(const language of ['zh','en']){
  const page=await browser.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(value=>localStorage.setItem('mocha-locale',value),language);
  for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){
   await page.setViewportSize({width,height});
   await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=undercover&players=max&scenario=late-speaker`);
   await expect(page.locator('.wg-speaking-now')).toContainText('Indigo');
   const paged=width<650||height<500;
   if(paged){
    await expect(page.locator('.wg-pages span')).toHaveText('3 / 3');
    await page.getByRole('button',{name:language==='zh'?'上一页':'Previous page',exact:true}).click();
    await expect(page.locator('.wg-pages span')).toHaveText('2 / 3');
    await page.getByRole('button',{name:'Toggle language',exact:true}).click();
    await expect(page.locator('.wg-pages span')).toHaveText('2 / 3');
    await page.getByRole('button',{name:'Toggle language',exact:true}).click();
   }
   await page.locator('.wg-secret').click();
   await expect(page.locator('.wg-secret.wg-open')).toHaveCount(1);
   await page.getByRole('combobox',{name:'Seat'}).selectOption('english-player-8');
   await expect(page.locator('.wg-secret.wg-open')).toHaveCount(0);
   await expect(page.locator('.wg-speaking-now')).toContainText('Indigo');
   await page.locator('.wg-speaking>.wg-primary').click();
   await expect(page.locator('.wg-speaking-now')).toContainText('Jules');
   await expect(page.locator('.wg-secret.wg-open')).toHaveCount(0);
   await page.screenshot({path:`${output}/${language}-${width}.png`});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));
   for(let seat=9;seat<12;seat++){
    await page.getByRole('combobox',{name:'Seat'}).selectOption(`english-player-${seat}`);
    await page.locator('.wg-speaking>.wg-primary').click();
   }
   await expect(page.locator('.wg-speaking-now')).toHaveCount(0);
   await expect(page.locator('.wg-odd-player').filter({hasText:'Player 12'})).toBeVisible();
   if(paged){
    await expect(page.locator('.wg-pages span')).toHaveText('3 / 3');
    await page.locator('.wg-pages button').first().click();
    await expect(page.locator('.wg-pages span')).toHaveText('2 / 3');
   }
   await page.setViewportSize({width:390,height:844});
   await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=undercover&players=max&scenario=late-speaker`);
   await page.setViewportSize({width:844,height:390});
   await expect(page.locator('.wg-speaking-now')).toContainText('Indigo');
   await page.setViewportSize({width:768,height:1024});
   await expect(page.locator('.wg-pages')).toHaveCount(0);
   await page.setViewportSize({width:390,height:844});
   await expect(page.locator('.wg-speaking-now')).toContainText('Indigo');
   console.log('PASS',language,width,height,'speaker following, manual browsing, seat privacy, voting and rotation');
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
