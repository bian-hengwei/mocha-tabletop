import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const browser=await chromium.launch(),out='test-results/codenames-random-teams-chromium';
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
await fs.mkdir(out,{recursive:true});

function readTeams(page){
 return page.locator('.wg-team').evaluateAll(teams=>teams.map(team=>({
  color:team.classList.contains('wg-red')?'red':'blue',
  members:[...team.querySelectorAll('.wg-member')].map(member=>({name:member.textContent.trim(),captain:!!member.querySelector('svg')}))
 })));
}
function words(page){return page.locator('.wg-word strong').allTextContents();}
async function checkOption(page,locale,stage){
 const option=page.getByRole('switch');
 await expect(option).toHaveAccessibleName(locale==='zh'?'随机分队与队长':'Random teams and captains');
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});await option.locator('..').scrollIntoViewIfNeeded();
  const box=await option.locator('..').boundingBox();
  assert(box&&box.width>=44&&box.height>=44&&box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=height+1,`${stage}: reachable switch at ${width}x${height}`);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${stage}: no page overflow`);
  await page.screenshot({path:`${out}/${locale}-${stage}-${width}x${height}.png`});
 }
 await page.setViewportSize({width:390,height:844});
}
async function newPlayer(locale,index,errors){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(({locale,index,id})=>{
  if(!localStorage.getItem('mocha-locale'))localStorage.setItem('mocha-locale',locale);
  if(!localStorage.getItem('mocha-profile'))localStorage.setItem('mocha-profile',JSON.stringify({id,name:`Player ${index} longABC`,avatar:'🦊'}));
 },{locale,index,id:crypto.randomUUID()});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 await page.goto(base);
 return {context,page};
}
async function leave(host){
 await host.locator('.topbar .brand button').click();
 await host.locator('.menu-list button').last().click();
 await host.locator('.cover-codenames').waitFor();
}

try{
 for(const locale of ['zh','en']){
  const contexts=[],pages=[],errors=[];
  let created=false;
  try{
   for(let index=0;index<4;index++){
    const player=await newPlayer(locale,index,errors);contexts.push(player.context);pages.push(player.page);
   }
   const host=pages[0],guests=pages.slice(1);
   await host.locator('.cover-codenames').click();
   const randomSwitch=host.getByRole('switch');
   await expect(randomSwitch).not.toBeChecked();
   await randomSwitch.focus();await host.keyboard.press('Space');await expect(randomSwitch).toBeChecked();
   await checkOption(host,locale,'setup');
   await host.locator('.mode-picker button:nth-child(2)').click();
   await host.locator('.create-body footer button.primary').click();
   await host.locator('.room-code').waitFor();created=true;
   const code=(await host.locator('.room-code').textContent()).trim();
   for(const guest of guests){
    await guest.locator('.home-entry-actions button').first().click();
    await guest.getByRole('textbox',{name:locale==='zh'?'房间码':'Room code',exact:true}).fill(code);
    await guest.getByRole('button',{name:locale==='zh'?'入桌':'Join',exact:true}).click();
    await host.locator('.join-requests button.approve').first().click();
    await guest.locator('.lobby').waitFor();
    await expect(guest.getByRole('switch')).toBeDisabled();await expect(guest.getByRole('switch')).toBeChecked();
   }
   await checkOption(host,locale,'lobby');
   const start=host.locator('.lobby-start button.primary');
   for(const guest of guests)await guest.locator('.lobby-start button.primary').click();
   await expect(start).toBeEnabled();
   await randomSwitch.click();await expect(randomSwitch).not.toBeChecked();await expect(start).toBeDisabled();
   for(const guest of guests){
    await expect(guest.locator('.lobby-start button.primary')).toHaveText(locale==='zh'?'准备好了':'Ready');
    await expect(guest.getByRole('switch')).not.toBeChecked();
   }
   await randomSwitch.click();await expect(randomSwitch).toBeChecked();
   for(const guest of guests)await guest.locator('.lobby-start button.primary').click();
   await expect(start).toBeEnabled();await start.click();
   for(const page of pages)await page.locator('.wg-table').waitFor();
   const assignments=await readTeams(host),boardWords=await words(host);
   assert.equal(assignments.length,2);assert(assignments.every(team=>team.members.length===2));
   assert(assignments.every(team=>team.members.filter(member=>member.captain).length===1));
   assert.deepEqual(assignments.flatMap(team=>team.members.map(member=>member.name)).sort(),Array.from({length:4},(_,i)=>`🦊 Player ${i} longABC`).sort());
   for(const page of pages){
    assert.deepEqual(await readTeams(page),assignments);await expect(page.getByRole('switch')).toHaveCount(0);
   }
   const captain=await (async()=>{for(const page of pages)if(await page.locator('.wg-clue-form').count())return page;throw Error('No active captain');})();
   const clue=(locale==='zh'?['月光','旅程','和谐']:['Moonlight','Journey','Harmony']).find(word=>!boardWords.includes(word));
   await captain.locator('.wg-clue-form input').fill(clue);await captain.locator('.wg-clue-form button[type="submit"]').click();
   await expect(captain.locator('.wg-clue-form')).toHaveCount(0);
   for(const page of pages)assert.deepEqual(await readTeams(page),assignments);
   await host.locator('.language-toggle').click();assert.deepEqual(await readTeams(host),assignments);assert.deepEqual(await words(host),boardWords);
   await host.reload();await host.locator('.wg-table').waitFor();
   await expect(host.locator('.language-toggle')).toHaveText(locale==='zh'?'中文':'English');
   assert.deepEqual(await readTeams(host),assignments);assert.deepEqual(await words(host),boardWords);
   await host.locator('.language-toggle').click();
   for(const [width,height] of [[390,844],[844,390]]){
    await host.setViewportSize({width,height});await host.screenshot({path:`${out}/${locale}-started-${width}x${height}.png`});
   }
   await guests[0].reload();await guests[0].locator('.wg-table').waitFor();assert.deepEqual(await readTeams(guests[0]),assignments);
   await leave(host);created=false;
   for(const count of [7,12]){
    await host.locator('.cover-codenames').click();await expect(host.getByRole('switch')).not.toBeChecked();await host.getByRole('switch').check();
    await host.locator('.local-play-fields select').selectOption(String(count));
    await host.locator('.local-play-actions button').click();await host.locator('.wg-table').waitFor();
    const practice=await host.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice);
    assert.equal(practice.options.codenamesRandomTeams,true);
    assert.deepEqual(practice.game.players.map(player=>player.id),practice.players.map(player=>player.id));
    const teams=await readTeams(host);
    assert.deepEqual(teams.map(team=>team.members.length),[Math.ceil(count/2),Math.floor(count/2)]);
    assert(teams.every(team=>team.members.filter(member=>member.captain).length===1));
    await host.reload();await host.locator('.wg-table').waitFor();assert.deepEqual(await readTeams(host),teams);
    await host.screenshot({path:`${out}/${locale}-practice-${count}.png`});await leave(host);
   }
   assert.deepEqual(errors,[]);
   console.log('PASS',locale,'setup/lobby eight sizes, keyboard, host-only option, readiness reset, balanced teams/captains, synchronized play, language, reload and 7/12-player practice');
  }finally{
   if(created)try{await leave(pages[0]);}catch(error){console.error('Room cleanup failed:',error.message);}
   for(const context of contexts)await context.close();
  }
 }
}finally{await browser.close();}
