import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const out=`test-results/relay-gallery-reading-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
try{for(const locale of ['zh','en']){
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/manifest-mocha.webmanifest');
 await page.evaluate(async locale=>{
  const {createPractice,readPractice}=await import('/src/local/practice.ts');
  const {drawrelay,encodeRelayStroke}=await import('/src/core/games/drawrelay.ts');
  const profile={id:'gallery_reader',name:'Long Name 123456',avatar:'🦊'};
  localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale',locale);
  const practice=createPractice('drawrelay',12,profile,{relayMode:'rounds',relaySeconds:0,language:locale});
  // A closed rectangle near all four canvas edges exposes clipping and distorted fitting.
  const frame=encodeRelayStroke([[32,32],[990,32],[990,735],[32,735],[32,32]],0,1);
  const sentence=locale==='zh'?'一只狐狸带着小茶杯去月亮上旅行':'A fox takes a little teacup on a trip to the moon';
  for(let step=0;step<12;step++)for(const person of practice.players){
   const values=[String(step)];practice.game=drawrelay.apply(practice.game,person.id,step%2?{action:'stroke',values:[...values,frame]}:{action:'draft',values,text:sentence});
   practice.game=drawrelay.apply(practice.game,person.id,{action:'submit',values});
  }
  localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice}));
  if(readPractice()?.id!==practice.id)throw Error('Twelve-player gallery fixture rejected');
 },locale);
 await page.goto(base);const album=page.locator('.relay-gallery-controls select'),next=page.getByRole('button',{name:locale==='zh'?'下一页':'Next page',exact:true});
 await expect(page.locator('.relay-gallery-page')).toBeVisible();
 for(const [width,height]of sizes){
  await page.setViewportSize({width,height});await album.selectOption('11');await next.click();
  await expect(page.locator('.relay-gallery-page polyline')).toHaveCount(1);
  const metrics=await page.locator('.relay-gallery-page>.relay-canvas').evaluate(svg=>{
   const box=svg.getBoundingClientRect(),page=svg.parentElement.getBoundingClientRect(),line=svg.querySelector('polyline').getBoundingClientRect();
   const matrix=svg.getScreenCTM();return{box:box.toJSON(),page:page.toJSON(),line:line.toJSON(),scaleX:matrix.a,scaleY:matrix.d};
  });
  for(const inner of [metrics.box,metrics.line])assert(inner.left>=metrics.page.left-1&&inner.top>=metrics.page.top-1&&inner.right<=metrics.page.right+1&&inner.bottom<=metrics.page.bottom+1,'full drawing inside page');
  assert(Math.abs(metrics.scaleX-metrics.scaleY)<.001,'drawing proportions preserved');
  if(width>height&&height<=500){assert(metrics.box.height>=140,`landscape drawing too short: ${metrics.box.height}`);const controls=await page.locator('.relay-gallery-controls').boundingBox();assert(metrics.page.right<=controls.x+1,'page stays beside controls');}
  for(const box of await page.locator('.relay-gallery-controls select,.relay-gallery-footer button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON())))assert(box.width>=43&&box.height>=43&&box.top>=0&&box.bottom<=height+1,'gallery control reachable and touch-sized');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page width overflow');
  await page.screenshot({path:`${out}/${locale}-${width}x${height}-drawing.png`});
  await page.getByRole('button',{name:locale==='zh'?'上一页':'Previous page',exact:true}).click();await expect(page.locator('.relay-gallery-page>.relay-sentence')).toBeVisible();
  await page.screenshot({path:`${out}/${locale}-${width}x${height}-text.png`});
  await page.getByRole('button',{name:locale==='zh'?'对局记录':'Game log',exact:true}).click();await page.setViewportSize({width:height,height:width});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({width,height});await expect(album).toHaveValue('11');
  await album.focus();await page.keyboard.press(engine==='webkit'?'Alt+Tab':'Tab');await expect(page.getByRole('button',{name:locale==='zh'?'再玩接龙':'Play relay again',exact:true})).toBeFocused();
  console.log('PASS',engine,locale,width,height,'full edge drawing, proportions, controls, album/page, dialog rotation and focus');
 }
 await page.reload();await expect(album).toHaveValue('11');assert.deepEqual(errors,[]);await page.close();
}}finally{await browser.close();}
