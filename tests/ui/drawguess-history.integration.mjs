import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const out=process.env.TEST_RESULTS_DIR||`test-results/drawguess-history-${engine}`;
const sizes=process.env.TEST_HISTORY_COMPACT==='1'?[[390,844],[568,320]]:[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
const browser=await(engine==='webkit'?webkit:chromium).launch(),observations=[];
await fs.mkdir(out,{recursive:true});
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[],matches=[];
  page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));
  // This local history regression never joins a real room.
  await context.routeWebSocket('**/api/rooms/**',socket=>socket.close());
  for(const scenario of ['win','loss','draw']){
   await page.goto(base+'/manifest-mocha.webmanifest');
   const fixture=await page.evaluate(async({locale,scenario})=>{
    const {createPractice,applyPractice,advancePracticeClock,writePractice,readPractice}=await import('/src/local/practice.ts');
    if(scenario==='win')localStorage.clear();
    localStorage.setItem('mocha-locale',locale);
    const profile={id:'draw-history-player',name:'History Player',avatar:'🦊'};
    localStorage.setItem('mocha-profile',JSON.stringify(profile));
    let p=createPractice('drawguess',3,profile,{language:locale,drawRounds:1,drawSeconds:60},undefined,17);
    const guessers=scenario==='win'?[1,0,0]:scenario==='loss'?[1,2,1]:[1,2,0];
    for(let turn=0;turn<2;turn++){
     const choice=p.game.choices[0];p={...p,viewer:`practice-${p.game.drawer}`};
     p=applyPractice(p,{action:'choose',values:[choice.id]});
     p={...p,viewer:`practice-${guessers[turn]}`};p=applyPractice(p,{action:'guess',values:[],text:choice[locale]});
     p=advancePracticeClock(p,Date.now());p=advancePracticeClock(p,p.game.revealUntil+1);
    }
    if(p.game.finished||p.game.phase!=='choose'||p.game.round!==3)throw Error(`${scenario}: legal fixture did not reach final choose`);
    p={...p,viewer:'practice-2'};p=advancePracticeClock(p,Date.now());writePractice(p);
    if(readPractice()?.id!==p.id)throw Error(`${scenario}: supported checkpoint was rejected`);
    return {id:p.id,guesser:`practice-${guessers[2]}`,answer:p.game.choices[0][locale]};
   },{locale,scenario});
   await page.goto(base);await expect(page.locator('.dg-private-choice')).toBeVisible();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-history-v1')||'{"records":[]}').records.some(r=>r.id===JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.id)),false);
   await page.locator('.dg-private-choice button').first().click();
   await page.locator('.practice-switch select').selectOption(fixture.guesser);
   await page.locator('.dg-guess-form input').fill(fixture.answer);
   await page.getByRole('button',{name:locale==='zh'?'提交猜词':'Submit guess',exact:true}).click();
   await expect(page.locator('.end-banner')).toBeVisible({timeout:12000});
   const terminal=await page.evaluate(()=>{
    const p=JSON.parse(localStorage.getItem('mocha-practice-v1')).practice,history=JSON.parse(localStorage.getItem('mocha-history-v1'));
    return {finished:p.game.finished,scores:p.game.scores,winnerIDs:p.game.winnerIDs,records:history.records.filter(r=>r.id===p.id)};
   });
   assert.equal(terminal.finished,true);assert.deepEqual(terminal.scores,scenario==='win'?[5,3,1]:scenario==='loss'?[1,5,3]:[3,3,3]);
   assert.deepEqual(terminal.winnerIDs,scenario==='win'?['practice-0']:scenario==='loss'?['practice-1']:['practice-0','practice-1','practice-2']);
   assert.equal(terminal.records.length,1);const record=terminal.records[0];
   assert.equal(record.result,scenario);assert.equal(record.score,terminal.scores[0]);assert.equal(record.name,'History Player');assert.equal(record.mode,'practice');
   assert.equal(record.playerCount,3);assert.equal(record.botCount,undefined);matches.push({scenario,...fixture,...terminal});
   console.log(`PASS ${engine}/${locale} legal ${scenario}: final App choose/guess and reveal timer -> ${record.result}, ${record.score} points`);
  }
  const open=async()=>{
   await page.getByRole('button',{name:locale==='zh'?'牌桌菜单':'Table menu',exact:true}).click();
   await page.getByRole('button',{name:locale==='zh'?'个人战绩':'My results',exact:true}).click();
   await expect(page.locator('.history-panel')).toBeVisible();
  };
  const assertHistory=async()=>{
   await expect(page.locator('.personal-records li')).toHaveCount(3);await expect(page.locator('.history-summary')).toHaveCount(0);
   for(const [scenario,label] of [['win',locale==='zh'?'胜':'Win'],['loss',locale==='zh'?'负':'Loss'],['draw',locale==='zh'?'并列':'Tie']]){
    const mark=page.locator(`.result-${scenario}`);await expect(mark).toHaveText(label);
    await expect(mark.locator('..').locator('small')).toContainText(locale==='zh'?'同屏试玩':'Pass & play');
   }
  };
  await open();await assertHistory();
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});await assertHistory();
   await page.locator('.result-draw').scrollIntoViewIfNeeded();
   await page.screenshot({path:`${out}/${locale}-${width}x${height}-top.png`});
   for(const scenario of ['draw','loss','win']){
    const mark=page.locator(`.result-${scenario}`);await mark.scrollIntoViewIfNeeded();
    assert(await mark.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),`${locale}/${width}x${height} ${scenario}: result label is reachable`);
   }
   if(height<700)await page.screenshot({path:`${out}/${locale}-${width}x${height}-scrolled.png`});
  }
  // Repeated renders, a different viewed seat and language/reload preserve the first-seat result and match identity.
  await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});
  await page.locator('.practice-switch select').selectOption('practice-1');
  await page.locator('.language-toggle').click();await page.locator('.language-toggle').click();
  await page.reload();await expect(page.locator('.end-banner')).toBeVisible();await open();await assertHistory();
  const removed=matches.at(-1).id,remove=page.locator('.result-draw').locator('..').getByRole('button');
  page.once('dialog',dialog=>dialog.dismiss());await remove.click();await expect(page.locator('.personal-records li')).toHaveCount(3);
  page.once('dialog',dialog=>dialog.accept());await remove.click();await expect(page.locator('.personal-records li')).toHaveCount(2);
  await page.keyboard.press('Escape');await page.reload();await expect(page.locator('.end-banner')).toBeVisible();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-history-v1')));
  assert.equal(after.records.length,2);assert(after.seen.includes(removed));assert(!after.records.some(r=>r.id===removed));
  await page.locator('.end-banner .primary').click();await expect(page.locator('.end-banner')).toHaveCount(0);
  const replay=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice);
  assert.notEqual(replay.id,removed);assert.equal(replay.game.finished,false);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-history-v1')).records.length),2);
  assert.deepEqual(errors,[]);observations.push({locale,matches,sizes,deletion:{removed,tombstoneRetained:true},replay:{newID:replay.id,noUnfinishedRecord:true},pageErrors:errors});
  await context.close();console.log(`PASS ${engine}/${locale}: ${sizes.length} history viewports, labels, first-seat dedup, cancelled/confirmed delete, reload and replay`);
 }
 await fs.writeFile(`${out}/observations.json`,JSON.stringify({engine,observations},null,2)+'\n');
}finally{await browser.close();}
