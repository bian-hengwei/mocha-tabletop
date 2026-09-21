import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';

const base=process.env.BASE_URL||'http://127.0.0.1:5173';
const browser=await(process.env.TEST_BROWSER==='webkit'?webkit:chromium).launch({executablePath:process.env.CHROME_PATH||undefined});
try{
 for(const mode of ['tab-recovery','local-denied','all-denied']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  // Hold automatic recovery locally so this test never contacts a real room.
  await context.routeWebSocket('**/api/rooms/**',()=>{});
  await context.addInitScript(mode=>{
   if(mode==='tab-recovery')sessionStorage.setItem('mocha-room-session',JSON.stringify({profile:{id:'boundary-player-000',name:'Tab recovery',avatar:'🦊'},code:'ABC234',token:'a'.repeat(48),savedAt:Date.now(),expiresAt:Date.now()+3600000}));
   for(const name of mode==='all-denied'?['localStorage','sessionStorage']:['localStorage'])Object.defineProperty(window,name,{configurable:true,get(){throw new DOMException('Storage denied','SecurityError');}});
  },mode);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(base);
  if(mode==='tab-recovery'){
   await page.locator('.connecting-overlay').getByRole('button',{name:'取消',exact:true}).click();
   await page.locator('.resume-session').waitFor();
   assert.match(await page.locator('.resume-session').textContent(),/ABC234/);
   assert.match(await page.locator('.profile-chip').textContent(),/Tab recovery/);
   await page.getByRole('button',{name:'Switch to English',exact:true}).click();
   assert.match(await page.locator('.resume-session').textContent(),/Resume your table · ABC234/);
   await page.getByRole('button',{name:'切换为中文',exact:true}).click();
   assert.match(await page.locator('.resume-session').textContent(),/回到上次的牌桌 · ABC234/);
   // Forgetting a synthetic recovery hint must be entirely local; do not join a room.
   await page.getByRole('button',{name:'忘记牌桌',exact:true}).click();
   await page.locator('.resume-session').waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('mocha-room-session')),null);
  }else{
   await page.getByPlaceholder('你的昵称').fill('临时玩家');
   await page.getByRole('button',{name:'入座',exact:true}).click();
   await page.locator('.game-cover').first().waitFor();
   assert.match(await page.locator('.profile-chip').textContent(),/临时玩家/);
   await page.getByRole('status').filter({hasText:'身份仅在本次打开有效'}).waitFor();
  }
  assert.ok(await page.locator('.game-cover').count()>0);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${mode}: throwing storage property getters preserve rendering and usable entry/recovery`);
  await context.close();
 }
}finally{await browser.close();}
