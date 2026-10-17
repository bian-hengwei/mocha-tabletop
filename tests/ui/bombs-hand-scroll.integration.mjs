import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const engine=process.env.TEST_BROWSER||'chromium',base=process.env.BASE_URL||'http://127.0.0.1:5174';
const browser=await(engine==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/bombs-hand-scroll-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
const locales=(process.env.TEST_LOCALES||'zh,en').split(',').map(value=>value.trim()).filter(Boolean);
const results=[];

try{
 for(const locale of locales){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  await context.addInitScript(l=>localStorage.setItem('mocha-locale',l),locale);
  const page=await context.newPage();page.setDefaultTimeout(6000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});
   await page.goto(`${base}/tests/ui/bombs-viewport.fixture.html?scenario=selected`);
   const hand=page.locator('.bt-hand'),cue=page.locator('.bt-hand-scroll-cue');
   await expect(hand.locator('.bt-card')).toHaveCount(11);
   const measure=async()=>hand.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,left:el.scrollLeft}));
   const expectCue=async()=>{
    const size=await measure(),overflow=size.scroll>size.client+2;
    if(overflow){
     await expect(cue).toHaveCount(1);
     await expect(cue).toHaveText(locale==='zh'?'↔ 左右滑动':'↔ Swipe');
     await expect(cue).toBeVisible();
    }else await expect(cue).toHaveCount(0);
    return {...size,overflow};
   };
   const initial=await expectCue();
   const attack=page.locator('.bt-hand .bt-card').filter({hasText:locale==='zh'?'攻击':'Attack'}).first();
   await attack.click();
   await expect(attack).toHaveClass(/bt-selected/);
   await expectCue();
   const clear=page.locator('.bt-hand-label button');
   await expect(clear).toHaveCount(1);
   const clearSize=await clear.evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,bottom:r.bottom,viewport:innerHeight};});
   assert(clearSize.width>=44&&clearSize.height>=44&&clearSize.bottom<=height+1,`${locale} ${width}x${height} clear target ${JSON.stringify(clearSize)}`);
   const header=await page.locator('.bt-hand-label').evaluate(el=>{
    const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const children=[...el.children].filter(n=>getComputedStyle(n).display!=='none');
    const parent=rect(el),items=children.map(rect);
    const overlaps=(a,b)=>a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;
    const cue=el.querySelector('.bt-hand-scroll-cue');
    return {parent,items,inside:items.every(r=>r.left>=parent.left-1&&r.right<=parent.right+1),nonzero:items.every(r=>r.width>0&&r.height>0),nonoverlap:items.every((r,i)=>items.slice(0,i).every(previous=>!overlaps(previous,r))),cueFont:cue?getComputedStyle(cue).fontSize:null,clearHit:(()=>{const clear=el.querySelector('button');if(!clear)return null;const r=clear.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return clear.contains(hit);})()};
   });
   assert(header.inside&&header.nonzero&&header.nonoverlap&&header.clearHit&&(!header.cueFont||parseFloat(header.cueFont)>=9),`${locale} ${width}x${height} hand label layout ${JSON.stringify(header)}`);
   await page.screenshot({path:`${out}/${locale}-${width}x${height}-selected.png`,animations:'disabled'});
   await clear.click();
   await expect(page.locator('.bt-hand .bt-selected')).toHaveCount(0);
   await expectCue();

   if(initial.overflow){
    const bounds=await hand.boundingBox();assert(bounds,`${locale} ${width} hand bounds`);
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    for(let i=0;i<5;i++){
     await page.mouse.wheel(500,0);await page.waitForTimeout(30);
     const position=await measure();if(position.left>=position.scroll-position.client-2)break;
    }
    await expect.poll(async()=> (await measure()).left).toBeGreaterThan(0);
    const last=hand.locator('.bt-card').last(),lastBox=await last.boundingBox();
    assert(lastBox&&lastBox.x>=bounds.x-1&&lastBox.x+lastBox.width<=bounds.x+bounds.width+1,`${locale} ${width} last card fits after scroll: ${JSON.stringify({bounds,lastBox})}`);
    await last.click();await expect(last).toHaveClass(/bt-selected/);
    if(width===568||width===390)await page.screenshot({path:`${out}/${locale}-${width}x${height}-last-selected.png`,animations:'disabled'});
    for(let i=0;i<5;i++){
     await page.mouse.wheel(-500,0);await page.waitForTimeout(30);
     if((await measure()).left<=1)break;
    }
    await expect.poll(async()=> (await measure()).left).toBeLessThanOrEqual(1);
    await expect(last).toHaveClass(/bt-selected/);
    await page.getByRole('combobox',{name:'Seat'}).selectOption('p1');
    await expect(page.locator('.bt-hand .bt-selected')).toHaveCount(0);
   }

   await page.getByRole('combobox',{name:'Seat'}).selectOption('spectator');
   await expect(hand).toHaveCount(0);await expect(cue).toHaveCount(0);
   await page.getByRole('combobox',{name:'Seat'}).selectOption('p0');
   await expect(hand.locator('.bt-card')).toHaveCount(11);await expectCue();

   await page.setViewportSize({width:1440,height:900});
   await expect.poll(async()=>{const state=await measure();return state.scroll-state.client;}).toBeLessThanOrEqual(2);
   await expect(cue).toHaveCount(0);
   await page.setViewportSize({width,height});
   const resized=await expectCue();
   results.push({locale,viewport:`${width}x${height}`,initial,clearSize,resized});
   console.log(`PASS Bombs hand cue ${locale} ${width}x${height}`);
  }
  assert.deepEqual(errors,[],`${locale} browser errors`);
  await context.close();
 }
}finally{await browser.close();}

await fs.writeFile(`${out}/results.json`,JSON.stringify({base,engine,results},null,2));
console.log(JSON.stringify({base,engine,results},null,2));
