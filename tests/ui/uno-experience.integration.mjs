import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',safari=process.env.TEST_BROWSER==='webkit';
const browser=await(safari?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/uno-experience-${safari?'webkit':'chromium'}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
try{for(const locale of ['zh','en']){
 const context=await browser.newContext({hasTouch:true,viewport:{width:390,height:844}});await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const begin=async(scenario='selection',extra='')=>{await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=uno&scenario=${scenario}${extra}`);await page.locator('.ng-uno').waitFor();};
 const hand=page.locator('.ng-uno-hand .ng-uno-card'),play=page.locator('.ng-uno-play'),colors=page.locator('.ng-uno-colors button');
 const fits=async()=>{
  const r=await page.evaluate(()=>{const hand=document.querySelector('.ng-uno-hand'),bar=document.querySelector('.ng-uno-playbar'),surface=document.querySelector('.game-surface'),bounds=el=>el.getBoundingClientRect().toJSON();return{width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,surfaceScroll:surface.scrollHeight-surface.clientHeight,rack:bounds(hand),rackOverflow:hand.scrollHeight-hand.clientHeight,bar:bar?bounds(bar):null,top:bounds(document.querySelector('.ng-uno-center .ng-uno-card')),overview:bounds(document.querySelector('.ng-uno-overview')),ys:[...hand.children].map(el=>Math.round(el.offsetTop)),buttons:[...document.querySelectorAll('.ng-uno-playbar button')].map(bounds)};});
  assert(!r.overflow,JSON.stringify(r));assert(r.surfaceScroll<=1,'no vertical game surface scrolling');assert(r.rackOverflow<=1,'hand scrolls horizontally only');assert(new Set(r.ys).size===1,'all cards in a single row');
  if(await page.locator('.ng-challenge').count()===0&&await page.locator('.ng-heading').count()===0)assert(r.top.y>=r.overview.y&&r.top.bottom<=r.overview.bottom+1,'current discard stays visible '+JSON.stringify(r));
  assert(r.rack.y>=0&&r.rack.bottom<=r.height+1);assert(!r.bar||r.bar.bottom<=r.height+1);
  assert(r.buttons.every(b=>b.x>=0&&b.right<=r.width+1&&b.y>=0&&b.bottom<=r.height+1&&b.width>=44&&b.height>=44),'reachable 44px actions '+JSON.stringify(r));
 };
 for(const [width,height]of sizes){await page.setViewportSize({width,height});await begin('long-hand','&players=10');await expect(hand).toHaveCount(28);await fits();await hand.last().scrollIntoViewIfNeeded();await fits();await page.screenshot({path:`${out}/${locale}-rack-${width}.png`});
  await hand.nth(3).click();await expect(colors).toHaveCount(4);await fits();await page.screenshot({path:`${out}/${locale}-wild-${width}.png`});
 }
 await begin();await hand.nth(0).dblclick();await expect(hand).toHaveCount(4);await expect(page.locator('.ng-uno-center .ng-uno-card')).toHaveAttribute('aria-label',locale==='zh'?'红色 7':'Red 7');
 await begin();await hand.nth(0).tap();await hand.nth(0).tap();await expect(hand).toHaveCount(4);
 await begin();await hand.nth(0).tap();await hand.nth(1).tap();await expect(hand).toHaveCount(5);await expect(hand.nth(1)).toHaveAttribute('aria-pressed','true');
 await begin();await hand.nth(0).tap();await page.waitForTimeout(400);await hand.nth(0).tap();await expect(hand.nth(0)).toHaveAttribute('aria-pressed','false');await expect(hand).toHaveCount(5);
 await begin();await hand.nth(3).dblclick();await expect(hand).toHaveCount(5);await expect(colors).toHaveCount(4);await expect(play).toBeDisabled();await colors.nth(3).click();await play.click();await expect(hand).toHaveCount(4);await expect(page.locator('.ng-color-badge')).toHaveText(locale==='zh'?'蓝色':'Blue');
 await begin();await hand.nth(4).tap();await hand.nth(4).tap();await expect(colors).toHaveCount(4);await expect(hand).toHaveCount(5);
 await begin();await hand.nth(0).focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');await expect(hand).toHaveCount(5);await expect(play).toBeDisabled();
 await begin();await hand.nth(3).click();await page.setViewportSize({width:390,height:844});await expect(colors).toHaveCount(4);await fits();await page.setViewportSize({width:844,height:390});await fits();await expect(hand.nth(3)).toHaveAttribute('aria-pressed','true');
 await page.getByRole('combobox',{name:'Seat'}).selectOption('english-player-1');await expect(page.locator('.ng-uno-selected')).toHaveCount(0);await expect(colors).toHaveCount(0);
 await begin('no-match');await expect(play).toHaveCount(0);await fits();await page.locator('.ng-uno-play-actions button').click();await fits();
 await begin('challenge');await expect(page.locator('.ng-challenge')).toBeVisible();await page.getByRole('button',{name:locale==='zh'?'看完了，继续':'Done reviewing · Continue',exact:true}).click();
 assert.deepEqual(errors,[]);console.log(`PASS ${locale}: single-row 28-card rack, 10 players, eight sizes, 44px controls, double-click/tap, wild color choice, keyboard, seat reset, rotation, draw and challenge`);await context.close();
}}finally{await browser.close();}
