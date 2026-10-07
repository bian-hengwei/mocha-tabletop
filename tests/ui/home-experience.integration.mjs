import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch(),out=`test-results/home-experience-${engine}`;await fs.mkdir(out,{recursive:true});
try{for(const locale of ['zh','en'])for(const [width,height]of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){
 const page=await browser.newPage({viewport:{width,height}});await page.addInitScript(locale=>{localStorage.setItem('mocha-profile',JSON.stringify({id:'home_review',name:'Mocha',avatar:'🦊'}));localStorage.setItem('mocha-locale',locale);},locale);await page.goto(base);await expect(page.locator('.home-shell')).toBeVisible();await expect(page.locator('.home-shell .game-cover')).toHaveCount(14);await page.screenshot({path:`${out}/${locale}-${width}x${height}.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 for(const size of await page.locator('.home-entry-actions button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height)))assert(size>=44);
 await page.locator('.home-footer .text-button').click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.home-footer .text-button')).toBeFocused();
 const oddWord=page.locator('.home-shell .cover-undercover');await oddWord.click();await expect(page.getByRole('dialog')).toContainText(locale==='zh'?'异词同伴':'Odd Word');await page.setViewportSize({width:height,height:width});await page.keyboard.press('Escape');await expect(oddWord).toBeFocused();await page.setViewportSize({width,height});
 await page.locator('.home-entry-actions button').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.home-entry-actions button').first()).toBeFocused();await page.close();console.log('PASS home',locale,width,height);
}}finally{await browser.close();}
