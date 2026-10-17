import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const out=`test-results/relay-prompts-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]],errors=[];
async function seed(page,locale,relayMode,legacy=false){
 await page.goto(base+'/manifest-mocha.webmanifest');
 await page.evaluate(async({locale,relayMode,legacy})=>{
  const {createPractice}=await import('/src/local/practice.ts');
  localStorage.clear();localStorage.setItem('mocha-locale',locale);
  const profile={id:'relay_local',name:'Mocha',avatar:'🦊'};localStorage.setItem('mocha-profile',JSON.stringify(profile));
  const p=createPractice('drawrelay',12,profile,{relayMode,relaySeconds:0,language:locale});
  if(legacy)delete p.game.openingPrompts;
  localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice:p}));
 },{locale,relayMode,legacy});
 await page.goto(base);await expect(page.locator('.relay-table')).toBeVisible();
}
const state=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.game);
async function saved(page,text){await expect.poll(async()=>{const s=await state(page);return s.queue?s.queue.drafts[0]?.text:s.drafts[0]?.text;}).toBe(text);}
async function unchanged(page){const s=await state(page);assert.equal(s.books[0].length,0,'a draft selection must not pass a page');}
try{
 for(const locale of ['zh','en'])for(const [index,[width,height]]of sizes.entries()){
  const relayMode=index%2?'queue':'rounds',page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));
  await seed(page,locale,relayMode);
  const choices=(await state(page)).openingPrompts,own=choices[0];
  await expect(page.locator('.relay-prompt-choices')).toHaveCount(0);
  await page.locator('.relay-sealed button').click();
  const buttons=page.locator('.relay-prompt-choices button'),textarea=page.locator('.relay-writing textarea'),pass=page.locator('.relay-submit>.primary');
  await expect(buttons).toHaveCount(3);assert.deepEqual(await buttons.allTextContents(),own);
  for(const phrase of choices.slice(1).flat())assert(!(await page.locator('.relay-table').innerText()).includes(phrase),'another player candidate must not enter the DOM');
  await expect(pass).toBeDisabled();
  await buttons.first().focus();await page.keyboard.press('Enter');await saved(page,own[0]);await expect(buttons.first()).toHaveAttribute('aria-pressed','true');await unchanged(page);
  await buttons.first().click();await saved(page,'');await expect(pass).toBeDisabled();
  await buttons.last().click();await saved(page,own[2]);
  await page.getByRole('button',{name:locale==='zh'?'自己写':'Write my own',exact:true}).click();
  await expect(page.locator('.relay-prompt-choices')).toHaveCount(0);await expect(textarea).toHaveValue(own[2]);
  const custom=locale==='zh'?'小猫在纸船里看星星':'A cat watches stars from a paper boat';
  await textarea.dispatchEvent('compositionstart');await textarea.fill(custom);await expect(pass).toBeDisabled();
  await textarea.dispatchEvent('compositionend',{data:custom});await saved(page,custom);await unchanged(page);
  await textarea.press('Enter');await saved(page,custom+'\n');await unchanged(page);
  await page.getByRole('button',{name:locale==='zh'?'预设词':'Suggested prompts',exact:true}).click();
  assert.deepEqual(await buttons.allTextContents(),own);await expect(textarea).toHaveValue(custom+'\n');
  await buttons.nth(1).click();await saved(page,own[1]);
  const toggle=page.getByRole('button',{name:locale==='zh'?'Switch to English':'切换为中文',exact:true});await toggle.click();
  assert.deepEqual(await buttons.allTextContents(),own);await expect(textarea).toHaveValue(own[1]);
  await page.getByRole('button',{name:locale==='zh'?'切换为中文':'Switch to English',exact:true}).click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page width overflow');
  for(const box of await page.locator('.relay-prompt-modes button,.relay-prompt-choices button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON())))assert(box.height>=43&&box.width>=43,'prompt controls need touch targets');
  const submitBox=await pass.boundingBox();assert(submitBox.y>=0&&submitBox.y+submitBox.height<=height+1,'Pass remains fully visible');
  await page.screenshot({path:`${out}/${locale}-${width}x${height}-${relayMode}.png`});
  await page.reload();await expect(page.locator('.relay-prompt-choices')).toHaveCount(0);await page.locator('.relay-sealed button').click();
  assert.deepEqual(await buttons.allTextContents(),own);await expect(textarea).toHaveValue(own[1]);await unchanged(page);
  const help=page.getByRole('button',{name:locale==='zh'?'玩法和安装帮助':'Rules and app help',exact:true});
  await help.click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.setViewportSize({width:height,height:width});await page.keyboard.press('Escape');await expect(help).toBeFocused();
  await expect(textarea).toHaveValue(own[1]);await page.setViewportSize({width,height});
  await page.locator('.practice-switch select').selectOption('practice-1');await expect(page.locator('.relay-prompt-choices')).toHaveCount(0);
  await page.locator('.relay-sealed button').click();assert.deepEqual(await buttons.allTextContents(),choices[1]);await expect(textarea).toHaveValue('');
  assert(!(await page.locator('.relay-table').innerText()).includes(own[1]));
  await page.locator('.practice-switch select').selectOption('practice-0');await page.locator('.relay-sealed button').click();await expect(textarea).toHaveValue(own[1]);
  await pass.click();
  if(relayMode==='rounds')await expect(page.locator('.relay-wait')).toBeVisible();else await expect(page.locator('.relay-sealed')).toContainText(locale==='zh'?'暂无待办':'No pending tasks');
  await expect(page.locator('.relay-prompt-choices')).toHaveCount(0);
  await page.close();console.log('PASS prompts',locale,width,height,relayMode);
 }
 for(const relayMode of ['rounds','queue']){
  const page=await browser.newPage({viewport:{width:390,height:844}});await seed(page,'en',relayMode,true);await page.locator('.relay-sealed button').click();
  await expect(page.locator('.relay-opening-prompts')).toHaveCount(0);await page.locator('.relay-writing textarea').fill('A legacy page');await saved(page,'A legacy page');await page.reload();await page.locator('.relay-sealed button').click();await expect(page.locator('.relay-writing textarea')).toHaveValue('A legacy page');await page.close();
 }
 const keyboardPage=await browser.newPage({viewport:{width:390,height:420}});
 await seed(keyboardPage,'en','queue');await keyboardPage.locator('.relay-sealed button').click();
 await keyboardPage.getByRole('button',{name:'Write my own',exact:true}).click();
 const keyboardInput=keyboardPage.locator('.relay-writing textarea');await keyboardInput.focus();await keyboardInput.fill('A fox reads a map');await saved(keyboardPage,'A fox reads a map');
 await keyboardInput.scrollIntoViewIfNeeded();const inputBox=await keyboardInput.boundingBox();assert(inputBox.y>=0&&inputBox.y+inputBox.height<=420+1,'input stays reachable in a compressed visual viewport');
 await keyboardPage.locator('.relay-submit>.primary').scrollIntoViewIfNeeded();await keyboardPage.screenshot({path:`${out}/en-compressed-keyboard.png`});
 await keyboardPage.close();
 assert.deepEqual(errors,[]);console.log('PASS legacy rounds/queue free input; no runtime errors');
}finally{await browser.close();}
