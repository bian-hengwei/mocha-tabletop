import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const browser=await({chromium,webkit}[engine]).launch(),out=`test-results/header-controls/${engine}`;
await fs.mkdir(out,{recursive:true});
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({hasTouch:true});await context.addInitScript(locale=>{localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify({id:'header-control-player',name:'长昵称 Long player name',avatar:'🦊'}));},locale);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(base);
  for(const kind of ['doudizhu','guandan','mahjong','gems','bombs','werewolf','avalon','sushi','century','uno','codenames','undercover']){
   await page.setViewportSize({width:390,height:844});await page.locator(`.cover-${kind}`).click();await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();await page.locator('.game-surface').waitFor();
   for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){
    await page.setViewportSize({width,height});await page.screenshot({path:`${out}/${kind}-${locale}-${width}.png`});
    const controls=await page.locator('.top-tools button').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{label:el.getAttribute('aria-label'),x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
    assert(controls.every(r=>r.width>=44&&r.height>=44&&r.x>=0&&r.y>=0&&r.right<=width&&r.bottom<=height&&r.hit),`${engine} ${kind} ${locale} ${width}: visible, unobscured 44px header controls ${JSON.stringify(controls)}`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow');
   }
   await page.getByRole('button',{name:locale==='zh'?'牌桌菜单':'Table menu',exact:true}).click();await page.getByRole('button',{name:locale==='zh'?'结束试玩':'End practice',exact:true}).click();await expect(page.locator('.game-library')).toBeVisible();console.log(`PASS ${engine} ${locale} ${kind}: seven viewports and rotation, header controls visible and touchable`);
  }
  assert.deepEqual(errors,[]);await context.close();
 }
}finally{await browser.close();}
