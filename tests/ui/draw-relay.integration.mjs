import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const out=`test-results/draw-relay-${engine}`;await fs.mkdir(out,{recursive:true});
const errors=[];
async function seed(page,{locale='en',stage=0,count=3}={}){await page.goto(base+'/manifest-mocha.webmanifest');await page.evaluate(async({locale,stage,count})=>{const {createPractice}=await import('/src/local/practice.ts');const {drawrelay,encodeRelayStroke}=await import('/src/core/games/drawrelay.ts');localStorage.clear();localStorage.setItem('mocha-locale',locale);const profile={id:'relay_local',name:'Mocha',avatar:'🦊'};localStorage.setItem('mocha-profile',JSON.stringify(profile));const p=createPractice('drawrelay',count,profile,{relaySeconds:0,language:locale});for(let step=0;step<stage;step++)for(const person of p.players){p.game=drawrelay.apply(p.game,person.id,step%2?{action:'stroke',values:[String(step),encodeRelayStroke([[90,610],[340,220],[640,610],[90,610]],3,2)]}:{action:'draft',values:[String(step)],text:locale==='en'?'A fox sailing a little teacup':'狐狸坐着茶杯去旅行'});p.game=drawrelay.apply(p.game,person.id,{action:'submit',values:[String(step)]});}localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice:p}));},{locale,stage,count});await page.goto(base);await expect(page.locator('.relay-table')).toBeVisible();}
async function open(page){await page.locator('.relay-sealed button').click();}
async function draw(page){const canvas=page.locator('.relay-paper .relay-canvas');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.15,box.y+box.height*.75);await page.mouse.down();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.2,{steps:10});await page.mouse.move(box.x+box.width*.75,box.y+box.height*.75,{steps:10});await page.mouse.up();await expect(canvas.locator('polyline')).toHaveCount(1);}
try{
 if(!process.env.TEST_FLOW_ONLY)for(const locale of ['zh','en'])for(const [width,height]of [[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]]){
  const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));await seed(page,{locale,stage:1,count:12});await open(page);await draw(page);await page.screenshot({path:`${out}/${locale}-${width}x${height}-draw.png`});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page width overflow');assert(await page.locator('.relay-table').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'relay width overflow');
  const heading=await page.locator('.relay-heading').evaluate(el=>{const box=el.getBoundingClientRect(),topbar=document.querySelector('.topbar').getBoundingClientRect();return {top:box.top,bottom:box.bottom,topbarBottom:topbar.bottom,visible:el.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2))};});
  assert(heading.top>=heading.topbarBottom-1&&heading.bottom<=height&&heading.visible,`phase and timer remain visible after scrolling canvas: ${JSON.stringify(heading)}`);
  const submit=await page.locator('.relay-submit>.primary').boundingBox();assert(submit&&submit.y>=0&&submit.y+submit.height<=height+1,'submit remains in reach while drawing');
  const canvas=await page.locator('.relay-paper .relay-canvas').boundingBox(),footer=await page.locator('.relay-submit').boundingBox();assert(canvas&&footer&&canvas.y>=heading.bottom-1&&canvas.y+canvas.height<=footer.y+1,'entire canvas remains between the pinned heading and submit controls');
  for(const box of await page.locator('.relay-table button').evaluateAll(nodes=>nodes.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height}))))assert(box.h>=43,'short touch target');
  await page.getByRole('button',{name:locale==='en'?'Clear canvas':'清空画布',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.setViewportSize({width:height,height:width});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.relay-paper polyline')).toHaveCount(1);
  await page.setViewportSize({width,height});await page.locator('.practice-switch select').selectOption('practice-1');await expect(page.locator('.relay-sealed button')).toBeVisible();await expect(page.locator('.relay-sentence')).toHaveCount(0);await open(page);await expect(page.locator('.relay-paper polyline')).toHaveCount(0);
  if(locale==='en')assert(!/[\u3400-\u9fff]/u.test(await page.locator('.relay-table').innerText()),'untranslated relay UI');
  await seed(page,{locale,stage:2});await open(page);await page.screenshot({path:`${out}/${locale}-${width}x${height}-guess.png`});
  await seed(page,{locale,stage:3});await page.screenshot({path:`${out}/${locale}-${width}x${height}-gallery.png`});await page.locator('.relay-gallery-footer button').last().click();await expect(page.locator('.relay-gallery-page polyline')).toHaveCount(1);await page.locator('.relay-gallery-controls select').selectOption('2');await expect(page.locator('.relay-gallery-controls>span')).toHaveText('1 / 3');
  await page.close();console.log('PASS',locale,width,height,'real App drawing, secrecy, rotation, gallery');
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});await seed(page);
 for(let step=0;step<3;step++)for(let seat=0;seat<3;seat++){
  await page.locator('.practice-switch select').selectOption(`practice-${seat}`);await open(page);
  if(step%2){await draw(page);await page.locator('.relay-canvas').press('ArrowRight');await expect(page.locator('.relay-paper polyline')).toHaveCount(2);}
  else{await page.locator('.relay-writing textarea').fill(`English word ${step}-${seat}`);await expect(page.getByRole('status').filter({hasText:'Draft saved'})).toBeVisible();}
  await page.locator('.relay-submit>.primary').click();if(seat<2)await expect(page.locator('.relay-wait')).toContainText('Submitted');else if(step<2)await expect(page.locator('.relay-heading>div>span')).toHaveText(`${step+2} / 3`);console.log('PASS relay contribution',step,seat);
 }
 await expect(page.locator('.relay-gallery-page')).toBeVisible();await page.reload();await expect(page.locator('.relay-gallery-page')).toBeVisible();await page.close();
 assert.deepEqual(errors,[]);console.log('PASS complete 3-player local relay and persisted gallery');
}finally{await browser.close();}
