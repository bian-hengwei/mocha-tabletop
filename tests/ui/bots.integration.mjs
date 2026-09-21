import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5207';
const engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const out=process.env.BOT_ARTIFACT_DIR||`tests/ui/artifacts/bots-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
const games=[['doudizhu',3],['guandan',4],['mahjong',4],['gems',4],['bombs',5],['sushi',5],['century',5],['uno',10]];
const errors=[];
try{
 for(const locale of ['zh','en']){
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  const [host,guest]=await Promise.all(contexts.map(c=>c.newPage()));
  for(const [i,page]of [host,guest].entries()){
   page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(base);if(locale==='en')await page.getByRole('dialog').getByRole('button',{name:'Switch to English'}).click();
   await page.locator('.profile-editor input').fill(i?'GuestBotQA':'HostBotQA');await page.locator('.profile-editor footer button').click();
  }
  const label=(zh,en)=>locale==='zh'?zh:en;
  await host.locator('.cover-uno').click();await host.locator('.mode-picker button').filter({has:host.getByText(label('云端联机','Online'),{exact:true})}).click();await host.getByRole('button',{name:label('创建牌桌','Create table'),exact:true}).click();await host.locator('.room-code').waitFor();
  const code=(await host.locator('.room-code').innerText()).trim();await guest.getByRole('button',{name:label('加入牌桌','Join a table'),exact:true}).click();await guest.getByRole('textbox',{name:label('房间码','Room code'),exact:true}).fill(code);await guest.getByRole('button',{name:label('入桌','Join'),exact:true}).click();
  await host.getByRole('button',{name:label('同意GuestBotQA','Approve GuestBotQA'),exact:true}).click();await guest.locator('.lobby').waitFor();
  for(const [kind,max]of games){
   while(await host.locator('.bot-seat-controls').count()){const n=await host.locator('.bot-seat-controls').count();await host.locator('.bot-seat-controls button').last().click();await expect(host.locator('.bot-seat-controls')).toHaveCount(n-1);}
   await host.getByRole('combobox',{name:label('更换游戏','Change game'),exact:true}).selectOption(kind);
   for(let i=0;i<max-2;i++){
    await host.getByRole('button',{name:label('添加玩家','Add player'),exact:true}).click();
    if(kind==='doudizhu'&&i===0){await host.keyboard.press('Escape');await expect(host.getByRole('button',{name:label('添加玩家','Add player'),exact:true})).toBeFocused();await host.getByRole('button',{name:label('添加玩家','Add player'),exact:true}).click();}
    await host.getByRole('button',{name:label(['简单人机','普通人机','困难人机'][i%3],['Easy bot','Normal bot','Hard bot'][i%3]),exact:true}).click();await expect(host.locator('.bot-seat-controls')).toHaveCount(i+1);
   }
   await expect(host.locator('.lobby-seat.vacant')).toHaveCount(0);
   assert.equal(await guest.locator('.bot-seat-controls').count(),0);assert.equal(await guest.locator('.add-seat-choices').count(),0);
   await guest.getByRole('button',{name:label('准备好了','Ready'),exact:true}).click();await expect(host.getByRole('button',{name:label('开局','Start'),exact:true})).toBeEnabled();
   await host.locator('.bot-seat-controls select').first().selectOption('hard');await guest.getByRole('button',{name:label('准备好了','Ready'),exact:true}).waitFor();await expect(host.getByRole('button',{name:label('开局','Start'),exact:true})).toBeDisabled();
   for(const [width,height]of sizes){
    await host.setViewportSize({width,height});await host.locator('.lobby-content').evaluate(el=>el.scrollTop=0);
    assert(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${kind}/${locale}/${width} page overflow`);
    for(const el of await host.locator('.bot-seat-controls button,.bot-seat-controls select,.add-seat-choices button').all()){
     const box=await el.boundingBox();assert(box&&box.height>=43.5,`${kind} bot control touch height`);
    }
    assert(await host.locator('.bot-seat-controls select').evaluateAll(selects=>selects.every(el=>{const style=getComputedStyle(el),canvas=document.createElement('canvas'),context=canvas.getContext('2d');context.font=style.font;return context.measureText(el.selectedOptions[0].text).width<=el.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)+1;})),`${kind}/${locale}/${width} full bot difficulty label`);
    await host.screenshot({path:`${out}/${kind}-${locale}-${width}x${height}-lobby.png`});
    assert(await host.locator('.lobby-start-status').evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&el.contains(hit);}),`${kind}/${locale}/${width}: start explanation remains visible beside the action`);
    await host.getByRole('button',{name:label('开局','Start'),exact:true}).scrollIntoViewIfNeeded();
    const box=await host.getByRole('button',{name:label('开局','Start'),exact:true}).boundingBox();assert(box.y+box.height<=height+1,'start reachable');
   }
   if(kind==='doudizhu'){
    const difficulty=await host.locator('.bot-seat-controls select').inputValue();
    await host.locator('.language-toggle').click();await expect(host.locator('.bot-roster-summary')).toHaveText(locale==='zh'?'2 humans · 1 bot':'2 人 · 1 机');
    await host.locator('.language-toggle').click();await host.reload();await host.locator('.lobby').waitFor();await expect(host.locator('.bot-seat-controls select')).toHaveValue(difficulty);await expect(host.locator('.bot-roster-summary')).toHaveText(label('2 人 · 1 机','2 humans · 1 bot'));
   }
   await guest.getByRole('button',{name:label('准备好了','Ready'),exact:true}).click();await host.getByRole('button',{name:label('开局','Start'),exact:true}).click();await host.locator('.game-surface').waitFor();await guest.locator('.game-surface').waitFor();
   await host.reload();await host.locator('.game-surface').waitFor();await expect(host.locator('.pause-overlay')).toHaveCount(0);await expect(host.locator('.bot-match-status[role=alert]')).toHaveCount(0);
   for(const [width,height]of sizes){await host.setViewportSize({width,height});await host.screenshot({path:`${out}/${kind}-${locale}-${width}x${height}-table.png`});assert(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
   await host.getByRole('button',{name:label('牌桌菜单','Table menu'),exact:true}).click();await host.setViewportSize({width:844,height:390});await host.setViewportSize({width:390,height:844});await host.screenshot({path:`${out}/${kind}-${locale}-menu-rotated.png`});
   await host.getByRole('button',{name:label('结束本局，返回准备','End game and return to lobby'),exact:true}).click();await host.locator('.lobby').waitFor();await guest.locator('.lobby').waitFor();await expect(host.locator('.bot-seat-controls')).toHaveCount(max-2);
  }
  // A sole human may fill every remaining legal seat in every supported game.
  await guest.getByRole('button',{name:label('牌桌菜单','Table menu'),exact:true}).click();await guest.getByRole('button',{name:label('离开牌桌','Leave table'),exact:true}).click();
  for(const [kind,max]of games){
   while(await host.locator('.bot-seat-controls').count()){const n=await host.locator('.bot-seat-controls').count();await host.locator('.bot-seat-controls button').last().click();await expect(host.locator('.bot-seat-controls')).toHaveCount(n-1);}
   await host.getByRole('combobox',{name:label('更换游戏','Change game'),exact:true}).selectOption(kind);
   for(let i=1;i<max;i++){
    await host.getByRole('button',{name:label('添加玩家','Add player'),exact:true}).click();
    if(kind==='doudizhu'&&i===1)for(const [width,height]of sizes){await host.setViewportSize({width,height});await host.screenshot({path:`${out}/add-seat-${locale}-${width}x${height}.png`});const hard=host.getByRole('button',{name:label('困难人机','Hard bot'),exact:true});await expect(hard).toBeVisible();assert(await hard.evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'All difficulty choices remain reachable without scrolling');}
    await host.getByRole('button',{name:label('困难人机','Hard bot'),exact:true}).click();await expect(host.locator('.bot-seat-controls')).toHaveCount(i);
   }
   await expect(host.locator('.bot-roster-summary')).toHaveText(label(`1 人 · ${max-1} 机`,`1 human · ${max-1} bots`));await expect(host.getByRole('button',{name:label('开局','Start'),exact:true})).toBeEnabled();
   await host.setViewportSize({width:390,height:844});await host.screenshot({path:`${out}/${kind}-${locale}-one-human-remaining-bots.png`});
   await host.getByRole('button',{name:label('开局','Start'),exact:true}).click();await host.locator('.game-surface').waitFor();await expect(host.locator('.pause-overlay')).toHaveCount(0);await expect(host.locator('.bot-match-status[role=alert]')).toHaveCount(0);
   await host.getByRole('button',{name:label('牌桌菜单','Table menu'),exact:true}).click();await host.getByRole('button',{name:label('结束本局，返回准备','End game and return to lobby'),exact:true}).click();await host.locator('.lobby').waitFor();await expect(host.locator('.bot-seat-controls')).toHaveCount(max-1);
  }
  await host.getByRole('button',{name:label('牌桌菜单','Table menu'),exact:true}).click();await host.getByRole('button',{name:label('离开牌桌','Leave table'),exact:true}).click();await host.locator('.game-cover').first().waitFor();
  await Promise.all(contexts.map(c=>c.close()));
 }
 assert.deepEqual(errors,[]);console.log(`PASS ${engine}: eight bot games, two languages, seven sizes, mixed rooms, per-seat difficulty/readiness, host reload, rotations, one human with all remaining seats as bots and cleanup. Screenshots require separate visual review.`);
}catch(error){
 let index=0;for(const context of browser.contexts())for(const page of context.pages()){
  console.error('Visible error notices:',await page.locator('.toast').allTextContents());
  await page.screenshot({path:`${out}/failure-${index++}.png`});
 }
 throw error;
}finally{await browser.close();}
