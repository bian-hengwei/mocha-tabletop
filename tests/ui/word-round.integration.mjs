import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await(process.env.TEST_BROWSER==='webkit'?webkit:chromium).launch(),base=process.env.BASE_URL||'http://127.0.0.1:5208';
try{for(const locale of ['zh','en'])for(const [width,height]of [[320,568],[568,320]]){
 const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(l=>localStorage.setItem('mocha-locale',l),locale);const page=await context.newPage();await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=undercover`);
 const words=[];for(let i=0;i<3;i++){await page.getByLabel('Seat',{exact:true}).selectOption(`english-player-${i}`);await expect(page.locator('.wg-open')).toHaveCount(0);await page.locator('.wg-secret').click();words.push(await page.locator('.wg-secret strong').textContent());await page.locator('.wg-secret-panel>.wg-primary').click();await expect(page.locator('.wg-open')).toHaveCount(0);}
 assert.equal(new Set(words).size,2);await expect(page.locator('.wg-heading>span')).toHaveText('3 / 3');await expect(page.locator('.wg-speaking,.wg-final-word,.wg-odd-player')).toHaveCount(0);await page.locator('.wg-help-button').click();await page.setViewportSize({width:height,height:width});await page.keyboard.press('Escape');await expect(page.locator('.wg-help-button')).toBeFocused();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();console.log('PASS private word deal and offline continuation',locale,width,height);
}}finally{await browser.close();}
