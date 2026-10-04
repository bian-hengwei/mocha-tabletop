import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const out=`test-results/codenames-input-${engine}`;
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
try{
 await fs.mkdir(out,{recursive:true});
 for(const locale of ['zh','en']){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(locale=>{
   localStorage.setItem('mocha-locale',locale);
   localStorage.setItem('mocha-profile',JSON.stringify({id:'input-player',name:'Mocha',avatar:'🦊'}));
  },locale);
  await page.goto(base);
  await page.locator('.cover-codenames').click();
  await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();
  await page.locator('.wg-table').waitFor();
  const seat=page.locator('.practice-switch select'),captain=await page.locator('.wg-team.wg-active.wg-red').count()?'practice-0':'practice-1';
  await seat.selectOption(captain);
  const form=page.locator('.wg-clue-form'),input=form.locator('input');
  const phase=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.game.phase);
  await input.waitFor();

  // DOM composition events test the application boundary, not a system input method.
  await input.fill('小猫');await input.dispatchEvent('compositionstart');
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});
   await input.press('Enter');
   assert.equal(await input.inputValue(),'小猫','candidate text remains editable');
   assert.equal(await phase(),'clue','candidate confirmation does not advance the turn');
   await input.scrollIntoViewIfNeeded();
   await page.screenshot({path:`${out}/${locale}-${width}x${height}.png`});
  }
  await form.evaluate(node=>node.requestSubmit());
  assert.equal(await phase(),'clue','form submission while composing is also ignored');
  await input.dispatchEvent('compositionend');
  for(const flag of ['native','legacy']){
   const prevented=await input.evaluate((node,flag)=>{
    const event=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true,isComposing:flag==='native'});
    if(flag==='legacy')Object.defineProperty(event,'keyCode',{value:229});
    return !node.dispatchEvent(event);
   },flag);
   assert(prevented,`${flag} composing Enter default is prevented`);
   assert.equal(await phase(),'clue');
  }

  // An interrupted composition must not block the next visit to the captain's seat.
  await input.dispatchEvent('compositionstart');
  await seat.selectOption('practice-2');await seat.selectOption(captain);
  await expect(input).toHaveValue('');
  await input.fill('小猫');await input.press('Enter');
  await expect.poll(phase).toBe('guess');
  await expect(page.locator('.wg-clue-panel strong')).toContainText('小猫');

  // A new game's explicit submit still works after composition ends.
  await page.evaluate(()=>localStorage.removeItem('mocha-practice-v1'));await page.reload();
  await page.locator('.cover-codenames').click();
  await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();
  await page.locator('.wg-table').waitFor();
  const nextCaptain=await page.locator('.wg-team.wg-active.wg-red').count()?'practice-0':'practice-1';
  await seat.selectOption(nextCaptain);
  await input.fill('月光');await input.dispatchEvent('compositionstart');await input.dispatchEvent('compositionend');
  await form.locator('button[type="submit"]').click();
  await expect.poll(phase).toBe('guess');
  await expect(page.locator('.wg-clue-panel strong')).toContainText('月光');
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(`PASS codenames ${engine} ${locale}: eight sizes, composition/trusted Enter, native/229 defaults, form guard, seat reset, ordinary Enter and button submission`);
 }
}finally{await browser.close();}
