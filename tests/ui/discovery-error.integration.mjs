import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const out=`test-results/discovery-error-${engine}`;
await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
try{
 for(const locale of ['zh','en'])for(const [width,height]of sizes){
  const zh=locale==='zh',context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage();
  await context.addInitScript(locale=>{localStorage.setItem('mocha-profile',JSON.stringify({id:'discovery-ui',name:'Mocha',avatar:'🦊'}));localStorage.setItem('mocha-locale',locale);},locale);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let response='offline',pending;
  await page.route('**/api/discover',async route=>{
   if(response==='offline')return route.abort('failed');
   if(response==='pending'){pending=route;return;}
   return route.fulfill({status:response==='503'?503:200,json:response==='503'?{error:'private backend diagnostic'}:response==='empty'?[]:[{code:'ABC234',kind:'gems',mode:'lan',hostName:'Friends',count:2,max:4}]});
  });
  await page.goto(base);
  const open=page.getByRole('button',{name:zh?'发现附近牌桌':'Find nearby tables',exact:true});
  const retry=()=>page.getByRole('dialog').getByRole('button',{name:zh?'重试':'Retry',exact:true});
  const empty=()=>page.getByText(zh?'附近还没有开桌':'No nearby tables yet',{exact:true});
  await open.click();await expect(page.getByRole('alert')).toContainText(zh?'暂时无法发现牌桌':'Could not find nearby tables');
  await expect(empty()).toHaveCount(0);await expect(page.locator('.toast')).toHaveCount(0);
  assert.ok(!(await page.locator('body').innerText()).includes('private backend diagnostic'));
  await page.screenshot({path:`${out}/${locale}-${width}x${height}-failure.png`});
  const controls=page.getByRole('dialog').getByRole('button');
  for(const button of await controls.all()){
   await expect(button).toBeInViewport();const bounds=await button.boundingBox();assert.ok(bounds.width>=44&&bounds.height>=44);
  }
  await page.keyboard.press('Tab');assert.equal(await page.getByRole('dialog').evaluate(el=>el.contains(document.activeElement)),true);
  await page.setViewportSize({width:height,height:width});await expect(retry()).toBeInViewport();await page.setViewportSize({width,height});
  response='503';await retry().click();await expect(retry()).toBeEnabled();await expect(empty()).toHaveCount(0);
  assert.ok(!(await page.locator('body').innerText()).includes('private backend diagnostic'));
  response='empty';await retry().click();await expect(empty()).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
  await page.screenshot({path:`${out}/${locale}-${width}x${height}-empty.png`});
  response='rooms';await page.getByRole('button',{name:zh?'刷新':'Refresh',exact:true}).click();await expect(page.locator('.nearby-list button')).toHaveCount(1);
  await expect(page.locator('.nearby-list')).toContainText('Friends');
  await page.keyboard.press('Escape');await expect(open).toBeFocused();
  response='offline';await open.click();await expect(retry()).toBeEnabled();
  await page.getByRole('button',{name:zh?'输入房间码':'Enter room code',exact:true}).click();await expect(page.getByRole('dialog')).toContainText(zh?'六位房间码':'Six-character room code');
  response='empty';await page.getByRole('button',{name:zh?'发现附近':'Find nearby',exact:true}).click();await expect(empty()).toBeVisible();
  // A request finishing after switching to code entry must not contaminate a reopened discovery.
  response='pending';await page.getByRole('button',{name:zh?'刷新':'Refresh',exact:true}).click();await expect(page.getByText(zh?'寻找中':'Searching…',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:zh?'输入房间码':'Enter room code',exact:true}).click();
  response='empty';await page.getByRole('button',{name:zh?'发现附近':'Find nearby',exact:true}).click();await expect(empty()).toBeVisible();
  await pending.fulfill({status:503,json:{error:'late private error'}});await page.waitForTimeout(50);await expect(empty()).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await context.close();console.log('PASS',engine,locale,width,height,'offline, 503, empty, rooms, retry, reopen, input switch, stale request, focus and rotation');
 }
}finally{await browser.close();}
