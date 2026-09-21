import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Browser-only user flows. No game engine imports, React state access or hidden state injection.
const baseURL=process.env.BASE_URL||'http://127.0.0.1:5174';
const artifacts=process.env.CARD_ARTIFACTS||'test-results/cards';
await fs.mkdir(artifacts,{recursive:true});
const browser=await(process.env.TEST_BROWSER==='webkit'?webkit.launch({headless:true}):chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined}));
const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await context.addInitScript(()=>{localStorage.setItem('mocha-profile',JSON.stringify({id:'ui-cards',name:'测试商人',avatar:'🦊'}));localStorage.removeItem('mocha-practice-v1');});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('dialog',dialog=>dialog.accept());
page.setDefaultTimeout(5000);
const seat=async(id)=>{await page.getByRole('combobox',{name:'切换试玩座位'}).selectOption(id);};
const activeSeat=async()=>{const select=page.getByRole('combobox',{name:'切换试玩座位'});const options=await select.locator('option').evaluateAll(xs=>xs.map(x=>({id:x.value,label:x.textContent})));const active=options.find(x=>x.label.includes('待操作'));assert(active,'At least one practice seat must have a legal action');await seat(active.id);return active.id;};
const noToast=async()=>{if(await page.locator('.toast').count())throw new Error(await page.locator('.toast').textContent());};
const confirmSheet=async()=>{await page.locator('.action-sheet footer').getByRole('button',{name:'确认',exact:true}).click();};
async function begin(name){await page.goto(baseURL);await page.getByRole('button',{name:`选择${name}`,exact:true}).click();await page.getByRole('button',{name:'同屏试玩',exact:true}).click();await page.getByRole('combobox',{name:'切换试玩座位'}).waitFor();}
async function take(colors){for(const color of colors)await page.locator('.g-bank').getByRole('button',{name:new RegExp(`^${color} `)}).click();await page.locator('.g-take').getByRole('button',{name:/^拿取/}).click();await noToast();}
async function reserve(){await page.getByRole('button',{name:'预留 1 级盲牌',exact:true}).click();await confirmSheet();await noToast();}
async function payDiscard(){const discard=page.locator('.action-dock').getByRole('button',{name:/^归还/});if(await discard.count()){await discard.click();const sheet=page.locator('.action-sheet'),footer=await sheet.locator('footer small').textContent();const amount=Number(footer.split('/').at(-1).trim());for(let i=0;i<amount;i++)await sheet.locator('.choice').nth(i).click();await confirmSheet();return true;}return false;}
try{
  await begin('晶石商会');
  await page.locator('.g-market-row .development-card:visible').first().click();
  assert.match(await page.locator('.g-card-note').textContent(),/筹码不足.*永久奖励和黄金已计入/,'Explain why buying is unavailable even when reserving is possible');
  assert.equal(await page.locator('.g-card-buttons').getByRole('button',{name:'查看支付',exact:true}).count(),0);
  assert(await page.locator('.g-card-buttons').getByRole('button',{name:'预留',exact:true}).isEnabled());
  await page.getByRole('button',{name:'关闭牌面',exact:true}).click();
  await seat('practice-0');await take(['白钻','蓝宝石','祖母绿']);
  await seat('practice-1');await reserve();
  await seat('practice-0');await take(['祖母绿','红宝石','黑玛瑙']);
  await seat('practice-1');await reserve();
  await seat('practice-0');await take(['白钻','蓝宝石','红宝石']);
  await seat('practice-1');await reserve();
  await seat('practice-0');await reserve();
  await seat('practice-1');await take(['白钻','蓝宝石','祖母绿']);
  await seat('practice-0');await reserve();
  assert(await payDiscard(),'11 held tokens must prompt a mandatory return');
  await page.getByRole('button',{name:'查看 阿岚 的公开库存',exact:true}).click();
  const inventory=page.getByRole('dialog',{name:'阿岚 的公开库存'});
  await inventory.getByLabel('黄金 3 枚筹码',{exact:true}).waitFor();assert.equal(await inventory.locator('.purchased-columns>div').count(),5,'Only five development colors exist');assert.equal(await inventory.locator('.g-hidden-card').count(),3,'Opponent blind reservations stay hidden');
  assert((await inventory.textContent()).includes('预留牌 3'));
  await page.getByRole('button',{name:'关闭公开库存',exact:true}).click();
  await page.screenshot({path:`${artifacts}/gems-discard-inventory.png`});
  // Advance the opponent once, then inspect visible cards until a legal purchase is found.
  await seat('practice-1');
  assert(await page.getByRole('button',{name:'预留 1 级盲牌',exact:true}).isDisabled(),'Three reserves disable another blind reservation');
  const enabledBank=page.locator('.g-bank-gems button:not([disabled])');
  const count=Math.min(3,await enabledBank.count());
  for(let i=0;i<count;i++)await enabledBank.nth(i).click();
  await page.locator('.g-take').getByRole('button',{name:/^拿取/}).click();
  await payDiscard();
  await seat('practice-0');
  let purchased=false;
  for(const level of [1,2,3]){
    if(purchased)break;
    if(await page.locator('.g-tier-tabs').isVisible())await page.locator('.g-tier-tabs button').nth(level-1).click();
    const row=page.locator('.g-market-row').filter({has:page.locator('.level-'+level)});
    const cards=row.locator('.development-card').or(page.locator('.g-reserved .development-card'));
    const count=await cards.count();
    for(let i=0;i<count;i++){
      await cards.nth(i).click();const buy=page.locator('.g-card-inspector').getByRole('button',{name:'查看支付',exact:true});
      if(await buy.count()){await buy.click();purchased=true;break;}
      await page.getByRole('button',{name:'关闭牌面',exact:true}).click();
    }
  }
  assert(purchased,'No affordable card after inspecting every market tier and own reservations');
  await page.getByLabel('待购买的发展牌和自动支付筹码').waitFor();
  const paymentPlan=await page.locator('.g-payment>.g-cost>span').evaluateAll(xs=>xs.map(x=>x.getAttribute('aria-label')));
  await page.locator('.action-dock').getByRole('button',{name:'选择筹码',exact:true}).click();
  assert((await page.locator('.action-sheet').textContent()).includes('折扣后费用'));
  if(process.env.CUSTOM_PAYMENT){for(const item of paymentPlan){const [color,amount]=item.split(' ');const choices=page.locator('.action-sheet .choice').filter({hasText:color+' ·'});for(let i=0;i<Number(amount);i++)await choices.nth(i).click();}await confirmSheet();}
  else{await page.getByRole('button',{name:'关闭选择',exact:true}).click();await page.locator('.action-dock').getByRole('button',{name:'确认购买',exact:true}).click();}
  await noToast();
  await page.getByRole('button',{name:'查看 测试商人 的公开库存',exact:true}).click();
  assert((await page.getByRole('dialog',{name:'测试商人 的公开库存'}).textContent()).includes('已购牌 1'));
  await page.getByRole('button',{name:'关闭公开库存',exact:true}).click();
  await page.screenshot({path:`${artifacts}/gems-purchase.png`});
  console.log('PASS gems: token selection, reserve, gold, mandatory discard, public inventory, payment preview, '+(process.env.CUSTOM_PAYMENT?'actual custom payment':'automatic purchase'));

  // A second real-app deal exercises the repeat-tap pair shortcut without a mode toggle.
  await begin('晶石商会');await take(['白钻','白钻']);
  await page.getByRole('button',{name:'查看我的全部库存',exact:true}).click();
  await page.getByRole('dialog').getByLabel('白钻 2 枚筹码',{exact:true}).waitFor();
  await page.getByRole('button',{name:'关闭公开库存',exact:true}).click();
  console.log('PASS gems: repeated same-color taps take exactly two tokens');
  await seat('practice-1');await page.locator('.g-market-row:visible .development-card').first().click();await page.locator('.g-card-inspector').getByRole('button',{name:'预留',exact:true}).click();
  await seat('practice-0');await page.getByRole('button',{name:'查看 阿岚 的公开库存',exact:true}).click();assert.equal(await page.locator('.inventory-reserved .development-card').count(),1);assert.equal(await page.locator('.inventory-reserved .g-hidden-card').count(),0);await page.getByRole('button',{name:'关闭公开库存',exact:true}).click();
  await take(['蓝宝石','祖母绿','红宝石']);await seat('practice-1');await reserve();await seat('practice-0');await page.getByRole('button',{name:'查看 阿岚 的公开库存',exact:true}).click();assert.equal(await page.locator('.inventory-reserved .development-card').count(),1);assert.equal(await page.locator('.inventory-reserved .g-hidden-card').count(),1);await page.screenshot({path:`${artifacts}/gems-public-private-reserves.png`});await page.getByRole('button',{name:'关闭公开库存',exact:true}).click();
  await seat('practice-1');await page.getByRole('button',{name:'查看我的全部库存',exact:true}).click();assert.equal(await page.locator('.inventory-reserved .development-card').count(),2);assert.equal(await page.locator('.inventory-reserved .g-hidden-card').count(),0);await page.getByRole('button',{name:'关闭公开库存',exact:true}).click();
  console.log('PASS gems: face-up reserve remembered publicly, blind reserve hidden from opponents but visible to its owner');

  await begin('喵喵危机');let played=false,drew=false;
  for(let turn=0;turn<20&&!(played&&drew);turn++){
    await activeSeat();
    if(!played){const hand=page.locator('.bt-hand');for(const title of ['预知三张','洗牌','攻击','跳过','索取']){const card=hand.getByRole('button',{name:title,exact:true}).first();if(await card.count()){await card.click();await page.getByRole('button',{name:'打出这张',exact:true}).click();played=true;if(title==='索取')await page.locator('.bt-seat.targetable').first().click();break;}}}
    if(await page.locator('.bt-phase-response').count())for(const id of ['practice-0','practice-1','practice-2']){if(!await page.locator('.bt-phase-response').count())break;await seat(id);const pass=page.getByRole('button',{name:/^继续$/});if(await pass.count())await pass.click();}
    await activeSeat();
    if(await page.locator('.bt-phase-future').count())await page.getByRole('button',{name:'看好了',exact:true}).click();
    if(await page.locator('.bt-phase-give').count()){await page.locator('.bt-hand .bt-card').first().click();await page.getByRole('button',{name:'交出这张',exact:true}).click();await activeSeat();}
    const draw=page.getByRole('button',{name:/^抽牌，剩余/});if(await draw.isEnabled()){await draw.click();drew=true;}
    await noToast();
  }
  assert(played&&drew);await page.screenshot({path:`${artifacts}/bombs-after-effects.png`});console.log('PASS bombs: redesigned live app hand play, responses and draw');
  assert.deepEqual(errors,[],'No browser runtime errors');
  console.log(`Screenshots: ${artifacts}`);
}catch(error){await page.screenshot({path:`${artifacts}/failure.png`});console.error(await page.locator('body').innerText());throw error;}
finally{await browser.close();}
