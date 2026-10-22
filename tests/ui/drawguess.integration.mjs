import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit,expect} from '@playwright/test';

const base=process.env.BASE_URL||'http://127.0.0.1:5311';
const engine=process.env.TEST_BROWSER||'chromium';
const out=process.env.DRAWGUESS_ARTIFACTS||(engine==='chromium'?'test-results/drawguess':`test-results/drawguess-${engine}`);
const viewports=process.env.TEST_VIEWPORT_SCOPE==='compact'?[[320,568],[568,320]]:[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit.launch():chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined}));
const errors=[];
async function assertLayout(page){
 assert(await page.locator('.dg-stage').evaluate(stage=>{
  const canvas=stage.querySelector('canvas'),s=stage.getBoundingClientRect(),c=canvas.getBoundingClientRect();
  return c.top>=s.top&&c.bottom<=s.bottom&&c.left>=s.left&&c.right<=s.right&&s.bottom<=innerHeight&&s.top>=0&&stage.scrollHeight<=stage.clientHeight+2;
 }),'The complete canvas fits its stage and viewport');
 assert(await page.locator('.dg-scoreboard').evaluate(node=>node.scrollHeight<=node.clientHeight+2),'Scoreboard content is not vertically clipped');
 assert(await page.locator('.dg-table').evaluate(node=>node.scrollWidth<=node.clientWidth+2&&node.scrollHeight<=node.clientHeight+2),'Table fits without outer scrolling');
 for(const button of await page.locator('.dg-table button:visible,.dg-guess-form input:visible').all()){
  const box=await button.boundingBox();assert(box&&box.width>=43.5&&box.height>=43.5,'Drawing actions retain 44px touch targets');
  assert(box.y>=0&&box.y+box.height<=page.viewportSize().height+1,'Drawing actions fit the viewport');
 }
}
async function bottomInk(canvas){
 return canvas.evaluate(node=>{
  const ctx=node.getContext('2d'),start=Math.floor(node.height*.9),pixels=ctx.getImageData(0,start,node.width,node.height-start).data;
  let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])count++;return count;
 });
}
async function drawAtBottom(page){
 const canvas=page.locator('.dg-canvas'),box=await canvas.boundingBox();assert(box);
 const start={x:box.x+box.width*.2,y:box.y+box.height*.96},end={x:box.x+box.width*.8,y:start.y};
 for(const point of [start,end])assert(await canvas.evaluate((node,p)=>document.elementFromPoint(p.x,p.y)===node,point),'The lower drawing edge accepts pointer input');
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:12});await page.mouse.up();
 await expect.poll(()=>bottomInk(canvas)).toBeGreaterThan(0);
}
async function roundTwoPrompts(page,language,seed,legacy=false){
 await page.goto(`${base}/manifest-mocha.webmanifest`);
 await page.evaluate(async({language,seed,legacy})=>{
  const {createPractice,writePractice,readPractice}=await import('/src/local/practice.ts');const {drawguess,advanceDrawGuessClock}=await import('/src/core/games/drawguess.ts');
  localStorage.clear();localStorage.setItem('mocha-locale',language);const profile={id:'drawguess-seed-audit',name:'Drawer',avatar:'🦊'};localStorage.setItem('mocha-profile',JSON.stringify(profile));const p=createPractice('drawguess',3,profile,{language,drawRounds:2,drawSeconds:45},undefined,seed);let game=p.game;if(legacy)delete game.seed;
  game=advanceDrawGuessClock(game,1000);const choice=drawguess.view(game,game.players[game.drawer].id).actions.find(a=>a.id==='choose').choices[0];game=drawguess.apply(game,game.players[game.drawer].id,{action:'choose',values:[choice.id]});game=advanceDrawGuessClock(game,1001);game=advanceDrawGuessClock(game,game.deadlineAt+1);game=advanceDrawGuessClock(game,game.revealUntil+1);p.game=game;p.viewer=p.players[game.drawer].id;writePractice(p);if(!readPractice())throw Error('Rejected DrawGuess seed fixture');
 },{language,seed,legacy});
 await page.goto(base);await page.locator('.dg-private-choice').waitFor();return page.locator('.dg-private-choice button').allTextContents();
}
try {
 for(const language of ['en','zh']) for(const [width,height] of viewports) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true});
  await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),language);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=drawguess&players=max`);
  await page.locator('.dg-table').waitFor();
  assert.equal(await page.locator('.dg-private-choice button').count(),3);
  await assertLayout(page);
  await page.screenshot({path:`${out}/${language}-${width}x${height}-choice.png`});
  const answer=await page.locator('.dg-private-choice button').first().innerText();
  await page.locator('.dg-private-choice button').first().click();
  assert.equal(await page.locator('.dg-private-answer').count(),1);
  assert.equal(await page.locator('.dg-canvas').getAttribute('tabindex'),'0');
  await page.locator('.dg-canvas').press('ArrowRight');
  await assertLayout(page);await drawAtBottom(page);
  await page.screenshot({path:`${out}/${language}-${width}x${height}-draw.png`});
  await page.getByRole('button',{name:/^(清空画布|Clear canvas)$/}).click();
  assert.equal(await page.getByRole('dialog').count(),1);
  await assertLayout(page);
  await page.screenshot({path:`${out}/${language}-${width}x${height}-clear.png`});
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),0);
  assert(await bottomInk(page.locator('.dg-canvas'))>0,'Cancelling preserves the lower-edge stroke');
  // Rotate with confirmation open; the whole canvas and primary action remain reachable.
  if(width===320&&height===568){
   await page.getByRole('button',{name:/^(清空画布|Clear canvas)$/}).click();
   await page.setViewportSize({width:568,height:320});await assertLayout(page);
   assert.equal(await page.getByRole('dialog').count(),1);
   await page.keyboard.press('Escape');await drawAtBottom(page);
   await page.setViewportSize({width,height});await assertLayout(page);
  }
  await page.getByRole('button',{name:/^(清空画布|Clear canvas)$/}).click();
  await page.getByLabel('Seat').selectOption('english-player-1');await expect(page.getByRole('dialog')).toHaveCount(0);
  assert.equal(await page.locator('.dg-private-answer').count(),0);
  await assertLayout(page);
  await page.locator('.dg-guess-form input').fill('wrong answer');
  await page.locator('.dg-guess-form').press('Enter');
  assert.equal(await page.locator('.dg-guesses p').count()>0,true);
  if(language==='en')assert(!/[\u3400-\u9fff]/u.test(await page.locator('.dg-table').innerText()),'English drawing view contains Chinese');
  await page.screenshot({path:`${out}/${language}-${width}x${height}.png`,fullPage:true});
  await page.getByLabel('Seat').selectOption('english-player-0');
  assert.equal(await page.getByRole('dialog').count(),0,'Seat changes reset clear confirmation');
  await page.getByRole('button',{name:/^(清空画布|Clear canvas)$/}).click();await page.getByRole('button',{name:/^(确认清空画布|Confirm clear canvas)$/}).click();
  await expect.poll(()=>bottomInk(page.locator('.dg-canvas'))).toBe(0);
  await page.getByLabel('Seat').selectOption('english-player-1');
  await expect(page.locator('.dg-private-answer')).toHaveCount(0);
  await page.locator('.dg-guess-form input').fill(answer);await page.locator('.dg-guess-form input').press('Enter');
  await expect(page.locator('.dg-guesses .correct')).toHaveText(language==='en'?'Blair guessed correctly':'Blair 猜对了');
  await expect(page.locator('.dg-reveal')).toContainText(answer);
  await page.screenshot({path:`${out}/${language}-${width}x${height}-correct.png`});
  await page.getByRole('button',{name:'Toggle language'}).click();await expect(page.locator('.dg-guesses .correct')).toHaveText(language==='zh'?'Blair guessed correctly':'Blair 猜对了');
  await page.getByRole('button',{name:'Toggle language'}).click();await expect(page.locator('.dg-guesses .correct')).toHaveText(language==='en'?'Blair guessed correctly':'Blair 猜对了');
  const seeded=await roundTwoPrompts(page,language,11),different=await roundTwoPrompts(page,language,137),legacy=await roundTwoPrompts(page,language,11,true);
  assert.deepEqual(seeded,await roundTwoPrompts(page,language,11),'same match seed repeats later-turn prompts');assert.notDeepEqual(seeded,different,'different match seeds change later-turn prompts');assert.deepEqual(legacy,language==='en'?['airplane','coffee','tree']:['飞机','咖啡','大树'],'legacy seedless checkpoints retain fixed fallback');
  assert.equal(different.length,3);const seat=page.locator('.practice-switch select');const drawer=await seat.inputValue(),other=await seat.locator('option').evaluateAll((options,drawer)=>options.find(option=>option.value!==drawer)?.value,drawer);await seat.selectOption(other);await page.locator('.dg-waiting').waitFor();for(const word of seeded)assert(!(await page.locator('.dg-table').innerText()).includes(word),'prompts stay drawer-private');
  await assertLayout(page);await page.screenshot({path:`${out}/${language}-${width}x${height}-seeded-round2.png`});
  await context.close();console.log('PASS drawguess',engine,language,width,height);
 }
 const literal=await browser.newPage({viewport:{width:390,height:844}});
 await literal.goto(`${base}/tests/ui/i18n.fixture.html?kind=drawguess&names=literal`);
 const answer=await literal.locator('.dg-private-choice button').first().innerText();await literal.locator('.dg-private-choice button').first().click();await literal.getByLabel('Seat').selectOption('english-player-1');
 for(const guess of ['狼人杀','Blair 猜对了','中文 猜对了 狼人杀']){await literal.locator('.dg-guess-form input').fill(guess);await literal.locator('.dg-guess-form input').press('Enter');}
 const before=await literal.locator('.dg-guesses p').allTextContents();assert.deepEqual(before,['中文 狼人杀 猜对了：狼人杀','中文 狼人杀 猜对了：Blair 猜对了','中文 狼人杀 猜对了：中文 猜对了 狼人杀']);await literal.locator('.dg-guess-form input').fill(answer);await literal.locator('.dg-guess-form input').press('Enter');
 for(const expected of ['中文 狼人杀 猜对了 猜对了','中文 狼人杀 猜对了 guessed correctly','中文 狼人杀 猜对了 猜对了']){await expect(literal.locator('.dg-guesses .correct')).toHaveText(expected);assert.deepEqual((await literal.locator('.dg-guesses p').allTextContents()).slice(0,3),before);for(const [width,height]of viewports){await literal.setViewportSize({width,height});const feedback=literal.locator('.dg-guesses .correct');await feedback.scrollIntoViewIfNeeded();assert(await feedback.evaluate(el=>{const r=el.getBoundingClientRect(),log=el.parentElement.getBoundingClientRect();return el.scrollWidth<=el.clientWidth+1&&r.top>=log.top-1&&r.bottom<=log.bottom+1&&r.top>=0&&r.bottom<=innerHeight;}),'wrapped feedback is fully visible inside the scrollable log');await literal.screenshot({path:`${out}/${expected.endsWith('correctly')?'en':'zh'}-${width}x${height}-literal.png`});}await literal.getByRole('button',{name:'Toggle language'}).click();}
 await literal.close();assert.deepEqual(errors,[],'Drawing interactions produce no browser errors');
} finally {await browser.close();}
