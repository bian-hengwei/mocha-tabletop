import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const out=`test-results/gems-results-${engine}`;await fs.mkdir(out,{recursive:true});
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
   const {gems}=await import('/src/core/games/gems.ts');
   const players=['Host','梅林','Long Merchant Name','River'].map((name,i)=>({id:`player-000${i}`,name,avatar:'🦊',connected:true,ready:true}));
   const active=gems.create(players,71),finished=structuredClone(active);
   // Independent endgame example: equal 15-point totals, fewer cards wins.
   const cards=[[3,3,3],[4,5],[4,4],[3]],patrons=[2,2,0,0];
   finished.merchants.forEach((merchant,i)=>{
    merchant.bought=cards[i].map((points,j)=>({id:`bought-${i}-${j}`,tier:3,bonus:'white',points,cost:[0,0,0,0,0]}));
    merchant.nobles=Array.from({length:patrons[i]},(_,j)=>({id:`patron-${i}-${j}`,cost:[4,4,0,0,0]}));
   });
   finished.finished=true;finished.finalRound=true;finished.winners=[players[1].id];
   return {room:{code:'ABC234',hostID:players[0].id,kind:'gems',mode:'cloud',players,pending:[],started:true,revision:1,matchID:'gems-results',expiresAt:Date.now()+3600000},active:gems.view(active,players[0].id),finished:gems.view(finished,players[0].id)};
  });
  if(role==='guest')fixture.room.hostID='player-0001';
  await expect.poll(()=>!!socket).toBe(true);
  const send=view=>{snapshot={type:'snapshot',room:fixture.room,view,actionRevision:1,paused:false};socket.send(JSON.stringify(snapshot));};
  send(fixture.active);await page.locator('.g-bank-gem').first().click();await expect(page.locator('.gem-picked')).toHaveCount(1);
  await page.locator('.g-tier-active .development-card').first().click();await expect(page.getByRole('dialog')).toBeVisible();
  // Same current player and phase: completion itself must clear transient choices.
  send(fixture.finished);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.gem-picked')).toHaveCount(0);
  await expect(page.locator('.g-take')).toHaveCount(0);await expect(page.locator('.action-dock')).toHaveCount(0);
  const table=page.locator('.gems-results table');await expect(table).toHaveAccessibleName(locale==='zh'?'得分明细':'Score breakdown');
  const rows=table.locator('tbody tr');
  assert.deepEqual(await rows.evaluateAll(xs=>xs.map(row=>[...row.querySelectorAll('td')].map(x=>x.textContent))),[['2','2','15'],['3','2','15'],['2','0','8'],['1','0','3']]);
  await expect(rows.nth(1).locator('th')).toContainText(locale==='zh'?'你':'You');
  await expect(rows.nth(0).locator('th')).toContainText('梅林');await expect(rows.nth(0).locator('small')).toHaveText(locale==='zh'?'胜者':'Winner');
  await expect(rows.nth(1).locator('small')).not.toContainText(locale==='zh'?'胜者':'Winner');
  for(const [width,height] of [[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]]){
   await page.setViewportSize({width,height});
   const issues=await page.locator('.end-banner').evaluate(panel=>{
    const r=panel.getBoundingClientRect(),bad=[];
    if(r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1||panel.scrollWidth>panel.clientWidth||panel.scrollHeight>panel.clientHeight+1)bad.push('result clips');
    for(const cell of panel.querySelectorAll('th,td'))if(cell.scrollWidth>cell.clientWidth+1)bad.push('cell clips');
    for(const button of panel.querySelectorAll('button')){const b=button.getBoundingClientRect();if(b.width<44||b.height<44||b.bottom>r.bottom||b.right>r.right)bad.push('button unreachable');}
    return bad;
   });assert.deepEqual(issues,[],`${locale} ${width}: scores and controls fit`);
   await page.screenshot({path:`${out}/${role}-${locale}-${width}.png`});
   await page.getByRole('button',{name:locale==='zh'?'收起结算':'Dismiss result',exact:true}).click();
   const reopen=page.getByRole('button',{name:locale==='zh'?'得分明细':'Score breakdown',exact:true});
   const box=await reopen.boundingBox();assert(box&&box.width>=44&&box.height>=44&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,'Score details remains reachable');
   await reopen.click();await expect(table).toBeVisible();
  }
  await page.getByRole('button',{name:locale==='zh'?'收起结算':'Dismiss result',exact:true}).click();await expect(table).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:locale==='zh'?'得分明细':'Score breakdown',exact:true}).click();await expect(table).toBeVisible();
  // Language round-trip keeps names, winner and numbers unchanged.
  await page.getByRole('button',{name:locale==='zh'?'Switch to English':'切换为中文',exact:true}).click();await expect(rows.nth(0).locator('th')).toContainText('梅林');
  await page.getByRole('button',{name:locale==='zh'?'切换为中文':'Switch to English',exact:true}).click();await expect(rows.nth(0).locator('small')).toHaveText(locale==='zh'?'胜者':'Winner');
  await page.reload();await expect(table).toBeVisible();
  // A fresh match restores controls and cannot retain the result panel.
  fixture.room={...fixture.room,matchID:'gems-next-match',revision:2};send(fixture.active);await expect(table).toHaveCount(0);await expect(page.locator('.g-take')).toBeVisible();
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${engine} ${role} ${locale}: four-player scores, tie winner, eight sizes, rotation, dismiss/reopen, locale, reload and new match`);
 }
}finally{await browser.close();}
