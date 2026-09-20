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
  if(kind==='uno'&&scenario==='long-hand'){await page.locator('.ng-uno-hand .ng-uno-card').nth(3).click();await expect(page.locator('.ng-uno-colors button')).toHaveCount(4);}
  if(kind==='sushi'&&scenario==='chopsticks'){const cards=page.locator('.ng-sushi-hand-panel .ng-sushi-card');await cards.first().click();await cards.nth(1).click();await expect(cards.first()).toHaveAttribute('aria-pressed','true');await expect(cards.nth(1)).toHaveAttribute('aria-pressed','true');}
  if(scenario==='full-plates'){for(const plate of await page.locator('.ng-plate').all()){await plate.locator('.ng-sushi-card').last().scrollIntoViewIfNeeded();const bounds=await plate.locator('.ng-sushi-card').last().boundingBox();assert(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1);await fit();}}
  if(locale==='en')assert(!/[\p{Script=Han}]/u.test(await page.locator('.ng-table').innerText()),'English gameplay text');
  await fit();await page.screenshot({animations:'disabled',timeout:10000,path:`${out}/${kind}-${scenario}-${locale}-${width}.png`});
  if(scenario==='call'){await page.getByRole('button',{name:locale==='zh'?'喊：剩一张！':'Call: Last card!',exact:true}).click();await fit();}
  if(scenario==='challenge'){await page.locator('.ng-challenge .ng-action').click();await expect(page.locator('.ng-challenge')).toHaveCount(0);await fit();}
  if(kind==='sushi'&&scenario==='chopsticks'){await page.locator('.ng-sushi-confirm>.ng-action').click();await expect(page.locator('.ng-sushi-hand-panel .ng-sushi-card:enabled')).toHaveCount(0);await fit();await page.getByRole('button',{name:locale==='zh'?'重新选牌':'Choose again',exact:true}).click();await expect(page.locator('.ng-sushi-hand-panel .ng-sushi-card:enabled')).toHaveCount(7);}
 }
 await context.close();console.log(`PASS ${locale} ${width}x${height}`);
}}finally{await browser.close();}
