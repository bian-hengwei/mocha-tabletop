import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',safari=process.env.TEST_BROWSER==='webkit';
const browser=await(safari?webkit.launch():chromium.launch());
const out=`test-results/mahjong-modes-${safari?'webkit':'chromium'}`;await fs.mkdir(out,{recursive:true});
const modes=['guangdong','laizi','sichuan','bloodflow','bloodflowAny','bloodflowThree','redBloodflow','redBattle','guangdongFan','guangdongGhost'];
const sizes=[[320,568],[390,844],[430,932],[844,390],[568,320],[932,430],[768,1024],[1440,900]];
try{for(const locale of ['zh','en']){
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(locale=>{localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify({id:'mahjong-mode-test',name:'长昵称 Long Mahjong Player',avatar:'🦊'}));},locale);
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));const text=(zh,en)=>locale==='zh'?zh:en;
 const fit=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal page overflow');
 for(const mode of modes){await page.goto(base);await page.locator('.cover-mahjong').click();await page.locator('.rule-options select').selectOption(mode);await expect(page.locator('.create-body')).not.toContainText('可碰可杠，不吃牌');
  await page.locator('.setup-rules').click();await expect(page.getByRole('tab')).toHaveCount(3);await expect(page.locator('.mahjong-example-tile')).toHaveCount(14);
  await page.getByRole('tab').first().focus();await page.keyboard.press('End');await expect(page.getByRole('tab').last()).toHaveAttribute('aria-selected','true');await expect(page.locator('.mahjong-guide-mode select')).toHaveValue(mode);await expect(page.locator('.mahjong-guide section')).toHaveCount(['laizi','redBloodflow','redBattle','guangdongGhost'].includes(mode)?4:3);
  await page.keyboard.press('Home');await expect(page.getByRole('tab').first()).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.mahjong-guide')).toHaveCount(0);await expect(page.locator('.setup-rules')).toBeFocused();
  await page.getByRole('button',{name:text('同屏试玩','Pass & play'),exact:true}).click();await page.locator('.mj-table').waitFor();await fit();
  if(!['guangdong','laizi','guangdongFan','guangdongGhost'].includes(mode)){
   for(let i=0;i<4;i++){await page.getByRole('combobox',{name:/切换试玩座位|Switch practice seat/}).selectOption('practice-'+i);const cards=page.locator('.mj-tile:not([disabled])'),labels=await cards.evaluateAll(xs=>xs.map(x=>x.getAttribute('aria-label')));if(mode==='bloodflowAny'&&i===0){await expect(page.locator('.mj-actions .mj-action')).toBeEnabled();}else{let ids;if(['bloodflowThree','redBloodflow'].includes(mode)){ids=[0,1,2];}else{const suit=['万','筒','条','Characters','Dots','Bamboo'].find(s=>labels.filter(x=>x.includes(s)).length>=3);ids=labels.map((x,j)=>x.includes(suit)?j:-1).filter(j=>j>=0).slice(0,3);}for(const j of ids)await cards.nth(j).click();await expect(page.locator('.mj-tile.selected')).toHaveCount(3);}await page.locator('.mj-actions .mj-action').click();}
   for(let i=0;i<4;i++){await page.getByRole('combobox',{name:/切换试玩座位|Switch practice seat/}).selectOption('practice-'+i);await page.locator('.mj-actions .mj-suit').last().click();}
  }
  await page.getByRole('combobox',{name:/切换试玩座位|Switch practice seat/}).selectOption('practice-0');await page.locator('.mj-tile:not([disabled])').first().click();await expect(page.locator('.mj-tile.selected')).toHaveCount(1);await page.locator('.mj-tile.selected').click();await expect(page.locator('.mj-tile.selected')).toHaveCount(0);
  if(['laizi','redBloodflow','redBattle','guangdongGhost'].includes(mode))await expect(page.locator('.mj-wild-indicator .mj-face')).toBeVisible();
  await page.reload();await page.locator('.mj-table').waitFor();await fit();if(locale==='en')assert(!/[\u3400-\u9fff]/u.test(await page.locator('.mj-edition').innerText()),'mode name translated');await page.evaluate(()=>localStorage.removeItem('mocha-practice-v1'));
 }
 // Dense table, long names, history dialog, rotation and every required viewport.
 await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=dense&mode=redBloodflow&long=1&large=1&statuses=1`);
 for(const [width,height]of sizes){await page.setViewportSize({width,height});await fit();await expect(page.locator('.mj-river .mj-face')).toHaveCount(48);await expect(page.locator('.mj-history')).toBeVisible();
  const overlaps=await page.locator('.mj-seat:not(.self)').evaluateAll(seats=>seats.flatMap(s=>{const a=s.querySelector('.mj-avatar').getBoundingClientRect(),b=s.querySelector('div').getBoundingClientRect();return a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1?[s.className]:[];}));assert.deepEqual(overlaps,[],'avatar and text do not overlap');assert(await page.locator('.mj-seat.seat-self small').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().bottom<=e.closest('.mj-arena').getBoundingClientRect().bottom-10)),'self score clears the table rail');
  const seatOverlaps=await page.locator('.mj-seat').evaluateAll(seats=>seats.flatMap((s,i)=>seats.slice(i+1).flatMap(other=>{const a=s.getBoundingClientRect(),b=other.getBoundingClientRect();return a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1?[[s.className,other.className]]:[];})));assert.deepEqual(seatOverlaps,[],`${locale} ${width}×${height}: seats occupy separate lanes`);
  const seatTileOverlaps=await page.evaluate(()=>{const found=[];for(const s of document.querySelectorAll('.mj-seat'))for(const r of document.querySelectorAll('.mj-rack,.mj-melds')){const a=s.getBoundingClientRect(),b=r.getBoundingClientRect();if(a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1)found.push([s.className,r.className]);}return found;});assert.deepEqual(seatTileOverlaps,[],`${locale} ${width}×${height}: seats clear racks and melds`);
  await page.screenshot({path:`${out}/${locale}-dense-${width}.png`});await page.getByRole('button',{name:/胡牌记录|Win history/}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.setViewportSize({width:height,height:width});await fit();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:/胡牌记录|Win history/})).toBeFocused();
 }
 await page.goto(base);await page.locator('.cover-mahjong').click();await page.locator('.setup-rules').click();
 for(const [width,height]of sizes){await page.setViewportSize({width,height});for(let tab=0;tab<3;tab++){await page.getByRole('tab').nth(tab).click();await fit();await expect(page.getByRole('tabpanel')).toBeVisible();}await page.screenshot({path:`${out}/${locale}-guide-${width}.png`});}
 assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${locale}: all ten variants, tutorials, exchange, missing suit, discard, reload, dense table, dialog focus/rotation, eight viewports`);
}}finally{await browser.close();}
