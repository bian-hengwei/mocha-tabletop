import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const out=`test-results/bombs-experience-${engine}`;await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch();
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
try{
 for(const locale of ['zh','en'])for(const [width,height] of sizes){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true});await context.addInitScript(l=>localStorage.setItem('mocha-locale',l),locale);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(7000);
  const go=async scenario=>{await page.goto(`${base}/tests/ui/bombs-viewport.fixture.html?scenario=${scenario}`);await page.locator('.bt-table').waitFor();};
  const hand=page.locator('.bt-hand .bt-card'),selected=page.locator('.bt-hand .bt-selected');
  const byKind=(zh,en)=>hand.filter({hasText:locale==='zh'?zh:en}).first();
  const opener=page.getByRole('button',{name:locale==='zh'?'最近弃牌':'Recent discards',exact:true});
  const dialog=page.getByRole('dialog',{name:locale==='zh'?'最近弃牌':'Recent discards',exact:true});
  const close=page.getByRole('button',{name:locale==='zh'?'关闭弃牌':'Close discards',exact:true});
  const fit=async()=>{
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));
   assert(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
   assert(await close.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  };
  await go('discard');const attack=byKind('攻击','Attack'),count=await hand.count();
  await attack.dblclick();await expect(selected).toHaveCount(0);await expect(hand).toHaveCount(count);await expect(page.locator('.bt-phase-turn')).toBeVisible();
  await attack.tap();await expect(attack).toHaveAttribute('aria-pressed','true');await attack.tap();await expect(attack).toHaveAttribute('aria-pressed','false');await expect(hand).toHaveCount(count);
  await attack.click();await page.screenshot({path:`${out}/selected-${locale}-${width}x${height}.png`});
  await opener.click();await expect(dialog).toBeVisible();await expect(page.locator('.bt-discard-list li')).toHaveCount(12);await fit();
  // Fixture has 14 public discards. Only the newest 12 are projected, newest first.
  const expected=locale==='zh'?['攻击','跳过','拆弹','预知三张','太阳猫','星星猫','叶子猫','云朵猫','月亮猫','否决','攻击','跳过']:['Attack','Skip','Defuse','Peek 3','Sun Kitten','Star Kitten','Leaf Kitten','Cloud Kitten','Moon Kitten','Nope','Attack','Skip'];
  assert.deepEqual(await page.locator('.bt-discard-list h3').allTextContents(),expected);
  assert(await dialog.evaluate(el=>el.contains(document.activeElement)));await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)));
  await page.screenshot({path:`${out}/discards-${locale}-${width}x${height}.png`});await page.locator('.bt-discard-list li').last().scrollIntoViewIfNeeded();await expect(page.locator('.bt-discard-list li').last()).toBeInViewport();
  await page.setViewportSize({width:height,height:width});await fit();await page.setViewportSize({width,height});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);assert(await opener.evaluate(el=>el===document.activeElement));await expect(attack).toHaveAttribute('aria-pressed','true');
  await page.locator('.bt-focus .bt-primary').click();await expect(hand).toHaveCount(count-1);await expect(page.locator('.bt-response')).toBeVisible();
  await opener.click();await expect(page.locator('.bt-discard-list h3').first()).toHaveText(locale==='zh'?'攻击':'Attack');await close.click();
  await page.getByRole('combobox',{name:'Seat'}).selectOption('spectator');await expect(page.locator('.bt-hand-zone')).toHaveCount(0);await expect(page.locator('.bt-focus button')).toHaveCount(0);await opener.click();await expect(page.locator('.bt-discard-list li')).toHaveCount(12);await fit();await close.click();
  await go('turn');await opener.click();await expect(page.locator('.bt-discard-empty')).toHaveText(locale==='zh'?'还没有弃牌':'No discards yet');await page.keyboard.press('Escape');
  for(const [scenario,zh,en] of [['give','拆弹','Defuse'],['response','否决','Nope']]){
   await go(scenario);const card=byKind(zh,en),before=await hand.count();await card.dblclick();await expect(hand).toHaveCount(before);await expect(selected).toHaveCount(0);await expect(page.locator(`.bt-phase-${scenario}`)).toBeVisible();
   await card.click();await expect(selected).toHaveCount(1);await page.locator(scenario==='give'?'.bt-focus .bt-primary':'.bt-nope-action').click();await expect(hand).toHaveCount(before-1);
  }
  await go('turn');const cats=hand.filter({hasText:locale==='zh'?'月亮猫':'Moon Kitten'});await cats.nth(0).click();await cats.nth(1).click();await cats.nth(1).dblclick();await expect(selected).toHaveCount(2);await expect(page.locator('.bt-phase-turn')).toBeVisible();
  await cats.nth(2).click();await expect(selected).toHaveCount(3);await page.locator('.bt-focus .bt-primary').click();await expect(page.locator('.bt-phase-target')).toBeVisible();
  await page.getByRole('combobox',{name:'Seat'}).selectOption('p1');await expect(selected).toHaveCount(0);
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS bombs experience ${locale} ${width}x${height}`);
 }
}finally{await browser.close();}
