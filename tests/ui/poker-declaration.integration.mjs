import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/poker-declaration-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
const title=locale=>locale==='zh'?'出牌牌型':'Declare combination';
const comboName=(locale,declared,rank)=>`${locale==='zh'?(declared?'顺子':'同花顺'):(declared?'Straight':'Straight flush')} · ${rank}`;
async function choose(page,locale,declared,rank){
 const opener=page.getByRole('button',{name:title(locale),exact:true});await opener.click();
 const dialog=page.getByRole('dialog',{name:title(locale),exact:true});
 await expect(dialog.getByRole('button',{name:comboName(locale,false,rank),exact:true})).toHaveAttribute('aria-pressed','true');
 await dialog.getByRole('button',{name:comboName(locale,declared,rank),exact:true}).click();
 await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
}
async function fits(page){
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
 assert(await page.locator('.game-surface').evaluate(e=>e.scrollHeight<=e.clientHeight+2),'declaration must not add vertical table scrolling');
 const failures=await page.locator('.classic-controls button').evaluateAll(buttons=>buttons.flatMap(button=>{
  const box=button.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(button);
  const clipped=[...range.getClientRects()].some(r=>r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1);
  return clipped||box.width<44||box.height<44||box.left<0||box.right>innerWidth+1||box.top<0||box.bottom>innerHeight+1?[button.textContent]:[];
 }));assert.deepEqual(failures,[],'all controls and complete labels remain visible and touchable');
}
async function fullHand(locale,response,declared){
 const context=await browser.newContext({viewport:{width:320,height:568}}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Prepare storage outside App so its empty-session persistence cannot erase the fixture.
 await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=guandan&scenario=declare`);
 // A saved free-lead position from seed 4. All choices, declarations and plays below use the UI.
 await page.evaluate(async({locale,response})=>{
  const {guandan}=await import('/src/core/games/poker.ts');
  const players=['Alex','Blair','Rain','Quinn'].map((name,i)=>({id:`practice-${i}`,name,avatar:['🦊','🐼','🐱','🐻'][i]}));
  const game=guandan.create(players,4);if(response)game.current=3;
  localStorage.setItem('mocha-profile',JSON.stringify(players[0]));localStorage.setItem('mocha-locale',locale);
  localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice:{id:'full-hand-declaration',kind:'guandan',players,game,viewer:players[response?3:0].id}}));
 },{locale,response});await page.goto(base);
 await expect(page.getByRole('combobox',{name:locale==='zh'?'切换试玩座位':'Switch practice seat'})).toHaveValue(response?'practice-3':'practice-0');
 if(response){
  for(const name of ['♦4','♠5','♠6','♠7','♥8'])await page.getByRole('button',{name,exact:true}).first().click();
  await page.locator('.classic-controls .primary').click();
  await page.getByRole('combobox',{name:locale==='zh'?'切换试玩座位':'Switch practice seat'}).selectOption('practice-0');
 }
 const names=['♣9','♣10','♣J','♣Q','♣K'];
 for(const name of names)await page.getByRole('button',{name,exact:true}).first().click();
 await expect(page.locator('.classic-card.selected')).toHaveCount(5);
 await expect(page.locator('.classic-hand .classic-card')).toHaveCount(27);
 await expect(page.locator('.classic-controls button')).toHaveCount(response?5:4);
 const opener=page.getByRole('button',{name:title(locale),exact:true});
 for(const [width,height]of sizes){
  await page.setViewportSize({width,height});await fits(page);
  await page.screenshot({path:`${out}/full-${locale}-${response?'response':'lead'}-${width}.png`});
  await opener.click();const dialog=page.getByRole('dialog',{name:title(locale),exact:true});
  await expect(dialog.getByRole('button',{name:comboName(locale,false,'K'),exact:true})).toHaveAttribute('aria-pressed','true');
  for(const control of await dialog.getByRole('button').all())assert(await control.evaluate(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}),'dialog choices and close remain reachable');
  await page.screenshot({path:`${out}/dialog-${locale}-${width}.png`});
  await page.setViewportSize({width:height,height:width});
  await expect(page.locator('.classic-card.selected')).toHaveCount(5);
  await page.keyboard.press('Tab');assert(await dialog.evaluate(e=>e.contains(document.activeElement)),'focus stays in rotated dialog');
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
 }
 await page.setViewportSize({width:320,height:568});
 // Choosing a different interpretation changes no cards and submits nothing.
 await choose(page,locale,true,'K');await expect(page.locator('.classic-hand .classic-card')).toHaveCount(27);
 await expect(page.locator('.classic-selection')).toHaveText(locale==='zh'?'已选 5 · 顺子':'Selected 5 · Straight');
 await page.getByRole('button',{name:locale==='zh'?'清空选择':'Clear selection',exact:true}).click();await expect(opener).toHaveCount(0);
 for(const name of names)await page.getByRole('button',{name,exact:true}).first().click();
 await expect(page.locator('.classic-selection')).toHaveText(locale==='zh'?'已选 5 · 同花顺':'Selected 5 · Straight flush');
 await choose(page,locale,declared,'K');await fits(page);
 await page.locator('.classic-controls .primary').click();
 await expect(page.locator('.played-caption span')).toHaveText(comboName(locale,declared,'K'));
 await expect(page.locator('.classic-hand .classic-card')).toHaveCount(22);await expect(opener).toHaveCount(0);
 assert.deepEqual(errors,[]);await context.close();
 console.log('PASS full hand declaration, eight sizes, dialog rotation/focus, reselection and actual play',engine,locale,{response,declared});
}
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:320,height:568}});await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const declared of [false,true]){
   await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=guandan&scenario=declare`);
   const cards=page.locator('.classic-hand .classic-card');for(let i=0;i<5;i++)await cards.nth(i).click();
   await choose(page,locale,declared,'9');await page.locator('.classic-controls .primary').click();
   await expect(page.locator('.classic-felt')).toContainText(locale==='zh'?(declared?'顺子':'同花顺'):(declared?'Straight':'Straight flush'));
   await expect(page.locator('.played-caption span')).toHaveText(comboName(locale,declared,'9'));
   await expect(cards).toHaveCount(1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.deepEqual(errors,[]);await context.close();console.log('PASS strongest default and explicit weaker declaration',engine,locale);
  for(const response of [false,true])for(const declared of [false,true])await fullHand(locale,response,declared);
 }
}finally{await browser.close();}
