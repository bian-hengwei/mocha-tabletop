import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const safari=process.env.TEST_BROWSER==='webkit';
const browser=await(safari?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const contexts=[],errors=[],out='test-results/lobby-layout';
const viewports=[{width:844,height:390},{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:932,height:430},{width:768,height:1024},{width:1440,height:900}];
await fs.mkdir(out,{recursive:true});
let host;
try{
 for(const name of ['Layout host','Layout guest']){
  const context=await browser.newContext({viewport:viewports[0],hasTouch:true});contexts.push(context);
  await context.addInitScript(profile=>{localStorage.setItem('mocha-profile',JSON.stringify(profile));if(!localStorage.getItem('mocha-locale'))localStorage.setItem('mocha-locale','zh');},{id:crypto.randomUUID(),name,avatar:'🦊'});
 }
 host=await contexts[0].newPage();const guest=await contexts[1].newPage();
 for(const page of [host,guest]){page.setDefaultTimeout(6000);page.on('pageerror',error=>errors.push(error.message));await page.goto(base);}
 await host.locator('.cover-werewolf').click();await host.getByRole('button',{name:/云端联机/}).click();await host.getByRole('button',{name:'创建牌桌',exact:true}).click();
 await host.locator('.room-code').waitFor();const code=(await host.locator('.room-code').textContent()).trim();
 await guest.getByRole('button',{name:'加入牌桌',exact:true}).click();await guest.getByRole('textbox',{name:'房间码',exact:true}).fill(code);await guest.getByRole('button',{name:'入桌',exact:true}).click();
 await host.locator('.join-requests .approve').waitFor();
 await expect(guest.locator('.connection-target')).toContainText(code);await expect(guest.locator('.connection-target')).toContainText('Layout guest');await expect(guest.locator('.connection-target')).toContainText('已连接，申请已送达');
 for(const language of ['zh','en']){
  if(language==='en')await host.locator('.language-toggle').click();
  await expect(host.locator('.join-requests span')).toHaveText(language==='en'?'🦊 Layout guest would like to join':'🦊 Layout guest 想入座');
  for(const viewport of viewports){
   // Resize while the request is pending: rotation must not collapse interactive rows.
   await host.setViewportSize(viewport);await guest.setViewportSize(viewport);
   const pending=await guest.locator('.connection-target').boundingBox();assert(pending&&pending.x>=0&&pending.x+pending.width<=viewport.width&&pending.y+pending.height<=viewport.height,'pending room and name stay visible');await guest.getByRole('button',{name:'取消',exact:true}).click({trial:true});
   await guest.screenshot({path:`${out}/${safari?'webkit':'chrome'}-pending-${language}-${viewport.width}.png`});
   const approve=host.locator('.join-requests .approve');
   await approve.scrollIntoViewIfNeeded();
   await host.screenshot({path:`${out}/${safari?'webkit':'chrome'}-${language}-${viewport.width}.png`});
   const request=await host.locator('.join-requests').boundingBox(),button=await approve.boundingBox();
   assert(request&&button&&request.height>=button.height,'Pending request retains its button height instead of shrinking behind rules');
   await approve.click({trial:true});
   // Both the last rule setting and footer remain reachable in the same scroll region.
   await host.locator('.lobby-controls select').first().click({trial:true});
   await host.locator('.lobby-seats .lobby-seat').first().scrollIntoViewIfNeeded();
   const seat=await host.locator('.lobby-seats .lobby-seat').first().boundingBox();
   assert(seat&&seat.height>=60,'Seat contents retain readable height');
   assert(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
   console.log(`PASS pending lobby approval, seats and footer ${language} ${viewport.width}×${viewport.height}`);
  }
 }
 for(const language of ['zh','en']){
  await guest.getByRole('button',{name:language==='zh'?'取消':'Cancel',exact:true}).click();
  await expect(host.locator('.join-requests')).toHaveCount(0);
  for(const storage of ['localStorage','sessionStorage'])assert.equal(await guest.evaluate(key=>globalThis[key].getItem('mocha-room-session'),storage),null,'Cancelled admission is not saved for recovery');
  await guest.reload();await expect(guest.locator('.game-library')).toBeVisible();
  await expect(guest.locator('.resume-session,.connecting-overlay')).toHaveCount(0);
  await guest.screenshot({path:`${out}/${safari?'webkit':'chrome'}-cancelled-${language}.png`});
  await guest.locator('.language-toggle').click();
  const english=language==='zh';
  await guest.getByRole('button',{name:english?'Join a table':'加入牌桌',exact:true}).click();
  await guest.getByRole('textbox',{name:english?'Room code':'房间码',exact:true}).fill(code);
  await guest.getByRole('button',{name:english?'Join':'入桌',exact:true}).click();
  await expect(guest.locator('.connection-target')).toContainText(code);await host.locator('.join-requests .approve').waitFor();
  console.log('PASS cancelled '+language+' admission stays cancelled across reload; explicit new join works');
 }
 await host.setViewportSize(viewports[0]);await host.locator('.join-requests .approve').click();
 const ready=guest.getByRole('button',{name:'准备好了',exact:true});const readyBox=await ready.boundingBox();assert(readyBox&&readyBox.height>=44&&readyBox.width>=44,'Ready has a full touch target');await ready.click();await expect(host.locator('.lobby-seat.ready').filter({hasText:'Layout guest'})).toHaveCount(1);
 await host.locator('.lobby-controls select').first().selectOption('gems');
 await guest.getByRole('button',{name:'准备好了',exact:true}).click();
 await host.locator('.lobby-controls .primary').click();await expect(host.locator('.g-table')).toBeVisible();await expect(guest.locator('.g-table')).toBeVisible();
 assert.deepEqual(errors,[]);console.log('PASS actual approval, guest readiness, rule change and game start');
}finally{
 if(host&&!host.isClosed()&&await host.locator('.lobby,.game-surface').count()){
  await host.locator('.brand .icon').click().catch(()=>{});host.once('dialog',d=>d.accept());
  await host.getByRole('button',{name:/^(离开牌桌|Leave table)$/}).click().catch(()=>{});
 }
 await Promise.all(contexts.map(context=>context.close()));await browser.close();
}
