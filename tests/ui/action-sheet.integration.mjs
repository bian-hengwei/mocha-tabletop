import {findWordPage} from './word-test-pages.mjs';
import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',safari=process.env.TEST_BROWSER==='webkit';
const browser=await(safari?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));await fs.mkdir('test-results/action-sheet',{recursive:true});
const sizes=[{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:932,height:430},{width:768,height:1024},{width:1440,height:900}];
try{for(const language of ['zh','en']){
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);await page.addInitScript(language=>localStorage.setItem('mocha-locale',language),language);
 const visit=async(scenario='')=>{await page.goto(`${base}/tests/ui/action-sheet.fixture.html?scenario=${scenario}`);await page.locator('.dock-actions button').click();};
 const update=kind=>page.evaluate(kind=>window.dispatchEvent(new CustomEvent('action-update',{detail:kind})),kind);
 await page.setViewportSize(sizes[3]);await visit();await page.locator('.choice').nth(0).click();await page.locator('.choice').nth(1).click();await update('shrink');
 await page.screenshot({path:`test-results/action-sheet/stale-${language}.png`});
 await expect(page.locator('.sheet-heading h2')).toHaveText(language==='zh'?'选择 1 名队员':'Choose 1 team members');
 await expect(page.locator('.choice[aria-pressed=true]')).toHaveCount(1);await expect(page.locator('.action-sheet footer button')).toBeEnabled();await page.locator('.action-sheet footer button').click();
 assert.deepEqual(JSON.parse(await page.getByTestId('commands').textContent()),[{action:'propose',values:['player-1']}]);
 await visit();await page.locator('.choice').nth(0).click();await page.locator('.choice').nth(1).click();await page.locator('.choice').nth(2).click();await page.locator('.action-sheet footer button').click();await expect(page.locator('.error')).toBeVisible();await page.locator('.choice').nth(0).click();await expect(page.locator('.error')).toHaveCount(0);await page.keyboard.press('Escape');assert.equal(await page.getByTestId('commands').textContent(),'[]');
 await visit();await update('remove');await expect(page.locator('.action-sheet')).toHaveCount(0);assert.equal(await page.getByTestId('commands').textContent(),'[]');
 for(const viewport of sizes){
  await page.setViewportSize(viewport);await visit('range');
  const vertical=await page.locator('.action-sheet').evaluate(sheet=>[sheet,...sheet.querySelectorAll('*')].filter(n=>n instanceof HTMLElement&&n.clientHeight>0&&n.scrollHeight>n.clientHeight+2&&['auto','scroll','hidden'].includes(getComputedStyle(n).overflowY)).map(n=>n.className));assert.deepEqual(vertical,[],'Gameplay choices never require vertical scrolling or clipped content');
  const next=page.getByRole('button',{name:language==='zh'?'下一组选项':'Next choices',exact:true}),previous=page.getByRole('button',{name:language==='zh'?'上一组选项':'Previous choices',exact:true});
  if(viewport.height<=500){
  await expect(next).toBeVisible();await expect(previous).toBeDisabled();
  const settleChoiceScroll=()=>expect.poll(()=>page.locator('.choices').evaluate(element=>{
   const buttons=document.querySelectorAll('.choice-paging button');
   return buttons[0].disabled===(element.scrollLeft<=4)&&buttons[1].disabled===(element.scrollLeft+element.clientWidth>=element.scrollWidth-4);
  })).toBe(true);
  for(let step=0;step<10&&await next.isEnabled();step++){await next.click();await settleChoiceScroll();}
  await expect(next).toBeDisabled();await expect(page.locator('.choice').last()).toBeInViewport({ratio:1});
  const arrow=await previous.boundingBox();assert(arrow.width>=44&&arrow.height>=44,'Choice paging has touch-sized controls');
  assert((await page.locator('.action-sheet footer button').boundingBox()).height>=44,'Confirmation has a touch-sized target');
  await page.screenshot({path:`test-results/action-sheet/${safari?'webkit':'chrome'}-${language}-${viewport.width}-last-choices.png`});
  for(let step=0;step<10&&await previous.isEnabled();step++){await previous.click();await settleChoiceScroll();}
  await expect(previous).toBeDisabled();
  }else{
   await expect(page.locator('.choice')).toHaveCount(10);
   for(const choice of await page.locator('.choice').all())await expect(choice).toBeInViewport({ratio:1});
   await expect(next).toHaveCount(0);
   await page.screenshot({path:`test-results/action-sheet/${safari?'webkit':'chrome'}-${language}-${viewport.width}-all-players.png`});
  }

  await expect(page.locator('.action-sheet footer button')).toBeDisabled();await page.locator('.choice').nth(1).click();await expect(page.locator('.action-sheet footer button')).toBeEnabled();
  assert.match(await page.locator('.action-sheet footer').innerText(),/1–2/,'Allowed selection range is explicit');
  await page.setViewportSize({width:viewport.height,height:viewport.width});await expect(page.locator('.choice[aria-pressed=true]')).toHaveCount(1);await page.setViewportSize(viewport);
  await page.locator('.action-sheet footer button').click({trial:true});await page.screenshot({path:`test-results/action-sheet/${safari?'webkit':'chrome'}-${language}-${viewport.width}.png`});await page.keyboard.press('Escape');
  await visit('zero');assert.equal(await page.locator('.choices .choice').count(),0);await expect(page.locator('.action-sheet footer button')).toHaveText(language==='zh'?'自爆':'Reveal and leave');
  const text=await page.locator('.action-sheet').innerText();for(const redundant of ['你的决定','Your decision','确认后执行','Execute after confirming'])assert(!text.includes(redundant));
  await page.locator('.action-sheet footer button').click();assert.deepEqual(JSON.parse(await page.getByTestId('commands').textContent()),[{action:'explode',values:[]}]);
 }
 // A single-pick confirmation shows the chosen word on its own card, keeps it after a
 // rejected submit, and can be dismissed without acting.
 await visit('confirm');await page.locator('.choice').first().click();
 await expect(page.locator('.action-sheet .confirm-word')).toHaveText('黄金');
 await expect(page.locator('.action-sheet .choices')).toHaveCount(0);
 await expect(page.locator('.action-sheet footer button')).toBeFocused();
 await page.locator('.action-sheet footer button').click();
 await expect(page.locator('.action-sheet .error')).toBeVisible();
 await expect(page.locator('.action-sheet .confirm-word')).toHaveText('黄金');
 await page.screenshot({path:`test-results/action-sheet/${safari?'webkit':'chrome'}-${language}-confirm-rejected.png`});
 await page.locator('.action-sheet .confirm-back').click();await expect(page.locator('.action-sheet')).toHaveCount(0);
 assert.deepEqual(JSON.parse(await page.getByTestId('commands').textContent()),[]);
 // Drive real stored practice states through the shared confirmation sheet.
 const openCodenames=async scenario=>{
  await page.goto(`${base}/tests/ui/action-sheet.fixture.html`);
  await page.evaluate(async({scenario,language})=>{
   const {modules}=await import('/src/core/registry.ts');
   const players=Array.from({length:4},(_,i)=>({id:'action-word-player-'+i,name:['Mocha','梅林','红队','普通玩家'][i],avatar:['🦊','🐼','🐱','🐻'][i]}));
   const kind='codenames';let game,viewer=players[0].id;
   {
    for(let seed=1;seed<=500;seed++){
     game=modules[kind].create(players,seed,{language:'zh'});if(!game.cards.some(c=>c.word==='黄金'))continue;
     const captain=game.captains[game.turn==='red'?0:1];game=modules[kind].apply(game,captain,{action:'clue',values:['1'],text:'缤纷世界'});
     if(scenario==='penalty'){game=modules[kind].apply(game,captain,{action:'invalid_clue',values:[]});viewer=game.captains[game.turn==='red'?0:1];}
     else viewer=players.find((p,i)=>game.teams[i]===game.turn&&!game.captains.includes(p.id)).id;
     if(modules[kind].view(game,viewer).actions.some(a=>a.choices.some(c=>c.title==='黄金')))break;
    }
   }
   localStorage.setItem('mocha-locale',language);localStorage.setItem('mocha-profile',JSON.stringify(players[0]));localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice:{id:crypto.randomUUID(),kind,players,game,viewer,options:{language:'zh'}}}));
  },{scenario,language});await page.goto(base);
 };
 const pickBoardWord=async()=>{
  const word=page.locator('.wg-word').filter({has:page.locator('strong',{hasText:/^黄金$/})});
  await (await findWordPage(page,word)).click();
  return word;
 };
 for(const scenario of ['guess','penalty']){
  await openCodenames(scenario);
  if(scenario==='penalty'){await page.locator('.wg-extra-actions button').first().click();await page.locator('.choice').filter({has:page.locator('span',{hasText:/^黄金$/})}).click();}
  else await pickBoardWord();
  if(scenario==='guess'){
   // A guess shows the picked word on its own card instead of repeating the whole board.
   await expect(page.locator('.action-sheet .confirm-word')).toHaveText('黄金');
   await expect(page.locator('.action-sheet .choices')).toHaveCount(0);
   await expect(page.locator('.action-sheet footer button')).toHaveCount(1);
   await expect(page.locator('.action-sheet .confirm-back')).toHaveText(language==='zh'?'返回牌桌另选':'Back to board to pick another');
  }else{
   await expect(page.locator('.choice.selected span')).toHaveText('黄金');
   await expect(page.locator('.action-sheet .confirm-word')).toHaveCount(0);
  }
  await expect(page.locator('.action-sheet footer button')).toBeEnabled();await page.screenshot({path:`test-results/action-sheet/${safari?'webkit':'chrome'}-${language}-${scenario}-literal.png`});
  await page.locator('.action-sheet footer button').click();await expect(page.locator('.action-sheet')).toHaveCount(0);
 }
 // Cancelling the guess sheet closes it and hands focus back to the board word that opened it.
 await openCodenames('guess');const word=await pickBoardWord();
 await expect(page.locator('.action-sheet .confirm-word')).toHaveText('黄金');
 await page.keyboard.press('Escape');await expect(page.locator('.action-sheet')).toHaveCount(0);
 await expect(word).toBeFocused();
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${language}: current action constraints, invalid selection recovery, cancellation, range/zero-choice confirmation and seven-size rotation`);
}}finally{await browser.close();}
