import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch(),out=`test-results/sushi-party-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]],errors=[];
async function seed(page,locale,scenario){
 await page.goto(base+'/manifest-mocha.webmanifest');
 await page.evaluate(async({locale,scenario})=>{
  const {createPractice,writePractice,readPractice}=await import('/src/local/practice.ts');const {sushi}=await import('/src/core/games/sushi.ts');
  localStorage.clear();localStorage.setItem('mocha-locale',locale);const profile={id:'party-ui-player',name:'Morgan',avatar:'🦊'};localStorage.setItem('mocha-profile',JSON.stringify(profile));
  const specials=scenario==='copy'?['order','wasabi']:scenario==='bonus'?['spoon','chopsticks']:[scenario==='give'?'spoon':scenario,'tea'];
  const menu={roll:'maki',appetizers:['tempura','sashimi','dumpling'],specials,dessert:'pudding'};
  const p=createPractice('sushi',3,profile,{language:locale,sushiEdition:'party',sushiMenu:menu}),s=p.game;s.deck.push(...s.hands.flat());s.step=4;
  const take=k=>{const i=s.deck.findIndex(c=>c.kind===k);if(i<0)throw Error(k);return s.deck.splice(i,1)[0];};
  s.table=[[],[],[]];if(['bonus','spoon','give','chopsticks'].includes(scenario))s.table[0].push(take(scenario==='chopsticks'?'chopsticks':'spoon'));if(scenario==='bonus')s.table[0].push(take('chopsticks'));
  if(scenario==='copy')s.table[0].push(take('salmon'),take('wasabi'));if(scenario==='takeout')s.table[0].push(take('salmon'),take('dumpling'));
  const main=['copy','menu','takeout'].includes(scenario)?(scenario==='copy'?'order':scenario):'tempura';
  s.hands=[[take(main),take('egg')],[take('tempura'),take('salmon')],[take('tempura'),take('salmon')]];
  if(!['bonus','copy'].includes(scenario)){
   if(['spoon','give','chopsticks'].includes(scenario))p.game=sushi.apply(p.game,p.players[0].id,{action:'sushi:bonus',values:[s.table[0][0].id]});
   for(let i=0;i<3;i++)p.game=sushi.apply(p.game,p.players[i].id,{action:'pick',values:[p.game.hands[i][0].id]});
   if(scenario==='give'){p.game=sushi.apply(p.game,p.players[0].id,{action:'sushi:spoon',values:['group:nigiri']});p.viewer=p.players[1].id;}
  }
  writePractice(p);if(!readPractice())throw Error(`Rejected ${scenario} checkpoint`);
 },{locale,scenario});
 await page.goto(base);await expect(page.locator('.ng-sushi')).toBeVisible();
}
try{for(const locale of ['zh','en'])for(const [width,height]of sizes){
 const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/manifest-mocha.webmanifest');await page.evaluate(locale=>{localStorage.clear();localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify({id:'party-setup',name:'Morgan',avatar:'🦊'}));},locale);await page.goto(base);
 await page.locator('.cover-sushi').click();await page.locator('.sushi-menu-options>label>select').first().selectOption('party');
 const fields=page.locator('.sushi-menu-options select');await expect(fields).toHaveCount(8);
 await fields.nth(1).selectOption('uramaki');await fields.nth(2).selectOption('onigiri');await fields.nth(3).selectOption('tofu');await fields.nth(4).selectOption('miso');await fields.nth(5).selectOption('spoon');await fields.nth(6).selectOption('takeout');await fields.nth(7).selectOption('fruit');
 const count=page.locator('.local-play-fields select').first();await count.selectOption('8');await expect(fields.nth(5).locator('option[value="order"]')).toHaveJSProperty('disabled',true);await expect(fields.nth(2).locator('option[value="tofu"]')).toHaveJSProperty('disabled',true);
 await page.screenshot({path:`${out}/${locale}-${width}x${height}-setup.png`});await page.locator('.local-play-actions button').first().click();await expect(page.locator('.sushi-players button')).toHaveCount(8);await expect(page.locator('.ng-hand .ng-sushi-card')).toHaveCount(7);
 for(const scenario of ['bonus','copy','menu','spoon','give','takeout','chopsticks']){
  await seed(page,locale,scenario);const buttons=page.locator('.ng-sushi-confirm button'),trigger=buttons.first();await trigger.click();const dialog=page.locator('.action-sheet');await expect(dialog).toBeVisible();
  const choices=dialog.locator('.choice'),confirm=dialog.locator('footer button');if(scenario!=='takeout'&&scenario!=='bonus')await expect(confirm).toBeDisabled();
  if(scenario==='copy')await expect(choices).toHaveCount(3);if(scenario==='bonus')await expect(choices).toHaveCount(2);
  await choices.first().click();await choices.last().click();if(await choices.count()===1)await choices.first().click();
  // Single-select dialogs replace a previous choice; Takeout intentionally permits several.
  if(scenario!=='takeout')await expect(dialog.locator('.choice[aria-pressed="true"]')).toHaveCount(1);
  if(locale==='en')assert(!/[\u3400-\u9fff]/u.test(await dialog.innerText()),`${scenario} English dialog`);
  await page.screenshot({path:`${out}/${locale}-${width}x${height}-${scenario}.png`});
  await page.setViewportSize({width:height,height:width});assert(await confirm.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth;}));await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await page.setViewportSize({width,height});
  await trigger.click();await choices.first().click();await confirm.click();await expect(dialog).toHaveCount(0);
  assert(await page.evaluate(async()=>{const {readPractice}=await import('/src/local/practice.ts');return !!readPractice();}),'Action preserves a valid checkpoint');
 }
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.close();console.log('PASS Party',locale,width,height,'setup, menu restrictions, all special dialogs, rotation, focus, command and restore');
}assert.deepEqual(errors,[]);}finally{await browser.close();}
