import {chromium, webkit, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const out=`test-results/gem-purchase-quotes-${engine}`;await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch();
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
try{for(const locale of ['zh','en']){
 const page=await browser.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
 const label=(zh,en)=>locale==='zh'?zh:en;
 const dialog=page.locator('.g-card-inspector'),preview=dialog.locator('.g-purchase-preview');
 async function openScenario(scenario){
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=gems&scenario=${scenario}`);
  const opener=page.locator('.g-market-row').last().locator('.development-card').first();await opener.click();
  await expect(preview).toBeVisible();return opener;
 }
 async function checkLayout(name){
  const metrics=await dialog.evaluate(el=>{const box=el.getBoundingClientRect();return {top:box.top,right:box.right,bottom:box.bottom,left:box.left,scroll:el.scrollHeight,client:el.clientHeight,width:el.clientWidth,scrollWidth:el.scrollWidth};});
  const size=page.viewportSize();
  assert(metrics.top>=0&&metrics.bottom<=size.height+1&&metrics.left>=0&&metrics.right<=size.width+1,`${name}/${locale}: dialog in viewport ${JSON.stringify(metrics)}`);
  assert(metrics.scrollWidth<=metrics.width+1,`${name}/${locale}: no horizontal overflow`);
  assert(metrics.scroll<=metrics.client+1,`${name}/${locale}: all content fits without scrolling ${JSON.stringify(metrics)}`);
  for(const control of await dialog.locator('button:not([disabled])').all()){
   const box=await control.boundingBox();assert(box&&box.width>=43.9&&box.height>=43.9,`${name}: 44px target`);await expect(control).toBeInViewport();
  }
  const table=await preview.locator('table').boundingBox();assert(table&&table.x+table.width<=metrics.right);
  await page.screenshot({path:`${out}/${name}-${locale}-${size.width}x${size.height}.png`});
 }
 const opener=await openScenario('quote-short');
 await expect(preview.locator('tbody tr')).toHaveCount(4);
 const cells=await preview.locator('tbody tr').allTextContents();
 assert.deepEqual(cells.map(row=>row.replace(/[\u3400-\u9fffA-Za-z\s]/gu,'')),['1−1000','2−0211','1−1000','1−0101']);
 await expect(preview.locator('.g-quote-gold')).toHaveText(label('黄金补缺 2 / 持有 1','Gold needed 2 / Have 1'));
 await expect(preview.locator('.g-quote-result')).toHaveText(label('筹码缺口 1','Token shortfall: 1'));
 await expect(dialog.getByRole('button',{name:label('查看支付','Review payment'),exact:true})).toHaveCount(0);
 for(const [width,height] of sizes){await page.setViewportSize({width,height});await checkLayout('short');}
 for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)));}
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
 await page.getByRole('button',{name:'Toggle language'}).click();await opener.click();
 await expect(preview).toHaveAttribute('aria-label',label('My purchase cost','我的购买费用'));
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Toggle language'}).click();await opener.click();
 await expect(preview).toHaveAttribute('aria-label',label('我的购买费用','My purchase cost'));
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await page.getByRole('combobox',{name:'Seat',exact:true}).selectOption('english-player-1');
 await page.locator('.g-market-row').last().locator('.development-card').first().click();
 await expect(dialog.locator('.g-card-note')).toHaveText(label('等待你的回合','Wait for your turn.'));
 await expect(preview.locator('.g-quote-gold')).toHaveText(label('黄金补缺 5 / 持有 0','Gold needed 5 / Have 0'));
 await page.keyboard.press('Escape');
 await openScenario('quote-ready');
 await expect(preview.locator('.g-quote-result')).toHaveText(label('筹码充足','Enough tokens'));
 const review=dialog.getByRole('button',{name:label('查看支付','Review payment'),exact:true});await review.click();await expect(dialog).toHaveCount(0);
 await expect(page.locator('.g-payment')).toBeVisible();
 await page.locator('.g-payment .development-card').click();await expect(preview.locator('.g-quote-result')).toHaveText(label('筹码充足','Enough tokens'));
 await expect(dialog.locator('.g-card-note')).toHaveText(label('在底部确认支付，或取消购买','Confirm payment below, or cancel the purchase.'));
 for(const [width,height] of sizes){await page.setViewportSize({width,height});await checkLayout('payment');}
 await page.keyboard.press('Escape');
 await page.locator('.dock-actions').getByRole('button',{name:label('取消','Cancel'),exact:true}).click();await expect(page.locator('.g-payment')).toHaveCount(0);
 await page.locator('.g-market-row').last().locator('.development-card').first().click();await review.click();
 await page.locator('.dock-actions').getByRole('button',{name:label('确认购买','Confirm purchase'),exact:true}).click();
 await expect(page.locator('.g-payment')).toHaveCount(0);await expect(page.locator('.g-merchant').first().locator('.merchant-head>small').first()).toHaveText('3');
 await openScenario('quote-free');await expect(preview.locator('.g-quote-result')).toHaveText(label('无需筹码','No tokens needed'));await checkLayout('free');
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${engine}/${locale}: discount/shortage/gold, eight sizes, rotation, focus, language, seat cleanup, review/cancel/confirm and free cost`);
}}finally{await browser.close();}
