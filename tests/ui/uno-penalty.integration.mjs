import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',out='test-results/uno-penalty';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
try{for(const locale of ['zh','en']){const context=await browser.newContext();await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);const page=await context.newPage();
 for(const penalty of [2,4])for(const [width,height]of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){
  await page.setViewportSize({width,height});await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=uno&scenario=penalty&penalty=${penalty}`);
  await page.getByRole('combobox',{name:'Seat'}).selectOption('english-player-1');
  const hand=page.locator('.ng-uno-hand .ng-uno-card');await expect(hand).toHaveCount(1);
  const accept=page.getByRole('button',{name:locale==='zh'?`接受 +${penalty}，抽牌并跳过`:penalty===4?'Accept +4 and skip your turn':'Accept +2, draw and skip',exact:true});await expect(accept).toBeVisible();
  const rect=await accept.boundingBox();assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${out}/${locale}-${penalty}-${width}.png`});await accept.click();await expect(hand).toHaveCount(1+penalty);await expect(accept).toHaveCount(0);
 }
 console.log(`PASS ${locale}: +2/+4 wait for target confirmation, seven sizes`);await context.close();}}finally{await browser.close();}
