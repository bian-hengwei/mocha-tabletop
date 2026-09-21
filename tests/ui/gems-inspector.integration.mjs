import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const out=`test-results/gems-inspector-${engine}`;await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch();
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
try{for(const locale of ['zh','en']){
 const page=await browser.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
 const label=(zh,en)=>locale==='zh'?zh:en;
 const note=page.locator('.g-card-note'),dialog=page.locator('.g-card-inspector');
 async function checkNote(text,name){
  await expect(note).toHaveText(text);
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});
   const metrics=await dialog.evaluate(el=>{const box=el.getBoundingClientRect();return {bottom:box.bottom,top:box.top,scroll:el.scrollHeight,client:el.clientHeight};});
   assert(metrics.top>=0&&metrics.bottom<=height+1&&metrics.scroll<=metrics.client+1,`${name}/${locale}/${width}: card and explanation fit`);
   const box=await note.boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
   const close=dialog.getByRole('button',{name:label('关闭牌面','Close card'),exact:true});await expect(close).toBeInViewport();
   await page.screenshot({path:`${out}/${name}-${locale}-${width}.png`});
  }
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 }
 await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=gems`);
 await page.locator('.g-tier-active .development-card').first().click();
 await expect(dialog.getByRole('button',{name:label('预留','Reserve'),exact:true})).toBeEnabled();
 await checkNote(label('筹码不足，暂不能购买。永久奖励和黄金已计入。','Not enough tokens to buy. Bonuses and gold are already counted.'),'can-reserve');
 await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=gems&scenario=inspection`);
 await page.locator('.g-tier-active .development-card').first().click();
 await expect(dialog.getByRole('button',{name:label('预留','Reserve'),exact:true})).toHaveCount(0);
 await checkNote(label('筹码不足，暂时无法购买；预留位置已满','Not enough gems to buy this card yet. All reserve slots are full.'),'full-market');
 await page.locator('.g-reserved .development-card').first().click();
 await checkNote(label('筹码不足，暂不能购买。永久奖励和黄金已计入。','Not enough tokens to buy. Bonuses and gold are already counted.'),'own-reserved');
 await page.getByRole('button',{name:label('查看我的全部库存','View my full inventory'),exact:true}).click();
 await page.locator('.purchased-columns .development-card').first().click();
 await checkNote(label('这张发展牌已经购入','This development card has already been purchased.'),'bought');
 await page.locator('.g-merchant').nth(1).click();await page.locator('.inventory-reserved .development-card').click();
 await checkNote(label('这是其他玩家的预留牌','This card is reserved by another player.'),'other-reserved');
 await page.getByRole('combobox',{name:'Seat',exact:true}).selectOption('english-player-1');
 await page.locator('.g-tier-active .development-card').first().click();
 await checkNote(label('等待你的回合','Wait for your turn.'),'waiting');
 await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=gems&scenario=payment`);
 await page.locator('.g-payment .development-card').click();
 await checkNote(label('在底部确认支付，或取消购买','Confirm payment below, or cancel the purchase.'),'payment');
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${engine}/${locale}: purchase and reserve explanations, ownership, waiting, payment, eight sizes and rotation`);
}}finally{await browser.close();}
