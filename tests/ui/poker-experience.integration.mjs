import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const out=`test-results/poker-experience-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
try{
 for(const kind of ['doudizhu','guandan'])for(const locale of ['zh','en']){
  const page=await browser.newPage();await page.addInitScript(l=>localStorage.setItem('mocha-locale',l),locale);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});await page.goto(`${base}/tests/ui/poker.fixture.html?kind=${kind}&dense&long`);await page.locator('.poker-seat-play').last().waitFor();await page.waitForTimeout(350);
   const issues=await page.evaluate(()=>{
    const errors=[],arena=document.querySelector('.classic-arena').getBoundingClientRect();
    const plays=[...document.querySelectorAll('.poker-seat-play')],seats=[...document.querySelectorAll('.classic-seat')];
    const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
    for(const el of plays){const r=el.getBoundingClientRect();if(r.left<arena.left-1||r.right>arena.right+1||r.top<arena.top-1||r.bottom>arena.bottom+1)errors.push(`play outside table: ${el.className}`);for(const seat of seats)if(overlaps(r,seat.getBoundingClientRect()))errors.push(`play overlaps seat: ${el.className} / ${seat.className}`);for(const other of plays)if(other!==el&&overlaps(r,other.getBoundingClientRect()))errors.push(`plays overlap: ${el.className} / ${other.className}`);}
    for(const el of document.querySelectorAll('.game-surface,.classic-hand-panel,.classic-selection'))if(el.scrollHeight>el.clientHeight+2)errors.push(`vertical overflow ${el.className}`);
    for(const el of document.querySelectorAll('.classic-card')){const strip=el.getBoundingClientRect(),face=el.querySelector('.classic-face').getBoundingClientRect();if(strip.width<26||face.width<44||strip.height<60)errors.push('unreadable overlapping hand');}
    for(const el of document.querySelectorAll('.classic-controls button,.counter-toggle')){const r=el.getBoundingClientRect();if(r.width<44||r.height<44||r.bottom>innerHeight+1||r.left<0||r.right>innerWidth+1)errors.push(`unreachable control ${el.textContent}`);}
    if(document.documentElement.scrollWidth>innerWidth+1)errors.push('page overflow');return errors;
   });assert.deepEqual(issues,[],`${engine} ${kind} ${locale} ${width}×${height}`);
   for(const rail of await page.locator('.poker-seat-play .played-scroll').all()){
    await rail.evaluate(e=>e.scrollLeft=e.scrollWidth);assert(await rail.evaluate(e=>{const last=e.querySelector('.classic-face:last-child').getBoundingClientRect(),r=e.getBoundingClientRect();return last.right<=r.right+1&&last.left>=r.left-1;}),'last public card reachable');
   }
   await page.screenshot({path:`${out}/${kind}-${locale}-${width}.png`});
  }
  await page.goto(`${base}/tests/ui/poker.fixture.html?kind=${kind}&counter=off`);await expect(page.locator('.poker-counter')).toHaveCount(0);
  await page.goto(`${base}/tests/ui/poker.fixture.html?kind=${kind}&spectator`);await expect(page.locator('.classic-hand-panel')).toHaveCount(0);await expect(page.locator('.counter-ranks>div')).toHaveCount(15);
  assert.deepEqual(errors,[]);await page.close();console.log('PASS dense public plays, full hands, all lanes, counter, spectator, bilingual eight sizes',kind,locale);
 }
 // Mouse drag paints, a reverse drag deselects, and a seat change cancels selections.
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(`${base}/tests/ui/poker.fixture.html`);
 const cards=page.locator('.classic-card'),first=await cards.nth(0).boundingBox(),third=await cards.nth(2).boundingBox();
 await page.mouse.move(first.x+20,first.y+20);await page.mouse.down();await page.mouse.move(third.x+20,third.y+20,{steps:15});await page.mouse.up();await expect(page.locator('.classic-card.selected')).toHaveCount(3);
 await page.mouse.move(first.x+20,first.y+20);await page.mouse.down();await page.mouse.move(third.x+20,third.y+20,{steps:15});await page.mouse.up();await expect(page.locator('.classic-card.selected')).toHaveCount(0);
 await cards.first().click();await expect(page.locator('.classic-card.selected')).toHaveCount(1);await page.getByLabel('Seat',{exact:true}).selectOption('1');await expect(page.locator('.classic-card.selected')).toHaveCount(0);await page.close();
 if(engine==='chromium'){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();await page.goto(`${base}/tests/ui/poker.fixture.html`);
  const cdp=await context.newCDPSession(page),rail=page.locator('.classic-hand-scroll');
  const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  let box=await page.locator('.classic-card').first().boundingBox();const y=box.y+25;
  await touch('touchStart',270,y);for(let x=260;x>=80;x-=15)await touch('touchMove',x,y);await touch('touchEnd');await page.waitForTimeout(350);
  assert(await rail.evaluate(e=>e.scrollLeft)>80,'normal swipe scrolls');await expect(page.locator('.classic-card.selected')).toHaveCount(0);
  await rail.evaluate(e=>e.scrollLeft=0);await page.waitForTimeout(200);box=await page.locator('.classic-card').first().boundingBox();const third=await page.locator('.classic-card').nth(2).boundingBox();
  await touch('touchStart',box.x+20,box.y+25);await page.waitForTimeout(320);await expect(rail).toHaveClass(/drag-selecting/);
  for(let x=box.x+20;x<=third.x+20;x+=8)await touch('touchMove',x,box.y+25);await touch('touchEnd');await expect(page.locator('.classic-card.selected')).toHaveCount(3);assert(await rail.evaluate(e=>e.scrollLeft)<2,'hold drag selects without scrolling');
  await page.setViewportSize({width:844,height:390});await expect(page.locator('.classic-card.selected')).toHaveCount(3);
  await context.close();console.log('PASS real touch swipe vs hold-to-select and rotation');
 }
 // Animation survives selection cleanup, stays off for existing plays, and honors reduced motion.
 for(const reducedMotion of ['no-preference','reduce']){
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion});await page.goto(`${base}/tests/ui/poker.fixture.html`);
  await page.getByRole('button',{name:'提示',exact:true}).click();await page.locator('.classic-controls .primary').click();
  await expect(page.locator('.poker-seat-play')).toHaveCount(1);
  assert.equal(await page.locator('.poker-seat-play').evaluate(e=>getComputedStyle(e).animationName),reducedMotion==='reduce'?'none':'poker-deal-in');
  await page.getByLabel('Seat',{exact:true}).selectOption('1');assert.equal(await page.locator('.poker-seat-play').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.close();
 }
 console.log('PASS mouse drag selection and deselection');
}finally{await browser.close();}
