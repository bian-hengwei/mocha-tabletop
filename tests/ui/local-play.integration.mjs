import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {waitForOfflineReady} from './offline-ready.mjs';
const base=process.env.BASE_URL||'http://127.0.0.1:5218',engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const out=`test-results/local-play-${engine}`;await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[667,375]];
const maxCounts={doudizhu:3,guandan:4,mahjong:4,gems:4,bombs:5,sushi:5,century:5,uno:10};
async function saved(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1'))?.practice);}
async function exit(page,locale,solo=true){await page.getByRole('button',{name:locale==='zh'?'牌桌菜单':'Table menu',exact:true}).click();await page.getByRole('button',{name:solo?(locale==='zh'?'结束单机':'End solo game'):(locale==='zh'?'结束试玩':'End practice'),exact:true}).click();await expect(page.locator('.game-surface')).toHaveCount(0);}
async function reachable(locator){await locator.scrollIntoViewIfNeeded();assert(await locator.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));}
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(base);await page.evaluate(locale=>{localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify({id:'local-play-human',name:'MorganLongName',avatar:'🦊'}));},locale);await page.reload();
  if(process.env.TEST_OFFLINE==='1'){await waitForOfflineReady(page);await context.setOffline(true);await page.reload();}
  for(const [i,[kind,count]] of Object.entries(maxCounts).entries()){
   await page.locator('.cover-'+kind).click();const counts=page.locator('.local-play-fields select').first();
   if(count<=4&&['doudizhu','guandan','mahjong'].includes(kind)){await expect(counts).toBeDisabled();await expect(counts).toHaveValue(String(count));}else await counts.selectOption(String(count));
   const difficulty=['easy','normal','hard'][i%3];await page.locator('.local-play-fields select').nth(1).selectOption(difficulty);
   await page.getByRole('button',{name:locale==='zh'?'单人人机':'Solo vs bots',exact:true}).click();await page.locator('.game-surface').waitFor();
   const p=await saved(page);assert.equal(p.players.length,count);assert.equal(p.mode,'solo');assert.equal(p.difficulty,difficulty);assert(p.players.slice(1).every(bot=>bot.bot.difficulty===difficulty));assert.equal(await page.locator('.practice-switch').count(),0);
   await expect(page.locator('.local-play-summary')).toContainText(locale==='zh'?'单人人机':'Solo vs bots');
   if(kind==='sushi'){await expect.poll(async()=>(await saved(page)).revision).toBeGreaterThan(1);await page.reload();await page.locator('.game-surface').waitFor();assert.equal((await saved(page)).id,p.id);}
   await exit(page,locale);
  }
  for(const kind of ['avalon','undercover','codenames','werewolf']){
   await page.locator('.cover-'+kind).click();assert.equal(await page.getByRole('button',{name:locale==='zh'?'单人人机':'Solo vs bots',exact:true}).count(),0);
   const countSelect=page.locator('.local-play-fields select');const values=await countSelect.locator('option').evaluateAll(options=>options.map(o=>o.value));await countSelect.selectOption(values.at(-1));await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();await page.locator('.game-surface').waitFor();assert.equal((await saved(page)).players.length,Number(values.at(-1)));assert.equal(await page.locator('.practice-switch option').count(),Number(values.at(-1)));await exit(page,locale,false);
  }
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});await page.locator('.cover-uno').click();await page.locator('.local-play-fields select').first().selectOption('10');
   const solo=page.getByRole('button',{name:locale==='zh'?'单人人机':'Solo vs bots',exact:true});await reachable(solo);await page.screenshot({path:`${out}/setup-${locale}-${width}x${height}.png`});
   await page.setViewportSize({width:height,height:width});await reachable(solo);await page.setViewportSize({width,height});await solo.click();await page.locator('.game-surface').waitFor();await page.screenshot({path:`${out}/solo-${locale}-${width}x${height}.png`});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const button of await page.locator('.topbar button').all())await reachable(button);
   await exit(page,locale);
  }
  // Reload/language/replay/history use a clearly marked terminal fixture, not a claimed full UI match.
  await page.locator('.cover-gems').click();await page.locator('.local-play-fields select').first().selectOption('3');await page.locator('.local-play-fields select').nth(1).selectOption('hard');await page.getByRole('button',{name:locale==='zh'?'单人人机':'Solo vs bots',exact:true}).click();await page.locator('.game-surface').waitFor();
  const before=await saved(page);await page.locator('.language-toggle').click();await page.locator('.language-toggle').click();assert.equal((await saved(page)).id,before.id);
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('mocha-practice-v1'));s.practice.game.finished=true;s.practice.game.winners=[s.practice.players[0].id];localStorage.setItem('mocha-practice-v1',JSON.stringify(s));});await page.reload();await page.locator('.end-banner').waitFor();
  const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-history-v1')).records);assert.equal(records.filter(r=>r.id===before.id).length,1);assert.equal(records.find(r=>r.id===before.id).mode,'solo');
  await page.getByRole('button',{name:locale==='zh'?'再来一局':'Play again',exact:true}).click();await expect(page.locator('.end-banner')).toHaveCount(0);const replay=await saved(page);assert.notEqual(replay.id,before.id);assert.equal(replay.players.length,3);assert.equal(replay.difficulty,'hard');await exit(page,locale);await page.reload();await expect(page.locator('.game-surface')).toHaveCount(0);
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${locale}: eight solo games, counts, difficulty, bot progress, discussion pass & play, eight viewports and rotation, resume/language/replay/history/exit${process.env.TEST_OFFLINE==='1'?', offline':''}`);
 }
}finally{await browser.close();}
