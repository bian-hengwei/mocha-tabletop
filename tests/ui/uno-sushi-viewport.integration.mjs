import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await (process.env.TEST_BROWSER==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const out='test-results/uno-sushi-viewport';await fs.mkdir(out,{recursive:true});
try {for(const locale of ['zh','en'])for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){
 const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(l=>localStorage.setItem('mocha-locale',l),locale);const page=await context.newPage();
 for(const [kind,scenario] of [['uno','long-hand'],['uno','challenge'],['uno','call'],['sushi','chopsticks'],['sushi','full-plates']]){
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=${kind}&scenario=${scenario}&players=${kind==='sushi'?'max':'10'}`);await page.locator(`.ng-${kind}`).waitFor();
  const fit=async()=>{const r=await page.evaluate(()=>[...document.querySelectorAll('.game-surface,.ng-uno-overview,.ng-sushi-overview,.ng-plates,.ng-plate,.ng-challenge,.ng-hand,.ng-uno-center')].filter(e=>e.getBoundingClientRect().height).map(e=>({class:e.className,extra:e.scrollHeight-e.clientHeight,rect:e.getBoundingClientRect().toJSON()})));assert(r.every(e=>e.extra<=1&&e.rect.y>=0&&e.rect.bottom<=height+1),JSON.stringify({locale,width,height,scenario,r}));const actions=await page.locator('.ng-action,.ng-uno-colors button').evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().toJSON()).filter(r=>r.height));assert(actions.every(r=>r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1),'actions fit');};
  if(kind==='uno'&&scenario==='long-hand'){await expect(page.locator('.ng-hand-scroll-cue')).toBeVisible();await page.locator('.ng-uno-hand .ng-uno-card').nth(3).click();await expect(page.locator('.ng-uno-colors button')).toHaveCount(4);}
  if(kind==='sushi'&&scenario==='chopsticks'){const cards=page.locator('.ng-sushi-hand-panel .ng-sushi-card');await cards.first().click();await cards.nth(1).click();await expect(cards.first()).toHaveAttribute('aria-pressed','true');await expect(cards.nth(1)).toHaveAttribute('aria-pressed','true');}
  if(scenario==='full-plates'){for(const plate of await page.locator('.ng-plate').all()){await plate.locator('.ng-sushi-card').last().scrollIntoViewIfNeeded();const bounds=await plate.locator('.ng-sushi-card').last().boundingBox();assert(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1);await fit();}}
  if(locale==='en')assert(!/[\p{Script=Han}]/u.test(await page.locator('.ng-table').innerText()),'English gameplay text');
  await fit();await page.screenshot({animations:'disabled',timeout:10000,path:`${out}/${kind}-${scenario}-${locale}-${width}.png`});
  if(scenario==='call'){
   await expect(page.locator('.ng-hand-scroll-cue')).toHaveCount(0);
   await expect(page.locator('.ng-uno-hand-panel h3 small')).toHaveText(locale==='zh'?'1 张':'1 card');
   await expect(page.locator('.ng-player.ng-self small').first()).toHaveText(locale==='zh'?'1 张手牌 · UNO!':'1 card in hand · UNO!');
  }
  if(scenario==='call'){await page.getByRole('button',{name:locale==='zh'?'喊：剩一张！':'Call: Last card!',exact:true}).click();await fit();}
  if(scenario==='challenge'){await page.locator('.ng-challenge .ng-action').click();await expect(page.locator('.ng-challenge')).toHaveCount(0);await fit();}
  if(kind==='sushi'&&scenario==='chopsticks'){await page.locator('.ng-sushi-confirm>.ng-action').click();await expect(page.locator('.ng-sushi-hand-panel .ng-sushi-card:enabled')).toHaveCount(0);await fit();await page.getByRole('button',{name:locale==='zh'?'重新选牌':'Choose again',exact:true}).click();await expect(page.locator('.ng-sushi-hand-panel .ng-sushi-card:enabled')).toHaveCount(7);}
 }
 // Inspect the real App's five-player final result, including its replay/dismiss controls.
 await page.goto(base+'/manifest-mocha.webmanifest');
 await page.evaluate(async()=>{
  const {sushi}=await import('/src/core/games/sushi.ts');
  const players=Array.from({length:5},(_,i)=>({id:'result-'+i,name:['Player One','Player Two','Player Three','Player Four','Player Five 长名字'][i],avatar:'🦊'}));
  const game=sushi.create(players,17);Object.assign(game,{round:3,step:8,finished:true,winners:[players[4].id],hands:players.map(()=>[]),scores:[21,20,28,23,29],puddings:[4,1,3,1,1],roundScores:[[7,6,7,8,10],[0,8,6,9,10],[8,8,15,8,11]]});
  localStorage.setItem('mocha-profile',JSON.stringify(players[4]));localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice:{id:crypto.randomUUID(),kind:'sushi',players,game,viewer:players[4].id}}));
 });
 await page.goto(base);await expect(page.locator('.sushi-results tbody tr')).toHaveCount(5);
 await expect(page.locator('.sushi-result-total')).toHaveText(['29','28','23','21','20']);
 const resultFit=async()=>{
  const fit=await page.locator('.end-banner-sushi').evaluate(panel=>{const p=panel.getBoundingClientRect();return {width:panel.scrollWidth-panel.clientWidth,within:p.left>=0&&p.top>=0&&p.right<=innerWidth+1&&p.bottom<=innerHeight+1,cells:[...panel.querySelectorAll('th,td')].every(e=>e.scrollWidth<=e.clientWidth+1)};});
  assert(fit.within&&fit.width<=1&&fit.cells,JSON.stringify({locale,width,height,fit}));
  const close=await page.locator('.dismiss-result').boundingBox();assert(close&&close.width>=44&&close.height>=44);
 };
 await resultFit();await page.screenshot({path:`${out}/sushi-results-${locale}-${width}.png`});
 await page.setViewportSize({width:height,height:width});await resultFit();
 await page.getByRole('button',{name:locale==='zh'?'收起结算':'Dismiss result',exact:true}).click();
 await expect(page.locator('.ng-sushi-hand-panel')).toHaveCount(0);
 await page.getByRole('button',{name:locale==='zh'?'得分明细':'Score breakdown',exact:true}).click();
 await expect(page.locator('.sushi-results tbody tr')).toHaveCount(5);
 await context.close();console.log(`PASS ${locale} ${width}x${height}`);
}}finally{await browser.close();}
