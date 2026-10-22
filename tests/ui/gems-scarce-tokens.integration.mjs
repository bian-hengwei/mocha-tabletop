import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const out=`test-results/gems-scarce-tokens-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=process.env.TEST_VIEWPORT_SCOPE==='compact'?[[320,568],[568,320]]:[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];

async function seed(page,locale){
 await page.goto(base+'/manifest-mocha.webmanifest');
 return page.evaluate(async locale=>{
  const {createPractice,writePractice,readPractice}=await import('/src/local/practice.ts');
  const {gems}=await import('/src/core/games/gems.ts');
  localStorage.clear();localStorage.setItem('mocha-locale',locale);
  const profile={id:'gems-scarce-profile',name:'Morgan',avatar:'🦊'};localStorage.setItem('mocha-profile',JSON.stringify(profile));
  const practice=createPractice('gems',4,profile,{language:locale},undefined,47),state=practice.game;
  const initialSupply=state.bank.map((count,color)=>count+state.merchants.reduce((sum,merchant)=>sum+merchant.tokens[color],0));
  const target=[1,1,0,0,0,5];
  practice.game.bank.forEach((_,color)=>{for(let n=0;n<initialSupply[color]-target[color];n++){const seat=Array.from({length:4},(_,offset)=>(color+offset)%4).find(index=>practice.game.merchants[index].tokens.reduce((sum,value)=>sum+value,0)<(index===0?8:10));if(seat===undefined)throw Error('fixture token capacity exceeded');practice.game.merchants[seat].tokens[color]++;}});
  practice.game.bank=target;
  writePractice(practice);if(!readPractice())throw Error('Rejected conserved Gems checkpoint');
  const saved=readPractice().game,actualTotals=saved.bank.map((count,color)=>count+saved.merchants.reduce((sum,merchant)=>sum+merchant.tokens[color],0));
  return {initialSupply,actualTotals,cards:{deck:saved.decks.flat().length,market:saved.market.flat().length,reserved:saved.merchants.flatMap(merchant=>merchant.reserved).length},playersOverLimit:saved.merchants.filter(merchant=>merchant.tokens.reduce((a,b)=>a+b,0)>10).length};
 },locale);
}

async function checkpoint(page){return page.evaluate(async()=>{const {readPractice,practiceView}=await import('/src/local/practice.ts');const practice=readPractice();if(!practice)throw Error('Missing Gems checkpoint');return {game:practice.game,view:practiceView(practice)};});}

async function layout(page,width,height){
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}x${height}: no horizontal overflow`);
 const take=page.locator('.g-take .primary'),box=await take.boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'Take control remains reachable');
 const bank=await page.locator('.g-bank').boundingBox(),tray=await page.locator('.g-own-tray').boundingBox();assert(bank&&tray&&bank.y+bank.height<=tray.y+1,'bank does not overlap inventory');
}

try{
 for(const locale of ['zh','en'])for(const [width,height]of sizes){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const seeded=await seed(page,locale);assert.deepEqual(seeded.initialSupply,[7,7,7,7,7,5]);assert.deepEqual(seeded.actualTotals,seeded.initialSupply);assert.deepEqual(seeded.cards,{deck:78,market:12,reserved:0});assert.equal(seeded.playersOverLimit,0);
  await page.goto(base);await expect(page.locator('.g-table')).toBeVisible();
  const gems=page.locator('.g-bank-gem'),take=page.locator('.g-take .primary');
  const initial=await checkpoint(page),nextName=initial.view.board.players[1].name,initialMine=initial.game.merchants[0].tokens;
  await expect(take).toBeDisabled();await expect(take).toHaveAccessibleName(locale==='zh'?'选择宝石: 取 1–2 色，各 1 枚':'Choose gems: 1-2 colors, 1 token each');
  await gems.nth(0).click();await expect(take).toBeEnabled();await expect(take).toHaveText(locale==='zh'?'拿取 1':'Take 1');await layout(page,width,height);await page.screenshot({path:`${out}/${locale}-${width}x${height}-one-selected.png`});
  await page.getByRole('button',{name:locale==='zh'?'清空宝石选择':'Clear gem selection',exact:true}).click();await expect(take).toBeDisabled();
  await gems.nth(0).click();await take.click();await expect.poll(async()=>{const saved=await checkpoint(page);return {current:saved.game.current,viewCurrent:saved.view.board.current};}).toEqual({current:1,viewCurrent:'practice-1'});await page.screenshot({path:`${out}/${locale}-${width}x${height}-after-action.png`});await expect(page.locator('.g-merchant.active')).toContainText(nextName);await expect(take).toBeDisabled();
  const afterOne=(await checkpoint(page)).game;assert.deepEqual(afterOne.bank,[0,1,0,0,0,5]);assert.deepEqual(afterOne.merchants[0].tokens,[initialMine[0]+1,...initialMine.slice(1)]);assert.equal(afterOne.current,1);assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS one-token ${engine}/${locale}/${width}x${height}: choose, clear, confirm and turn transition`);
 }
 for(const locale of ['zh','en'])for(const [width,height]of [[320,568],[568,320]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await seed(page,locale);await page.goto(base);await expect(page.locator('.g-table')).toBeVisible();
  const initialMine=(await checkpoint(page)).game.merchants[0].tokens, gems=page.locator('.g-bank-gem'),take=page.locator('.g-take .primary');await gems.nth(0).click();await gems.nth(1).click();await expect(take).toHaveText(locale==='zh'?'拿取 2':'Take 2');await layout(page,width,height);await page.screenshot({path:`${out}/${locale}-${width}x${height}-two-selected.png`});await take.click();
  const afterTwo=(await checkpoint(page)).game;assert.deepEqual(afterTwo.bank,[0,0,0,0,0,5]);assert.deepEqual(afterTwo.merchants[0].tokens,[initialMine[0]+1,initialMine[1]+1,...initialMine.slice(2)]);assert.equal(afterTwo.current,1);assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS two-token ${engine}/${locale}/${width}x${height}: confirmed both available colors`);
 }
}finally{await browser.close();}
