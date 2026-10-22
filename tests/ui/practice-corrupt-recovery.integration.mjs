import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5301',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const out=`test-results/practice-corrupt-recovery-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=process.env.TEST_VIEWPORT_SCOPE==='compact'?[[320,568],[568,320]]:[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];

async function seed(page,locale,kind){
 await page.goto(base+'/manifest-mocha.webmanifest');
 return page.evaluate(async({locale,kind})=>{
  const {createPractice,writePractice,readPractice}=await import('/src/local/practice.ts');const {GAMES}=await import('/src/core/types.ts');
  localStorage.clear();localStorage.setItem('mocha-locale',locale);const profile={id:'checkpoint-user',name:'Recovery',avatar:'🦊'};const history={records:[{id:'keep-history',kind:'gems',at:1,name:'Recovery',avatar:'🦊',mode:'practice',result:'draw',summary:'Keep this record',playerCount:2}],seen:['keep-history']};
  localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-history-v1',JSON.stringify(history));
  const p=createPractice(kind,kind==='guandan'?4:GAMES[kind].min,profile,{language:locale},undefined,77);delete p.game[kind==='guandan'?'levels':'bids'];writePractice(p);if(readPractice())throw Error('Expected corrupt checkpoint rejection');
  return {practice:p.id,profile:localStorage.getItem('mocha-profile'),history:localStorage.getItem('mocha-history-v1')};
 },{locale,kind});
}

try{
 for(const locale of ['zh','en'])for(const kind of ['doudizhu','guandan'])for(const [width,height]of sizes){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const before=await seed(page,locale,kind);await page.goto(base);await expect(page.locator('.home-shell')).toBeVisible();await expect(page.locator('.game-surface')).toHaveCount(0);
  const preserved=await page.evaluate(()=>({practice:localStorage.getItem('mocha-practice-v1'),profile:localStorage.getItem('mocha-profile'),history:localStorage.getItem('mocha-history-v1')}));assert.equal(preserved.practice,null);assert.equal(preserved.profile,before.profile);assert.equal(preserved.history,before.history);
  await page.locator(`.cover-${kind}`).click();await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();await expect(page.locator('.game-surface')).toBeVisible();
  const replacement=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice);assert.equal(replacement.kind,kind);assert.notEqual(replacement.id,before.practice);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const history=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-history-v1')).records);assert.equal(history[0].id,'keep-history');assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/${kind}-${locale}-${width}x${height}.png`});
  await context.close();console.log(`PASS ${engine}/${kind}/${locale}/${width}x${height}: corrupt save -> home -> fresh practice; profile/history preserved`);
 }
}finally{await browser.close();}
