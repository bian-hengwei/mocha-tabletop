import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit.launch():chromium.launch());
const out=`test-results/modern-word-packs-${engine}`;
await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
const games={codenames:'.wg-table',undercover:'.wg-table',drawguess:'.dg-table',drawrelay:'.relay-table'};
const errors=[];

async function freshPage(locale,width,height){
 const page=await browser.newPage({viewport:{width,height},isMobile:width<900,hasTouch:width<900});
 await page.addInitScript(({locale})=>{
  localStorage.clear();
  localStorage.setItem('mocha-locale',locale);
  localStorage.setItem('mocha-profile',JSON.stringify({id:`modern_${locale}`,name:'Mocha',avatar:'🦊'}));
 },{locale});
 page.on('pageerror',error=>errors.push(`${locale} ${width}x${height}: ${error.message}`));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(base);
 await expect(page.locator('.home-shell')).toBeVisible();
 return page;
}

try{
 for(const locale of ['zh','en'])for(const [width,height]of sizes){
  const page=await freshPage(locale,width,height),wordPack=page.getByRole('combobox',{name:locale==='zh'?'词包':'Word pack',exact:true});
  let firstGame=true;
  for(const [kind,selector]of Object.entries(games)){
   await page.locator(`.cover-${kind}`).click();
   await expect(wordPack).toBeVisible();
   await expect(wordPack).toHaveValue(firstGame?'classic':'modern');
   await wordPack.selectOption('modern');
   await expect(wordPack).toHaveValue('modern');
   await expect(page.locator('.word-language-note')).toContainText(locale==='zh'?'切换界面语言不会重发词语':'Changing the interface language does not redeal words');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${locale} ${kind} setup overflow ${width}x${height}`);
   await page.screenshot({path:`${out}/${locale}-${kind}-${width}x${height}-setup.png`});

   await page.setViewportSize({width:height,height:width});
   await expect(wordPack).toHaveValue('modern');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${locale} ${kind} rotated setup overflow`);
   await page.screenshot({path:`${out}/${locale}-${kind}-${width}x${height}-rotated-setup.png`});
   await page.setViewportSize({width,height});

   await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();
   await expect(page.locator(selector)).toBeVisible();
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')||'null')?.practice);
   assert.equal(saved?.kind,kind);
   assert.equal(saved?.options?.wordPack,'modern');
   assert.equal(saved?.game?.wordPack,'modern');
   assert.equal(saved?.game?.language,locale);
   await page.locator('.language-toggle').click();
   const stable=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')||'null')?.practice);
   assert.equal(stable?.game?.wordPack,'modern');
   assert.equal(stable?.game?.language,locale,'changing UI language must not redeal words');
   assert.equal(stable?.options?.language,locale,'changing UI language must not change the saved word language');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${locale} ${kind} game overflow ${width}x${height}`);
   await page.screenshot({path:`${out}/${locale}-${kind}-${width}x${height}-game.png`});

   const nextLocale=locale==='zh'?'en':'zh';
   await page.getByRole('button',{name:nextLocale==='zh'?'牌桌菜单':'Table menu'}).click();
   await page.getByRole('button',{name:nextLocale==='zh'?'结束试玩':'End practice'}).click();await page.getByRole('button',{name:nextLocale==='zh'?'结束当前游戏':'End current game',exact:true}).click();
   await expect(page.locator('.home-shell')).toBeVisible();
   await page.locator('.language-toggle').click();
   firstGame=false;
   console.log('PASS',locale,kind,`${width}x${height}`,'modern setup, rotation, start, stable language');
  }
  await page.close();
 }
 assert.deepEqual(errors,[],`browser errors:\n${errors.join('\n')}`);
 console.log(`PASS modern word packs ${engine}: 4 games, 2 languages, 7 viewports and rotation`);
}finally{await browser.close();}
