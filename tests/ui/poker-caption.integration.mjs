import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const out=`test-results/poker-caption-${engine}`;await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch();
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
// Expectations are the physical card ranks, independent of encoded comparison
// power. In Guan Dan the level card and the two jokers use different powers.
const cases=[['doudizhu',12,2,'Q','Q'],['guandan',12,5,'Q','Q'],['guandan',5,5,'5','5'],['guandan',15,5,'2','2'],['guandan',16,5,'小王','Small joker'],['guandan',17,5,'大王','Big joker']];
try{for(const locale of ['zh','en']){
 const page=await browser.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
 for(const[kind,rank,level,zh,en]of cases){
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=${kind}&scenario=played-single&rank=${rank}&level=${level}`);
  const caption=page.locator('.played-caption');await expect(caption.locator('span').first()).toHaveText(`${locale==='zh'?'单张':'Single'} · ${locale==='zh'?zh:en}`);await expect(caption.locator('.played-owner')).toHaveText('Alex');
  await expect(page.locator('.classic-seat.self small').first()).toContainText(locale==='zh'?'1 张':'1 card');
  for(const[width,height]of sizes){
   await page.setViewportSize({width,height});
   const box=await caption.boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
   assert(await caption.evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1),'played caption does not clip');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`${out}/${kind}-${rank}-${locale}-${width}.png`});
  }
 }
 await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=guandan&scenario=spectator-lead`);
 const waiting=locale==='zh'?'等待 Blair':'Waiting for Blair';
 await expect(page.locator('.table-prompt')).toHaveText(waiting);
 await expect(page.locator('.classic-selection')).toHaveText(waiting);
 await expect(page.locator('.classic-seat.current')).toContainText('Blair');
 await expect(page.locator('.classic-hand .classic-card')).toHaveCount(0);
 for(const[width,height]of sizes){
  await page.setViewportSize({width,height});
  const box=await page.locator('.table-prompt').boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
  await page.screenshot({path:`${out}/spectator-${locale}-${width}.png`});
 }
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${engine}/${locale}: visible played rank, normal/level/two/jokers, spectator current player, eight sizes and rotation`);
}}finally{await browser.close();}
