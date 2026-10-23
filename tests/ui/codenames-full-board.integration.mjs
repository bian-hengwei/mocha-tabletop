import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5173';
const out='test-results/codenames-full-board';
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});

function cards(page){return page.locator('.wg-signals.wg-whole-board .wg-word');}
async function assertWholeBoard(page,{longWords=false}={}){
 await expect(cards(page)).toHaveCount(25);
 assert.deepEqual(await cards(page).locator('.wg-cell-index').allTextContents(),Array.from({length:25},(_,index)=>String(index+1)),'Whole-board mode keeps the 5x5 card order');
 const rects=await cards(page).evaluateAll(nodes=>nodes.map(card=>{
  const rect=card.getBoundingClientRect(),label=card.querySelector('strong').getBoundingClientRect();
  return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height,labelTop:label.top,labelBottom:label.bottom,labelHeight:label.height,scrollHeight:card.querySelector('strong').scrollHeight,clientHeight:card.querySelector('strong').clientHeight,word:card.querySelector('strong').textContent};
 }));
 assert(rects.every(card=>card.width>=44&&card.height>=44),'Every full-board card remains a 44px reachable target');
 const overlaps=rects.flatMap((card,index)=>rects.slice(index+1).filter(other=>card.left<other.right-1&&card.right>other.left+1&&card.top<other.bottom-1&&card.bottom>other.top+1).map(other=>[card.word,other.word]));
 assert.deepEqual(overlaps,[],'Adjacent whole-board cards must never overlap');
 const clipped=rects.filter(card=>card.labelTop<card.top||card.labelBottom>card.bottom||card.scrollHeight>card.clientHeight+1);
 assert.equal(clipped.length,0,`Word labels stay inside their cards: ${JSON.stringify(clipped)}`);
 if(longWords)assert(rects.some(card=>card.word==='Password-free payment'),'The independent modern long-word fixture is active');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Whole-board mode has no horizontal page overflow');
 const whole=page.locator('.wg-whole-toggle');await whole.scrollIntoViewIfNeeded();
 const toggle=await whole.evaluate(button=>{const rect=button.getBoundingClientRect(),target=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return {width:rect.width,height:rect.height,targetIsButton:target===button||button.contains(target),coveredByWord:!!target?.closest('.wg-word')};});
 assert(toggle.width>=44&&toggle.height>=36&&toggle.targetIsButton&&!toggle.coveredByWord,`Whole-board toggle remains tappable: ${JSON.stringify(toggle)}`);
 const last=cards(page).last();await last.scrollIntoViewIfNeeded();
 const reachable=await last.evaluate(card=>{const rect=card.getBoundingClientRect(),surface=card.closest('.game-surface')?.getBoundingClientRect();return {surface,card:{top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right}};});
 assert(reachable.surface&&reachable.card.top>=reachable.surface.top-1&&reachable.card.bottom<=reachable.surface.bottom+1,'The last whole-board card is reachable by scrolling');
}

async function startHotseat(page,locale){
 await page.goto(base);await page.locator('.cover-codenames').click();
 await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();
 await page.locator('.wg-table').waitFor();
}

