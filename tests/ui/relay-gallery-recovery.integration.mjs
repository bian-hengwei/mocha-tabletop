import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',out='test-results/relay-gallery-ui';
const browser=await chromium.launch();await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
try{for(const locale of ['zh','en']){
 const context=await browser.newContext();let socket,snapshot,fixture;const errors=[];
 await context.addInitScript(locale=>{const profile={id:'player_1',name:'Mocha',avatar:'🦊'};localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale',locale);sessionStorage.setItem('mocha-room-session',JSON.stringify({profile,code:'ABC234',token:'a'.repeat(48),savedAt:Date.now(),expiresAt:Date.now()+3600000}));},locale);
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 async function project(){
  const result=await page.evaluate(async({match,players})=>{const {viewMatch}=await import('/src/core/room.ts');return viewMatch(match,'drawrelay',players[1].id);},fixture);
  snapshot={type:'snapshot',room:fixture.room,...result,paused:true};socket.send(JSON.stringify(snapshot));
 }
 await context.routeWebSocket('**/api/rooms/**',ws=>{socket=ws;ws.onMessage(async raw=>{
  const message=JSON.parse(String(raw));
  if(message.type==='hello'&&snapshot)ws.send(JSON.stringify(snapshot));
  if(message.type==='action'){
   fixture.match=await page.evaluate(async({match,players,message})=>{const {applyMatch}=await import('/src/core/room.ts');return applyMatch(match,'drawrelay',players,players[1].id,message.command,message.requestID,message.actionRevision);},{...fixture,message});
   await project();
  }
 });});
 await page.goto(base);await expect.poll(()=>!!socket).toBe(true);
 fixture=await page.evaluate(async locale=>{
  const {createMatch}=await import('/src/core/room.ts');const {drawrelay,encodeRelayStroke}=await import('/src/core/games/drawrelay.ts');
  const players=Array.from({length:3},(_,i)=>({id:`player_${i}`,name:i===1?'Mocha':`Player ${i}`,avatar:'🦊',ready:true,connected:i!==2}));
  const match=createMatch('drawrelay',players,{relayMode:'rounds',relaySeconds:0});
  const active=structuredClone(match);
  for(let step=0;step<3;step++)for(const p of players){
   match.game=drawrelay.apply(match.game,p.id,step%2?{action:'stroke',values:[String(step),encodeRelayStroke([[120,600],[500,120],[880,600]],3,2)]}:{action:'draft',values:[String(step)],text:locale==='zh'?'狐狸坐茶杯去旅行':'A fox sails a teacup'});
   match.game=drawrelay.apply(match.game,p.id,{action:'submit',values:[String(step)]});
  }
  return {players,match,active,room:{code:'ABC234',hostID:'player_0',kind:'drawrelay',mode:'cloud',players,spectators:[],pending:[],started:true,options:{relayMode:'rounds',relaySeconds:0},revision:1,matchID:'finished-gallery-recovery',expiresAt:Date.now()+3600000}};
 },locale);
 await project();await expect(page.locator('.pause-overlay')).toHaveCount(0);
 const next=page.getByRole('button',{name:locale==='zh'?'下一页':'Next page',exact:true}),previous=page.getByRole('button',{name:locale==='zh'?'上一页':'Previous page',exact:true}),album=page.locator('.relay-gallery-controls select');
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});await album.selectOption('2');await expect(page.locator('.relay-gallery-controls>span')).toHaveText('1 / 3');
  await page.screenshot({path:`${out}/${locale}-${width}x${height}-sentence.png`});
  await next.click();await expect(page.locator('.relay-gallery-page polyline')).toHaveCount(1);await expect(page.locator('.relay-gallery-controls>span')).toHaveText('2 / 3');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow');
  await page.screenshot({path:`${out}/${locale}-${width}x${height}-drawing.png`});
  await page.getByRole('button',{name:locale==='zh'?'对局记录':'Game log',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.setViewportSize({width:height,height:width});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await page.setViewportSize({width,height});
  await next.click();await expect(next).toBeDisabled();await previous.click();await expect(page.locator('.relay-gallery-controls>span')).toHaveText('2 / 3');
  await page.reload();await expect(album).toHaveValue('2');await expect(page.locator('.relay-gallery-controls>span')).toHaveText('2 / 3');
  await previous.click();await expect(page.locator('.relay-gallery-controls>span')).toHaveText('1 / 3');await expect(previous).toBeDisabled();
  console.log('PASS',locale,width,height,'finished gallery despite missing peer, album/page, drawing, dialog rotation, boundaries and reload');
 }
 // The exemption must not remove the pause screen on an unfinished next match.
 fixture.match=fixture.active;fixture.room={...fixture.room,matchID:'active-next-match',revision:2};await project();await expect(page.locator('.pause-overlay')).toBeVisible();
 assert.deepEqual(errors,[]);await context.close();
}}finally{await browser.close();}
