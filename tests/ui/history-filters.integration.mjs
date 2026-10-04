import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const out=`test-results/history-filters-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
try{
 for(const locale of ['zh','en'])for(const [width,height] of sizes){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(7000);await context.routeWebSocket('**',socket=>socket.close());
  await context.addInitScript(locale=>{
   if(localStorage.getItem('mocha-profile'))return;
   localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify({id:'history-filter-person',name:'UNO爱好者',avatar:'🦊'}));
   const cases=[['uno','cloud','win'],['uno','lan','loss'],['uno','solo','win'],['gems','cloud','draw'],['gems','cloud','win',2],['mahjong','practice','completed'],['werewolf','cloud','host'],['werewolf','lan','completed'],['bombs','solo','loss'],['gems','practice','win']];
   const records=Array.from({length:500},(_,i)=>{const [kind,mode,result,botCount]=cases[i%10];return {id:`record-${i}`,kind,mode,result,...(botCount?{botCount}:{}),at:1791090000000-i*3600000,name:i%2?'梅林':'UNO爱好者',avatar:'🦊',summary:'胜者：梅林、红队 · 15 分',playerCount:4,score:15};});
   localStorage.setItem('mocha-history-v1',JSON.stringify({records,seen:records.map(record=>record.id)}));
  },locale);
  const open=async()=>{await page.getByRole('button',{name:locale==='zh'?'个人战绩':'My results',exact:true}).click();await page.locator('.history-panel').waitFor();};
  const rows=page.locator('.personal-records li'),game=page.locator('.history-filters select').nth(0),mode=page.locator('.history-filters select').nth(1),count=page.locator('.history-filter-status [role=status]');
  const fit=async()=>{
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert(await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
   for(const control of await page.locator('.history-filters select').all()){
    await control.scrollIntoViewIfNeeded();assert(await control.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
   }
  };
  await page.goto(base);await open();await expect(rows).toHaveCount(500);await expect(page.locator('.history-summary b')).toHaveText(locale==='zh'?'150 局联机':'150 online games');
  await fit();await page.screenshot({path:`${out}/all-${locale}-${width}x${height}.png`});
  await game.selectOption('uno');await mode.selectOption('online');await expect(rows).toHaveCount(100);await expect(count).toHaveText(locale==='zh'?'100 / 500 条战绩':'100 of 500 results');
  await expect(page.locator('.history-summary b')).toHaveText(locale==='zh'?'100 局联机':'100 online games');await expect(page.locator('.history-summary span')).toHaveText(locale==='zh'?'50 局获胜 / 并列':'50 wins / ties');
  await expect(rows.first().locator('small')).toContainText('UNO爱好者');await expect(rows.first().locator('p')).toHaveText(locale==='zh'?'胜者：梅林、红队 · 15 分':'Winner: 梅林、红队 · 15 points');
  await page.screenshot({path:`${out}/filtered-${locale}-${width}x${height}.png`});
  await page.setViewportSize({width:height,height:width});await fit();await expect(game).toHaveValue('uno');await expect(mode).toHaveValue('online');await page.setViewportSize({width,height});
  const remove=rows.first().locator('.icon');await remove.scrollIntoViewIfNeeded();assert(await remove.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44;}));
  page.once('dialog',dialog=>dialog.dismiss());await remove.click();await expect(rows).toHaveCount(100);
  page.once('dialog',dialog=>dialog.accept());await remove.click();await expect(rows).toHaveCount(99);await expect(count).toHaveText(locale==='zh'?'99 / 499 条战绩':'99 of 499 results');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-history-v1')));assert.equal(stored.records.length,499);assert.equal(stored.records.some(record=>record.id==='record-0'),false);assert(stored.seen.includes('record-0'));
  await game.selectOption('gems');await expect(rows).toHaveCount(100);await expect(page.locator('.history-summary b')).toHaveText(locale==='zh'?'50 局联机':'50 online games');
  await mode.selectOption('solo');await expect(rows).toHaveCount(0);await expect(page.locator('.history-summary')).toHaveCount(0);await expect(page.locator('.history-panel .empty-state p')).toHaveText(locale==='zh'?'没有符合筛选的战绩':'No matching results');await page.screenshot({path:`${out}/empty-${locale}-${width}x${height}.png`});
  await page.locator('.history-filter-status button').click();await expect(rows).toHaveCount(499);
  await mode.selectOption('solo');await expect(rows).toHaveCount(100);await expect(page.locator('.history-summary')).toHaveCount(0);await mode.selectOption('practice');await expect(rows).toHaveCount(100);
  await page.reload();await open();await expect(rows).toHaveCount(499);await expect(game).toHaveValue('all');await expect(mode).toHaveValue('all');
  await game.selectOption('uno');await expect(page.locator('.history-panel footer button')).toHaveText(locale==='zh'?'删除全部 499 条战绩':'Delete all 499 results');page.once('dialog',dialog=>{assert.match(dialog.message(),locale==='zh'?/全部战绩/:/all.*records/i);return dialog.dismiss();});await page.locator('.history-panel footer button').click();assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-history-v1')).records)).length,499);
  page.once('dialog',dialog=>dialog.accept());await page.locator('.history-panel footer button').click();await expect(page.locator('.history-panel .empty-state p')).toHaveText(locale==='zh'?'暂无战绩':'No results yet');await expect(page.locator('.history-filters')).toHaveCount(0);
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-history-v1')).seen)).length,500);await page.reload();await open();await expect(rows).toHaveCount(0);
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS history filters ${locale} ${width}x${height}: 500 records, game/mode counts, competitive stats, names, rotation, language, confirmed deletion/reload`);
 }
}finally{await browser.close();}
