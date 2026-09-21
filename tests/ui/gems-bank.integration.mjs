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
  const hint=page.locator('.g-bank-hint');
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const targets=await gems.evaluateAll(es=>es.map(el=>{
    const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {label:el.getAttribute('aria-label'),visible:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&el.contains(hit),width:r.width,height:r.height};
   }));
   assert.equal(targets.length,6);
   assert(targets.every(t=>t.visible&&t.width>=43.5&&t.height>=43.5),`${locale} ${width}x${height}: every gem visible at touch size: ${JSON.stringify(targets)}`);
   assert(await page.locator('.g-bank-gems').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'bank does not require horizontal scrolling');
   await expect(take).toBeDisabled();
   await expect(hint).toBeVisible();
   await expect(hint).toContainText(locale==='zh'?'取 3 色，各 1 枚':'3 colors, 1 each');
   await expect(hint).toContainText(locale==='zh'?'或同色连点取 2（库存 ≥4）':'Or tap one color twice for 2 (stock ≥4)');
   const hintVisible=await hint.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
   assert(hintVisible,`${locale} ${width}x${height}: take requirements are not clipped or covered`);
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
   await expect(hint).toContainText(locale==='zh'?`取 ${colors.length} 色，各 1 枚`:colors.length===1?'1 color, 1 token':`${colors.length} colors, 1 each`);
   if(scenario!=='bank-full-hand'){
    await expect(hint).not.toContainText('≥4');
    await gems.nth(colors[0]).click();await gems.nth(colors[0]).click();
    await expect(gems.nth(colors[0])).toHaveAttribute('aria-pressed','false');
   }
   for(const i of colors)await gems.nth(i).click();
   await expect(take).toBeEnabled();await take.click();
   if(scenario==='bank-full-hand')await expect(page.locator('.action-dock')).toContainText(locale==='zh'?'归还':'Return');
   else await expect(hint).toHaveCount(0);
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);
 console.log(`PASS ${engine}: visible take requirements, incomplete choices, scarce bank, pair stock threshold, token overflow; six gem colors at 44px, both languages/eight sizes, clear and rotation.`);
}finally{await browser.close();}
