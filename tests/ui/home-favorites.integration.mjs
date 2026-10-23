import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5393';
const engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
const out=`test-results/home-favorites-${engine}`;
await fs.mkdir(out,{recursive:true});
const errors=[];

async function setup(locale,width,height,{saved=false,rawFavorites=null,denyWrites=false}={}){
 const context=await browser.newContext({viewport:{width,height}});
 await context.routeWebSocket('**/api/rooms/**',()=>{});
 await context.addInitScript(({locale,saved,rawFavorites,denyWrites})=>{
  if(!localStorage.getItem('mocha-library-test-init')){localStorage.clear();sessionStorage.clear();const profile={id:'library-favorites-review',name:'Library收藏LongNam',avatar:'🦊'};localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-library-test-init','1');if(rawFavorites!==null)localStorage.setItem('mocha-library-favorites-v1',rawFavorites);if(saved)sessionStorage.setItem('mocha-room-session',JSON.stringify({profile,code:'ABC234',token:'a'.repeat(48),savedAt:Date.now(),expiresAt:Date.now()+3600000}));}
  if(denyWrites)Storage.prototype.setItem=function(){throw new DOMException('Denied','SecurityError')};
 },{locale,saved,rawFavorites,denyWrites});
 const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(`${locale} ${width}x${height}: ${error.message}`));page.on('dialog',dialog=>dialog.accept());
 await page.goto(base);await expect(page.locator('.home-shell')).toBeVisible();
 if(saved){await page.locator('.connecting-overlay>button').click();await expect(page.locator('.resume-session')).toBeVisible();}
 return {context,page};
}

const cardKinds=page=>page.locator('.game-cover').evaluateAll(nodes=>nodes.map(node=>node.className.match(/cover-(\w+)/)[1]));

