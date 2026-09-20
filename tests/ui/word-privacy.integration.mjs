import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5173';
const artifacts='test-results/word-privacy';
await fs.mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const sizes=[[320,740],[390,844],[568,320],[1440,900]];
const errors=[];
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(locale=>{localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify({id:'word-privacy-browser',name:'Alexandria测试玩家',avatar:'🦊'}));localStorage.removeItem('mocha-practice-v1');},locale);
  const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  const seat=index=>page.locator('.practice-switch select').selectOption('practice-'+index);
  const begin=async kind=>{await page.goto(base);await page.locator('.cover-'+kind).click();await page.locator('.create-body footer .text-button').click();await page.locator('.wg-table').waitFor();};
  const confirm=()=>page.locator('.action-sheet footer button').click();
  const capture=async(name,{voting=false}={})=>{
   for(const [width,height]of sizes){
    await page.setViewportSize({width,height});await page.locator('.game-surface').evaluate(el=>{el.scrollTop=0;});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${locale} ${name} ${width}: horizontal page overflow`);
    const overflow=await page.locator('.wg-table button,.wg-table strong,.wg-table input,.wg-table select').evaluateAll(nodes=>nodes.flatMap(el=>{const r=el.getBoundingClientRect();return r.width&&el.scrollWidth>el.clientWidth+2?[{text:el.textContent,client:el.clientWidth,scroll:el.scrollWidth}]:[];}));
    assert.deepEqual(overflow,[],`${locale} ${name} ${width}: clipped labels`);
    const atlas=await page.locator('.wg-table svg image').evaluateAll(nodes=>[...new Set(nodes.map(el=>el.getAttribute('href')))]);
    assert(atlas.length>0,'The table must include its illustrated atlas');
    for(const url of atlas)assert(await page.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();return image.naturalWidth>0;},url),`Atlas failed to load: ${url}`);
    if(voting){
     assert.equal(await page.locator('.wg-secret-compact').count(),1,'Hide the large word card after dealing');
     const compact=await page.locator('.wg-secret-panel').boundingBox();assert(compact.height<=90,'The hidden secret control must stay compact while voting');
     const first=await page.locator('.wg-odd-player').first().boundingBox();assert(first.y<height,'At least the first voting targets must enter the initial viewport');
    }
    await page.screenshot({path:`${artifacts}/${name}-${locale}-${width}.png`});
   }
   await page.setViewportSize({width:390,height:844});
  };
  await begin('codenames');
  const red=await page.locator('.wg-team.wg-active.wg-red').count()>0,captain=red?0:1,operative=red?2:3;
  await seat(captain);await page.locator('.wg-key-toggle').click();assert.equal(await page.locator('.wg-word.wg-assassin').count(),1);
  await seat(operative);assert.equal(await page.locator('.wg-word.wg-assassin').count(),0);await seat(captain);
  assert.equal(await page.locator('.wg-word.wg-assassin').count(),0,'Returning to the captain must not reveal the previous key');assert.equal(await page.locator('.wg-key-toggle').getAttribute('aria-pressed'),'false');
  await capture('signals-captain');
  await page.locator('.wg-key-toggle').click();const targets=await page.locator('.wg-word.wg-'+(red?'red':'blue')).locator('.wg-cell-index').allTextContents();
  const boardWords=await page.locator('.wg-word>strong').allTextContents();const clue=(locale==='en'?['Mystery','Journey','Harmony']:['联想','旅途','回忆']).find(word=>!boardWords.includes(word));
  await page.locator('.wg-clue-form input').fill(clue);await page.locator('.wg-clue-form select').selectOption('unlimited');await page.locator('.wg-clue-form button[type=submit]').click();await seat(operative);
  for(const target of targets){await page.locator('.wg-word').nth(Number(target)-1).click();await confirm();}
  await page.locator('.end-banner').waitFor();const signalsMatch=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.id);
  await page.locator('.end-banner .primary').click();await page.locator('.wg-key-toggle').waitFor();assert.notEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.id),signalsMatch);assert.equal(await page.locator('.wg-key-toggle').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('.wg-word.wg-assassin').count(),0,'Replaying Secret Signals starts with its key hidden');
  console.log(`PASS ${locale} captain key away/back privacy, complete game, same-game replay privacy, 4 illustrated layouts`);
  await begin('undercover');await page.locator('.wg-secret').click();assert.equal(await page.locator('.wg-secret.wg-open').count(),1);await seat(1);await seat(0);
  assert.equal(await page.locator('.wg-secret.wg-open').count(),0,'Returning to a seat must not reveal its previous secret word');assert.equal(await page.locator('.wg-secret').getAttribute('aria-pressed'),'false');
  await capture('odd-deal');
  const words=[];for(let index=0;index<3;index++){await seat(index);await page.locator('.wg-secret').click();words.push(await page.locator('.wg-secret>strong').textContent());await page.locator('.wg-secret-panel>.wg-primary').click();}
  for(let index=0;index<3;index++){await seat(index);await page.locator('.wg-speaking>.wg-primary').click();}
  await capture('odd-vote',{voting:true});
  const odd=words.findIndex(word=>words.filter(candidate=>candidate===word).length===1);assert(odd>=0);
  for(let index=0;index<3;index++){await seat(index);if(index===2)await page.locator('.wg-secret').click();const target=index===odd?(index+1)%3:odd;await page.locator('.wg-odd-player').nth(target).click();await confirm();}
  await page.locator('.end-banner').waitFor();assert.equal(await page.locator('.wg-secret.wg-open').count(),1,'Keep a revealed final word to exercise replay state reset');const oddMatch=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.id);
  await page.locator('.end-banner .primary').click();assert.notEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.id),oddMatch);assert.equal(await page.locator('.wg-secret.wg-open').count(),0,'Replaying Odd Word Out must not expose its new secret word');assert.equal(await page.locator('.wg-secret').getAttribute('aria-pressed'),'false');
  console.log(`PASS ${locale} secret word away/back privacy, compact voting controls, complete game, revealed-word replay privacy, 8 illustrated layouts`);
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS word-game privacy and replay regressions, 24 bilingual responsive screenshots, loaded atlases, voting priority, no clipped labels or browser errors');
}finally{await browser.close();}
