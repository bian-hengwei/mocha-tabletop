import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',safari=process.env.TEST_BROWSER==='webkit';
const browser=await(safari?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/table-layout-${safari?'webkit':'chromium'}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
try{for(const locale of ['zh','en']){
 const context=await browser.newContext();await context.addInitScript(locale=>{localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify({id:'layout-test',name:'Long player name for table testing',avatar:'🦊'}));},locale);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=dense&mode=bloodflow`);
 for(const [width,height] of sizes){await page.setViewportSize({width,height});
  const box=await page.evaluate(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2,width:b.width,height:b.height};};return{top:r('.seat-across'),left:r('.seat-left'),right:r('.seat-right'),north:r('.river-across'),south:r('.river-self'),west:r('.river-left'),east:r('.river-right'),center:r('.mj-center')};});
  assert(box.top.y<box.left.y&&box.top.y<box.right.y,'opposite player is above side players');
  assert(box.left.x<box.center.x&&box.right.x>box.center.x,'side players face each other');
  assert(box.north.y<box.center.y&&box.south.y>box.center.y,'opposite and own rivers bracket the center');
  assert(box.west.x<box.center.x&&box.east.x>box.center.x,'side rivers bracket the center');
  assert.equal(await page.locator('.mj-opponents .mj-face:not(.mj-back)').count(),0,'opponent racks never contain faces');
  assert.equal(await page.locator('.mj-rack').count(),3);
  await expect(page.locator('.mj-river-grid .mj-face')).toHaveCount(48);
  await page.screenshot({path:`${out}/${locale}-mahjong-${width}.png`});
 }
 const winds=await page.locator('.mj-compass span').allTextContents();await page.getByRole('combobox',{name:'Seat',exact:true}).selectOption('1');
 const rotated=await page.locator('.mj-compass span').allTextContents();assert.notDeepEqual(rotated,winds,'wind labels follow the selected seat');
 await expect(page.locator('.seat-across b')).toContainText('Drew');await expect(page.locator('.mj-seat.self')).toContainText(locale==='zh'?'南':'South');
 await page.goto(base);await page.locator('.cover-doudizhu').click();await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();
 await page.getByRole('button',{name:locale==='zh'?'叫分 1':'Bid 1',exact:true}).click();await expect(page.locator('.seat-self .seat-call')).toHaveText(locale==='zh'?'叫分 1':'Bid 1');
 const seats=page.getByRole('combobox',{name:/切换试玩座位|Switch practice seat/});await seats.selectOption('practice-1');await page.getByRole('button',{name:locale==='zh'?'叫分 3':'Bid 3',exact:true}).click();
 const card=page.locator('.classic-hand .classic-card').first();await card.click();await page.locator('.classic-controls .primary').click();await expect(page.locator('.poker-play-area')).toHaveClass(/play-self/);
 await seats.selectOption('practice-2');await expect(page.locator('.poker-play-area')).toHaveClass(/play-left/);await page.getByRole('button',{name:locale==='zh'?'不出':'Pass',exact:true}).click();await expect(page.locator('.poker-seat-play.play-self .played-caption>span').first()).toHaveText(locale==='zh'?'不出':'Pass');
 await seats.selectOption('practice-0');await expect(page.locator('.poker-play-area')).toHaveClass(/play-right/);
 for(const [width,height]of sizes){await page.setViewportSize({width,height});await expect(page.locator('.played .classic-face')).toHaveCount(1);const played=await page.locator('.played .classic-face').boundingBox(),arena=await page.locator('.classic-arena').boundingBox();assert(played.x+played.width/2>arena.x+arena.width/2,'right opponent’s card is on the right half of the table');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/${locale}-doudizhu-${width}.png`});}
 assert.deepEqual(errors,[]);console.log(`PASS ${locale}: four-direction rivers and seats, seat-relative compass, backs-only racks, bids, passes, relative played cards, eight viewports`);await context.close();
}}finally{await browser.close();}
