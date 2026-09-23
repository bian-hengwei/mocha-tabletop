import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',safari=process.env.TEST_BROWSER==='webkit',names=['梅林','UNO爱好者','同意','🌻'];
const browser=await(safari?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));await fs.mkdir('test-results/player-names',{recursive:true});
try{for(const language of ['en','zh']){
 const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(6000);await page.addInitScript(language=>localStorage.setItem('mocha-locale',language),language);
 const visit=async(kind,scenario='')=>page.goto(`${base}/tests/ui/player-names.fixture.html?kind=${kind}&scenario=${scenario}&lang=${language}`);
 await visit('werewolf','judge');await expect(page.locator('.judge-death-list b')).toHaveText(['UNO爱好者','同意','🌻','梅林'].join('、'));
 assert((await page.locator('.judge-last-check').innerText()).includes('同意'),'Seer target nickname remains unchanged');await page.screenshot({path:`test-results/player-names/${safari?'webkit':'chrome'}-${language}-judge.png`});
 await visit('avalon','identity');await page.locator('.identity-deck').click();
 await expect(page.locator('.identity-knowledge p').first()).toHaveText(names.join('、'));await expect(page.locator('.identity-knowledge small').nth(1)).toHaveText('梅林');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Player choices',exact:true}).click();await expect(page.locator('.choice span')).toHaveText([...names,'梅林',language==='en'?'Approve':'同意']);await page.keyboard.press('Escape');
 for(const [kind,selector]of [['gems','.merchant-head>b'],['bombs','.bt-seat b'],['sushi','.ng-player b'],['century','.ng-player b'],['uno','.ng-player b'],['codenames','.wg-member'],['undercover','.wg-odd-player strong']]){
  await visit(kind);if(kind==='bombs')await expect(page.locator('.bt-focus h2')).toHaveText('同意');const labels=await page.locator(selector).allTextContents();for(const name of names)assert(labels.some(label=>label.includes(name)),`${kind} preserves ${name}`);
 }
 // Structured scenarios use real legal engine actions, then the same indexed log renderer as App.
 for(const scenario of ['structured-avalon','structured-plans','structured-hosted'])for(const target of scenario==='structured-hosted'?[0,1]:[0]){
  await page.goto(`${base}/tests/ui/player-names.fixture.html?kind=${scenario==='structured-avalon'?'avalon':'werewolf'}&scenario=${scenario}&target=${target}`);
  const secrets=scenario==='structured-plans',expectedNames=scenario==='structured-hosted'?[['梅林；红队','{votes}'][target]]:['梅林；红队','{votes}'];
  for(const section of scenario==='structured-hosted'?['Public log','Private log']:[secrets?'Identity':'Public log']){
   const texts=[];
   for(let pass=0;pass<2;pass++){
    if(secrets)await page.locator('.identity-deck').click();else await page.getByRole('button',{name:section,exact:true}).click();
    const content=secrets?page.locator('.identity-knowledge'):page.locator('.game-log');const text=await content.innerText();texts.push(text);
    for(const name of expectedNames)assert(text.includes(name),`${scenario}/${section} preserves opaque nickname ${name}: ${text}`);
    const systemWord=scenario==='structured-avalon'?'赞成':secrets?'空刀':section==='Private log'?'刀口':'出局';
    assert.equal(text.includes(systemWord),(pass===0?language:language==='en'?'zh':'en')==='zh',`${scenario} changes system wording only`);
    await page.screenshot({path:`test-results/player-names/${safari?'webkit':'chrome'}-${language}-${scenario}-${target}-${pass}-${section.replaceAll(' ','-')}.png`});
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Toggle language',exact:true}).click();
   }
   assert.notEqual(texts[0],texts[1],'Locale switch translates the sentence around unchanged names');
  }
  if(scenario==='structured-hosted'){await page.getByRole('button',{name:'Switch viewer',exact:true}).click();await expect(page.getByRole('button',{name:'Private log',exact:true})).toHaveCount(0);}
  if(secrets){await page.getByRole('button',{name:'Switch viewer',exact:true}).click();await page.locator('.identity-deck').click();assert(!(await page.locator('.identity-story').innerText()).includes('空刀'));assert(!(await page.locator('.identity-story').innerText()).includes('No attack'));await page.keyboard.press('Escape');}
 }
 for(const name of names){
  await page.evaluate(name=>{localStorage.setItem('mocha-profile',JSON.stringify({id:'name-audit-profile',name,avatar:'🦊'}));localStorage.removeItem('mocha-practice-v1');},name);
  await page.goto(base);await expect(page.locator('.profile-chip span')).toHaveText(name);await page.locator('.cover-gems').click();await page.getByRole('button',{name:language==='zh'?'同屏试玩':'Pass & play',exact:true}).click();
  const merchant=page.locator('.g-merchant').first().getByRole('button');await expect(merchant).toHaveCount(1);assert((await merchant.getAttribute('aria-label')).includes(name),'Inventory opener accessible name preserves nickname');await merchant.focus();await page.keyboard.press('Enter');
  assert((await page.locator('.g-inventory').getAttribute('aria-label')).includes(name),`Inventory dialog ${language}/${name}: ${await page.locator('.g-inventory').getAttribute('aria-label')}`);assert((await page.locator('.g-inventory h2').textContent()).includes(name));
  await page.keyboard.press('Escape');await expect(merchant).toBeFocused();await page.screenshot({path:`test-results/player-names/${language}-profile-${names.indexOf(name)}.png`});
 }
 await page.screenshot({path:`test-results/player-names/${language}.png`});assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${language}: raw player names across seats, judge outcomes, secret knowledge, choices and real App inventory aria`);
}}finally{await browser.close();}
