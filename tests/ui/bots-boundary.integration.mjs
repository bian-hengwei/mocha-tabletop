import {chromium,webkit,expect} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5207',engine=process.env.TEST_BROWSER||'chromium',out=process.env.BOT_ARTIFACT_DIR||`tests/ui/artifacts/bot-boundary-${engine}`;
await fs.mkdir(out,{recursive:true});const browser=await(engine==='webkit'?webkit:chromium).launch();
try{for(const locale of ['zh','en'])for(const state of ['round','retry']){
 const page=await browser.newPage();await page.goto(`${base}/tests/ui/bots-boundary.fixture.html?locale=${locale}&state=${state}`);
 const button=page.getByRole('button',{name:state==='round'?(locale==='zh'?'开始下一轮':'Start the next round'):(locale==='zh'?'重试人机':'Retry bot'),exact:true});await expect(button).toBeVisible();
 for(const[width,height]of[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){
  await page.setViewportSize({width,height});const box=await button.boundingBox();assert(box&&box.height>=44&&box.y>=0&&box.y+box.height<=height,'recovery action reachable');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow');
  const clipped=await page.locator('.game-surface').evaluate(el=>el.scrollHeight>el.clientHeight+1);assert(!clipped,`${locale}/${state}/${width}: game clipped by bot status`);
  await page.screenshot({path:`${out}/${state}-${locale}-${width}x${height}.png`});
 }
 await button.click();await expect(page.locator('.bot-match-status')).toHaveCount(0);assert.equal(await page.evaluate(state=>window.botBoundaryEvents[state==='round'?'continues':'retries'],state),1);
 await page.goto(`${base}/tests/ui/bots-boundary.fixture.html?locale=${locale}&state=${state}&guest=1`);await expect(button).toHaveCount(0);if(state==='retry')await expect(page.getByRole('alert')).toBeVisible();await page.close();
}
for(const locale of ['zh','en'])for(const kind of ['doudizhu','guandan','mahjong']){
 const page=await browser.newPage();await page.goto(`${base}/tests/ui/bots-boundary.fixture.html?locale=${locale}&state=finished&kind=${kind}`);await expect(page.locator('.end-banner')).toBeVisible();await page.getByRole('button',{name:locale==='zh'?'收起结算':'Dismiss result',exact:true}).click();
 for(const[width,height]of[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){
  await page.setViewportSize({width,height});const rows=await page.locator('.classic-result-player').all();assert.equal(rows.length,kind==='doudizhu'?3:4);
  for(const row of rows){const box=await row.boundingBox();assert(box&&box.y>=0&&box.y+box.height<=height,`${kind}/${locale}/${width}: every player's final score and hand visible`);}
  assert(await page.locator('.classic-arena,.classic-hand-panel,.seat-turn-label').count()===0,'no stale active-play interface at result');
  await page.screenshot({path:`${out}/finished-${kind}-${locale}-${width}x${height}.png`});
 }
 if(kind==='mahjong'){await page.getByRole('button',{name:locale==='zh'?'胡牌记录 (1)':'Win history (1)',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.setViewportSize({width:844,height:390});await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);}
 await page.close();
}
console.log(`PASS ${engine}: real App bot-owned round continuation and retry, guest permissions, both languages and seven sizes. Classic final scores, exposed hands and win history also verified; transport is a deterministic fixture.`);}finally{await browser.close();}
