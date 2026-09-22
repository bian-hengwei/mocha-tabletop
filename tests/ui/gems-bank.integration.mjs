import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const engine=process.env.TEST_BROWSER||'chromium';
const out=process.env.GEMS_ARTIFACT_DIR||`test-results/gems-bank-${engine}`;
await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
const errors=[];
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext();
  await context.addInitScript(locale=>{
   localStorage.setItem('mocha-locale',locale);
   localStorage.setItem('mocha-profile',JSON.stringify({id:'gems-bank-ui',name:'Morgan',avatar:'🦊'}));
   localStorage.removeItem('mocha-practice-v1');
  },locale);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('.cover-gems').click();
  await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();
  await page.locator('.g-table').waitFor();
  const gems=page.locator('.g-bank-gem'),take=page.locator('.g-take .primary');
  const rules=take;
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const targets=await gems.evaluateAll(es=>es.map(el=>{
    const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {label:el.getAttribute('aria-label'),visible:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&el.contains(hit),width:r.width,height:r.height};
   }));
   assert.equal(targets.length,6);
   assert(targets.every(t=>t.visible&&t.width>=43.5&&t.height>=43.5),`${locale} ${width}x${height}: every gem visible at touch size: ${JSON.stringify(targets)}`);
   const bankSize=await page.locator('.g-bank-gems').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
   assert(bankSize.scroll<=bankSize.client+1,`${locale} ${width}x${height}: bank does not require horizontal scrolling: ${JSON.stringify(bankSize)}`);
   await expect(take).toBeDisabled();
   await expect(rules).toBeVisible();
   await expect(rules).toHaveText(locale==='zh'?'拿取':'Take');
   await expect(take).toHaveAccessibleName(locale==='zh'?'选择宝石: 取 3 色，各 1 枚 · 或同色连点取 2（库存 ≥4）':'Choose gems: 3 colors, 1 each · Or tap one color twice for 2 (stock ≥4)');
   const rulesVisible=await rules.evaluate(el=>{const r=el.getBoundingClientRect(),button=el.closest('button').getBoundingClientRect();return r.top>=button.top&&r.bottom<=button.bottom&&r.left>=button.left&&r.right<=button.right&&button.bottom<=innerHeight;});
   assert(rulesVisible,`${locale} ${width}x${height}: take requirements are not clipped or covered`);
   const regions=await page.locator('.g-market,.g-bank,.g-bank-actions').evaluateAll(([market,bank,actions])=>Object.fromEntries([['market',market],['bank',bank],['actions',actions]].map(([name,el])=>{const r=el.getBoundingClientRect();return[name,{left:r.left,right:r.right,top:r.top,bottom:r.bottom}];})));
   const marketClear=regions.market.right<=regions.bank.left+1||regions.bank.right<=regions.market.left+1||regions.market.bottom<=regions.bank.top+1||regions.bank.bottom<=regions.market.top+1;
   assert(marketClear,`${locale} ${width}x${height}: market and gem bank overlap: ${JSON.stringify(regions)}`);
   assert(regions.actions.left>=regions.bank.left-1&&regions.actions.right<=regions.bank.right+1&&regions.actions.top>=regions.bank.top-1&&regions.actions.bottom<=regions.bank.bottom+1,`${locale} ${width}x${height}: gem actions escape their bank: ${JSON.stringify(regions)}`);
   for(const i of [0,2]){await gems.nth(i).click();await expect(take).toBeDisabled();}
   await page.screenshot({path:`${out}/${locale}-${width}x${height}-incomplete.png`});
   await gems.nth(4).click();
   await expect(take).toBeEnabled();
   for(const i of [0,2,4])await expect(gems.nth(i)).toHaveAttribute('aria-pressed','true');
   await page.screenshot({path:`${out}/${locale}-${width}x${height}-selected.png`});
   // Rotation preserves the deliberate choice and keeps confirm/clear reachable.
   await page.setViewportSize({width:height,height:width});
   await expect(take).toBeEnabled();
   await page.setViewportSize({width,height});
   await page.getByRole('button',{name:locale==='zh'?'清空宝石选择':'Clear gem selection',exact:true}).click();
   await expect(take).toBeDisabled();
   await gems.nth(4).click();await gems.nth(4).click();
   await expect(take).toBeEnabled();
   await expect(gems.nth(4)).toHaveAccessibleName(/2$/);
   await gems.nth(4).click();await expect(gems.nth(4)).toHaveAttribute('aria-pressed','false');
   await expect(take).toBeDisabled();
   if(width===568&&height===320){
    await page.locator('.g-own-stock').scrollIntoViewIfNeeded();
    await page.locator('.g-own-stock').click();
    await expect(page.locator('.g-inventory')).toBeVisible();
    await page.screenshot({path:`${out}/${locale}-${width}x${height}-inventory.png`});
    await page.getByRole('button',{name:locale==='zh'?'关闭公开库存':'Close inventory',exact:true}).click();
   }
  }
  for(const [scenario,colors]of [['bank-scarce',[1,2]],['bank-one',[3]],['bank-no-pair',[0,1,2]],['bank-full-hand',[0,1,2]]]){
   await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=gems&players=max&scenario=${scenario}`);
   await expect(rules).toHaveText(locale==='zh'?'拿取':'Take');
   if(scenario!=='bank-full-hand'){
    await expect(rules).toHaveText(locale==='zh'?'拿取':'Take');
    await gems.nth(colors[0]).click();await gems.nth(colors[0]).click();
    await expect(gems.nth(colors[0])).toHaveAttribute('aria-pressed','false');
   }
   for(const i of colors)await gems.nth(i).click();
   await expect(take).toBeEnabled();await take.click();
   if(scenario==='bank-full-hand')await expect(page.locator('.action-dock')).toContainText(locale==='zh'?'归还':'Return');
   else await expect(take).toBeDisabled();
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);
 console.log(`PASS ${engine}: compact take control with accessible rules, non-overlapping bank controls, scarce bank, pair stock threshold, token overflow; six gem colors at 44px, both languages/eight sizes, clear and rotation.`);
}finally{await browser.close();}
