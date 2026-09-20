import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';

const base=process.env.BASE_URL||'http://127.0.0.1:5173';
const browser=await(process.env.TEST_BROWSER==='webkit'?webkit:chromium).launch({executablePath:process.env.CHROME_PATH||undefined});
const profile={id:'name-audit-host',name:'UNO爱好者',avatar:'🦊'};
const names=['UNO爱好者','梅林','红队'];
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(profile=>{
  localStorage.setItem('mocha-profile',JSON.stringify(profile));
  localStorage.setItem('mocha-history-v1',JSON.stringify({seen:['legacy-one','legacy-tie'],records:[
   {id:'legacy-one',kind:'uno',at:Date.now(),name:profile.name,avatar:profile.avatar,mode:'cloud',result:'win',summary:'UNO爱好者 获胜',playerCount:3},
   {id:'legacy-tie',kind:'gems',at:Date.now()-1000,name:'梅林',avatar:'🐻',mode:'cloud',result:'draw',summary:'胜者：梅林、红队 · 15 分',playerCount:3,score:15},
  ]}));
 },profile);
 // All discovery and socket traffic stays in this browser fixture.
 await context.route('**/api/discover',route=>route.fulfill({json:names.map((hostName,i)=>({code:['ABC234','DEF234','GHI234'][i],kind:'gems',mode:'lan',hostName,count:2,max:4}))}));
 await context.routeWebSocket('**/api/rooms/**',()=>{});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 for(const locale of ['zh','en','zh']){
  const current=await page.locator('html').getAttribute('lang');
  if((locale==='en')!==(current==='en'))await page.locator('.language-toggle').click();
  await page.getByRole('button',{name:locale==='zh'?'个人战绩':'My results',exact:true}).click();
  const rows=page.locator('.personal-records li');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('p')).toHaveText(locale==='zh'?'UNO爱好者 获胜':'UNO爱好者 wins');
  await expect(rows.nth(1).locator('p')).toHaveText(locale==='zh'?'胜者：梅林、红队 · 15 分':'Winner: 梅林、红队 · 15 points');
  assert.match(await rows.nth(0).locator('small').textContent(),/UNO爱好者/);
  assert.match(await rows.nth(1).locator('small').textContent(),/梅林/);
  await page.getByRole('dialog').getByRole('button',{name:locale==='zh'?'关闭':'Close',exact:true}).click();
  await page.locator('.home-footer button').last().click();
  await expect(page.locator('.nearby-list button')).toHaveCount(3);
  for(let i=0;i<names.length;i++)assert.ok((await page.locator('.nearby-list b').nth(i).textContent()).startsWith(names[i]),`${locale} nearby host ${names[i]} remains verbatim`);
  await page.getByRole('dialog').getByRole('button',{name:locale==='zh'?'关闭':'Close',exact:true}).click();
 }
 assert.deepEqual(errors,[]);
 await context.close();

 const lobby=await browser.newContext({viewport:{width:390,height:844}});
 await lobby.addInitScript(profile=>{localStorage.setItem('mocha-profile',JSON.stringify(profile));sessionStorage.setItem('mocha-room-session',JSON.stringify({profile,token:'a'.repeat(48),code:'ABC234',savedAt:Date.now(),expiresAt:Date.now()+3600000}));},profile);
 await lobby.routeWebSocket('**/api/rooms/**',socket=>socket.onMessage(raw=>{if(JSON.parse(String(raw)).type==='hello')socket.send(JSON.stringify({type:'snapshot',room:{code:'ABC234',kind:'gems',mode:'cloud',hostID:profile.id,players:[{...profile,ready:true,connected:true},...names.slice(1).map((name,i)=>({id:`name-audit-guest-${i}`,name,avatar:'🐻',ready:false,connected:false}))],pending:[],started:false,revision:1,expiresAt:Date.now()+3600000}}));}));
 const roomPage=await lobby.newPage(),roomErrors=[];roomPage.on('pageerror',e=>roomErrors.push(e.message));await roomPage.goto(base);
 for(const locale of ['zh','en','zh']){
  const current=await roomPage.locator('html').getAttribute('lang');if((locale==='en')!==(current==='en'))await roomPage.locator('.language-toggle').click();
  await expect(roomPage.locator('.presence-notice')).toBeVisible();
  assert.ok((await roomPage.locator('.presence-notice').textContent()).startsWith('梅林、红队'),`${locale} offline names remain verbatim`);
 }
 assert.deepEqual(roomErrors,[]);await lobby.close();
 console.log('PASS real App legacy history summaries, nearby hosts and offline names remain unchanged through zh/en/zh');
}finally{await browser.close();}
