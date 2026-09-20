import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch({executablePath:process.env.CHROME_PATH||undefined});
try {
 for(const viewport of [{width:320,height:568},{width:844,height:390},{width:1440,height:900}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  const profile=page.getByRole('dialog');await profile.getByPlaceholder('你的昵称').waitFor();assert(await profile.getByPlaceholder('你的昵称').evaluate(node=>node===document.activeElement),'Initial profile preserves nickname autofocus');await profile.getByPlaceholder('你的昵称').fill('小狗 Mocha');
  await profile.getByRole('button',{name:'Switch to English'}).click();
  assert.equal(await profile.locator('.language-toggle').innerText(),'中文','target language must remain in its own script');
  assert.equal(await profile.getByPlaceholder('Your name').inputValue(),'小狗 Mocha');
  await profile.getByRole('button',{name:'切换为中文'}).click();
  assert.equal(await profile.locator('.language-toggle').innerText(),'English');
  await profile.getByRole('button',{name:'入座',exact:true}).click();
  await page.locator('.language-toggle').click();
  assert.equal(await page.locator('.language-toggle').innerText(),'中文');
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  await page.reload();assert.equal(await page.locator('.language-toggle').innerText(),'中文');
  await page.locator('.cover-gems').click();await page.locator('.setup-rules').click();
  const rules=page.getByRole('dialog').filter({has:page.locator('.rule-guide')});
  await rules.waitFor();assert.match(await rules.locator('ol').innerText(),/three different colors/);assert.match(await rules.locator('ol').innerText(),/at least four/);
  await rules.getByRole('tab',{name:'Quick start'}).focus();await page.keyboard.press('ArrowRight');
  assert.equal(await rules.getByRole('tab',{name:'Full rules'}).getAttribute('aria-selected'),'true');
  await page.keyboard.press('Home');assert.equal(await rules.getByRole('tab',{name:'Quick start'}).getAttribute('aria-selected'),'true');
  await page.keyboard.press('Tab');assert(await rules.getByRole('tabpanel').evaluate(node=>node===document.activeElement),'Tab skips the inactive rules tab and reaches content');
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert(await rules.evaluate(node=>node.contains(document.activeElement)),'Tab stays in the upper dialog');}
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1,'Escape closes only rules');
  assert(await page.locator('.setup-rules').evaluate(node=>node===document.activeElement),'focus returns to rules opener');
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'onboarding and home fit viewport');
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS native language labels, first-entry language switch, persistence, precise rules and stacked keyboard dialogs at ${viewport.width}x${viewport.height}`);
 }
} finally {await browser.close();}