try{
 for(const locale of ['zh','en']){
  for(const [width,height] of sizes){
   const context=await browser.newContext({viewport:{width,height}});
   await context.addInitScript(value=>localStorage.setItem('mocha-locale',value),locale);
   const page=await context.newPage();page.setDefaultTimeout(8_000);
   await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=codenames&players=max${locale==='en'?'&scenario=modern-long-words':''}`);
   await page.locator('.wg-table').waitFor();
   const whole=page.locator('.wg-whole-toggle');
   await whole.click();await expect(whole).toHaveAttribute('aria-pressed','true');
   await assertWholeBoard(page,{longWords:locale==='en'});
   await page.locator('.game-surface').evaluate(surface=>surface.scrollTop=0);
   await page.screenshot({path:`${out}/whole-${locale}-${width}x${height}.png`});
   await page.setViewportSize({width:height,height:width});await assertWholeBoard(page,{longWords:locale==='en'});
   await page.setViewportSize({width,height});
   await whole.click();await expect(page.locator('.wg-word')).toHaveCount(width<650&&height>=500?9:width<650||height<500?10:25);
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(value=>localStorage.setItem('mocha-locale',value),locale);
  const page=await context.newPage();page.setDefaultTimeout(8_000);
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=codenames&players=max`);await page.locator('.wg-table').waitFor();
  const red=await page.locator('.wg-team.wg-active.wg-red').count()>0, captain=red?0:1,operative=red?2:3;
  await page.getByLabel('Seat').selectOption(`english-player-${captain}`);
  const whole=page.locator('.wg-whole-toggle');await whole.click();
  await page.locator('.wg-key-toggle').click();await expect(page.locator('.wg-word.wg-assassin')).toHaveCount(1);
  await page.getByLabel('Seat').selectOption(`english-player-${operative}`);await expect(page.locator('.wg-word.wg-assassin')).toHaveCount(0);
  await expect(cards(page)).toHaveCount(25);
  const mark=page.locator('.wg-mark-toggle');await mark.click();
  const target=cards(page).nth(0);await target.click();await expect(target.locator('.wg-personal-mark')).toHaveText('?');await target.click();await expect(target.locator('.wg-personal-mark')).toHaveText('×');
  await whole.click();await whole.click();await expect(target.locator('.wg-personal-mark')).toHaveText('×');
  await page.getByLabel('Seat').selectOption(`english-player-${captain}`);
  await page.locator('.wg-clue-form input').fill('Orbiting');await page.locator('.wg-clue-form button[type=submit]').click();await expect(page.locator('.wg-clue-form')).toHaveCount(0);
  await page.getByLabel('Seat').selectOption(`english-player-${operative}`);
  await target.click();await expect(page.locator('.action-sheet')).toBeVisible();await expect(cards(page)).toHaveCount(25);
  await page.locator('.action-sheet .sheet-heading>.icon').click();await expect(page.locator('.action-sheet')).toHaveCount(0);
  await expect(target.locator('.wg-personal-mark')).toHaveText('×');
  await page.screenshot({path:`${out}/operative-mark-${locale}.png`});
  await context.close();

  const appContext=await browser.newContext({viewport:{width:390,height:844}});
  await appContext.addInitScript(value=>{localStorage.setItem('mocha-locale',value);localStorage.setItem('mocha-profile',JSON.stringify({id:'wholeboard-browser',name:'Whole board',avatar:'🦊'}));localStorage.removeItem('mocha-practice-v1');},locale);
  const app=await appContext.newPage();app.setDefaultTimeout(8_000);
  await startHotseat(app,locale);
  const appWhole=app.locator('.wg-whole-toggle');await appWhole.click();await expect(appWhole).toHaveAttribute('aria-pressed','true');
  for(const [width,height] of [[320,568],[568,320],[390,844]]){
   await app.setViewportSize({width,height});await assertWholeBoard(app);
   await app.locator('.game-surface').evaluate(surface=>surface.scrollTop=0);
   await app.screenshot({path:`${out}/app-whole-${locale}-${width}x${height}.png`});
   await app.setViewportSize({width:height,height:width});await assertWholeBoard(app);
  }
  await app.setViewportSize({width:390,height:844});
  const appRed=await app.locator('.wg-team.wg-active.wg-red').count()>0,appCaptain=appRed?0:1,appOperative=appRed?2:3;
  const seat=index=>app.locator('.practice-switch select').selectOption(`practice-${index}`);
  await seat(appCaptain);await app.locator('.game-surface').evaluate(surface=>surface.scrollTop=0);
  await app.locator('.wg-key-toggle').click();await expect(app.locator('.wg-word.wg-assassin')).toHaveCount(1);
  await app.screenshot({path:`${out}/app-key-${locale}-390x844.png`});
  await seat(appOperative);await expect(app.locator('.wg-word.wg-assassin')).toHaveCount(0);
  const appMark=app.locator('.wg-mark-toggle');await appMark.scrollIntoViewIfNeeded();await appMark.click();
  const appTarget=cards(app).first();await appTarget.scrollIntoViewIfNeeded();await appTarget.click();await expect(appTarget.locator('.wg-personal-mark')).toHaveText('?');
  await seat(appCaptain);const appWords=await cards(app).locator('strong').allTextContents();const appClue=(locale==='zh'?['联想','旅途','回忆']:['Orbiting','Mystery','Harmony','Xylophone']).find(word=>!appWords.includes(word));assert(appClue,'A non-board clue is available for the hotseat interaction');await app.locator('.wg-clue-form input').fill(appClue);await app.locator('.wg-clue-form button[type=submit]').click();await expect(app.locator('.wg-clue-form')).toHaveCount(0);
  await seat(appOperative);await appTarget.scrollIntoViewIfNeeded();await appTarget.click();await expect(app.locator('.action-sheet')).toBeVisible();
  await app.screenshot({path:`${out}/app-guess-${locale}-390x844.png`});
  await app.locator('.action-sheet .sheet-heading>.icon').click();await expect(app.locator('.action-sheet')).toHaveCount(0);
  await appContext.close();
 }
}finally{await browser.close();}
