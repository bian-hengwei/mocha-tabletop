import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',out=`test-results/proactive-usability-${process.env.TEST_BROWSER||'chromium'}`;await fs.mkdir(out,{recursive:true});
const browser=await(process.env.TEST_BROWSER==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const errors=[];
// Repository UI acceptance matrix, plus the narrower short-landscape regression.
const viewports=[
 {width:320,height:568},{width:390,height:844},{width:430,height:932},
 {width:844,height:390},{width:932,height:430},{width:768,height:1024},
 {width:1440,height:900},{width:568,height:320},
];
try {
 for(const language of ['zh','en'])for(const viewport of viewports){
  const context=await browser.newContext({viewport});await context.addInitScript(language=>{localStorage.setItem('mocha-locale',language);localStorage.setItem('mocha-profile',JSON.stringify({id:'audit-flow',name:'Mocha',avatar:'🦊'}));localStorage.removeItem('mocha-practice-v1');},language);
  const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',error=>errors.push(error.message));
  const caption=(zh,en)=>language==='zh'?zh:en;
  async function begin(kind){await page.goto(base);await page.locator('.cover-'+kind).click();await page.getByRole('button',{name:caption('同屏试玩','Pass & play'),exact:true}).click();await page.locator('.ng-'+kind).waitFor();}
  async function onScreen(button,label){const box=await button.boundingBox();assert(box&&box.y>=0&&box.y+box.height<=viewport.height,`${label}: immediately visible without an extra scroll (${JSON.stringify(box)})`);}
  await begin('century');
  const panel=title=>page.locator('.ng-panel').filter({has:page.locator('h3',{hasText:title})});
  const market=panel(caption('商人市场','Merchant market'));
  if(viewport.height<=360){
   const overview=page.locator('.ng-century-overview');
   assert((await overview.boundingBox()).height>=200,'Short landscape preserves enough market height to read a complete card');
   for(const card of await market.locator('.ng-spice-card').all()){
    await card.evaluate(e=>e.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
    await expect.poll(()=>card.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
   }
   await market.locator('.ng-spice-card').first().click();
   await page.locator('.action-sheet').waitFor();await page.keyboard.press('Escape');
   await page.screenshot({path:`${out}/century-short-market-${language}.png`});
  }
  await market.locator('.ng-spice-card').nth(1).click();await page.locator('.action-sheet footer button').click();
  const payment=page.getByRole('button',{name:language==='zh'?/^支付给第/:/^Pay merchant/});
  await onScreen(payment,'Mandatory recruitment payment');await page.screenshot({path:`${out}/century-payment-after-${language}-${viewport.width}.png`});
  await payment.click();await page.locator('.action-sheet .choice').first().click();await page.locator('.action-sheet footer button').click();
  assert.equal(await page.locator('.ng-pocket-active').count(),0,'Mandatory controls disappear once payment completes');
  await page.getByRole('combobox',{name:caption('切换试玩座位','Switch practice seat')}).selectOption('practice-1');
  const caravan=panel(caption('可用商人','Available merchants'));
  await caravan.getByRole('button',{name:caption('升级 2 次','Upgrade 2 steps'),exact:true}).click();
  const upgrade=page.getByRole('button',{name:caption('再升级 2 次','Up to 2 more upgrades'),exact:true});await onScreen(upgrade,'Upgrade continuation');
  await upgrade.click();await page.locator('.action-sheet .choice').first().click();await page.locator('.action-sheet footer button').click();
  const endUpgrade=page.getByRole('button',{name:caption('结束升级','Finish upgrading'),exact:true});await onScreen(endUpgrade,'Finish upgrade');await endUpgrade.click();
  assert.equal(await page.locator('.ng-pocket-active').count(),0);
  await begin('sushi');
  assert.equal(await page.locator('.ng-plates').count(),0,'Empty player platters do not occupy the opening screen');
  assert.equal(await page.locator('.ng-heading').count(),0,'Normal turns do not repeat generic how-to instructions');
  const card=page.locator('.ng-hand .ng-sushi-card').first();await card.click();await page.locator('.ng-sushi-confirm>.ng-action').click();
  assert.equal(await page.locator('.ng-sushi-card.ng-selected').count(),1,'Locked pick remains visible');
  assert(await page.locator('.ng-heading').textContent(),'Waiting for other players remains meaningful feedback');
  await page.getByRole('button',{name:caption('重新选牌','Choose again'),exact:true}).click();
  assert.equal(await page.locator('.ng-hand .ng-sushi-card:not([disabled])').count(),10,'Cancelling locked selection restores the hand');
  await page.goto(base+'/tests/ui/i18n.fixture.html?kind=uno&scenario=no-match');
  assert.equal(await page.locator('.ng-uno-hand .ng-uno-card:not([disabled])').count(),0);
  assert.equal(await page.locator('.ng-uno-play').count(),0,'No dead Play button when the hand cannot match');
  const draw=page.getByRole('button',{name:caption('抽一张','Draw one'),exact:true});
  assert((await draw.getAttribute('class')).includes('ng-uno-only-action'),'The only legal action gets primary styling');
  const body=await page.locator('body').innerText();for(const emptyHint of ['先选牌，再出牌','请先完成当前提示','点选一张亮起的牌','Select a playable card','Select, then play'])assert(!body.includes(emptyHint));
  await page.screenshot({path:`${out}/uno-no-match-${language}-${viewport.width}.png`});await draw.click();
  assert.equal(await page.locator('.ng-uno-hand .ng-uno-card').count(),3);assert.equal(await page.locator('.ng-uno-playbar').count(),0,'Unplayable draw ends the turn without stale action buttons');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();
  console.log(`PASS proactive game usability ${language} ${viewport.width}×${viewport.height}: recruitment/upgrade continuation in view, Sushi lock/cancel feedback, UNO legal-action priority`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
