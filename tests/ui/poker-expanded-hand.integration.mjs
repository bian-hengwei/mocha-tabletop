import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const out=`test-results/poker-expanded-hand-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]],errors=[];
async function fit(page){
 const dialog=page.locator('.poker-hand-dialog'),box=await dialog.boundingBox(),viewport=page.viewportSize();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,'dialog stays in viewport');
 assert(await dialog.evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1),'only the card grid scrolls');
 const overlaps=await page.locator('.poker-expanded-card').evaluateAll(cards=>cards.flatMap((card,i)=>{const a=card.getBoundingClientRect();return cards.slice(i+1).filter(other=>{const b=other.getBoundingClientRect();return a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;}).map(other=>[card.getAttribute('aria-label'),other.getAttribute('aria-label')]);}));assert.deepEqual(overlaps,[],'expanded cards never overlap');
 for(const button of await page.locator('.poker-hand-dialog header button,.poker-hand-toolbar button,.poker-hand-dialog footer button').all()){
  assert(await button.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}),'44px fixed controls');
 }
 const small=await page.locator('.poker-expanded-card').evaluateAll(cards=>cards.filter(el=>{const r=el.getBoundingClientRect();return r.width<44||r.height<44;}));assert.equal(small.length,0);
}
try{
 for(const locale of ['zh','en'])for(const kind of ['doudizhu','guandan'])for(const [width,height]of sizes){
  const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
  const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/tests/ui/poker.fixture.html?kind=${kind}&counter=off&motion`);
  const hand=page.locator('.classic-hand .classic-card'),count=kind==='guandan'?27:20;await expect(hand).toHaveCount(count);
  const original=await hand.evaluateAll(cards=>cards.map(card=>card.dataset.pokerCard));
  await hand.first().click();await expect(hand.first()).toHaveAttribute('aria-pressed','true');
  const opener=page.getByRole('button',{name:locale==='zh'?'展开手牌':'Expand hand',exact:true});await opener.click();const expanded=page.locator('.poker-expanded-card');await expect(expanded).toHaveCount(count);await fit(page);
  await expect(expanded.first()).toHaveAttribute('aria-pressed','true');await expanded.first().click();await expect(expanded.first()).toHaveAttribute('aria-pressed','false');
  await expanded.last().click();const selectedID=await expanded.last().getAttribute('data-hand-card');await page.getByRole('button',{name:locale==='zh'?'按花色':'By suit',exact:true}).click();await expect(page.locator(`.poker-expanded-card[data-hand-card="${selectedID}"]`)).toHaveAttribute('aria-pressed','true');
  assert.deepEqual(await hand.evaluateAll(cards=>cards.map(card=>card.dataset.pokerCard)),original,'display sorting does not reorder authoritative hand');
  const groups=await expanded.evaluateAll(cards=>cards.map(card=>{const art=card.querySelector('img');return Number(art.dataset.rank)>=16?4:Number(art.dataset.suit);}));assert(groups.every((group,i)=>i===0||group>=groups[i-1]),'suit ordering is stable');
  await page.getByRole('button',{name:locale==='zh'?'按点数':'By rank',exact:true}).click();assert.deepEqual(await expanded.evaluateAll(cards=>cards.map(card=>card.dataset.handCard)),original,'rank order restores authoritative order');
  await page.locator('.poker-hand-dialog').getByRole('button',{name:locale==='zh'?'清空选择':'Clear selection',exact:true}).click();await expect(page.locator('.poker-expanded-card.selected')).toHaveCount(0);
  await expanded.first().click();await expanded.nth(2).click();await expect(page.locator('.poker-hand-dialog footer .primary')).toBeDisabled();
  await page.screenshot({path:`${out}/${kind}-${locale}-${width}.png`});await page.setViewportSize({width:height,height:width});await fit(page);await expect(page.locator('.poker-expanded-card.selected')).toHaveCount(2);
  await page.keyboard.press('Tab');assert(await page.locator('.poker-hand-dialog').evaluate(el=>el.contains(document.activeElement)),'focus stays inside');await page.keyboard.press('Escape');await expect(page.locator('.poker-hand-dialog')).toHaveCount(0);await expect(opener).toBeFocused();
  await expect(page.locator('.classic-hand .selected')).toHaveCount(2);await page.setViewportSize({width,height});
  await page.locator('.classic-controls').getByRole('button',{name:locale==='zh'?'清空选择':'Clear selection',exact:true}).click();await opener.click();await expanded.first().click();await expect(page.locator('.poker-hand-dialog footer .primary')).toBeEnabled();await page.locator('.poker-hand-dialog footer .primary').click();await expect(page.locator('.poker-hand-dialog')).toHaveCount(0);await expect(hand).toHaveCount(count-1);await expect(page.locator('.latest-play')).toBeVisible();
  await page.getByLabel('Seat',{exact:true}).selectOption('2');await opener.click();await expect(page.locator('.poker-expanded-card:enabled')).toHaveCount(0);await expect(page.locator('.poker-expanded-card.selected')).toHaveCount(0);await page.evaluate(()=>document.querySelector('[aria-label="Remote play"]').click());await expect(page.locator('.poker-hand-dialog')).toHaveCount(0);
  assert(await page.locator('.game-surface').evaluate(el=>el.scrollHeight<=el.clientHeight+2),'table remains bounded after adding opener');
  if(locale==='en')assert(!/[\p{Script=Han}]/u.test(await page.locator('.poker-table').innerText()),'English controls');
  await context.close();console.log(`PASS expanded hand selection/order/rotation/play/read-only ${kind} ${locale} ${width}x${height}`);
 }
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:320,height:568}});await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);const page=await context.newPage();page.setDefaultTimeout(6000);
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=guandan&scenario=declare`);await page.getByRole('button',{name:locale==='zh'?'展开手牌':'Expand hand',exact:true}).click();
  for(let i=0;i<5;i++)await page.locator('.poker-expanded-card').nth(i).click();const declare=page.locator('.poker-hand-dialog').getByRole('button',{name:locale==='zh'?'出牌牌型':'Declare combination',exact:true});await declare.click();
  await page.getByRole('dialog',{name:locale==='zh'?'出牌牌型':'Declare combination',exact:true}).getByRole('button',{name:locale==='zh'?'顺子 · 9':'Straight · 9',exact:true}).click();await expect(declare).toBeFocused();await expect(page.locator('.poker-hand-dialog')).toBeVisible();await expect(page.locator('.poker-expanded-card.selected')).toHaveCount(5);
  await page.locator('.poker-hand-dialog footer .primary').click();await expect(page.locator('.poker-hand-dialog')).toHaveCount(0);await expect(page.locator('.latest-play .played-caption')).toContainText(locale==='zh'?'顺子':'Straight');
  await page.goto(`${base}/tests/ui/poker.fixture.html?kind=guandan&spectator`);await expect(page.locator('.poker-expand-hand')).toHaveCount(0);await expect(page.locator('.poker-hand-dialog')).toHaveCount(0);
  await context.close();console.log(`PASS nested declaration preserves hand selection and observer privacy ${locale}`);
 }
 for(const locale of ['zh','en'])for(const kind of ['doudizhu','guandan']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/manifest-mocha.webmanifest');await page.evaluate(async({locale,kind})=>{
   const {createPractice}=await import('/src/local/practice.ts');const {pokerModule}=await import('/src/core/games/poker.ts');const profile={id:'expanded-test',name:'Alex',avatar:'🦊'};const practice=createPractice(kind,kind==='guandan'?4:3,profile);practice.game=pokerModule(kind).create(practice.players,68);
   localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice}));
  },{locale,kind});await page.goto(base);await page.locator('.poker-expand-hand').waitFor();
  if(kind==='doudizhu')await page.getByRole('button',{name:locale==='zh'?'叫分 3':'Bid 3',exact:true}).click();
  const hand=page.locator('.classic-hand .classic-card'),count=await hand.count();await page.locator('.poker-expand-hand').click();await page.locator('.poker-expanded-card').first().click();await page.locator('.poker-hand-dialog footer .primary').click();await expect(hand).toHaveCount(count-1);await expect(page.locator('.poker-hand-dialog')).toHaveCount(0);
  await page.reload();await expect(hand).toHaveCount(count-1);await expect(page.locator('.poker-hand-dialog')).toHaveCount(0);await page.locator('.poker-expand-hand').click();await expect(page.locator('.poker-expanded-card:enabled')).toHaveCount(0);await page.keyboard.press('Escape');await page.screenshot({path:`${out}/app-${kind}-${locale}.png`});await context.close();console.log(`PASS real App ${kind} ${locale} play and reload`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
