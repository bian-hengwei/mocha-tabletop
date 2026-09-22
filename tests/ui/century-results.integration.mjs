import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const out=`test-results/century-results-${engine}`;await fs.mkdir(out,{recursive:true});
const browser=await({chromium,webkit}[engine]).launch();
try{
 for(const locale of ['zh','en'])for(const role of ['host','guest']){
  const context=await browser.newContext({viewport:{width:390,height:844}});let socket,snapshot;
  await context.routeWebSocket('**/api/rooms/**',ws=>{socket=ws;ws.onMessage(raw=>{if(JSON.parse(String(raw)).type==='hello'&&snapshot)ws.send(JSON.stringify(snapshot));});});
  await context.addInitScript(locale=>{
   localStorage.setItem('mocha-locale',locale);
   sessionStorage.setItem('mocha-room-session',JSON.stringify({profile:{id:'player-0000',name:'Host',avatar:'🦊'},code:'ABC234',token:'a'.repeat(48),savedAt:Date.now(),expiresAt:Date.now()+3600000}));
  },locale);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  const fixture=await page.evaluate(async()=>{
   const {century}=await import('/src/core/games/century.ts');
   const players=['Host','梅林','Long Merchant Name','River','Guest'].map((name,i)=>({id:`player-000${i}`,name,avatar:'🦊',connected:true,ready:true}));
   const active=century.create(players,71),finished=structuredClone(active);
   // Independent totals include order points, coin values and non-yellow cubes.
   const orders=[[6,7,8,9],[6,7,8,9,10],[10,10,10,10],[7,7,7],[8,8,8,8]],gold=[1,2,2,0,0],silver=[2,1,1,1,0],spices=[3,2,2,1,3];
   finished.caravans.forEach((caravan,i)=>{
    caravan.orders=orders[i].map((points,j)=>({id:`order-${i}-${j}`,points,cost:[0,0,0,0]}));
    caravan.gold=gold[i];caravan.silver=silver[i];caravan.cubes=[2,spices[i],0,0];
   });
   finished.finished=true;finished.finalRound=true;finished.winners=[players[2].id];
   const small={...finished,players:players.slice(0,3),caravans:finished.caravans.slice(0,3)};
   return {room:{code:'ABC234',hostID:players[0].id,kind:'century',mode:'cloud',players,pending:[],started:true,revision:1,matchID:'century-results',expiresAt:Date.now()+3600000},active:century.view(active,players[0].id),finished:century.view(finished,players[0].id),small:century.view(small,players[0].id)};
  });
  if(role==='guest')fixture.room.hostID='player-0001';
  await expect.poll(()=>!!socket).toBe(true);
  const send=view=>{snapshot={type:'snapshot',room:fixture.room,view,actionRevision:1,paused:false};socket.send(JSON.stringify(snapshot));};
  send(fixture.active);await page.locator('.ng-century-tabs button').nth(1).click();await page.locator('.ng-goal').first().click();await expect(page.getByRole('dialog')).toBeVisible();
  send(fixture.finished);await expect(page.getByRole('dialog')).toHaveCount(0);
  const table=page.locator('.century-results table'),rows=table.locator('tbody tr');
  await expect(table).toHaveAccessibleName(locale==='zh'?'得分明细':'Score breakdown');
  assert.deepEqual(await rows.evaluateAll(xs=>xs.map(row=>[...row.querySelectorAll('td')].map(x=>x.textContent))),[['4','2','1','49'],['5','2','1','49'],['4','1','2','38'],['4','0','0','35'],['3','0','1','23']]);
  await expect(rows.nth(0).locator('th')).toContainText('Long Merchant Name');await expect(rows.nth(0).locator('small')).toHaveText(locale==='zh'?'胜者':'Winner');
  await expect(rows.nth(1).locator('th')).toContainText('梅林');await expect(rows.nth(1).locator('small')).toHaveCount(0);
  await expect(page.locator('.century-results p')).toHaveText((locale==='zh'?'触发末轮的订单数':'Orders to trigger the final round')+'：5');
  for(const [width,height] of [[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]]){
   await page.setViewportSize({width,height});
   const issues=await page.locator('.end-banner').evaluate(panel=>{
    const r=panel.getBoundingClientRect(),bad=[];
    if(r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1||panel.scrollWidth>panel.clientWidth||panel.scrollHeight>panel.clientHeight+1)bad.push(`result clips ${panel.clientHeight}/${panel.scrollHeight} at ${r.x},${r.y},${r.right},${r.bottom}`);
    for(const cell of panel.querySelectorAll('th,td'))if(cell.scrollWidth>cell.clientWidth+1)bad.push('cell clips');
    for(const button of panel.querySelectorAll('button')){const b=button.getBoundingClientRect();if(b.width<44||b.height<44||b.bottom>r.bottom||b.right>r.right)bad.push('button unreachable');}
    return bad;
   });await page.screenshot({path:`${out}/${role}-${locale}-${width}.png`});
   assert.deepEqual(issues,[],`${locale} ${width}: scores and controls fit`);
   await page.getByRole('button',{name:locale==='zh'?'收起结算':'Dismiss result',exact:true}).click();
   const reopen=page.getByRole('button',{name:locale==='zh'?'得分明细':'Score breakdown',exact:true});
   const box=await reopen.boundingBox();assert(box&&box.width>=44&&box.height>=44&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,'Score details remains reachable');
   await reopen.click();await expect(table).toBeVisible();
  }
  await page.getByRole('button',{name:locale==='zh'?'Switch to English':'切换为中文',exact:true}).click();await expect(rows.nth(1).locator('th')).toContainText('梅林');
  await page.getByRole('button',{name:locale==='zh'?'切换为中文':'Switch to English',exact:true}).click();await expect(rows.nth(0).locator('small')).toHaveText(locale==='zh'?'胜者':'Winner');
  await page.reload();await expect(table).toBeVisible();
  fixture.room={...fixture.room,players:fixture.room.players.slice(0,3),matchID:'century-three',revision:2};send(fixture.small);await expect(rows).toHaveCount(3);await expect(page.locator('.century-results p')).toContainText('：6');
  fixture.room={...fixture.room,matchID:'century-next',revision:3};send(fixture.active);await expect(table).toHaveCount(0);await expect(page.locator('.ng-century-result-heading')).toHaveCount(0);
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${engine} ${role} ${locale}: five-player totals and counts, authoritative tie winner, eight sizes, dismiss/reopen, locale, reload, three-player target and new match`);
 }
}finally{await browser.close();}
