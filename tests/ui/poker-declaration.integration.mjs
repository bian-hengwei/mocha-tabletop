import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=`test-results/poker-declaration-${process.env.TEST_BROWSER||'chromium'}`;await fs.mkdir(out,{recursive:true});
const base=process.env.BASE_URL||'http://127.0.0.1:5174';const browser=await(process.env.TEST_BROWSER==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
try{for(const locale of ['zh','en']){const context=await browser.newContext({viewport:{width:320,height:568}});await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);const page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));for(const declared of [false,true]){await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=guandan&scenario=declare`);const cards=page.locator('.classic-hand .classic-card');for(let i=0;i<5;i++)await cards.nth(i).click();const select=page.getByRole('combobox',{name:locale==='zh'?'出牌牌型':'Declare combination'});await expect(select).toHaveValue('同花顺:9:5:11');if(declared)await select.selectOption('顺子:9:5:0');await page.locator('.classic-controls .primary').click();await expect(page.locator('.classic-felt')).toContainText(locale==='zh'?(declared?'顺子':'同花顺'):(declared?'Straight':'Straight flush'));await expect(cards).toHaveCount(1);
await expect(page.locator('.played-caption span')).toHaveText(`${locale==='zh'?(declared?'顺子':'同花顺'):(declared?'Straight':'Straight flush')} · 9`);
for(const[width,height]of[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]]){
 await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert(await page.locator('.played-caption').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1;}),'declared combination caption stays readable');
 await page.screenshot({path:`${out}/${locale}-${declared?'straight':'flush'}-${width}.png`});
}}assert.deepEqual(errors,[]);console.log(`PASS ${locale}: strongest default and explicit weaker Guan Dan declaration through UI`);await context.close();}}finally{await browser.close();}
