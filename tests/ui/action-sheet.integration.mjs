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
  await page.locator('.choice').last().scrollIntoViewIfNeeded();assert(await page.locator('.choice').last().evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Last choice is horizontally reachable');
  await expect(page.locator('.action-sheet footer button')).toBeDisabled();await page.locator('.choice').nth(1).click();await expect(page.locator('.action-sheet footer button')).toBeEnabled();
  assert.match(await page.locator('.action-sheet footer').innerText(),/1–2/,'Allowed selection range is explicit');
  await page.setViewportSize({width:viewport.height,height:viewport.width});await expect(page.locator('.choice[aria-pressed=true]')).toHaveCount(1);await page.setViewportSize(viewport);
  await page.locator('.action-sheet footer button').click({trial:true});await page.screenshot({path:`test-results/action-sheet/${safari?'webkit':'chrome'}-${language}-${viewport.width}.png`});await page.keyboard.press('Escape');
  await visit('zero');assert.equal(await page.locator('.choices .choice').count(),0);await expect(page.locator('.action-sheet footer button')).toHaveText(language==='zh'?'自爆':'Reveal and leave');
  const text=await page.locator('.action-sheet').innerText();for(const redundant of ['你的决定','Your decision','确认后执行','Execute after confirming'])assert(!text.includes(redundant));
  await page.locator('.action-sheet footer button').click();assert.deepEqual(JSON.parse(await page.getByTestId('commands').textContent()),[{action:'explode',values:[]}]);
 }
 // Drive real stored practice states through the shared confirmation sheet.
 for(const scenario of ['undercover','guess','penalty']){
  await page.goto(`${base}/tests/ui/action-sheet.fixture.html`);
  await page.evaluate(async({scenario,language})=>{
   const {modules}=await import('/src/core/registry.ts');
   const players=Array.from({length:4},(_,i)=>({id:'action-word-player-'+i,name:['Mocha','梅林','红队','普通玩家'][i],avatar:['🦊','🐼','🐱','🐻'][i]}));
   const kind=scenario==='undercover'?'undercover':'codenames';let game,viewer=players[0].id;
   if(kind==='undercover'){
    game=modules[kind].create(players,1,{language:'zh'});for(const p of players)game=modules[kind].apply(game,p.id,{action:'ready',values:[]});
    while(game.phase==='describe')game=modules[kind].apply(game,players[game.order[game.speaker]].id,{action:'described',values:[]});
   }else{
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
  if(scenario==='undercover')await page.locator('.wg-odd-player').nth(1).click();
  else if(scenario==='penalty'){await page.locator('.wg-extra-actions button').first().click();await page.locator('.choice').filter({has:page.locator('span',{hasText:/^黄金$/})}).click();}
  else await (await findWordPage(page,page.locator('.wg-word').filter({has:page.locator('strong',{hasText:/^黄金$/})}))).click();
  await expect(page.locator('.choice.selected span')).toHaveText(scenario==='undercover'?'🐼 梅林':'黄金');
  await expect(page.locator('.action-sheet footer button')).toBeEnabled();await page.screenshot({path:`test-results/action-sheet/${safari?'webkit':'chrome'}-${language}-${scenario}-literal.png`});
  await page.locator('.action-sheet footer button').click();await expect(page.locator('.action-sheet')).toHaveCount(0);
 }
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${language}: current action constraints, invalid selection recovery, cancellation, range/zero-choice confirmation and seven-size rotation`);
}}finally{await browser.close();}
