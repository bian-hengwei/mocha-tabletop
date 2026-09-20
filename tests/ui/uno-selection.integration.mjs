import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const out='test-results/uno-selection';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];
try{
for(const locale of ['zh','en'])for(const viewport of [{width:320,height:568},{width:568,height:320},{width:1280,height:720}]){
 const context=await browser.newContext({viewport,deviceScaleFactor:1});await context.addInitScript(locale=>{localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify({id:'uno-ui-test',name:'Tester',avatar:'🦊'}));},locale);
 const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
 const fixture=base+'/tests/ui/i18n.fixture.html?kind=uno&scenario=selection';
 await page.goto(fixture);const hand=page.locator('.ng-uno-hand .ng-uno-card'),play=page.locator('.ng-uno-play'),red7=hand.nth(0),red9=hand.nth(1),wild=hand.nth(3);
 await expect(hand).toHaveCount(5);await expect(play).toBeDisabled();await expect(hand.nth(2)).toBeDisabled();
 const top=await page.locator('.ng-uno-center .ng-uno-card').getAttribute('aria-label');
 await red7.click();await expect(red7).toHaveAttribute('aria-pressed','true');await expect(play).toBeEnabled();await expect(hand).toHaveCount(5);assert.equal(await page.locator('.ng-uno-center .ng-uno-card').getAttribute('aria-label'),top,'Selection does not change discard');
 await expect.poll(()=>red7.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(-8);
 const selectedStyle=await red7.evaluate(el=>({border:getComputedStyle(el).borderColor,shadow:getComputedStyle(el).boxShadow}));assert.notEqual(selectedStyle.shadow,'none');
 await red7.click();await expect(red7).toHaveAttribute('aria-pressed','false');await expect(play).toBeDisabled();
 await red7.click();await red9.click();await expect(red7).toHaveAttribute('aria-pressed','false');await expect(red9).toHaveAttribute('aria-pressed','true');await expect(page.locator('.ng-uno-selected')).toHaveCount(1);
 await wild.click();await expect(play).toBeDisabled();const colors=page.locator('.ng-uno-colors button');await expect(colors).toHaveCount(4);assert((await colors.allTextContents()).every(s=>s.trim().length),'Every color has a text label');
 await colors.nth(3).click();await expect(colors.nth(3)).toHaveAttribute('aria-pressed','true');await expect(play).toBeEnabled();
 await page.locator('.ng-uno-playbar').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${locale}-wild-${viewport.width}.png`});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page stays within viewport');
 const bar=await page.locator('.ng-uno-playbar').boundingBox();assert(bar.x>=0&&bar.x+bar.width<=viewport.width+1,'Play bar fits width');
 await wild.click();await expect(play).toBeDisabled();await expect(colors).toHaveCount(0);
 await red7.click();await page.getByRole('combobox',{name:'Seat'}).selectOption('english-player-1');await expect(page.locator('.ng-uno-selected')).toHaveCount(0);await expect(page.locator('.ng-uno-playbar')).toHaveCount(0);await page.getByRole('combobox',{name:'Seat'}).selectOption('english-player-0');await expect(play).toBeDisabled();
 await red9.click();await play.click();await expect(hand).toHaveCount(4);await expect(page.locator('.ng-uno-selected')).toHaveCount(0);await expect(page.locator('.ng-uno-center .ng-uno-card')).toHaveAttribute('aria-label',locale==='zh'?'红色 9':'Red 9');
 await page.goto(fixture);await wild.click();await colors.nth(3).click();await play.click();await expect(hand).toHaveCount(4);await expect(page.locator('.ng-uno-selected')).toHaveCount(0);await expect(page.locator('.ng-color-badge')).toHaveText(locale==='zh'?'蓝色':'Blue');
 await page.goto(fixture+'&challenge=off');await expect(hand.nth(4)).toBeDisabled();assert.match(await page.locator('.ng-edition').textContent(),locale==='zh'?/质疑已关闭/:/challenge.*off/i);
 // Exercise the real launch form and verify its switch reaches the actual saved engine state.
 await page.goto(base);await page.locator('.cover-uno').click();const toggle=page.getByRole('switch');await expect(toggle).toBeChecked();await toggle.uncheck();await expect(toggle).not.toBeChecked();
 await page.screenshot({path:`${out}/${locale}-setup-${viewport.width}.png`});
 const form=await page.locator('.create-body').boundingBox();assert(form.x>=0&&form.x+form.width<=viewport.width+1,'Setup form fits width');
 await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();await page.locator('.ng-uno').waitFor();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')));assert.equal(saved.practice.options.unoChallenge,false);assert.equal(saved.practice.game.challengeEnabled,false);
 await page.reload();await expect(page.locator('.ng-edition')).toContainText(locale==='zh'?'+4 质疑已关闭':'Draw Four challenges off');
 console.log(`PASS ${locale} ${viewport.width}x${viewport.height}: select/cancel/swap/lift, Play, wild colors, seat reset, switch and reload`);await context.close();
}
assert.deepEqual(errors,[]);console.log('PASS UNO selection UI; no browser errors');
}finally{await browser.close();}
