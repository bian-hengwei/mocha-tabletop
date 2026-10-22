import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';

const base=process.env.BASE_URL||'http://127.0.0.1:5260',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const out=`test-results/guandan-actual-a-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=process.env.TEST_VIEWPORT_SCOPE==='compact'?[[320,568],[568,320]]:[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
const trace=JSON.parse(readFileSync(new URL('../fixtures/guandan-seed2-actual-a-loss.json',import.meta.url),'utf8'));

async function seed(page,locale){
 await page.goto(base+'/manifest-mocha.webmanifest');
 const checkpoint=await page.evaluate(async({locale,trace})=>{
  const {readPractice,writePractice}=await import('/src/local/practice.ts');
  localStorage.clear();localStorage.setItem('mocha-locale',locale);
  localStorage.setItem('mocha-profile',JSON.stringify(trace.before.players[2]));
  const practice={id:'guandan-seed2-actual-a',kind:'guandan',players:trace.before.players,game:trace.before,viewer:'audit-player-2',mode:'pass',revision:1};
  writePractice(practice);const restored=readPractice();if(!restored)throw Error('Rejected legal Guandan checkpoint');
  return {level:restored.game.level,levels:restored.game.levels,current:restored.game.current,phase:restored.game.phase,hand:restored.game.hands[2].map(c=>c.id)};
 },{locale,trace});
 assert.deepEqual(checkpoint,{level:10,levels:[14,10],current:2,phase:'play',hand:['p0-23']});
 await page.goto(base);await expect(page.locator('.classic-hand .classic-card')).toHaveCount(1);
}

async function state(page){return page.evaluate(async()=>{const {readPractice}=await import('/src/local/practice.ts');const p=readPractice();if(!p)throw Error('Missing practice checkpoint');return p.game;});}

async function fits(page,label){
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: horizontal overflow`);
 const panel=page.locator('.gd-results:not([hidden])');
 if(await panel.count()){const bad=await panel.evaluate(el=>{const r=el.getBoundingClientRect();return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1||el.scrollHeight>el.clientHeight+1;});assert(!bad,`${label}: results clipped`);}
}

try{
 for(const locale of ['zh','en'])for(const [width,height]of sizes){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await seed(page,locale);const card=page.locator('[data-poker-card="p0-23"]');await card.click();await page.locator('.classic-controls .primary').first().click();
  await expect(page.locator('.gd-results')).toBeVisible();await expect(page.locator('.gd-result-heading')).toContainText(locale==='zh'?'本轮结算':'Round result');
  const settled=await state(page);assert.equal(settled.finished,false);assert.equal(settled.phase,'roundEnd');assert.equal(settled.level,14);assert.deepEqual(settled.levels,[14,10]);assert.equal(settled.history.at(-1),'升级 +2');
  await fits(page,`${locale}/${width}x${height}/roundEnd`);await page.screenshot({path:`${out}/${locale}-${width}x${height}-round-end.png`});
  await page.getByRole('button',{name:locale==='zh'?'开始下一轮':'Start the next round',exact:true}).click();
  await expect(page.locator('.gd-results')).toHaveCount(0);await expect(page.locator('.classic-hand .classic-card')).toHaveCount(27);await expect(page.locator('.classic-edition')).toContainText('A');
  const next=await state(page);assert.equal(next.finished,false);assert.equal(next.round,settled.round+1);assert.equal(next.level,14);assert.deepEqual(next.levels,[14,10]);assert(['tribute','play'].includes(next.phase));
  const privacy=await page.evaluate(async()=>{const {readPractice}=await import('/src/local/practice.ts');const {guandan}=await import('/src/core/games/poker.ts');const p=readPractice(),view=guandan.view(p.game,p.players[0].id),ids=new Set(p.game.hands.slice(1).flat().map(c=>c.id)),paths=[];const walk=(value,path)=>{if(Array.isArray(value))value.forEach((item,i)=>walk(item,`${path}[${i}]`));else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){if(ids.has(item))paths.push(`${path}.${key}=${item}`);walk(item,`${path}.${key}`);}};walk(view,'view');return{leaks:paths,history:p.game.history.slice(-3),phase:p.game.phase};});
  assert.deepEqual(privacy.leaks,[],JSON.stringify(privacy));assert(privacy.history.includes('升级 +2'));
  await fits(page,`${locale}/${width}x${height}/dealA`);await page.screenshot({path:`${out}/${locale}-${width}x${height}-deal-a.png`});assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS ${engine}/${locale}/${width}x${height}: level10 roundEnd -> next A deal, history and privacy`);
 }
}finally{await browser.close();}
