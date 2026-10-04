import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const out=`test-results/mahjong-public-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]],errors=[];
async function fit(page){
 const dialog=page.locator('.mj-public-dialog'),viewport=page.viewportSize(),box=await dialog.boundingBox();
 assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,'public dialog fits viewport');
 assert(await dialog.evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1),'only public tiles content scrolls');
 assert(await page.locator('.mj-public-dialog button').evaluateAll(buttons=>buttons.every(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;})),'public controls are 44px and reachable');
}
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext();await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
  const panel=page.locator('.mj-public-dialog'),opener=page.locator('.mj-public-button'),seats=page.locator('.mj-public-seats button');
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=dense&mode=bloodflow&long`);
   const ownHand=await page.locator('.mj-hand button').evaluateAll(tiles=>tiles.map(tile=>tile.dataset.tileId));
   await opener.click();await fit(page);await expect(seats.nth(0)).toHaveAttribute('aria-pressed','true');await expect(panel.locator('.mj-all-discards .mj-face')).toHaveCount(24);
   await seats.nth(1).click();await expect(seats.nth(1)).toHaveAttribute('aria-pressed','true');await expect(panel.locator('.mj-public-melds [role=img]')).toHaveCount(3);await expect(panel.locator('.mj-public-melds')).toContainText(locale==='zh'?'碰':'Pung');
   assert.deepEqual(await page.locator('.mj-hand button').evaluateAll(tiles=>tiles.map(tile=>tile.dataset.tileId)),ownHand,'public player selection preserves the private hand');
   await page.screenshot({path:`${out}/${locale}-${width}-public.png`});
   await seats.nth(2).click();await expect(panel.locator('.mj-public-melds .mj-back')).toHaveCount(4);await expect(panel.locator('.mj-public-melds [role=img]')).toHaveCount(0);await expect(panel.locator('.mj-public-melds')).toContainText(locale==='zh'?'暗杠':'Concealed kong');
   await panel.locator('.mj-public-melds').scrollIntoViewIfNeeded();await expect(panel.locator('.mj-public-melds .mj-back').last()).toBeInViewport();await page.screenshot({path:`${out}/${locale}-${width}-concealed.png`});
   if(locale==='en')assert(!/[\p{Script=Han}]/u.test(await panel.innerText()),'public panel is fully translated');
   await page.setViewportSize({width:height,height:width});await fit(page);await expect(seats.nth(2)).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Tab');assert(await panel.evaluate(el=>el.contains(document.activeElement)),'dialog traps focus');await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(opener).toBeFocused();
   await page.setViewportSize({width,height});await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=quick`);
   const tile=page.locator('.mj-hand button').last(),confirm=page.locator('.mj-discard-confirm');await expect(confirm).toBeDisabled();
   await tile.dblclick();await expect(tile).toHaveAttribute('aria-pressed','false');await expect(page.locator('.river-self .mj-face')).toHaveCount(0);await expect(confirm).toBeDisabled();
   await tile.click();await expect(confirm).toBeEnabled();await page.screenshot({path:`${out}/${locale}-${width}-selected.png`});
   await opener.click();await expect(panel.locator('.mj-public-empty')).toHaveCount(2);await page.keyboard.press('Escape');await expect(tile).toHaveAttribute('aria-pressed','true');await confirm.click();await expect(page.locator('.river-self .mj-face')).toHaveCount(1);await expect(page.locator('.mj-tile.selected')).toHaveCount(0);
   console.log(`PASS ${locale} ${width}x${height}: public rivers/melds, concealed privacy, stable hand, focus/rotation and explicit discard`);
  }
  await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=dense&spectator`);await expect(page.locator('.mj-hand-panel')).toHaveCount(0);await opener.click();await seats.nth(2).click();await expect(panel.locator('.mj-public-melds .mj-back')).toHaveCount(4);await expect(panel.locator('.mj-public-melds [role=img]')).toHaveCount(0);
  await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=dense`);await opener.click();await page.evaluate(()=>{const select=document.querySelector('[aria-label=Seat]');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));});await expect(panel).toHaveCount(0);
  await page.setViewportSize({width:568,height:320});await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=mahjong&players=max`);const compactArena=page.locator('.mj-arena');assert(await compactArena.evaluate(el=>el.scrollHeight<=el.clientHeight+1),'compact arena keeps opponent racks inside its bounds');await page.screenshot({path:`${out}/${locale}-568-compact-arena.png`});
  await context.close();console.log(`PASS ${locale}: spectator public view and seat-change privacy reset`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
