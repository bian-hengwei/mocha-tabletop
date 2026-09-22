import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium',out=`test-results/mahjong-assistance-${engine}`;
const browser=await(engine==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
try{for(const locale of ['zh','en']){
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const helper=()=>page.locator('.mahjong-assist-button'),dialog=page.getByRole('dialog'),strip=page.locator('.mahjong-ready-tiles');
 const begin=async(scenario='quick',mode='guangdong')=>{await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=${scenario}&mode=${mode}`);await page.locator('.mj-hand').waitFor();};
 async function fit(){
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(await page.locator('.mj-hand-toolbar,.mahjong-ready,.mj-actions').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;})),'hints and actions stay on screen');
  const forbidden=/未见数 =|倍数按本桌规则|试算不会出牌|Unseen =|Multipliers follow this table|Previewing does not discard|未见数只扣除|Estimates use this table/;
  assert(!forbidden.test(await page.locator('body').innerText()),'no explanatory filler');
  await expect(page.locator('.mahjong-assist-note,.mahjong-assist-discard')).toHaveCount(0);
 }
 for(const [width,height]of sizes){
  await page.setViewportSize({width,height});await begin();
  const nine=page.getByRole('button',{name:locale==='zh'?'9条':'9 Bamboo',exact:true});
  await expect(nine).toHaveClass(/can-ready/);await expect(nine.locator('.mj-ready-mark')).toHaveText(locale==='zh'?'听':'Ready');await expect(nine).toHaveAttribute('aria-description',/打出后听牌|Discard to ready/);
  await expect(helper()).toHaveCount(0);const originalHand=await page.locator('.mj-hand-panel').boundingBox();await page.screenshot({path:`${out}/${locale}-${width}-highlights.png`});
  // The actual selected discard determines the automatically visible waits.
  await nine.click();assert.deepEqual(await page.locator('.mj-hand-panel').boundingBox(),originalHand,'preview does not move the hand or table');await expect(strip.locator('.mahjong-ready-tile')).toHaveCount(3);
  assert.deepEqual(await strip.locator('.mahjong-ready-tile').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))),locale==='zh'?['1万 · 未见 3 张','4万 · 未见 3 张','7万 · 未见 3 张']:['1 Characters · 3 unseen','4 Characters · 3 unseen','7 Characters · 3 unseen']);
  await expect(dialog).toHaveCount(0);await fit();assert(await page.locator('.mj-tile.selected .mj-ready-mark').evaluate(mark=>{const a=mark.getBoundingClientRect();return [...document.querySelectorAll('.mj-tile:not(.selected)')].every(tile=>{const b=tile.getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1;});}),'raised Ready badge does not cover another tile');await page.screenshot({path:`${out}/${locale}-${width}-preview.png`});
  await page.setViewportSize({width:height,height:width});await expect(nine).toHaveAttribute('aria-pressed','true');await expect(strip.locator('.mahjong-ready-tile')).toHaveCount(3);await page.setViewportSize({width,height});
  await helper().click();await expect(dialog).toBeVisible();await expect(page.locator('.mahjong-wait')).toHaveCount(3);await fit();
  const rect=await dialog.boundingBox();assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1);
  if(locale==='en')assert(!/[\u3400-\u9fff]/u.test(await dialog.innerText()));
  await page.screenshot({path:`${out}/${locale}-${width}-details.png`});
  await page.setViewportSize({width:height,height:width});await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)));await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(helper()).toBeFocused();await page.setViewportSize({width,height});
  await expect(nine).toHaveAttribute('aria-pressed','true');await expect(page.locator('.mj-hand button')).toHaveCount(14);
  await page.getByRole('button',{name:locale==='zh'?'1万':'1 Characters',exact:true}).click();await expect(strip.locator('.mahjong-ready-tile')).toHaveCount(1);await expect(strip.locator('.mahjong-ready-tile')).toHaveAttribute('aria-label',locale==='zh'?'9条 · 未见 3 张':'9 Bamboo · 3 unseen');
  await page.keyboard.press('Escape');await expect(strip).toHaveCount(0);await expect(page.locator('.mj-tile.selected')).toHaveCount(0);
 }
 await begin();await page.locator('.mj-hand button').last().click();await page.getByRole('button',{name:'Toggle language'}).click();await expect(page.locator('.mj-tile.selected')).toHaveCount(1);await expect(helper()).toHaveAttribute('aria-label',locale==='zh'?'Wait details':'听牌详情');await page.getByRole('button',{name:'Toggle language'}).click();
 await page.getByRole('combobox',{name:'Seat'}).selectOption('1');await expect(page.locator('.mj-tile.selected,.mj-tile.can-ready')).toHaveCount(0);await expect(strip.locator('.mahjong-ready-tile')).toHaveCount(3);
 await begin('remote');await expect(strip.locator('.mahjong-ready-tile')).toHaveCount(3);await page.getByRole('button',{name:'Remote discard'}).click();await expect(strip.locator('.mahjong-ready-tile')).toHaveCount(3);
 await begin();await page.locator('.mj-hand button').last().dblclick();await expect(page.locator('.river-self .mj-face')).toHaveCount(1);await expect(page.locator('.mj-tile.can-ready')).toHaveCount(0);await expect(strip.locator('.mahjong-ready-tile')).toHaveCount(3);
 for(const mode of ['sichuan','bloodflow']){await begin('quick',mode);await expect(page.locator('.mj-tile.can-ready')).toHaveCount(1);await expect(page.locator('.mj-tile.can-ready')).toHaveAttribute('aria-label',locale==='zh'?'9条':'9 Bamboo');}
 for(const scenario of ['opening','not-ready']){await begin(scenario,scenario==='opening'?'sichuan':'guangdong');await expect(page.locator('.mj-ready-mark,.mahjong-ready')).toHaveCount(0);}
 await begin('exhausted');await expect(strip.locator('.mahjong-ready-tile.exhausted')).toHaveCount(3);await helper().click();await expect(page.locator('.mahjong-wait.exhausted')).toHaveCount(3);await fit();await page.keyboard.press('Escape');
 await begin('wide-waits','laizi');await expect(strip.locator('.mahjong-ready-tile')).toHaveCount(33);await strip.focus();await page.keyboard.press('End');await strip.locator('.mahjong-ready-tile').last().scrollIntoViewIfNeeded();await expect(strip.locator('.mahjong-ready-tile').last()).toBeInViewport();await fit();await page.screenshot({path:`${out}/${locale}-wide-waits.png`});await helper().click();await expect(page.locator('.mahjong-wait')).toHaveCount(33);await page.locator('.mahjong-wait').last().scrollIntoViewIfNeeded();await expect(page.locator('.mahjong-wait').last()).toBeVisible();await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${locale}: automatic ready highlights and waits, selected discard preview, no filler, eight sizes, details/focus/rotation, legal suits, exhausted/wide waits, seat and language reset`);
}}finally{await browser.close();}
