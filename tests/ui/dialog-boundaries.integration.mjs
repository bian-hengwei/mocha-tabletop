import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',safari=process.env.TEST_BROWSER==='webkit';
const browser=await(safari?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
await fs.mkdir('test-results/dialog-boundaries',{recursive:true});
try{
 for(const language of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
  await context.addInitScript(language=>{localStorage.setItem('mocha-locale',language);localStorage.setItem('mocha-profile',JSON.stringify({id:'dialog-audit',name:'Mocha',avatar:'🦊'}));},language);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);await page.goto(base);
  const install=page.locator('.install-button');await install.click();const dialog=page.locator('.install-panel');await dialog.waitFor();
  await page.screenshot({path:`test-results/dialog-boundaries/${safari?'webkit':'chrome'}-install-${language}-portrait.png`});
  await page.keyboard.press('Tab');assert(await dialog.evaluate(node=>node.contains(document.activeElement)),'Install instructions must keep keyboard focus inside the dialog');
  assert(await page.locator('.game-library').evaluate(node=>!!node.closest('[inert]')),'Background game controls must be inert');
  await page.setViewportSize({width:844,height:390});await page.keyboard.press('Shift+Tab');assert(await dialog.evaluate(node=>node.contains(document.activeElement)));
  await page.screenshot({path:`test-results/dialog-boundaries/${safari?'webkit':'chrome'}-install-${language}-landscape.png`});
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);assert(await install.evaluate(node=>node===document.activeElement),'Escape returns focus to the install opener');
  await page.keyboard.press('Enter');await dialog.waitFor();await dialog.locator('header button').click();assert(await install.evaluate(node=>node===document.activeElement),'Pointer close returns focus to the install opener');
  await page.locator('.profile-chip').click();const profile=page.locator('.profile-editor'),input=profile.locator('input');await input.focus();
  for(const key of ['Escape','Tab'])for(const legacy of [false,true]){
   await input.evaluate((node,{key,legacy})=>node.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,isComposing:!legacy,keyCode:legacy?229:0})),{key,legacy});
   assert.equal(await profile.count(),1,'IME candidate cancellation must not dismiss the profile');
   assert(await input.evaluate(node=>node===document.activeElement),'IME candidate navigation must not move dialog focus');
  }
  await page.keyboard.press('Escape');await expect(profile).toHaveCount(0);assert(await page.locator('.profile-chip').evaluate(node=>node===document.activeElement));
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${language} install dialog: focus containment, inert background, rotation, Escape/pointer close/reopen, IME Escape/Tab preservation`);
 }
}finally{await browser.close();}
