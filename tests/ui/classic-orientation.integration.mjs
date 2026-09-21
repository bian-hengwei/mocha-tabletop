import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',safari=process.env.TEST_BROWSER==='webkit';
const browser=await(safari?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/classic-orientation-${safari?'webkit':'chromium'}`;await fs.mkdir(out,{recursive:true});
const viewports=[{width:320,height:568},{width:390,height:844},{width:568,height:320},{width:844,height:390},{width:1280,height:800},{width:430,height:932},{width:932,height:430},{width:768,height:1024},{width:1440,height:900}];
async function fits(page){
 const vertical=await page.locator('.game-surface, .game-surface *').evaluateAll(xs=>xs.filter(x=>x.clientHeight>0&&x.scrollHeight>x.clientHeight+2&&['auto','scroll'].includes(getComputedStyle(x).overflowY)).map(x=>({class:x.className,height:x.clientHeight,scrollHeight:x.scrollHeight})));assert.deepEqual(vertical,[],`playing surface needs no vertical scrolling at ${JSON.stringify(page.viewportSize())}`);
 const result=await page.evaluate(()=>{const rack=document.querySelector('.classic-hand-scroll').getBoundingClientRect();const controls=[...document.querySelectorAll('.classic-controls button')].map(e=>({text:e.textContent,...Object.fromEntries(['x','y','width','height','right','bottom'].map(k=>[k,e.getBoundingClientRect()[k]]))}));return{width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,rack:{x:rack.x,y:rack.y,right:rack.right,bottom:rack.bottom},controls};});
 assert(!result.overflow,'no horizontal page overflow');assert(result.rack.x>=0&&result.rack.right<=result.width&&result.rack.y>=0&&result.rack.bottom<=result.height+1,'hand rack stays on screen: '+JSON.stringify(result));
 assert(result.controls.every(c=>c.x>=0&&c.right<=result.width+1&&c.y>=0&&c.bottom<=result.height+1&&c.width>=44&&c.height>=44),'all primary actions visible and touchable: '+JSON.stringify(result));
 assert.equal(await page.locator('.classic-hand .classic-card-art').count(),await page.locator('.classic-hand .classic-card').count(),'every card uses complete SVG artwork');
 if(await page.locator('.game-table-guandan').count()){
  const obscured=await page.locator('.classic-arena').evaluate(arena=>{
   const seats=[...arena.querySelectorAll('.classic-seat')].map(e=>e.getBoundingClientRect());
   const hits=[];
   for(const node of arena.querySelectorAll('.table-prompt,.played-caption,.classic-team-levels')){
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
     const text=walker.currentNode;if(!text.textContent.trim())continue;
     const range=document.createRange();range.selectNodeContents(text);
     for(const r of range.getClientRects())if(seats.some(s=>Math.min(s.right,r.right)>Math.max(s.left,r.left)+1&&Math.min(s.bottom,r.bottom)>Math.max(s.top,r.top)+1))hits.push(text.textContent.trim());
    }
   }
   for(const card of arena.querySelectorAll('.played .classic-face')){
    const r=card.getBoundingClientRect(),rail=card.closest('.played-scroll').getBoundingClientRect();
    const left=Math.max(r.left,rail.left),right=Math.min(r.right,rail.right);
    if(right>left&&seats.some(s=>Math.min(s.right,right)>Math.max(s.left,left)+1&&Math.min(s.bottom,r.bottom)>Math.max(s.top,r.top)+1))hits.push('played card');
   }
   return hits;
  });
  assert.deepEqual(obscured,[],'Guan Dan seats must not cover prompts, played cards, captions or team levels');
 }

}
try{for(const locale of ['zh','en'])for(const [kind,mode]of [['doudizhu'],['guandan'],['mahjong','guangdong'],['mahjong','sichuan'],['mahjong','bloodflow'],['mahjong','laizi']]){
 const context=await browser.newContext({viewport:viewports[0]});await context.addInitScript(locale=>{localStorage.setItem('mocha-profile',JSON.stringify({id:'orientation-test',name:'Mocha',avatar:'🐶'}));localStorage.setItem('mocha-locale',locale);},locale);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('.cover-'+kind).click();if(mode)await page.locator('.rule-options select').selectOption(mode);await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();await page.locator('.classic-table').waitFor();if(kind==='doudizhu')await page.getByRole('button',{name:locale==='zh'?'叫分 3':'Bid 3',exact:true}).click();
 for(const viewport of viewports){await page.setViewportSize(viewport);await fits(page);const last=page.locator('.classic-hand .classic-card:not(:disabled)').last();await last.scrollIntoViewIfNeeded();await last.click();await expect(last).toHaveAttribute('aria-pressed','true');await fits(page);await page.screenshot({path:`${out}/${locale}-${kind}-${mode||'classic'}-${viewport.width}.png`});await last.click();}
 const last=page.locator('.classic-hand .classic-card:not(:disabled)').last();await last.click();const name=await last.getAttribute('aria-label');await page.setViewportSize(viewports[1]);await expect(page.getByRole('button',{name,exact:true}).last()).toHaveAttribute('aria-pressed','true');await page.setViewportSize(viewports[3]);await expect(page.getByRole('button',{name,exact:true}).last()).toHaveAttribute('aria-pressed','true');await fits(page);
 if(kind==='guandan'){
  await page.getByRole('button',{name:locale==='zh'?'清空选择':'Clear selection',exact:true}).click();
  await page.locator('.classic-hand .classic-card').first().click();await page.locator('.classic-controls .primary').click();
  await expect(page.locator('.played-caption')).toBeVisible();
  const switcher=page.getByRole('combobox',{name:locale==='zh'?'切换试玩座位':'Switch practice seat'});
  const next=await switcher.locator('option').evaluateAll(xs=>xs.find(x=>/待操作|Your action/.test(x.textContent))?.value);
  assert(next,'Next player remains identifiable in the practice selector');await switcher.selectOption(next);
  for(const viewport of viewports){await page.setViewportSize(viewport);await fits(page);await page.screenshot({path:`${out}/${locale}-guandan-played-${viewport.width}.png`});}
 }
 assert.deepEqual(errors,[]);console.log(`PASS ${locale} ${kind}/${mode||'classic'}: nine viewports, SVG artwork, scroll to last card, 44px targets and selection across rotation`);await context.close();
}}finally{await browser.close();}
