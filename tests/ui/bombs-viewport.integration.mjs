import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const engine=process.env.TEST_BROWSER||'chromium',base=process.env.BASE_URL||'http://127.0.0.1:5174';
const browser=await(engine==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));const out=`test-results/bombs-viewport-${engine}`;await fs.mkdir(out,{recursive:true});
try{for(const locale of ['zh','en'])for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]]){
 const context=await browser.newContext({viewport:{width,height}});await context.routeWebSocket('**',socket=>socket.close());await context.addInitScript(l=>localStorage.setItem('mocha-locale',l),locale);const page=await context.newPage();page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fit=async scenario=>{const overflow=await page.locator('.game-surface').evaluate(s=>[s,...s.querySelectorAll('*')].filter(n=>n instanceof HTMLElement&&n.clientHeight>0&&n.scrollHeight>n.clientHeight+2&&['auto','scroll','hidden'].includes(getComputedStyle(n).overflowY)).map(n=>({class:n.className,height:n.clientHeight,content:n.scrollHeight})));assert.deepEqual(overflow,[],`${locale} ${width} ${scenario}`);
 const seats=await page.locator(scenario==='finished'?'.ng-final-player':'.bt-seat').evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {width:r.width,height:r.height,left:r.left,right:r.right,hit:x.contains(hit)}}));
 assert.equal(seats.length,5);assert(seats.every(r=>r.width>=44&&r.height>=44&&r.left>=0&&r.right<=width&&r.hit),JSON.stringify({locale,width,scenario,seats}));
 assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1));const actions=await page.locator('.bt-focus button,.bt-deck,.bt-hand-label button').evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().toJSON()).filter(r=>r.height&&r.width));assert(actions.every(r=>r.y>=0&&r.bottom<=height+1),'action vertical bounds');};
 for(const scenario of ['turn','selected','response','target','request','give','future','bomb','insert','spectator','finished']){
 await page.goto(`${base}/tests/ui/bombs-viewport.fixture.html?scenario=${scenario}`);await page.locator(scenario==='finished'?'.ng-final-bombs':'.bt-table').waitFor();if(scenario==='selected')await page.locator('.bt-hand .bt-card').filter({hasText:locale==='zh'?'攻击':'Attack'}).first().click();await fit(scenario);
 if(width===320||width===844||width===568)await page.screenshot({path:`${out}/${locale}-${width}-${scenario}.png`,animations:'disabled'});
 if(scenario==='spectator'){await expect(page.locator('.bt-focus h2')).toHaveText('Ellie');await expect(page.locator('.bt-empty-hand')).toHaveText(locale==='zh'?'已出局':'Eliminated');await expect(page.locator('.bt-hand .bt-card')).toHaveCount(0);}
 if(scenario==='turn'){await page.locator('.bt-deck').click();await expect(page.locator('.bt-danger')).toBeVisible();await fit('draw-bomb');}
 if(scenario==='selected'){
  await page.locator('.bt-focus .bt-primary').click();await expect(page.locator('.bt-response')).toBeVisible();
  await expect(page.locator('.bt-response .bt-secondary,.bt-response .bt-nope-action')).toHaveCount(0);
  await expect(page.locator('.bt-response-waiting')).toBeVisible();
  await page.locator('.bt-hand .bt-card').filter({hasText:locale==='zh'?'否决':'Nope'}).click();
  await expect(page.locator('.bt-nope-action')).toBeVisible();
  await page.locator('.bt-hand-label button').click();await expect(page.locator('.bt-nope-action')).toHaveCount(0);
  await fit('actor-waits');
 }
 if(scenario==='response'){await expect(page.locator('.bt-response .bt-eyebrow')).toHaveText(locale==='zh'?'Blair 已出牌':'Blair played');await page.getByRole('button',{name:locale==='zh'?'打出否决':'Play Nope',exact:true}).click();await expect(page.locator('.bt-response-status b')).toHaveText(locale==='zh'?'当前效果：已否决':'Effect: blocked');await expect(page.locator('.bt-response .bt-secondary')).toHaveCount(0);await expect(page.locator('.bt-response .bt-nope-action')).toHaveCount(0);await fit('nope');
  await page.getByRole('combobox',{name:'Seat'}).selectOption('p1');
  await page.getByRole('button',{name:locale==='zh'?'反制否决':'Counter Nope',exact:true}).click();
  await expect(page.locator('.bt-response-status b')).toHaveText(locale==='zh'?'当前效果：生效':'Effect: active');
  await expect(page.locator('.bt-response .bt-secondary,.bt-response .bt-nope-action')).toHaveCount(0);
  await fit('counter-nope');
  if(width===320||width===844||width===568)await page.screenshot({path:`${out}/${locale}-${width}-counter-nope.png`,animations:'disabled'});
  for(const seat of ['p0','p2','p3','p4']){
   await page.getByRole('combobox',{name:'Seat'}).selectOption(seat);
   await page.getByRole('button',{name:locale==='zh'?'继续':'Continue',exact:true}).click();
  }
  await expect(page.locator('.bt-phase-turn')).toBeVisible();await fit('counter-resolved');
 }
 if(scenario==='target'){await page.locator('.bt-seat.targetable').last().click();await expect(page.locator('.bt-response')).toBeVisible();}
 if(scenario==='request'){await page.locator('.bt-request button').last().scrollIntoViewIfNeeded();await fit('last-request');await page.locator('.bt-request button').last().click();await expect(page.locator('.bt-response')).toBeVisible();}
 if(scenario==='give'){await page.locator('.bt-hand .bt-card').first().click();await page.locator('.bt-focus .bt-primary').click();await expect(page.locator('.bt-phase-turn')).toBeVisible();}
 if(scenario==='future'){
  await expect(page.locator('.bt-hand .bt-card:enabled')).toHaveCount(0);
  await expect(page.locator('.bt-hand .bt-selected')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Seat'}).selectOption('p1');
  await expect(page.locator('.bt-future-cards')).toHaveCount(0);
  await expect(page.locator('.bt-hand .bt-card:enabled')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Seat'}).selectOption('p0');
  await page.locator('.bt-focus .bt-primary').click();
  await expect(page.locator('.bt-phase-turn')).toBeVisible();
  const shuffle=page.locator('.bt-hand .bt-card').filter({hasText:locale==='zh'?'洗牌':'Shuffle'}).first();
  await shuffle.click();await expect(shuffle).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.bt-focus .bt-primary')).toHaveText(locale==='zh'?'打出这张':'Play this card');
 }
 if(scenario==='bomb'){await page.locator('.bt-danger .bt-quiet').click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await page.locator('.bt-danger .bt-primary').click();await expect(page.locator('.bt-insert')).toBeVisible();await fit('defused');}
 if(scenario==='insert'){
  const endpoints=await page.locator('.bt-insert').evaluate(x=>{const range=x.querySelector('.bt-insert-range').getBoundingClientRect(),buttons=[...x.querySelectorAll('.bt-quiet')].map(b=>b.getBoundingClientRect());return {left:Math.abs(buttons[0].left-range.left),right:Math.abs(buttons[1].right-range.right),sizes:buttons.map(b=>({width:b.width,height:b.height}))}});
  assert(endpoints.left<=1&&endpoints.right<=1&&endpoints.sizes.every(b=>b.width>=44&&b.height>=44),'range shortcuts align with their ends and are touchable');
  await page.locator('.bt-insert .bt-quiet').last().click();await page.locator('.bt-insert .bt-primary').click();await expect(page.locator('.bt-phase-turn')).toBeVisible();}
 }
 assert.deepEqual(errors,[]);await context.close();console.log(`PASS bombs ${locale} ${width}x${height}`);
}}finally{await browser.close();}
