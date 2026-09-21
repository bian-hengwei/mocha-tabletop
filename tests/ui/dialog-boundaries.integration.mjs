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
  for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){
   await page.setViewportSize({width,height});
   for(const button of await page.locator('.top-tools button,.home-footer button').all()){
    const rect=await button.boundingBox();assert(rect&&rect.height>=44&&rect.width>=44,'Header controls must have usable touch targets');
   }
   const help=page.getByRole('button',{name:language==='zh'?'玩法和安装帮助':'Rules and app help',exact:true});await help.click();
   const panel=page.getByRole('dialog'),content=panel.locator('.panel-content'),close=panel.getByRole('button',{name:language==='zh'?'关闭':'Close',exact:true});
   if(await content.evaluate(node=>node.scrollHeight>node.clientHeight)){
    await content.focus();await page.keyboard.press('PageDown');await expect.poll(()=>content.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
   }
   await content.evaluate(node=>node.scrollTo(0,node.scrollHeight));
   const r=await close.boundingBox();assert(r&&r.y>=0&&r.y+r.height<=height&&r.width>=44&&r.height>=44,'Close stays visible after scrolling to the end');
   assert(await close.evaluate(node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Close is not obscured by scrolling content');
   await page.screenshot({path:`test-results/dialog-boundaries/${safari?'webkit':'chrome'}-help-${language}-${width}-scrolled.png`});
   await close.click();await expect(panel).toHaveCount(0);assert(await help.evaluate(node=>node===document.activeElement));
  }
  await page.setViewportSize({width:844,height:390});
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
