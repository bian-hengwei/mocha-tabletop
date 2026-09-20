import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',out='test-results/illustrated-games';
await fs.mkdir(out,{recursive:true});
const isWebKit=process.env.TEST_BROWSER==='webkit';
const browser=await (isWebKit?webkit:chromium).launch({headless:true,...(!isWebKit?{executablePath:process.env.CHROME_PATH||undefined}:{})});
const errors=[];
try {
 for(const language of ['zh','en']) {
  const context=await browser.newContext();
  await context.addInitScript(language=>{localStorage.setItem('mocha-locale',language);localStorage.setItem('mocha-profile',JSON.stringify({id:'painted-table-test',name:'Morgan',avatar:'🦊'}));localStorage.removeItem('mocha-practice-v1');},language);
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1280,height:800}]) {
   await page.setViewportSize(viewport);
   for(const kind of ['sushi','century','uno']) {
    await page.goto(base);await page.locator('.cover-'+kind).click();await page.getByRole('button',{name:language==='zh'?'同屏试玩':'Pass & play',exact:true}).click();await page.locator('.ng-'+kind).waitFor();
    await page.evaluate(async()=>{const sources=[...document.querySelectorAll('.ng-table .illustrated-tile image')].map(image=>image.getAttribute('href'));await Promise.all([...new Set(sources)].map(src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error('Missing artwork: '+src));image.src=src;})));});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${kind} ${language} has no document overflow`);
    if(kind==='uno')assert(await page.locator('.ng-uno-card .ng-color-art').count()>1,'Every color card has engraved artwork');
    else assert(await page.locator('.ng-'+kind+' .illustrated-tile image').count()>1,'Cards show loaded painted illustrations');
    const clipped=await page.locator('.ng-sushi-card,.ng-spice-card,.ng-uno-card').evaluateAll(cards=>cards.flatMap(card=>{const outer=card.getBoundingClientRect();return [...card.querySelectorAll(':scope>b,:scope>strong,:scope>small,.ng-order-cost')].flatMap(label=>{const box=label.getBoundingClientRect();return box.left<outer.left-1||box.right>outer.right+1||box.top<outer.top-1||box.bottom>outer.bottom+1?[{card:card.getAttribute('aria-label'),label:label.textContent}]:[];});}));
    assert.deepEqual(clipped,[],`${kind} card labels fit their cards at ${viewport.width}`);
    await page.screenshot({path:`${out}/${kind}-${language}-${viewport.width}.png`});
    if(kind==='century'){
      for(const section of [0,1]) {
       await page.locator('.ng-century-tabs button').nth(section).click();
       for(const card of await page.locator('.ng-goal:visible,.ng-merchant-card:has(.ng-route-price):visible').all()) {
        for(const label of await card.locator('.ng-order-bonus,.ng-route-price,.ng-merchant-bonus').all()) {
          const text=(await label.innerText()).trim().replace(/\s+/g,' ');
          await expect(card).toHaveAccessibleName(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
        }
      }
      }
      if(viewport.width>600)assert(await page.locator('.ng-merchant-card').evaluateAll(cards=>cards.every(card=>card.getBoundingClientRect().width<270)),'A short hand retains card size instead of stretching into giant posters');
      const caravan=page.locator('.ng-panel').filter({has:page.locator('h3',{hasText:language==='zh'?'可用商人':'Available merchants'})});await caravan.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/century-hand-${language}-${viewport.width}.png`});
    }
   }
   console.log(`PASS painted cards ${language} ${viewport.width}×${viewport.height}: assets loaded, ranks/costs fit, no horizontal overflow`);
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);
} finally {await browser.close();}
