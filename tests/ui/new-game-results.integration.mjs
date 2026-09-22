import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const out=`test-results/new-game-results-${engine}`;await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch();
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
const totals={gems:[12,15,17,17],sushi:[22,20,25,24,25],century:[15,20,31,16,27],uno:[120,310,530,99,400,210,111,97,55,8]};
const counts={gems:4,bombs:5,sushi:5,century:5,uno:10};
const resultSelector={gems:'.gems-results',century:'.century-results',sushi:'.sushi-results',uno:'.ng-final-uno',bombs:'.ng-final-bombs'};
const rowSelector={gems:'tbody tr',century:'tbody tr',sushi:'tbody tr',uno:'.ng-final-player',bombs:'.ng-final-player'};
const playerName=i=>i===0?'Host':i===1?'Guest':`Mocha ${i-1}`;

async function open(page,locale,kind,extra=''){
 await page.goto(`${base}/tests/ui/new-game-results.fixture.html?locale=${locale}&kind=${kind}${extra}`);
 await expect(page.locator('.end-banner')).toBeVisible();
 if(kind==='uno'||kind==='bombs')await page.getByRole('button',{name:locale==='zh'?'收起结算':'Dismiss result',exact:true}).click();
 await expect(page.locator(resultSelector[kind])).toBeVisible();
}

async function verifyRows(page,kind,long=false){
 const result=page.locator(resultSelector[kind]),rows=result.locator(rowSelector[kind]);
 await expect(rows).toHaveCount(counts[kind]);
 for(let i=0;i<counts[kind];i++){
  const name=long?(i%2?`长昵称玩家甲乙丙丁${i}`:`Long name player ${i}`):playerName(i);
  await expect(rows.filter({hasText:name})).toHaveCount(1);
 }
 return {result,rows};
}

async function verifyScores(page,kind){
 if(kind==='bombs')return;
 const result=page.locator(resultSelector[kind]);
 for(let i=0;i<totals[kind].length;i++){
  const row=result.locator(rowSelector[kind]).filter({hasText:playerName(i)});
  if(kind==='uno')await expect(row.locator('.ng-final-player-heading>strong')).toHaveText(new RegExp(`^${totals[kind][i]}\\s*(?:分|pts)$`));
  else await expect(row.locator('td').last()).toHaveText(String(totals[kind][i]));
 }
}

try{
 for(const locale of ['zh','en'])for(const kind of ['sushi','century','uno','bombs','gems']){
  const page=await browser.newPage();page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,locale,kind);const {result,rows}=await verifyRows(page,kind);await verifyScores(page,kind);
  await expect(rows.filter({hasText:'Mocha 1'})).toHaveCount(1);
  if(kind==='gems'){
   await expect(rows.filter({hasText:'Mocha 1'}).locator('td')).toHaveText(['5','1','17']);
   await expect(result).toContainText(locale==='zh'?'平分时已购牌较少者获胜':'fewer purchased cards');
  }
  if(kind==='sushi'){
   await expect(rows.filter({hasText:'Mocha 1'}).locator('td')).toHaveText(['8','7','7','+3','25']);
   await expect(rows.filter({hasText:'Mocha 2'}).locator('td')).toHaveText(['10','10','10','-6','24']);
  }
  if(kind==='century')await expect(rows.filter({hasText:'Mocha 1'}).locator('td')).toHaveText(['5','2','1','31']);
  if(kind==='bombs')await expect(page.locator('.ng-final-status')).toHaveText(locale==='zh'?['最后的幸存者','已出局','已出局','已出局','已出局']:['Last survivor','Eliminated','Eliminated','Eliminated','Eliminated']);

  for(const[width,height]of sizes){
   await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1),`${kind}/${locale}/${width}: app overflow`);
   const surface=kind==='uno'||kind==='bombs'?result:page.locator('.end-banner');assert(await surface.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${kind}/${locale}/${width}: result surface horizontal overflow`);
   for(const row of await rows.all()){await row.scrollIntoViewIfNeeded();await expect(row).toBeInViewport();assert(await row.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${kind}/${locale}/${width}: result row clipped`);}
   await page.screenshot({path:`${out}/${kind}-${locale}-${width}x${height}.png`});
  }
  if(kind!=='uno'&&kind!=='bombs'){
   await page.getByRole('button',{name:locale==='zh'?'收起结算':'Dismiss result',exact:true}).click();await expect(page.locator('.end-banner')).toHaveCount(0);
   await page.getByRole('button',{name:locale==='zh'?'得分明细':'Score breakdown',exact:true}).click();await expect(page.locator(resultSelector[kind])).toBeVisible();
  }

  await open(page,locale,kind,'&long=1&guest=1');const longResult=await verifyRows(page,kind,true);
  for(const[width,height]of[[320,568],[568,320]]){
   await page.setViewportSize({width,height});
   for(const row of await longResult.rows.all()){await row.scrollIntoViewIfNeeded();await expect(row).toBeInViewport();assert(await row.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'long result row clipped');}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));
   await page.screenshot({path:`${out}/${kind}-${locale}-${width}-long.png`});
  }

  if(kind==='sushi'||kind==='gems'){
   await open(page,locale,kind,'&tie=1');const tieRows=(await verifyRows(page,kind)).rows;
   const second=kind==='gems'?'Mocha 2':'Mocha 3';
   for(const name of ['Mocha 1',second])await expect(tieRows.filter({hasText:name})).toContainText(locale==='zh'?'胜者':'Winner');
   for(const[width,height]of[[320,568],[568,320]]){await page.setViewportSize({width,height});for(const row of await tieRows.all()){await row.scrollIntoViewIfNeeded();await expect(row).toBeInViewport();}await page.screenshot({path:`${out}/${kind}-${locale}-${width}-tie.png`});}
  }
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${engine} ${locale} ${kind}: composed App results, all players, details, eight sizes, long names, ties and rotation`);
 }
}finally{await browser.close();}
