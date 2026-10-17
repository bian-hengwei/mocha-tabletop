import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch(),out=`test-results/sushi-copy-recovery-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
async function seed(page,locale,scenario){
 await page.goto(base+'/manifest-mocha.webmanifest');
 return page.evaluate(async({locale,scenario})=>{
  const {createPractice,writePractice,readPractice}=await import('/src/local/practice.ts');const {sushi}=await import('/src/core/games/sushi.ts');
  localStorage.clear();localStorage.setItem('mocha-locale',locale);const profile={id:'sushi-recovery-profile',name:'Morgan',avatar:'🦊'};localStorage.setItem('mocha-profile',JSON.stringify(profile));
  const specials=scenario==='copy'?['order','wasabi']:scenario==='bonus'?['spoon','chopsticks']:[scenario==='give'?'spoon':scenario,'tea'];
  const options={language:locale,sushiEdition:'party',sushiMenu:{roll:'maki',appetizers:['tempura','sashimi','dumpling'],specials,dessert:'pudding'}};
  const p=createPractice('sushi',3,profile,options,undefined,111),s=p.game;s.deck.push(...s.hands.flat());s.step=4;
  const take=kind=>{const i=s.deck.findIndex(card=>card.kind===kind);if(i<0)throw Error(kind);return s.deck.splice(i,1)[0];};
  s.table=[[],[],[]];if(['bonus','spoon','give','chopsticks'].includes(scenario))s.table[0].push(take(scenario==='chopsticks'?'chopsticks':'spoon'));if(scenario==='bonus')s.table[0].push(take('chopsticks'));
  if(scenario==='copy')s.table[0].push(take('salmon'),take('wasabi'));if(scenario==='takeout')s.table[0].push(take('salmon'),take('dumpling'));
  s.hands=[[take(scenario==='copy'?'order':['menu','takeout'].includes(scenario)?scenario:'tempura'),take('egg')],[take('tempura'),take('salmon')],[take('tempura'),take('salmon')]];
  if(!['copy','bonus'].includes(scenario)){
   if(['spoon','give','chopsticks'].includes(scenario))p.game=sushi.apply(p.game,p.players[0].id,{action:'sushi:bonus',values:[s.table[0][0].id]});
   for(let i=0;i<3;i++)p.game=sushi.apply(p.game,p.players[i].id,{action:'pick',values:[p.game.hands[i][0].id]});
   if(scenario==='give'){p.game=sushi.apply(p.game,p.players[0].id,{action:'sushi:spoon',values:['group:nigiri']});p.viewer=p.players[1].id;}
  }
  writePractice(p);if(!readPractice())throw Error(`Rejected ${scenario} recovery checkpoint`);
  return {viewer:p.viewer,phase:p.game.party.phase,copyTarget:p.game.party.copyTargets[0]};
 },{locale,scenario});
}
async function checkpoint(page){return page.evaluate(async()=>{const{readPractice,practiceView}=await import('/src/local/practice.ts');const p=readPractice();if(!p)throw Error('Recovery checkpoint rejected');return{view:practiceView(p),copy:p.game.party.copyTargets,bonus:p.game.party.bonus};});}
try{for(const locale of ['zh','en']){
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const label=(zh,en)=>locale==='zh'?zh:en;
 await seed(page,locale,'copy');await page.goto(base);const copy=page.locator('.ng-sushi-confirm').getByRole('button',{name:label('选择复制对象','Choose a card to copy'),exact:true});
 await copy.click();await page.locator('.action-sheet .choice').nth(1).click();await page.locator('.action-sheet footer button').click();const chosen=(await checkpoint(page)).copy[0];assert(chosen.startsWith('boost:'));
 await page.reload();await copy.click();const dialog=page.locator('.action-sheet'),selected=dialog.locator('.choice[aria-pressed="true"]'),confirm=dialog.locator('footer button');
 await expect(selected).toHaveCount(1);await expect(selected).toContainText(label('复制并使用芥末','Copy with Wasabi'));await expect(confirm).toBeEnabled();
 for(const [width,height] of sizes){await page.setViewportSize({width,height});const box=await confirm.boundingBox();assert(box&&box.width>=44&&box.height>=44&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);await expect(selected).toHaveCount(1);await expect(selected).toContainText(label('复制并使用芥末','Copy with Wasabi'));await page.screenshot({path:`${out}/${locale}-${width}x${height}-copy-restored.png`});}
 // Escape discards an unsent change; reopening restores the authority's previous choice.
 await dialog.locator('.choice').last().click();await page.keyboard.press('Escape');assert.equal((await checkpoint(page)).copy[0],chosen);await expect(copy).toBeFocused();await copy.click();await expect(selected).toContainText(label('复制并使用芥末','Copy with Wasabi'));await page.keyboard.press('Escape');
 const seats=page.locator('.practice-switch select');await seats.selectOption('practice-1');await expect(copy).toHaveCount(0);await expect(page.locator('.action-sheet')).toHaveCount(0);assert.equal((await checkpoint(page)).view.board.copyTarget,null);await seats.selectOption('practice-0');await copy.click();await expect(selected).toHaveCount(1);await expect(selected).toContainText(label('复制并使用芥末','Copy with Wasabi'));await page.keyboard.press('Escape');
 // Lock and refresh the Special order itself, then advance the step and verify the stored target clears.
 await page.locator('.ng-hand .ng-sushi-card').first().click();await page.locator('.ng-sushi-confirm button').last().click();await page.reload();assert.equal((await checkpoint(page)).view.board.selected.length,1);assert.equal((await checkpoint(page)).copy[0],chosen);
 for(const seat of [1,2]){await seats.selectOption(`practice-${seat}`);await page.locator('.ng-hand .ng-sushi-card').first().click();await page.locator('.ng-sushi-confirm button').last().click();}
 await seats.selectOption('practice-0');assert.equal((await checkpoint(page)).copy[0],null);await expect(copy).toHaveCount(0);
 // A stale restored target outside the fresh action choices must not remain selected.
 await seed(page,locale,'copy');await page.evaluate(async()=>{const {readPractice,writePractice}=await import('/src/local/practice.ts');const p=readPractice();if(!p)throw Error('Missing stale-target fixture');p.game.party.copyTargets[0]=p.game.deck.find(card=>card.kind==='tempura').id;writePractice(p);if(!readPractice())throw Error('Rejected stale-target fixture');});await page.goto(base);await copy.click();await expect(page.locator('.action-sheet .choice[aria-pressed="true"]')).toHaveCount(0);await expect(page.locator('.action-sheet footer button')).toBeDisabled();await page.keyboard.press('Escape');
 // Existing bonus selections also reopen from the owner's authoritative snapshot after reload.
 await seed(page,locale,'bonus');await page.goto(base);let trigger=page.locator('.ng-sushi-confirm button').first();await trigger.click();await page.locator('.action-sheet .choice').last().click();await page.locator('.action-sheet footer button').click();const bonus=(await checkpoint(page)).bonus[0];await page.reload();await trigger.click();await expect(page.locator('.action-sheet .choice[aria-pressed="true"]')).toHaveCount(1);await page.keyboard.press('Escape');assert.deepEqual((await checkpoint(page)).bonus[0],bonus);await page.locator('.practice-switch select').selectOption('practice-1');assert.deepEqual((await checkpoint(page)).view.board.bonus,[]);await page.locator('.practice-switch select').selectOption('practice-0');await trigger.click();await expect(page.locator('.action-sheet .choice[aria-pressed="true"]')).toHaveCount(1);await page.keyboard.press('Escape');
 // Pending effect options survive refresh. Only their actor receives private action choices.
 for(const scenario of ['menu','spoon','give','takeout','chopsticks']){
  const seeded=await seed(page,locale,scenario);await page.goto(base);const before=await checkpoint(page),action=before.view.actions[0];assert(action.id.startsWith('sushi:'));await page.locator('.ng-sushi-confirm button').first().click();await page.locator('.action-sheet .choice').first().click();await page.reload();const after=await checkpoint(page);assert.deepEqual(after.view,before.view,`${scenario}: authoritative options survive reload`);await expect(page.locator('.action-sheet')).toHaveCount(0);
  await page.locator('.practice-switch select').selectOption(seeded.viewer==='practice-0'?'practice-1':'practice-0');const other=await checkpoint(page);assert.equal(other.view.actions.length,0,`${scenario}: other actor has no private effect action`);assert.equal(other.view.board.copyTarget,null);await page.locator('.practice-switch select').selectOption(seeded.viewer);await page.locator('.ng-sushi-confirm button').first().click();await expect(page.locator('.action-sheet .choice[aria-pressed="true"]')).toHaveCount(0);await page.locator('.action-sheet .choice').first().click();await page.locator('.action-sheet footer button').click();assert((await checkpoint(page)).view.board.step>=before.view.board.step);await page.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${engine}/${locale}: Special order/bonus authority selection restore, eight sizes/focus/rotation, seat boundaries, lock/step cleanup, five pending effects reload and resume`);
}}finally{await browser.close();}
