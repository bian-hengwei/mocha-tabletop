import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const out=`test-results/poker-motion-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
async function opaque(page){
 const faces=await page.locator('.classic-card').evaluateAll(cards=>cards.map(c=>({opacity:getComputedStyle(c).opacity,filter:getComputedStyle(c).filter,faceOpacity:getComputedStyle(c.querySelector('.classic-face')).opacity})));
 assert(faces.length);assert(faces.every(c=>c.opacity==='1'&&c.faceOpacity==='1'&&c.filter==='none'),'waiting/bidding hands stay opaque with full color');
}
async function frame(page,time){await page.evaluate(time=>{for(const a of document.getAnimations()){a.pause();a.currentTime=time;}},time);}
try{
 for(const locale of ['zh','en'])for(const kind of ['doudizhu','guandan']){
  const page=await browser.newPage();await page.addInitScript(l=>localStorage.setItem('mocha-locale',l),locale);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/tests/ui/poker.fixture.html?kind=${kind}&bid&motion`);
  if(kind==='doudizhu'){
   for(const [width,height]of sizes){await page.setViewportSize({width,height});await opaque(page);await expect(page.locator('.classic-card:enabled')).toHaveCount(0);await page.screenshot({path:`${out}/bid-${locale}-${width}.png`});}
   await page.getByRole('button',{name:'Remote play'}).click();await opaque(page);await expect(page.locator('.classic-card:enabled')).toHaveCount(0);
  }
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});await page.goto(`${base}/tests/ui/poker.fixture.html?kind=${kind}&motion`);
   // View seat 1 while seat 0 plays: the local hand must remain readable and unplayable.
   await page.getByLabel('Seat',{exact:true}).selectOption('1');await opaque(page);await expect(page.locator('.classic-card:enabled')).toHaveCount(0);
   await page.getByRole('button',{name:'Remote play'}).click();await expect(page.locator('.poker-flight')).toHaveCount(1);await frame(page,0);
   const start=await page.locator('.poker-flight').boundingBox();await frame(page,450);const mid=await page.locator('.poker-flight').boundingBox();
   assert(Math.hypot(start.x-mid.x,start.y-mid.y)>25,'public play travels visibly from the source');
   assert(mid.width>0&&mid.x>=-2&&mid.x+mid.width<=width+2,'central pose fits viewport');
   assert.equal(await page.locator('.poker-motion-layer').getAttribute('aria-hidden'),'true');
   assert.equal(await page.locator('.poker-motion-layer').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
   await page.screenshot({path:`${out}/${kind}-${locale}-${width}-flight.png`});
   await frame(page,810);await page.screenshot({path:`${out}/${kind}-${locale}-${width}-landing.png`});
   await page.evaluate(()=>document.getAnimations().forEach(a=>a.finish()));await expect(page.locator('.poker-flight')).toHaveCount(0);await expect(page.locator('.in-flight')).toHaveCount(0);await expect(page.locator('.poker-seat-play .played-scroll')).toBeVisible();
   await page.getByLabel('Seat',{exact:true}).selectOption('0');await opaque(page);await expect(page.locator('.poker-flight')).toHaveCount(0);
  }
  assert.deepEqual(errors,[]);await page.close();console.log('PASS opaque bidding/waiting hands, visible remote flight/landing and seat switch',engine,kind,locale);
 }
 // Own play starts at the hand edge; rotating or reducing motion immediately restores the pile.
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(`${base}/tests/ui/poker.fixture.html?motion`);await page.getByRole('button',{name:'Remote play'}).click();await expect(page.locator('.poker-flight')).toHaveCount(1);await frame(page,300);await page.screenshot({path:`${out}/own-flight.png`});await page.setViewportSize({width:844,height:390});await expect(page.locator('.poker-flight')).toHaveCount(0);await expect(page.locator('.poker-seat-play .played-scroll')).toBeVisible();await opaque(page);
 await page.reload();await expect(page.locator('.poker-flight')).toHaveCount(0);await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Remote play'}).click();await expect(page.locator('.poker-flight')).toHaveCount(0);await expect(page.locator('.poker-seat-play .played-scroll')).toBeVisible();await page.close();
 for(const seat of ['2','3']){
  const side=await browser.newPage({viewport:{width:390,height:844}});await side.goto(`${base}/tests/ui/poker.fixture.html?motion`);await side.getByLabel('Seat',{exact:true}).selectOption(seat);await side.getByRole('button',{name:'Remote play'}).click();await expect(side.locator('.poker-flight')).toHaveCount(1);await frame(side,450);await side.screenshot({path:`${out}/direction-${seat}.png`});await side.evaluate(()=>document.getAnimations().forEach(a=>a.finish()));await expect(side.locator('.poker-seat-play .played-scroll')).toBeVisible();await side.close();
 }
 const saved=await browser.newPage();await saved.goto(`${base}/tests/ui/poker.fixture.html?dense`);await expect(saved.locator('.poker-seat-play')).toHaveCount(4);await expect(saved.locator('.poker-flight')).toHaveCount(0);await saved.close();
 const fast=await browser.newPage({viewport:{width:390,height:844}});await fast.goto(`${base}/tests/ui/poker.fixture.html?kind=guandan&motion&chain`);
 await fast.getByRole('button',{name:'Remote play'}).click();await expect(fast.locator('.poker-flight')).toHaveCount(1);await frame(fast,350);
 await fast.getByRole('button',{name:'Remote play'}).click();await expect(fast.locator('.poker-flight')).toHaveCount(2);
 await fast.evaluate(()=>document.getAnimations().forEach(a=>a.finish()));await expect(fast.locator('.poker-flight')).toHaveCount(0);await expect(fast.locator('.poker-seat-play .played-scroll:visible')).toHaveCount(2);
 await fast.getByRole('button',{name:'Remote play'}).click();await expect(fast.locator('.poker-flight')).toHaveCount(1);await frame(fast,300);await fast.emulateMedia({reducedMotion:'reduce'});await expect(fast.locator('.poker-flight')).toHaveCount(0);await expect(fast.locator('.in-flight')).toHaveCount(0);await fast.close();
 console.log('PASS own flight, rotation cancellation and reduced motion',engine);
}finally{await browser.close();}
