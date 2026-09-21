import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const browser=await({chromium,webkit}[engine]).launch();
await fs.mkdir('test-results/finished-recovery',{recursive:true});
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}});let socket,snapshot;
  await context.routeWebSocket('**/api/rooms/**',ws=>{socket=ws;ws.onMessage(raw=>{if(JSON.parse(String(raw)).type==='hello'&&snapshot)ws.send(JSON.stringify(snapshot));});});
  await context.addInitScript(locale=>{localStorage.setItem('mocha-locale',locale);sessionStorage.setItem('mocha-room-session',JSON.stringify({profile:{id:'player-0000',name:'Host',avatar:'🦊'},code:'ABC234',token:'a'.repeat(48),savedAt:Date.now(),expiresAt:Date.now()+3600000}));},locale);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  const fixture=await page.evaluate(async()=>{
   const {avalon}=await import('/src/core/games/avalon.ts');
   const players=Array.from({length:5},(_,i)=>({id:`player-000${i}`,name:i?`Guest ${i}`:'Host',avatar:'🦊',connected:i===0,ready:true}));
   const active=avalon.create(players,71),finished={...active,stage:'assassinate',results:[true,true,true],failCounts:[0,0,0],winner:'正义获胜 · 梅林幸存'};
   return{room:{code:'ABC234',hostID:players[0].id,kind:'avalon',mode:'cloud',players,pending:[],started:true,revision:1,matchID:'finished-recovery',expiresAt:Date.now()+3600000},active:avalon.view(active,players[0].id),finished:avalon.view(finished,players[0].id)};
  });
  await expect.poll(()=>!!socket).toBe(true);
  const send=view=>{snapshot={type:'snapshot',room:fixture.room,view,actionRevision:1,paused:true};socket.send(JSON.stringify(snapshot));};
  send(fixture.active);await expect(page.locator('.pause-overlay')).toBeVisible();
  await expect(page.locator('.presence-notice')).toContainText(locale==='zh'?'暂时离线 · 所有座位已保留':'are offline · Seats reserved');
  send(fixture.finished);await expect(page.locator('.pause-overlay')).toHaveCount(0);
  await expect(page.locator('.presence-notice')).toHaveCount(0);
  for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){
   await page.setViewportSize({width,height});await expect(page.locator('.end-banner')).toBeVisible();
   await expect(page.locator('.end-banner')).toContainText(locale==='zh'?'正义获胜':'Good wins');
   await page.screenshot({path:`test-results/finished-recovery/${engine}-${locale}-${width}.png`});
  }
  await page.reload();await expect(page.locator('.end-banner')).toBeVisible();await expect(page.locator('.pause-overlay')).toHaveCount(0);
  await page.getByRole('button',{name:locale==='zh'?'对局记录':'Game log',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
  // An unfinished new match must still pause; the result exception must not enable play offline.
  fixture.room={...fixture.room,matchID:'next-match',revision:2};send(fixture.active);await expect(page.locator('.pause-overlay')).toBeVisible();
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${engine} ${locale}: finished result survives missing peers and reload; unfinished play still pauses`);
 }
}finally{await browser.close();}