try{
 for(const locale of ['zh','en'])for(const [width,height]of sizes){
  const {context,page}=await setup(locale,width,height);
  const cards=page.locator('.game-cover'),filter=page.locator('.library-favorite-filter'),players=page.getByRole('combobox',{name:locale==='zh'?'玩家人数':'Players',exact:true});
  await expect(cards).toHaveCount(14);await expect(page.locator('.game-favorite')).toHaveCount(14);await expect(filter).toHaveAttribute('aria-pressed','false');
  assert.equal(await page.locator('button button').count(),0,'Favorite controls must not be nested in game buttons');
  const geometry=await page.locator('.game-entry').evaluateAll(entries=>entries.map(entry=>{const box=entry.getBoundingClientRect(),cover=entry.querySelector('.game-cover').getBoundingClientRect(),title=entry.querySelector('.cover-caption strong').getBoundingClientRect();return {boxWidth:box.width,coverWidth:cover.width,titleWidth:title.width};}));
  assert(geometry.every(item=>item.boxWidth>=100&&item.coverWidth>=item.boxWidth-1&&item.titleWidth>=24),`Missing game-card geometry at ${locale} ${width}x${height}: ${JSON.stringify(geometry[0])}`);
  for(const box of await page.locator('.game-favorite,.library-favorite-filter').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height};})))assert(box.width>=44&&box.height>=44,`Favorite target below 44px at ${locale} ${width}x${height}`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`Page overflow at ${locale} ${width}x${height}`);
  await page.screenshot({path:`${out}/${locale}-${width}x${height}-catalog.png`});

  const gems=page.locator('.game-entry:has(.cover-gems) .game-favorite'),codenames=page.locator('.game-entry:has(.cover-codenames) .game-favorite');
  await gems.focus();await page.keyboard.press('Space');await expect(gems).toHaveAttribute('aria-pressed','true');await expect(page.locator('.setup-panel')).toHaveCount(0);
  await codenames.focus();await page.keyboard.press('Enter');await expect(codenames).toHaveAttribute('aria-pressed','true');await expect(page.locator('.setup-panel')).toHaveCount(0);
  await filter.focus();await page.keyboard.press('Enter');await expect(filter).toHaveAttribute('aria-pressed','true');await expect(cards).toHaveCount(2);assert.deepEqual(await cardKinds(page),['gems','codenames']);
  const filteredGeometry=await page.evaluate(()=>{const library=document.querySelector('.game-library').getBoundingClientRect(),first=document.querySelector('.game-cover').getBoundingClientRect();return {libraryTop:library.top,firstTop:first.top,firstBottom:first.bottom,libraryBottom:library.bottom};});
  assert(filteredGeometry.firstTop>=filteredGeometry.libraryTop-1&&filteredGeometry.firstBottom<=filteredGeometry.libraryBottom+1,`First favorite clipped at ${locale} ${width}x${height}`);
  await page.screenshot({path:`${out}/${locale}-${width}x${height}-favorites.png`});
  await players.selectOption('8');await expect(cards).toHaveCount(1);assert.deepEqual(await cardKinds(page),['codenames']);
  await page.screenshot({path:`${out}/${locale}-${width}x${height}-filtered.png`});
  await players.selectOption('18');await expect(cards).toHaveCount(0);await expect(page.locator('.library-empty')).toBeVisible();await expect(page.getByRole('button',{name:locale==='zh'?'查看全部人数':'Show all player counts',exact:true})).toBeVisible();
  await page.screenshot({path:`${out}/${locale}-${width}x${height}-empty.png`});
  await page.getByRole('button',{name:locale==='zh'?'查看全部人数':'Show all player counts',exact:true}).click();await expect(cards).toHaveCount(2);await expect(players).toHaveValue('');
  await page.locator('.game-entry:has(.cover-codenames) .game-favorite').click();await expect(cards).toHaveCount(1);await page.locator('.game-entry:has(.cover-gems) .game-favorite').click();await expect(cards).toHaveCount(0);
  await page.locator('.library-empty .text-button').click();await expect(cards).toHaveCount(14);await expect(filter).toHaveAttribute('aria-pressed','false');
  await page.locator('.game-entry:has(.cover-gems) .game-favorite').focus();await page.keyboard.press('Space');await expect(page.locator('.game-entry:has(.cover-gems) .game-favorite')).toHaveAttribute('aria-pressed','true');
  await page.reload();await expect(cards).toHaveCount(14);await expect(page.locator('.game-entry:has(.cover-gems) .game-favorite')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('combobox',{name:locale==='zh'?'玩家人数':'Players',exact:true})).toBeVisible();
  if(locale==='zh'&&width===320){await filter.click();await page.setViewportSize({width:height,height:width});await expect(filter).toHaveAttribute('aria-pressed','true');await expect(cards).toHaveCount(1);await page.screenshot({path:`${out}/zh-rotation-${width}x${height}.png`});}
  await context.close();
  console.log('PASS favorites',locale,width,height);
 }

 for(const locale of ['zh','en'])for(const [width,height]of [[390,844],[568,320]]){
  const {context,page}=await setup(locale,width,height,{saved:true});
  await page.locator('.game-entry:has(.cover-gems) .game-favorite').click();await page.locator('.library-favorite-filter').click();await expect(page.locator('.game-cover')).toHaveCount(1);await expect(page.locator('.resume-session')).toBeVisible();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`${out}/${locale}-${width}x${height}-resume-favorites.png`});await context.close();
 }

 {
  const {context,page}=await setup('en',390,844,{rawFavorites:JSON.stringify(['gems','unknown-game',7,'gems'])});
  await expect(page.locator('.game-cover')).toHaveCount(14);await expect(page.locator('.game-entry:has(.cover-gems) .game-favorite')).toHaveAttribute('aria-pressed','true');await context.close();
 }
 {
  const {context,page}=await setup('en',390,844,{denyWrites:true});
  await page.locator('.game-entry:has(.cover-gems) .game-favorite').click();await expect(page.locator('.game-entry:has(.cover-gems) .game-favorite')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.toast')).toContainText('Favorites could not be saved');await context.close();
 }
 {
  const {context,page}=await setup('zh',390,844);
  await page.locator('.game-entry:has(.cover-gems) .game-favorite').click();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('mocha-library-favorites-v1'))).not.toBeNull();
  await page.getByRole('button',{name:'修改昵称头像'}).click();await page.getByRole('button',{name:'重置本机用户、收藏与战绩'}).click();await page.getByPlaceholder('你的昵称').waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('mocha-library-favorites-v1')),null,'App reset must clear local favorites');await context.close();
 }
 assert.deepEqual(errors,[]);console.log(`PASS home favorites ${engine}, ${sizes.length*2*4} bilingual matrix screenshots plus rotation/resume captures, keyboard, filters, empty recovery, reload and storage boundaries`);
}finally{await browser.close();}
