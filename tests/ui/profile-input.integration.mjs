import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await(process.env.TEST_BROWSER==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  const input=page.locator('input[autocomplete="nickname"]');
  await input.fill('小猫');
  await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,keyCode:13,bubbles:true});
  await expect(input).toBeVisible();
  assert.equal(await page.evaluate(()=>localStorage.getItem('mocha-profile')),null,'Committing an IME candidate must not create a profile');
  // Some IME/browser sequences mark the final composing key with legacy 229.
  await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:false,keyCode:229,bubbles:true});
  await expect(input).toBeVisible();
  await input.fill('小猫玩家');await input.press('Enter');
  await expect(input).toHaveCount(0);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-profile')).name),'小猫玩家');
  await page.getByRole('button',{name:locale==='en'?'Edit name and avatar':'修改昵称头像',exact:true}).click();
  await input.fill('南风');
  await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,keyCode:13,bubbles:true});
  await expect(input).toBeVisible();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-profile')).name),'小猫玩家','IME composition must not overwrite the saved nickname');
  await input.fill('南风玩家');await input.press('Enter');
  await expect(input).toHaveCount(0);await page.reload();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-profile')).name),'南风玩家');
  assert.deepEqual(errors,[]);await context.close();
  console.log(`PASS ${locale} profile IME candidate confirmation, real Enter save, edit and reload`);
 }
}finally{await browser.close();}
