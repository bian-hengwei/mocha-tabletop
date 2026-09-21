import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const out=`test-results/new-game-results-${engine}`;await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch();
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
const totals={bombs:[null,null,null,null,null],sushi:[22,20,25,24,25],century:[15,20,31,16,27],uno:[120,310,530,99,400,210,111,97,55,8]};
try{
 for(const locale of ['zh','en'])for(const kind of ['sushi','century','uno','bombs']){
  const page=await browser.newPage();page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/tests/ui/new-game-results.fixture.html?locale=${locale}&kind=${kind}`);
  await expect(page.locator('.end-banner')).toBeVisible();await page.setViewportSize({width:390,height:844});await page.setViewportSize({width:844,height:390});
  await page.getByRole('button',{name:locale==='zh'?'收起结算':'Dismiss result',exact:true}).click();
  const rows=page.locator('.ng-final-player');await expect(rows).toHaveCount(totals[kind].length);
  if(kind!=='bombs')for(let i=0;i<totals[kind].length;i++){
   const name=i===0?'Host':i===1?'Guest':`Mocha ${i-1}`;
   const row=rows.filter({has:page.locator('.ng-final-player-heading>b').filter({hasText:new RegExp(`^${name}(?:\\s|$)`)})});
   await expect(row.locator('.ng-final-player-heading>strong')).toHaveText(new RegExp(`^${totals[kind][i]}\\s*(?:分|pts)$`));
  }
  if(kind==='bombs'){await expect(page.locator('.ng-final-status')).toHaveText(locale==='zh'?['最后的幸存者','已出局','已出局','已出局','已出局']:['Last survivor','Eliminated','Eliminated','Eliminated','Eliminated']);await expect(page.locator('.bt-hand-zone,.bt-arena,.ng-final-player-heading>strong')).toHaveCount(0);}
  await expect(page.locator('.ng-final-player.winner')).toHaveCount(1);await expect(page.locator('.ng-final-player.winner')).toContainText('Mocha 1');
  if(kind==='sushi'){
   const winner=page.locator('.ng-final-player.winner');await expect(winner.locator('.ng-final-details dd')).toHaveText(['8','7','7','+3']);
   await expect(rows.filter({has:page.locator('.ng-final-player-heading>b').filter({hasText:'Mocha 2'})}).locator('.ng-final-details dd')).toHaveText(['10','10','10','-6']);
  }
  for(const[width,height]of sizes){
   await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1),'result page overflow');
   assert(await page.locator('.ng-final-grid').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1),`${kind}/${locale}/${width}: every default-name score fits without scrolling`);
   for(const row of await rows.all()){const box=await row.boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'all final rows visible');}
   assert(await page.locator('.ng-final-player-heading>b').evaluateAll(xs=>xs.every(x=>x.scrollWidth<=x.clientWidth+1)),'names wrap without clipping');
   assert.deepEqual(await rows.evaluateAll(xs=>xs.flatMap(row=>{const box=row.getBoundingClientRect(),walker=document.createTreeWalker(row,NodeFilter.SHOW_TEXT),bad=[];while(walker.nextNode()){const node=walker.currentNode;if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const rect of range.getClientRects())if(rect.left<box.left-1||rect.right>box.right+1||rect.top<box.top-1||rect.bottom>box.bottom+1)bad.push(node.textContent);}return bad;})),[],`${kind}/${locale}/${width}: score text stays inside its own card`);
   await page.screenshot({path:`${out}/${kind}-${locale}-${width}x${height}.png`});
  }
  // Long mixed-language names remain literal and readable, with a focusable
  // vertical result list available if the short viewport needs it.
  await page.goto(`${base}/tests/ui/new-game-results.fixture.html?locale=${locale}&kind=${kind}&long=1&guest=1`);await page.getByRole('button',{name:locale==='zh'?'收起结算':'Dismiss result',exact:true}).click();
  for(const[width,height]of[[320,568],[568,320]]){
   await page.setViewportSize({width,height});const grid=page.locator('.ng-final-grid');await grid.focus();
   for(const row of await rows.all()){await row.scrollIntoViewIfNeeded();await expect(row).toBeInViewport();assert(await row.locator('.ng-final-player-heading>b').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'long name clipped');}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));
   await page.screenshot({path:`${out}/${kind}-${locale}-${width}-long.png`});
  }
  if(kind==='sushi'){
   await page.goto(`${base}/tests/ui/new-game-results.fixture.html?locale=${locale}&kind=sushi&tie=1`);
   await page.getByRole('button',{name:locale==='zh'?'收起结算':'Dismiss result',exact:true}).click();
   await expect(page.locator('.ng-final-player.winner')).toHaveCount(2);
   await expect(page.locator('.ng-final-results>header p')).toHaveText(locale==='en'?'Winners: Mocha 1 and Mocha 3':'共同胜者： Mocha 1和Mocha 3');
   for(const[width,height]of[[320,568],[568,320]]){
    await page.setViewportSize({width,height});
    assert(await page.locator('.ng-final-grid').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'tied results fit');
    await page.screenshot({path:`${out}/sushi-${locale}-${width}-tie.png`});
   }
  }
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${engine} ${locale} ${kind}: final results and winner cues, game-specific totals/status, eight sizes, long names and rotation`);
 }
}finally{await browser.close();}
