import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch(),out=`test-results/undercover-dealer-${engine}`;await fs.mkdir(out,{recursive:true});
try{for(const locale of ['zh','en'])for(const [width,height]of [[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]]){
 const page=await browser.newPage({viewport:{width,height}});await page.addInitScript(l=>localStorage.setItem('mocha-locale',l),locale);
 await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=undercover&players=max&scenario=late-speaker`);
 await expect(page.locator('.wg-dealt-players>span')).toHaveCount(12);await expect(page.locator('.wg-speaking,.wg-odd-player,.wg-final-word')).toHaveCount(0);
 await page.locator('.wg-secret').click();await expect(page.locator('.wg-open')).toHaveCount(1);const word=await page.locator('.wg-secret strong').innerText();
 await page.getByRole('button',{name:'Toggle language'}).click();await expect(page.locator('.wg-secret strong')).toHaveText(word);await page.getByRole('button',{name:'Toggle language'}).click();
 await page.getByLabel('Seat',{exact:true}).selectOption('english-player-8');await expect(page.locator('.wg-open')).toHaveCount(0);await page.getByLabel('Seat',{exact:true}).selectOption('english-player-0');await expect(page.locator('.wg-open')).toHaveCount(0);
 await page.locator('.wg-help-button').click();await expect(page.getByRole('dialog')).toBeVisible();await page.setViewportSize({width:height,height:width});await page.keyboard.press('Escape');await expect(page.locator('.wg-help-button')).toBeFocused();await page.setViewportSize({width,height});
 await page.locator('.wg-dealt-players>span').last().scrollIntoViewIfNeeded();await expect(page.locator('.wg-dealt-players>span').last()).toBeInViewport();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`${out}/${locale}-${width}x${height}.png`});await page.close();console.log('PASS',locale,width,height,'legacy checkpoint as dealer, seat privacy, language, help, all names');
}}finally{await browser.close();}
