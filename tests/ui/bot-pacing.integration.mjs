import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5226',engine=process.env.TEST_BROWSER||'chromium';
const out=`test-results/bot-pacing-${engine}`;await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const sizes=process.env.TEST_PACING_COMPACT==='1'?[[390,844]]:[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
const profile={id:'pacing-human',name:'MorganLongName',avatar:'🦊'};
try{
 const setup=await browser.newPage();await setup.goto(base);
 // Select a reproducible legal deal whose first clockwise circuit contains only discards.
 // This is fixture preparation; all measured actions below run through the real App.
 const fixture=process.env.BOT_PACING_FIXTURE?JSON.parse(await fs.readFile(process.env.BOT_PACING_FIXTURE,'utf8')):await setup.evaluate(async profile=>{
  const p=await import('/src/local/practice.ts');
  for(let seed=1;seed<200;seed++){
   const initial=p.createPractice('mahjong',4,profile,{mahjongMode:'guangdong'},'easy',seed);
   const action=p.practiceView(initial).actions.find(a=>a.id==='discard');if(!action)continue;
   for(const tile of action.choices){
    let next=p.applyPractice(initial,{action:'discard',values:[tile.id]});let valid=true;
    for(let i=1;i<=3;i++){
     if(next.game.phase!=='discard'||next.game.current!==i){valid=false;break;}
     next=p.stepPracticeBot(next);
    }
    if(valid&&next.game.phase==='discard'&&next.game.current===0&&next.game.discards.every(r=>r.length===1))return {practice:initial,tile:tile.id};
   }
  }
  throw Error('No suitable deterministic opening');
 },profile);
 await fs.writeFile(`${out}/fixture.json`,JSON.stringify(fixture));await setup.close();
 for(const locale of ['zh','en'])for(const [width,height]of sizes){
  const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await context.addInitScript(({fixture,profile,locale})=>{
   if(!sessionStorage.getItem('pacing-seeded')){
    localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale',locale);
    localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice:fixture.practice}));sessionStorage.setItem('pacing-seeded','1');
   }
   window.pacing=[];const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){
    if(key==='mocha-practice-v1'){
     const p=JSON.parse(value).practice,last=window.pacing.at(-1);
     if(!last||last.revision!==p.revision)window.pacing.push({revision:p.revision,at:performance.now(),count:p.game.discards.flat().length,queued:document.querySelectorAll('.is-awaiting').length,flight:document.querySelector('.mj-flight')?.textContent});
    }
    return original.call(this,key,value);
   };
  },{fixture,profile,locale});
  await page.goto(base);await page.locator('.mj-table').waitFor();
  const tile=page.locator(`.mj-hand [data-tile-id="${fixture.tile}"]`);
  await tile.click();await expect(tile).toHaveAttribute('aria-pressed','true');await tile.click();
  await page.waitForFunction(()=>window.pacing.some(p=>p.count===1));
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.pacing.at(-1).count),1,'bot cannot overtake the human discard animation');
  await expect(page.locator('.mj-flight')).toBeVisible();
  const animation=await page.locator('.mj-flight').evaluate(el=>parseFloat(getComputedStyle(el).animationDuration)*1000);
  assert(animation>=1100&&animation<1400,'actual CSS animation fits inside the bot pause');
  await page.screenshot({path:`${out}/${locale}-${width}-discard.png`});
  await page.waitForFunction(()=>window.pacing.at(-1).count===4,undefined,{timeout:10000});
  const trace=await page.evaluate(()=>window.pacing.filter(p=>p.count>=1));
  assert.deepEqual(trace.map(p=>p.count),[1,2,3,4],'one visible discard per transition');
  for(let i=1;i<trace.length;i++){
   assert(trace[i].at-trace[i-1].at>=1350,JSON.stringify(trace));
   assert.equal(trace[i].queued,0,'no animation backlog');assert.equal(trace[i].flight,undefined,'previous flight landed before next bot');
  }
  await page.waitForTimeout(1200);await expect(page.locator('.mj-flight')).toHaveCount(0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');
  await page.screenshot({path:`${out}/${locale}-${width}-returned.png`});
  // The history dialog remains usable while rotating the live game.
  await page.locator('.mj-history').click();await page.setViewportSize({width:height,height:width});await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('.mj-history')).toBeFocused();
  await page.reload();await page.locator('.mj-table').waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.game.discards.flat().length),4,'reload preserves the human turn');
  await page.getByRole('button',{name:locale==='zh'?'牌桌菜单':'Table menu',exact:true}).click();await page.getByRole('button',{name:locale==='zh'?'结束单机':'End solo game',exact:true}).click();
  await page.waitForTimeout(1450);assert.equal(await page.evaluate(()=>localStorage.getItem('mocha-practice-v1')),null,'exit cannot resurrect a delayed save');
  assert.deepEqual(errors,[]);await fs.writeFile(`${out}/${locale}-${width}-trace.json`,JSON.stringify(trace));await context.close();
  console.log(`PASS ${engine} ${locale} ${width}x${height}: full clockwise circuit, animation gap, rotation, reload and exit`);
 }
 // Timer lifecycle uses a controlled browser clock, separate from the real-time visual checks.
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 page.on('dialog',d=>d.accept());await page.goto(base);await page.locator('.profile-editor').waitFor();
 await page.evaluate(({fixture,profile})=>{
  localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale','en');
  localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice:fixture.practice}));
 },{fixture,profile});
 await page.clock.install();await page.clock.pauseAt(new Date());await page.reload();await page.locator('.mj-table').waitFor();
 const revision=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.revision);
 const tile=page.locator(`.mj-hand [data-tile-id="${fixture.tile}"]`);await tile.click();await tile.click();
 assert.equal(await revision(),2);await page.clock.runFor(1000);assert.equal(await revision(),2);
 await page.reload();await page.locator('.mj-table').waitFor();
 await page.clock.runFor(1399);assert.equal(await revision(),2,'reload gives a full fresh pause');
 await page.clock.runFor(1);assert.equal(await revision(),3);
 await page.clock.fastForward(10000);assert.equal(await revision(),4,'late wake-up executes one bot, not a catch-up batch');
 await page.clock.runFor(1399);assert.equal(await revision(),4);
 await page.getByRole('button',{name:'Table menu',exact:true}).click();await page.getByRole('button',{name:'End solo game',exact:true}).click();
 await page.locator('.cover-mahjong').click();await page.getByRole('button',{name:'Solo vs bots',exact:true}).click();
 assert.equal(await revision(),1);await page.clock.runFor(100);assert.equal(await revision(),1,'old callback cannot play into a new match');
 await page.getByRole('button',{name:'Table menu',exact:true}).click();await page.getByRole('button',{name:'End solo game',exact:true}).click();
 await page.clock.runFor(5000);assert.equal(await page.evaluate(()=>localStorage.getItem('mocha-practice-v1')),null);
 await context.close();console.log(`PASS ${engine}: pending reload, late wake-up, fresh wait, new match and cancellation`);
}finally{await browser.close();}
