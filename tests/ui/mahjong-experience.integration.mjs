import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',safari=process.env.TEST_BROWSER==='webkit';
const browser=await(safari?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/mahjong-experience-${safari?'webkit':'chromium'}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
try{for(const locale of ['zh','en']){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
 const begin=async(scenario='quick',mode='guangdong')=>{await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=${scenario}&mode=${mode}`);await page.locator('.mj-table').waitFor();};
 const hand=page.locator('.mj-hand'),last=()=>hand.locator('button').last();
 const checkTurn=async()=>{await expect(page.locator('.river-self .mj-face')).toHaveCount(1);await expect(page.locator('.mj-seat.current')).toContainText('Blair');await expect(page.getByRole('alert')).toHaveCount(0);};
 async function fit(){
  const bad=await page.evaluate(()=>[...document.querySelectorAll('.mj-hand-panel,.mj-hand-toolbar,.mj-tile,.mj-actions button,.mj-edition,.mj-river-cell')].filter(e=>getComputedStyle(e).display!=='none').flatMap(e=>{const r=e.getBoundingClientRect();return r.top<0||r.bottom>innerHeight+1||r.left<0||r.right>innerWidth+1?[{class:e.className,box:r.toJSON()}]:[]}));
  assert.deepEqual(bad,[],'hand, actions and visible discards stay in the viewport');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
  const overlaps=await page.locator('.mj-river-cell').evaluateAll(es=>{const visible=es.filter(e=>getComputedStyle(e).display!=='none');return visible.flatMap((e,i)=>visible.slice(i+1).flatMap(other=>{const a=e.getBoundingClientRect(),b=other.getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1?[e.dataset.tileId+' / '+other.dataset.tileId]:[]}));});assert.deepEqual(overlaps,[],'river tiles never overlap');
 }
 for(const [width,height] of sizes){await page.setViewportSize({width,height});await begin('drawn-low');
  await expect(last()).toHaveClass(/drawn/);await expect(last()).toHaveAttribute('aria-label',locale==='zh'?'1万':'1 Characters');
  await expect(page.getByRole('button',{name:/^(打出|Discard|清空选择|Clear selection)$/})).toHaveCount(0);
  await last().tap();await expect(last()).toHaveAttribute('aria-pressed','true');await fit();await page.screenshot({path:`${out}/${locale}-${width}-hand.png`});
  await page.keyboard.press('Escape');await expect(last()).toHaveAttribute('aria-pressed','false');
  await begin('dense','bloodflow');await fit();await page.screenshot({path:`${out}/${locale}-${width}-dense.png`});
  const count=page.locator('.river-right .mj-river-count');await count.click();await expect(page.locator('.mj-all-discards .mj-face')).toHaveCount(24);await page.setViewportSize({width:height,height:width});
  const box=await page.getByRole('dialog').boundingBox();assert(box.x>=0&&box.y>=0&&box.y+box.height<=width+1,'river dialog survives rotation');await page.keyboard.press('Escape');await expect(count).toBeFocused();
 }
 await page.setViewportSize({width:390,height:844});await begin();await last().tap();await page.waitForTimeout(450);await last().tap();await checkTurn();
 await expect(page.locator('.mj-flight')).toBeVisible();await expect(page.locator('.mj-flight')).toContainText(locale==='zh'?'9条':'9 Bamboo');await page.locator('.mj-flight').evaluate(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=500;}));await page.screenshot({path:`${out}/${locale}-discard-flight.png`});await page.locator('.mj-flight').evaluate(e=>e.getAnimations().forEach(a=>a.play()));await expect(page.locator('.mj-flight')).toHaveCount(0);await expect(page.locator('.is-latest')).toHaveCount(1);
 await begin();await last().click();await page.locator('.topbar b').click();await expect(last()).toHaveAttribute('aria-pressed','true');await page.locator('.mj-arena').click({position:{x:5,y:5}});await expect(last()).toHaveAttribute('aria-pressed','false');
 await last().focus();await page.keyboard.press('Enter');await expect(last()).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Enter');await checkTurn();
 await begin();await hand.locator('button').nth(0).tap();await hand.locator('button').nth(1).tap();await expect(page.locator('.river-self .mj-face')).toHaveCount(0);await expect(hand.locator('button[aria-pressed=true]')).toHaveCount(1);
 await page.setViewportSize({width:844,height:390});await expect(hand.locator('button').nth(1)).toHaveAttribute('aria-pressed','true');await hand.locator('button').nth(1).click();await expect(page.locator('.river-self .mj-face')).toHaveCount(1);
 await begin('quick','sichuan');await expect(hand.locator('button').first()).toBeDisabled();await last().dblclick();await checkTurn();
 await begin('opening','sichuan');await expect(page.locator('.mj-actions button')).toBeDisabled();const tiles=hand.locator('button'),labels=await tiles.evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));const suit=['万','筒','条','Characters','Dots','Bamboo'].find(s=>labels.filter(x=>x.includes(s)).length>=3);for(const i of labels.map((x,i)=>x.includes(suit)?i:-1).filter(i=>i>=0).slice(0,3))await tiles.nth(i).click();await expect(page.locator('.mj-actions button')).toBeEnabled();await page.locator('.mj-actions button').click();await expect(page.locator('.mj-actions button')).toHaveCount(0);
 await begin('claims');await page.getByRole('button',{name:locale==='zh'?'7万':'7 Characters',exact:true}).first().dblclick();await page.getByRole('combobox',{name:'Seat'}).selectOption('1');await expect(page.locator('.mj-flight')).toHaveCount(0);await expect(page.getByRole('button',{name:locale==='zh'?'胡牌':'Win',exact:true})).toBeVisible();await fit();await page.screenshot({path:`${out}/${locale}-claims.png`});
 await begin('remote');await page.getByRole('button',{name:'Remote discard'}).click();await expect(page.locator('.mj-flight.from-right')).toBeVisible();await expect(page.locator('.mj-flight')).toContainText('Blair');await expect(page.locator('.river-right .mj-face')).toHaveCount(1);
 await begin('long-names');await fit();await page.screenshot({path:`${out}/${locale}-long-names.png`});
 await begin('max-melds');await fit();await page.screenshot({path:`${out}/${locale}-max-melds.png`});
 await context.close();assert.deepEqual(errors,[]);console.log(`PASS ${locale}: seven sizes, complete hand, drawn tile ordering, discard animation, keyboard/touch, cancel, rotation, public river inspection, claims and exchange`);
}
 const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=quick`);await page.locator('.mj-hand button').last().dblclick();await expect(page.locator('.mj-flight')).toHaveCSS('animation-name','none');await context.close();
}finally{await browser.close();}
