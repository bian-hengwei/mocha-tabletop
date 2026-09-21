import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',safari=process.env.TEST_BROWSER==='webkit';
const browser=await(safari?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/mahjong-experience-${safari?'webkit':'chromium'}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
try{for(const locale of ['zh','en']){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const begin=async(mode='guangdong')=>{await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=quick&mode=${mode}`);await page.locator('.classic-table').waitFor();};
 const rack=page.locator('.classic-hand'),last=()=>rack.locator('button').last();
 const discards=()=>page.locator('.river-self .river .classic-face');
 const checkTurn=async()=>{await expect(discards()).toHaveCount(1);await expect(page.locator('.classic-seat.current')).toContainText('Blair');await expect(page.getByRole('button',{name:locale==='zh'?'过':'Pass',exact:true})).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);};
 for(const [width,height] of sizes){await page.setViewportSize({width,height});await begin();const overflow=await page.locator('.classic-hand-scroll').evaluate(e=>e.scrollWidth>e.clientWidth+2);if(overflow)await expect(page.locator('.hand-scroll-cue')).toBeVisible();else await expect(page.locator('.hand-scroll-cue')).toHaveCount(0);await last().scrollIntoViewIfNeeded();
  await last().click();await expect(last()).toHaveAttribute('aria-pressed','true');await expect(discards()).toHaveCount(0);
  await page.screenshot({path:`${out}/${locale}-${width}.png`});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await last().dblclick();await checkTurn();
 }
 await begin();let tiles=rack.locator('button');await tiles.nth(0).tap();await tiles.nth(1).tap();await expect(discards()).toHaveCount(0);await expect(tiles.nth(1)).toHaveAttribute('aria-pressed','true');
 await begin();await last().tap();await last().tap();await checkTurn();
 await begin();await last().tap();await page.waitForTimeout(400);await last().tap();await expect(last()).toHaveAttribute('aria-pressed','false');await expect(discards()).toHaveCount(0);
 await begin();await last().focus();await page.keyboard.press('Enter');await expect(last()).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Enter');await expect(last()).toHaveAttribute('aria-pressed','false');await expect(discards()).toHaveCount(0);
 await begin();await last().click();await page.setViewportSize({width:844,height:390});await expect(last()).toHaveAttribute('aria-pressed','true');await page.locator('.classic-controls .primary').click();await checkTurn();
 await begin('sichuan');await rack.locator('button').first().dblclick({force:true});await expect(discards()).toHaveCount(0);await last().dblclick();await checkTurn();
 await page.goto(`${base}/tests/ui/classic.fixture.html?scenario=claims`);await page.getByRole('button',{name:locale==='zh'?'7万':'7 Characters',exact:true}).first().dblclick();
 await page.getByRole('combobox',{name:'Seat'}).selectOption('3');await expect(page.getByRole('button',{name:locale==='zh'?'过':'Pass',exact:true})).toHaveCount(0);
 await page.getByRole('combobox',{name:'Seat'}).selectOption('1');await expect(page.getByRole('button',{name:locale==='zh'?'胡牌':'Win',exact:true})).toBeVisible();
 await page.reload();await page.getByRole('combobox',{name:'Seat'}).selectOption('1');await expect(rack.locator('button[aria-pressed="true"]')).toHaveCount(0);
 assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${locale}: seven sizes, mouse double-click, touch double-tap, slow deselect, different tiles, keyboard, rotation, confirm, missing suit and manual winning decisions`);
}}finally{await browser.close();}
