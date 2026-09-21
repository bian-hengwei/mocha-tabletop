import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/century-viewport-${engine}`;await fs.mkdir(out,{recursive:true});
const errors=[],sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
try{
 for(const language of ['zh','en'])for(const [width,height] of sizes){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true});await context.addInitScript(language=>{localStorage.setItem('mocha-locale',language);localStorage.setItem('mocha-profile',JSON.stringify({id:'century-viewport',name:'Mocha',avatar:'🦊'}));localStorage.removeItem('mocha-practice-v1');},language);
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
  const caption=(zh,en)=>language==='zh'?zh:en;
  async function fits(){
   const overflow=await page.locator('.game-surface').evaluate(surface=>[surface,...surface.querySelectorAll('*')].filter(n=>n instanceof HTMLElement&&n.clientHeight>0&&n.scrollHeight>n.clientHeight+2&&['auto','scroll','hidden'].includes(getComputedStyle(n).overflowY)).map(n=>({class:n.className,height:n.clientHeight,content:n.scrollHeight})));
   if(overflow.length)await page.screenshot({path:`${out}/failure-${language}-${width}.png`});
   assert.deepEqual(overflow,[],'No vertical scrolling or clipped card content');
   assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1));
  }
  async function handCue(){
   const hand=page.locator('.ng-century-hand-panel .ng-market'),cue=page.locator('.ng-century-scroll-cue');
   const overflow=await hand.evaluate(n=>n.scrollWidth>n.clientWidth+2);
   await expect(cue).toHaveCount(overflow?1:0);
   if(overflow){
    await expect(cue).toHaveText(caption('↔ 滑动查看手牌','↔ Swipe hand'));
    assert(await cue.evaluate(n=>{const r=n.getBoundingClientRect(),parent=n.parentElement.getBoundingClientRect();return r.x>=parent.x-1&&r.right<=parent.right+1&&r.y>=0&&r.bottom<=innerHeight;}),'Hand scroll cue remains readable inside its heading');
   }
  }
  await page.goto(base);await page.locator('.cover-century').click();await page.getByRole('button',{name:caption('同屏试玩','Pass & play'),exact:true}).click();
  const tabs=page.locator('.ng-century-tabs');await tabs.waitFor();
  await handCue();await fits();
  await page.setViewportSize({width:1440,height:900});await handCue();await fits();
  await page.setViewportSize({width,height});await handCue();await fits();
  const seats=page.getByRole('combobox',{name:caption('切换试玩座位','Switch practice seat')}),handCards=page.locator('.ng-century-hand-panel .ng-merchant-card');
  await handCards.first().click();await expect(handCards).toHaveCount(1);await handCue();await fits();
  await seats.selectOption('practice-1');await handCards.first().click();
  await seats.selectOption('practice-0');await page.getByRole('button',{name:caption('休整，收回所有商人','Rest and recover all merchants'),exact:true}).click();
  await expect(handCards).toHaveCount(2);await handCue();await fits();
  await seats.selectOption('practice-1');await page.getByRole('button',{name:caption('休整，收回所有商人','Rest and recover all merchants'),exact:true}).click();await seats.selectOption('practice-0');
  for(const title of [caption('商人市场','Merchant market'),caption('公开订单','Public orders'),caption('商队','Caravans'),caption('已用商人','Used merchants')]){
   await tabs.getByRole('button',{name:title,exact:true}).click();await fits();
   const area=page.locator('.ng-century-page:not([hidden])');
   for(const card of await area.locator('.ng-spice-card').all()){
    await card.evaluate(n=>n.scrollIntoView({inline:'center',block:'nearest',behavior:'instant'}));
    assert(await card.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Every horizontal card remains reachable');await fits();
   }
  }
  await tabs.getByRole('button',{name:caption('商人市场','Merchant market'),exact:true}).click();
  await page.locator('.ng-century-page:not([hidden]) .ng-spice-card').nth(1).click();await page.locator('.action-sheet footer button').click();await fits();
  const pay=page.getByRole('button',{name:language==='zh'?/^支付给第/:/^Pay merchant/});await expect(pay).toBeVisible();
  await expect(page.locator('.ng-century-scroll-cue')).toHaveCount(0);
  await page.screenshot({path:`${out}/payment-${language}-${width}.png`});await pay.click();
  await page.setViewportSize({width:height,height:width});const dialog=await page.locator('.action-sheet').boundingBox();assert(dialog&&dialog.y>=0&&dialog.y+dialog.height<=width+1);
  await page.setViewportSize({width,height});await page.locator('.action-sheet .choice').first().click();await page.locator('.action-sheet footer button').click();await fits();await handCue();
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=century&players=max&scenario=table-dense`);await tabs.waitFor();await fits();
  await handCue();await page.screenshot({path:`${out}/hand-cue-${language}-${width}.png`});
  const hand=page.locator('.ng-century-hand-panel .ng-market');await hand.evaluate(n=>n.scrollLeft=n.scrollWidth);await fits();await handCue();
  const lastMerchant=hand.locator('button').last();
  assert(await lastMerchant.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Last hand merchant is reachable after scrolling');
  await page.setViewportSize({width:height,height:width});await handCue();await fits();
  await page.setViewportSize({width,height});await handCue();await fits();
  await tabs.getByRole('button',{name:caption('已用商人','Used merchants'),exact:true}).click();await fits();
  await tabs.getByRole('button',{name:caption('商队','Caravans'),exact:true}).click();await fits();
  const rivals=page.locator('.ng-century-page:not([hidden])>.ng-panel');assert.equal(await rivals.count(),4);await rivals.last().evaluate(n=>n.scrollIntoView({inline:'end',block:'nearest'}));await fits();
  await page.screenshot({path:`${out}/five-players-${language}-${width}.png`});
  await context.close();console.log('PASS Century fixed viewport, public areas, all cards, payment, rotation, five players',language,width,height);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
