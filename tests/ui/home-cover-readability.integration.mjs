import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch(),out=`test-results/home-cover-readability-${engine}`;
await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
try{for(const locale of ['zh','en'])for(const [width,height]of sizes)for(const saved of [false,true]){
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await context.routeWebSocket('**/api/rooms/**',()=>{});
 await page.addInitScript(({locale,saved})=>{
  localStorage.clear();const profile={id:'home_visual_fixture',name:'Mocha',avatar:'🦊'};
  localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale',locale);
  if(saved)sessionStorage.setItem('mocha-room-session',JSON.stringify({profile,code:'ABC234',token:'a'.repeat(48),savedAt:Date.now(),expiresAt:Date.now()+3600000}));
 },{locale,saved});
 await page.goto(base);if(saved){await page.locator('.connecting-overlay>button').click();await expect(page.locator('.resume-session')).toBeVisible();}
 const library=page.locator('.home-shell .game-library'),cards=library.locator('.game-cover');await expect(cards).toHaveCount(14);
 const checkRects=()=>page.evaluate(()=>{
  const rect=n=>n.getBoundingClientRect(),inside=(a,b)=>a.x>=b.x-1&&a.y>=b.y-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1;
  const library=document.querySelector('.home-shell .game-library'),bounds=rect(library),first=rect(library.querySelector('.game-cover'));
  if(first.height>bounds.height+1)throw Error(`No whole first card: ${first.height}/${bounds.height}`);
  for(const card of library.querySelectorAll('.game-cover')){
   const caption=card.querySelector('.cover-caption'),title=caption.querySelector('strong'),count=caption.querySelector('small'),art=card.querySelector(':scope>img,:scope>.cover-painting');
   if(!inside(rect(title),rect(caption))||!inside(rect(count),rect(caption)))throw Error('Clipped card title/count: '+title.textContent);
   if(title.scrollWidth>title.clientWidth+1||title.scrollHeight>title.clientHeight+1)throw Error('Clipped name: '+title.textContent);
   const a=rect(art),c=rect(caption),overlap=Math.max(0,Math.min(a.right,c.right)-Math.max(a.x,c.x))*Math.max(0,Math.min(a.bottom,c.bottom)-Math.max(a.y,c.y));
   if(overlap>1)throw Error('Art and caption overlap: '+title.textContent);
   if(parseFloat(getComputedStyle(title).fontSize)<16)throw Error('Small game title');
  }
  const controls=[...document.querySelectorAll('.home-entry-actions button,.home-footer button,.resume-session button')];
  for(const control of controls){const r=rect(control);if(r.width<43||r.height<43||r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1)throw Error('Unreachable control: '+control.textContent);}
  const footer=[...document.querySelectorAll('.home-footer button')].map(rect);if(footer.length===2&&footer[0].right>footer[1].left+1&&footer[0].bottom>footer[1].top+1)throw Error('Overlapping footer controls');
  if(document.documentElement.scrollWidth>innerWidth+1)throw Error('Page width overflow');
 });
 await checkRects();await page.screenshot({path:`${out}/${locale}-${width}x${height}${saved?'-resume':''}.png`});
 // Real selection, dialog rotation and focus restoration for every cover.
 for(let i=0;i<14;i++){
  const card=cards.nth(i);await card.scrollIntoViewIfNeeded();await card.click();await expect(page.locator('.setup-panel')).toBeVisible();
  if(i===13){await page.setViewportSize({width:height,height:width});await expect(page.locator('.setup-panel>header button')).toBeInViewport();await page.setViewportSize({width,height});}
  await page.keyboard.press('Escape');await expect(card).toBeFocused();
 }
 await cards.first().scrollIntoViewIfNeeded();await checkRects();
 await page.locator('.home-entry-actions button').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.home-entry-actions button').first()).toBeFocused();
 await page.locator('.home-footer .install-button').click();await expect(page.locator('.install-panel')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.home-footer .install-button')).toBeFocused();
 await page.locator('.home-footer .text-button').click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.home-footer .text-button')).toBeFocused();
 assert.deepEqual(errors,[]);await context.close();console.log('PASS',engine,locale,width,height,saved?'resume':'clean','14 covers, caption geometry, touch, navigation, dialogs and focus');
}}finally{await browser.close();}
