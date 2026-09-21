import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const engine=process.env.TEST_BROWSER||'chromium',base=process.env.BASE_URL||'http://127.0.0.1:5174';
const browser=await(engine==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));const out=`test-results/bombs-viewport-${engine}`;await fs.mkdir(out,{recursive:true});
try{for(const locale of ['zh','en'])for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]]){
 const context=await browser.newContext({viewport:{width,height}});await context.routeWebSocket('**',socket=>socket.close());await context.addInitScript(l=>localStorage.setItem('mocha-locale',l),locale);const page=await context.newPage();page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fit=async scenario=>{const overflow=await page.locator('.game-surface').evaluate(s=>[s,...s.querySelectorAll('*')].filter(n=>n instanceof HTMLElement&&n.clientHeight>0&&n.scrollHeight>n.clientHeight+2&&['auto','scroll','hidden'].includes(getComputedStyle(n).overflowY)).map(n=>({class:n.className,height:n.clientHeight,content:n.scrollHeight})));assert.deepEqual(overflow,[],`${locale} ${width} ${scenario}`);assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1));const actions=await page.locator('.bt-focus button,.bt-deck,.bt-hand-label button').evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().toJSON()).filter(r=>r.height&&r.width));assert(actions.every(r=>r.y>=0&&r.bottom<=height+1),'action vertical bounds');};
 for(const scenario of ['turn','selected','response','target','request','give','future','bomb','insert','finished']){
 await page.goto(`${base}/tests/ui/bombs-viewport.fixture.html?scenario=${scenario}`);await page.locator('.bt-table').waitFor();if(scenario==='selected')await page.locator('.bt-hand .bt-card').filter({hasText:locale==='zh'?'攻击':'Attack'}).first().click();await fit(scenario);
 if(width===320||width===844||width===568)await page.screenshot({path:`${out}/${locale}-${width}-${scenario}.png`,animations:'disabled'});
 if(scenario==='turn'){await page.locator('.bt-deck').click();await expect(page.locator('.bt-danger')).toBeVisible();await fit('draw-bomb');}
 if(scenario==='selected'){await page.locator('.bt-focus .bt-primary').click();await expect(page.locator('.bt-response')).toBeVisible();}
 if(scenario==='response'){
  await page.locator('.bt-response .bt-secondary').click();
  await expect(page.locator('.bt-response-status')).toContainText(locale==='zh'?'你已确认，等待其他玩家':'Confirmed · Waiting for others');
  await expect(page.locator('.bt-response .bt-secondary')).toHaveCount(0);await fit('responded');
  if(width===320||width===844||width===568)await page.screenshot({path:`${out}/${locale}-${width}-responded.png`,animations:'disabled'});
  await page.locator('.bt-hand .bt-card').filter({hasText:locale==='zh'?'否决':'Nope'}).first().click();await page.locator('.bt-focus .bt-primary').click();await fit('nope');
  await expect(page.locator('.bt-response-status')).not.toContainText(locale==='zh'?'你已确认':'Confirmed');
  await page.locator('.bt-response .bt-secondary').click();
  await expect(page.locator('.bt-response-status')).toContainText(locale==='zh'?'你已确认取消，等待其他玩家':'Cancellation confirmed · Waiting for others');await fit('cancel-confirmed');
  if(width===320||width===844||width===568)await page.screenshot({path:`${out}/${locale}-${width}-cancel-confirmed.png`,animations:'disabled'});
 }
 if(scenario==='target'){await page.locator('.bt-seat.targetable').last().click();await expect(page.locator('.bt-response')).toBeVisible();}
 if(scenario==='request'){await page.locator('.bt-request button').last().scrollIntoViewIfNeeded();await fit('last-request');await page.locator('.bt-request button').last().click();await expect(page.locator('.bt-response')).toBeVisible();}
 if(scenario==='give'){await page.locator('.bt-hand .bt-card').first().click();await page.locator('.bt-focus .bt-primary').click();await expect(page.locator('.bt-phase-turn')).toBeVisible();}
 if(scenario==='future'){await page.getByRole('combobox',{name:'Seat'}).selectOption('p1');await expect(page.locator('.bt-future-cards')).toHaveCount(0);await page.getByRole('combobox',{name:'Seat'}).selectOption('p0');await page.locator('.bt-focus .bt-primary').click();}
 if(scenario==='bomb'){await page.locator('.bt-danger .bt-quiet').click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await page.locator('.bt-danger .bt-primary').click();await expect(page.locator('.bt-insert')).toBeVisible();await fit('defused');}
 if(scenario==='insert'){await page.locator('.bt-insert .bt-quiet').last().click();await page.locator('.bt-insert .bt-primary').click();await expect(page.locator('.bt-phase-turn')).toBeVisible();}
 }
 assert.deepEqual(errors,[]);await context.close();console.log(`PASS bombs ${locale} ${width}x${height}`);
}}finally{await browser.close();}
