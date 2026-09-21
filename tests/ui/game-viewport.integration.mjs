import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/game-viewport-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]],errors=[],layoutIssues=[];
async function checkShortGemsTable(page,language){
 const surface=page.locator('.game-surface');
 assert(['auto','scroll'].includes(await surface.evaluate(el=>getComputedStyle(el).overflowY)),'short Gems table must allow outer scrolling');
 await surface.evaluate(el=>el.scrollTop=0);
 await page.screenshot({path:`${out}/gems-${language}-568-top.png`});
 for(const selector of ['.g-merchants','.g-nobles','.g-tier-tabs','.g-market-row:visible','.g-bank','.g-own-tray']){
  const section=page.locator(selector);await section.scrollIntoViewIfNeeded();
  assert(await section.evaluate(el=>{
   const r=el.getBoundingClientRect(),s=el.closest('.game-surface').getBoundingClientRect();
   return r.top>=Math.max(0,s.top)-1&&r.bottom<=Math.min(innerHeight,s.bottom)+1&&r.left>=s.left-1&&r.right<=s.right+1&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
  }),`short Gems section is fully reachable and unobstructed: ${selector}`);
 }
 await page.screenshot({path:`${out}/gems-${language}-568-bottom.png`});
 // Exercise the controls after scrolling, including the inventory below the bank.
 await page.locator('.g-bank').scrollIntoViewIfNeeded();
 for(const gem of await page.locator('.g-bank-gem').all()){
  const box=await gem.boundingBox();assert(box&&box.width>=43.5&&box.height>=43.5,'gem touch target retains its size');
 }
 for(const i of [0,1,2])await page.locator('.g-bank-gem').nth(i).click();
 await expect(page.locator('.g-take .primary')).toBeEnabled();
 await page.getByRole('button',{name:language==='zh'?'清空宝石选择':'Clear gem selection',exact:true}).click();
 await expect(page.locator('.g-take .primary')).toBeDisabled();
 await page.getByRole('button',{name:language==='zh'?'查看我的全部库存':'View my full inventory',exact:true}).click();
 await expect(page.locator('.g-inventory')).toBeVisible();await page.keyboard.press('Escape');
 await expect(page.locator('.g-inventory')).toHaveCount(0);await surface.evaluate(el=>el.scrollTop=0);
}
try{
 const page=await browser.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);const games=await page.evaluate(async()=>Object.keys((await import('/src/core/types.ts')).GAMES));assert.equal(games.length,12);
 for(const language of ['zh','en']){
  await page.addInitScript(language=>localStorage.setItem('mocha-locale',language),language);
  for(const [width,height]of sizes){await page.setViewportSize({width,height});
   for(const kind of games){
    await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=${kind}&players=max`);await expect(page.locator('.game-surface').locator(':scope>*').first()).toBeVisible();
    const shortGems=kind==='gems'&&height<=360&&width>height;
    if(shortGems)await checkShortGemsTable(page,language);
    const overflow=await page.locator('.game-surface').evaluate((surface,allowOuter)=>[surface,...surface.querySelectorAll('*')].filter(node=>node instanceof HTMLElement&&node.clientHeight>0&&node.scrollHeight>node.clientHeight+2&&['auto','scroll','hidden'].includes(getComputedStyle(node).overflowY)&&!node.matches('.illustrated-tile,.role-art')&&!(allowOuter&&node===surface&&['auto','scroll'].includes(getComputedStyle(node).overflowY))).map(node=>({class:node.className,height:node.clientHeight,content:node.scrollHeight})),shortGems);
    if(overflow.length)layoutIssues.push({kind,language,width,height,overflow});
    assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1),`${kind}: document fits viewport`);
    if(width===320||width===844)await page.screenshot({path:`${out}/${kind}-${language}-${width}.png`});
   }
   console.log(layoutIssues.some(issue=>issue.language===language&&issue.width===width)?'FAIL':'PASS','all twelve maximum-player tables have bounded, reachable layouts',language,width,height);
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(layoutIssues,[],'No unintended vertical scroll or clipping; short Gems outer scrolling must remain reachable');
}finally{await browser.close();}
