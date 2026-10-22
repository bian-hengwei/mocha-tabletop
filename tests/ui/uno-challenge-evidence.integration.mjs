import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const out=`test-results/uno-challenge-evidence-${engine}`;
await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];

async function seedReview(page,count,dense,locale){
 return page.evaluate(async({count,dense,locale})=>{
  const m=await import('/src/local/practice.ts');
  for(let seed=1;seed<1000;seed++){
   let p=m.createPractice('uno',count,{id:'uno-evidence-human',name:'Morgan',avatar:'🦊'},{language:locale,unoMode:'single'},undefined,seed);
   if(p.game.phase!=='play')continue;
   const actor=p.players[p.game.current].id;
   p.viewer=actor;
   if(!m.practiceView(p).actions.some(a=>a.id.startsWith('wild:wild4')))continue;
   // Grow a real hand through legal draws and passes, preserving the card inventory.
   if(dense){
    for(let turns=0;turns<150;turns++){
     p.viewer=p.players[p.game.current].id;
     if(p.viewer===actor&&p.game.hands[p.game.current].length>=29)break;
     p=m.applyPractice(p,{action:'draw',values:[]});
     if(p.game.drawn)p=m.applyPractice(p,{action:'pass',values:[]});
    }
    if(p.players[p.game.current].id!==actor||p.game.hands[p.game.current].length<29)continue;
   }
   p.viewer=actor;
   const action=m.practiceView(p).actions.find(a=>a.id.startsWith('wild:wild4'));
   if(!action)continue;
   p=m.applyPractice(p,{action:action.id,values:['blue']});
   p.viewer=p.players[p.game.current].id;
   p=m.applyPractice(p,{action:'challenge4',values:[]});
   m.writePractice(p);
   const restored=m.readPractice();
   if(!restored||restored.id!==p.id||JSON.stringify(restored.game)!==JSON.stringify(p.game))throw Error(`Rejected review checkpoint ${count}/${dense}/${seed}`);
   const evidence=m.practiceView(restored).board.privateChallenge;
   return {id:p.id,actor,viewer:p.viewer,players:p.players.map(p=>p.id),evidence,seed};
  }
  throw Error('No supported review checkpoint');
 },{count,dense,locale});
}

async function readable(page,evidence){
 const cards=page.locator('.ng-challenge .ng-uno-card');
 await expect(cards).toHaveCount(evidence.hand.length);
 const rail=page.locator('.ng-challenge .ng-hand');
 await expect(rail).toHaveAttribute('tabindex','0');
 for(const index of [0,evidence.hand.length-1]){
  await rail.evaluate((el,last)=>el.scrollTo({left:last?el.scrollWidth:0,behavior:'instant'}),index>0);
  const bounds=await cards.nth(index).boundingBox(),region=await rail.boundingBox();
  assert(bounds.height>=100,`Evidence ${index} stays readable: ${bounds.height}px`);
  assert(bounds.y>=region.y-1&&bounds.y+bounds.height<=region.y+region.height+1,'Whole evidence card fits its rail');
  assert(bounds.x>=region.x-1&&bounds.x+bounds.width<=region.x+region.width+1,`First and last evidence cards are reachable: ${JSON.stringify({bounds,region,viewport:await page.viewportSize()})}`);
 }
 const button=page.locator('.ng-challenge .ng-action');
 const box=await button.boundingBox();
 assert(box.height>=44&&box.y>=0&&box.y+box.height<=await page.evaluate(()=>innerHeight),'Continue is reachable without scrolling');
 assert(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Continue is unobscured');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page width overflow');
}

try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.evaluate(locale=>{localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify({id:'uno-evidence-human',name:'Morgan',avatar:'🦊'}));},locale);
  await page.reload();await expect(page.locator('.cover-uno')).toBeVisible();
  for(const [count,dense] of [[3,false],[10,false],[2,true]]){
   const expected=await seedReview(page,count,dense,locale);
   await page.reload();await expect(page.locator('.ng-challenge')).toBeVisible();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.id),expected.id);
   for(const [width,height] of sizes){
    await page.setViewportSize({width,height});await readable(page,expected.evidence);
    await page.screenshot({path:`${out}/${locale}-${count}-${dense?'dense':'standard'}-${width}x${height}.png`});
   }
   // Resizing preserves evidence; switching seats never exposes it to another player.
   for(const id of expected.players.filter(id=>id!==expected.viewer)){
    await page.locator('.practice-switch select').selectOption(id);
    await expect(page.locator('.ng-challenge')).toHaveCount(0);
    const privateView=await page.evaluate(async()=>{const m=await import('/src/local/practice.ts');return m.practiceView(m.readPractice()).board.privateChallenge;});
    assert.equal(privateView,undefined);
   }
   await page.locator('.practice-switch select').selectOption(expected.viewer);await page.reload();
   await expect(page.locator('.ng-challenge')).toBeVisible();await readable(page,expected.evidence);
   const review=await page.evaluate(async()=>{const m=await import('/src/local/practice.ts');return m.practiceView(m.readPractice()).board.privateChallenge;});
   assert.deepEqual(review,expected.evidence,'Reload preserves exact challenge evidence and outcome');
   const rail=page.locator('.ng-challenge .ng-hand');
   await rail.evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));await rail.focus();
   if(await rail.evaluate(el=>el.scrollWidth>el.clientWidth)){
    await page.keyboard.press('ArrowRight');await expect.poll(()=>rail.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
   }
   await page.locator('.ng-challenge .ng-action').focus();await page.keyboard.press('Enter');
   await expect(page.locator('.ng-challenge')).toHaveCount(0);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.game.phase),'play');
   console.log(`PASS ${locale}: ${count} players, ${expected.evidence.hand.length} evidence cards, seed ${expected.seed}; eight sizes, rotation, private seat views, reload, keyboard continue`);
  }
  assert.deepEqual(errors,[]);await context.close();
 }
}finally{await browser.close();}
