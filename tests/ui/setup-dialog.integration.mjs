import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const out=`test-results/setup-dialog-${engine}`;await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
const games=['doudizhu','guandan','mahjong','gems','bombs','sushi','century','uno'];
async function reachable(control){
 assert(await control.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>=44&&r.height>=44&&r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&el.contains(hit);}), '44px close control remains visible and can be tapped');
}
try{
 for(const locale of ['zh','en'])for(const [width,height]of sizes){
  const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(locale=>{localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify({id:'setup-dialog-test',name:'Morgan',avatar:'🦊'}));},locale);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  for(const game of games){
   await page.locator('.cover-'+game).click();
   const modes=page.locator('.mode-picker button');await modes.nth(1).click();await expect(modes.nth(1)).toHaveAttribute('aria-pressed','true');await expect(modes.nth(0)).toHaveAttribute('aria-pressed','false');
   await page.locator('.setup-rules').click();
   const rules=page.locator('.app-modal').filter({has:page.locator('.rule-guide')}),body=rules.locator(':scope > .modal-body'),close=rules.locator(':scope > header .icon');
   await rules.getByRole('tab',{name:locale==='zh'?'完整规则':'Full rules',exact:true}).click();
   await body.evaluate(el=>el.scrollTop=el.scrollHeight);await reachable(close);
   await page.screenshot({path:`${out}/${game}-${locale}-${width}x${height}-bottom.png`});
   await page.setViewportSize({width:height,height:width});await reachable(close);
   await close.click();await expect(rules).toHaveCount(0);await expect(page.locator('.setup-rules')).toBeFocused();
   await page.setViewportSize({width,height});await page.locator('.setup-rules').click();
   await page.keyboard.press('Escape');await expect(page.locator('.setup-rules')).toBeFocused();await page.keyboard.press('Escape');
   await expect(page.locator('.app-modal')).toHaveCount(0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS setup dialogs ${locale} ${width}x${height}: eight games, scroll, close, rotate, nested focus and mode selection`);
 }
}finally{await browser.close();}
