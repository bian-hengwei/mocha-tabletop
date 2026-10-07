import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const out=`test-results/sushi-table-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]],errors=[];
async function fit(page){
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1),'document fits');
 const clipped=await page.locator('.game-surface').evaluate(s=>[s,...s.querySelectorAll('*')].filter(n=>n instanceof HTMLElement&&n.clientHeight&&n.scrollHeight>n.clientHeight+2&&['auto','hidden','scroll'].includes(getComputedStyle(n).overflowY)&&!n.matches('.illustrated-tile')).map(n=>[n.className,n.clientHeight,n.scrollHeight]));
 assert.deepEqual(clipped,[],'no vertical clipping');
 for(const selector of ['.sushi-public-plate nav button','.ng-sushi-confirm button'])for(const control of await page.locator(selector).all()){
  const box=await control.boundingBox(),{width,height}=page.viewportSize();assert(box&&box.width>=44&&box.height>=44&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,selector+' reachable touch target');
 }
}
try{
 if(!process.env.TEST_FLOW_ONLY)for(const locale of ['zh','en'])for(const [width,height]of sizes){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true});await context.addInitScript(l=>localStorage.setItem('mocha-locale',l),locale);
  const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=sushi&players=max&scenario=full-plates`);await expect(page.locator('.sushi-dishes .ng-sushi-card')).toHaveCount(9);
  await fit(page);await expect(page.locator('.sushi-public-plate header p')).toHaveText(locale==='zh'?'料理分 7 · 卷数 6 · 布丁 0':'Dish points 7 · Maki 6 · Pudding 0');
  const tabs=page.locator('.sushi-players button');await expect(tabs).toHaveCount(5);await expect(tabs.first()).toHaveAttribute('aria-pressed','true');
  const originalHand=await page.locator('.ng-hand .ng-sushi-card').allTextContents();
  for(let i=1;i<5;i++){await page.getByRole('button',{name:locale==='zh'?'下一位玩家':'Next player',exact:true}).click();await expect(tabs.nth(i)).toHaveAttribute('aria-pressed','true');await fit(page);}
  await expect(page.getByRole('button',{name:locale==='zh'?'下一位玩家':'Next player',exact:true})).toBeDisabled();
  assert.deepEqual(await page.locator('.ng-hand .ng-sushi-card').allTextContents(),originalHand,'public browsing never switches the private hand');
  await tabs.first().click();await expect(tabs.first()).toHaveAttribute('aria-pressed','true');
  const lastDish=page.locator('.sushi-dishes .ng-sushi-card').last();await lastDish.scrollIntoViewIfNeeded();await lastDish.click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({path:`${out}/detail-${locale}-${width}.png`});
  await page.setViewportSize({width:height,height:width});const dialog=await page.getByRole('dialog').boundingBox();assert(dialog&&dialog.x>=0&&dialog.y>=0&&dialog.x+dialog.width<=height+1&&dialog.y+dialog.height<=width+1,'dialog fits after rotation');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(lastDish).toBeFocused();await page.setViewportSize({width,height});
  await page.locator('.sushi-dishes').evaluate(el=>el.scrollLeft=0);await page.screenshot({path:`${out}/plate-${locale}-${width}.png`});
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=sushi&players=max&scenario=chopsticks`);
  const cards=page.locator('.ng-hand .ng-sushi-card');await cards.first().click();await cards.nth(1).click();await expect(cards.first().locator('.ng-order')).toHaveText('1');await expect(cards.nth(1).locator('.ng-order')).toHaveText('2');
  await page.setViewportSize({width:height,height:width});await expect(cards.first()).toHaveAttribute('aria-pressed','true');await expect(cards.nth(1)).toHaveAttribute('aria-pressed','true');await page.setViewportSize({width,height});await fit(page);
  await page.screenshot({path:`${out}/selection-${locale}-${width}.png`});await page.locator('.ng-sushi-confirm>.ng-action').click();await expect(page.locator('.ng-hand .ng-sushi-card:enabled')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Seat',exact:true}).selectOption('english-player-1');await expect(page.locator('.ng-hand .ng-selected')).toHaveCount(0);await expect(tabs.nth(1)).toHaveAttribute('aria-pressed','true');
  if(locale==='en')assert(!/[\p{Script=Han}]/u.test(await page.locator('.ng-sushi').innerText()),'system text translated');
  await context.close();console.log(`PASS Sushi navigation, detail, selection, privacy ${locale} ${width}x${height}`);
 }
 // Actual App, deterministic legal game: full three rounds with explicit confirmation.
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/manifest-mocha.webmanifest');await page.evaluate(async locale=>{
   const {sushi}=await import('/src/core/games/sushi.ts');const players=[{id:'practice-0',name:'Alex',avatar:'🦊'},{id:'practice-1',name:'Blair',avatar:'🐼'}];
   localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify(players[0]));localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice:{id:crypto.randomUUID(),kind:'sushi',players,game:sushi.create(players,37),viewer:players[0].id}}));
  },locale);await page.goto(base);await page.locator('.ng-sushi').waitFor();
  let turns=0;while(!await page.locator('.end-banner-sushi').count()&&turns<60){
   await page.getByRole('combobox',{name:locale==='zh'?'切换试玩座位':'Switch practice seat',exact:true}).selectOption(`practice-${turns%2}`);
   await page.locator('.ng-hand .ng-sushi-card:enabled').first().click();await page.locator('.ng-sushi-confirm>.ng-action').click();turns++;
   if(turns===1){await expect(page.locator('.sushi-status')).toContainText('Blair');await page.reload();await expect(page.locator('.ng-hand .ng-sushi-card:enabled')).toHaveCount(0);await expect(page.locator('.ng-hand .ng-selected')).toHaveCount(1);}
  }
  assert.equal(turns,54,'two players each choose nine times per round; final card is automatic');await expect(page.locator('.sushi-results tbody tr')).toHaveCount(2);await expect(page.locator('.ng-sushi-hand-panel')).toHaveCount(0);
  await page.getByRole('button',{name:locale==='zh'?'收起结算':'Dismiss result',exact:true}).click();await page.getByRole('button',{name:locale==='zh'?'得分明细':'Score breakdown',exact:true}).click();await expect(page.locator('.sushi-results tbody tr')).toHaveCount(2);
  await page.screenshot({path:`${out}/finished-${locale}.png`});await context.close();console.log(`PASS real App Sushi three rounds, reload, final breakdown ${locale}`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
