import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/poker-feedback-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
async function fits(page){
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const status=page.locator('.classic-selection');
 assert(await status.evaluate(e=>{const r=e.getBoundingClientRect();return e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1&&r.top>=0&&r.bottom<=innerHeight+1;}),'complete feedback is visible');
 for(const button of await page.locator('.classic-controls button').all()){
  assert(await button.evaluate(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),'44px controls remain visible');
 }
}
async function fullHandWithoutHigherPlay(locale){
 const context=await browser.newContext({viewport:{width:320,height:568}});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 // Prepare storage outside App to avoid racing its initial empty-session persistence.
 await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=guandan&scenario=declare`);
 // Seed 68 gives the next player a full hand that cannot beat the opening joker.
 // Only prepare the deal; the opening play, seat switch and pass use the real UI.
 await page.evaluate(async locale=>{
  const {guandan}=await import('/src/core/games/poker.ts');
  const players=['Alex','Blair','Rain','Quinn'].map((name,i)=>({id:`practice-${i}`,name,avatar:['🦊','🐼','🐱','🐻'][i]}));
  localStorage.setItem('mocha-profile',JSON.stringify(players[0]));
  localStorage.setItem('mocha-locale',locale);
  localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice:{id:'no-higher-play',kind:'guandan',players,game:guandan.create(players,68),viewer:players[0].id}}));
 },locale);
 await page.goto(base);
 await page.locator('.classic-hand .classic-card').first().click();
 await page.locator('.classic-controls .primary').click();
 await page.getByRole('combobox',{name:locale==='zh'?'切换试玩座位':'Switch practice seat'}).selectOption('practice-1');
 await expect(page.locator('.classic-hand .classic-card')).toHaveCount(27);
 const hint=page.getByRole('button',{name:locale==='zh'?'无可压过的牌':'No higher play',exact:true});
 await expect(hint).toBeDisabled();
 for(const [width,height]of sizes){
  await page.setViewportSize({width,height});
  await fits(page);
  assert(await page.locator('.game-surface').evaluate(e=>e.scrollHeight<=e.clientHeight+2),'full hand and response controls need no vertical scrolling');
  const clipped=await page.locator('.classic-controls button').evaluateAll(buttons=>buttons.flatMap(button=>{
   const box=button.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(button);
   return [...range.getClientRects()].some(r=>r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1)?[button.textContent]:[];
  }));
  assert.deepEqual(clipped,[],'complete button labels stay inside their touch targets');
  await page.screenshot({path:`${out}/guandan-no-higher-${locale}-${width}.png`});
 }
 await page.setViewportSize({width:320,height:568});
 await page.getByRole('button',{name:locale==='zh'?'不出':'Pass',exact:true}).click();
 await expect(page.locator('.classic-selection')).toHaveText(locale==='zh'?'等待 Rain':'Waiting for Rain');
 await expect(page.locator('.classic-hand .classic-card')).toHaveCount(27);
 assert.deepEqual(errors,[]);
 await context.close();
 console.log('PASS full hand, no higher play, visible labels, rotation and actual pass',engine,locale);
}
try{for(const kind of ['guandan','doudizhu'])for(const locale of ['zh','en'])for(const[width,height]of sizes){
 const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(l=>localStorage.setItem('mocha-locale',l),locale);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=${kind}&scenario=response-feedback`);
 const rail=page.locator('.classic-hand-scroll');const overflow=await rail.evaluate(e=>e.scrollWidth>e.clientWidth+2);await expect(rail).toHaveAttribute('aria-label',locale==='zh'?(overflow?'手牌可左右滑动':'我的手牌'):(overflow?'Swipe to see your hand':'My hand'));
 await expect(page.locator('.classic-seat.seat-right small').first()).toContainText(locale==='zh'?'1 张':'1 card ·');
 await expect(page.locator('.classic-seat.seat-self small').first()).toContainText(locale==='zh'?'8 张':'8 cards ·');
 const status=page.locator('.classic-selection'),play=page.locator('.classic-controls .primary'),clear=page.getByRole('button',{name:locale==='zh'?'清空选择':'Clear selection',exact:true});
 for(const name of ['♠7','♣7'])await page.getByRole('button',{name,exact:true}).click();
 await expect(status).toHaveText(locale==='zh'?'这组牌压不过上家':'Cannot beat the previous play');await expect(play).toBeDisabled();await fits(page);await page.screenshot({path:`${out}/${kind}-${locale}-${width}.png`});
 await page.setViewportSize({width:height,height:width});await expect(page.locator('.classic-card[aria-pressed="true"]')).toHaveCount(2);await fits(page);await page.setViewportSize({width,height});
 await page.getByRole('button',{name:'♣7',exact:true}).click();await page.getByRole('button',{name:'♠8',exact:true}).click();
 await expect(status).toHaveText(locale==='zh'?'牌型不成立':'Not a valid combination');await expect(play).toBeDisabled();await fits(page);
 await clear.click();await expect(page.locator('.classic-card[aria-pressed="true"]')).toHaveCount(0);await expect(status).toHaveText(locale==='zh'?'轮到你了':'Your turn');
 for(const name of ['♠9','♥9','♣9','♦9'])await page.getByRole('button',{name,exact:true}).click();await expect(play).toBeEnabled();await expect(status).toHaveText(locale==='zh'?'已选 4 · 炸弹':'Selected 4 · Bomb');await play.click();
 await expect(page.locator('.classic-felt')).toContainText(locale==='zh'?'炸弹':'Bomb');await expect(page.locator('.classic-hand .classic-card')).toHaveCount(4);await expect(page.locator('.classic-card[aria-pressed="true"]')).toHaveCount(0);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS response feedback, correction, rotation and legal play',engine,kind,locale,width,height);
}for(const locale of ['zh','en'])await fullHandWithoutHigherPlay(locale);
}finally{await browser.close();}
