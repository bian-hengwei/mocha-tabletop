import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const out=`test-results/relay-input-${engine}`;
await fs.mkdir(out,{recursive:true});
const errors=[];
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
async function seed(page,locale,step=0){
 await page.goto(base+'/manifest-mocha.webmanifest');
 await page.evaluate(async({locale,step})=>{
  const {createPractice}=await import('/src/local/practice.ts');
  const {drawrelay,encodeRelayStroke}=await import('/src/core/games/drawrelay.ts');
  localStorage.clear();localStorage.setItem('mocha-locale',locale);
  const profile={id:'relay_local',name:'Mocha',avatar:'🦊'};
  localStorage.setItem('mocha-profile',JSON.stringify(profile));
  const practice=createPractice('drawrelay',3,profile,{relaySeconds:0,language:locale});
  for(let stage=0;stage<step;stage++)for(const player of practice.players){
   practice.game=drawrelay.apply(practice.game,player.id,stage%2?{action:'stroke',values:[String(stage),encodeRelayStroke([[120,600],[500,120],[880,600]],3,2)]}:{action:'draft',values:[String(stage)],text:'A cat in a boat'});
   practice.game=drawrelay.apply(practice.game,player.id,{action:'submit',values:[String(stage)]});
  }
  localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice}));
 },{locale,step});
 await page.goto(base);await expect(page.locator('.relay-table')).toBeVisible();
 await page.locator('.relay-sealed button').click();
}
const savedDraft=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.game.drafts[0].text);
async function saved(page,text){await expect.poll(()=>savedDraft(page)).toBe(text);}
try{
 for(const locale of ['zh','en']){
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});await seed(page,locale,width===568?2:0);
   const textarea=page.locator('.relay-writing textarea');
   const text=locale==='zh'?'小猫坐船去旅行':'A cat sails a teacup';
   // Synthetic DOM composition events exercise React's event ordering; this is
   // not a system IME or physical keyboard acceptance test.
   await textarea.dispatchEvent('compositionstart');await textarea.fill(text);
   await expect(page.locator('.relay-submit button')).toBeDisabled();
   await textarea.dispatchEvent('compositionend',{data:text});
   await saved(page,text);
   await expect(page.locator('.relay-draft-status')).toContainText(locale==='zh'?'草稿已保存':'Draft saved');
   await expect(page.locator('.relay-submit button')).toBeEnabled();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
   await page.screenshot({path:`${out}/${locale}-${width}x${height}-saved.png`});
   await page.reload();await page.locator('.relay-sealed button').click();
   await expect(page.locator('.relay-writing textarea')).toHaveValue(text);
  }
  await seed(page,locale);
  const textarea=page.locator('.relay-writing textarea');
  await textarea.fill('Saved');await saved(page,'Saved');
  await textarea.fill('Unfinished input');
  await textarea.dispatchEvent('compositionstart');
  // A composition start must cancel the already scheduled 350 ms save.
  await page.waitForTimeout(650);assert.equal(await savedDraft(page),'Saved');
  await textarea.dispatchEvent('compositionend',{data:'Unfinished input'});
  await saved(page,'Unfinished input');
  // Starting and ending composition without changing the value also restores
  // submit availability, but must never itself submit the private page.
  await textarea.dispatchEvent('compositionstart');await expect(page.locator('.relay-submit button')).toBeDisabled();
  await textarea.dispatchEvent('compositionend',{data:''});
  await expect(page.locator('.relay-submit button')).toBeEnabled();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.game.submitted[0]),false);
  await page.locator('.relay-submit button').click();
  await expect(page.locator('.relay-wait')).toContainText(locale==='zh'?'已提交':'Submitted');
  await seed(page,locale);
  await textarea.dispatchEvent('compositionstart');await textarea.fill('Private draft');
  await expect(page.locator('.relay-heading button')).toBeDisabled();
  await textarea.dispatchEvent('compositionend',{data:'Private draft'});await saved(page,'Private draft');
  await page.locator('.relay-heading button').click();
  await page.locator('.relay-sealed button').click();await expect(textarea).toHaveValue('Private draft');
  await textarea.dispatchEvent('compositionstart');await textarea.fill('Seat one private');
  await page.locator('.practice-switch select').selectOption('practice-1');
  await page.waitForTimeout(650);assert.equal(await savedDraft(page),'Private draft');
  await page.locator('.relay-sealed button').click();await expect(textarea).toHaveValue('');
  // Preserve the existing Unicode code-point limit and multiline editing.
  await textarea.fill('😀'.repeat(120));await textarea.dispatchEvent('compositionstart');
  await textarea.dispatchEvent('compositionend',{data:'😀'});
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.game.drafts[1].text)).toBe('😀'.repeat(120));
  await textarea.fill('Line one\nLine two');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.game.drafts[1].text)).toBe('Line one\nLine two');
  await page.close();
  console.log(`PASS ${locale}: eight sizes, unchanged-value composition end saves, reload, debounce cancellation, explicit submit, hide/seat cleanup, Unicode and multiline input`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
