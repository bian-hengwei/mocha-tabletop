import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const out=process.env.TEST_OUTPUT||`test-results/connection-overlays-${engine}`;
await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch();
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
const guest={id:'overlay-guest',name:'Overlay guest',avatar:'🦊',ready:true,connected:true},host={...guest,id:'overlay-host',name:'Host'};
const results=[];
async function contained(page,selector){
  for(const key of ['Tab','Shift+Tab','Tab','Tab','Shift+Tab']){
    await page.keyboard.press(key);
    assert(await page.locator(selector).evaluate(el=>el.contains(document.activeElement)),`${key} stays inside ${selector}`);
    assert(await page.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit);}),`${key} focus is visibly reachable`);
  }
}
async function reachable(locator,width,height){
  const r=await locator.boundingBox();assert(r&&r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height,'control inside viewport');
  assert(r.width>=44&&r.height>=44,'usable touch target');
  assert(await locator.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'control not obscured');
}
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  let mode='pending',snapshot,sockets=[],lastHello;
  await context.addInitScript(({locale,guest})=>{localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify(guest));},{locale,guest});
  await context.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await context.routeWebSocket('**/api/rooms/**',ws=>{
    sockets.push(ws);ws.onMessage(raw=>{const msg=JSON.parse(String(raw));if(msg.type==='hello'){lastHello=msg;if(mode==='pending')ws.send(JSON.stringify({type:'pending'}));if(mode==='live')ws.send(JSON.stringify(snapshot));}});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
  const pending=async()=>{
    await page.goto(base+'/?room=ABC234');await page.locator('.code-input').fill('ABC234');
    await page.locator('.join-form .primary').tap();await expect(page.locator('.connecting-overlay')).toBeVisible();
    await expect(page.locator('.connecting-overlay>button')).toBeFocused();
  };
  await pending();
  for(const [width,height]of sizes){
    await page.setViewportSize({width,height});await contained(page,'.connecting-overlay');
    assert(await page.locator('.topbar').evaluate(el=>!!el.closest('[inert]')),'waiting header inert');
    assert.equal(await page.locator('.connecting-overlay').evaluate(el=>el.getBoundingClientRect().top),0,'shade covers inert header');
    await reachable(page.locator('.connecting-overlay>button'),width,height);
    // A direct focus attempt must not enable the formerly obscured Join flow.
    await page.getByRole('button',{name:locale==='zh'?'加入牌桌':'Join a table',exact:true,includeHidden:true}).last().evaluate(el=>el.focus());
    await page.keyboard.press('Tab');await expect(page.locator('.connecting-overlay>button')).toBeFocused();
    await page.screenshot({path:`${out}/${locale}-${width}x${height}-waiting.png`,animations:'disabled'});
  }
  await page.keyboard.press('Enter');await expect(page.locator('.connecting-overlay')).toHaveCount(0);await expect(page.locator('.join-form')).toHaveCount(0);
  await pending();await page.keyboard.press('Escape');await expect(page.locator('.connecting-overlay')).toHaveCount(0);
  await pending();await page.locator('.connecting-overlay>button').tap();await expect(page.locator('.connecting-overlay')).toHaveCount(0);
  mode='live';await page.evaluate(guest=>{for(const storage of[localStorage,sessionStorage])storage.setItem('mocha-room-session',JSON.stringify({profile:guest,code:'ABC234',token:'a'.repeat(48),savedAt:Date.now(),expiresAt:Date.now()+3600000}));},guest);
  snapshot={type:'snapshot',room:{code:'ABC234',hostID:host.id,kind:'gems',mode:'cloud',players:[host,guest],pending:[],started:true,revision:1,matchID:'overlay-match',expiresAt:Date.now()+3600000},paused:false,serverNow:Date.now()};
  snapshot.view=await page.evaluate(async players=>{const {gems}=await import('/src/core/games/gems.ts');return gems.view(gems.create(players,71),players[1].id);},[host,guest]);
  await page.goto(base);await expect(page.locator('.in-game')).toBeVisible();
  const drop=async()=>{mode='offline';sockets.at(-1).close({code:1000,reason:'synthetic loss'});await expect(page.locator('.pause-overlay')).toBeVisible();};
  const recover=async()=>{mode='live';await expect.poll(()=>sockets.length).toBeGreaterThan(0);for(const ws of sockets)try{ws.send(JSON.stringify(snapshot));}catch{}await expect(page.locator('.pause-overlay')).toHaveCount(0);};
  // A dialog already above the game must remain above a new recovery layer.
  await page.locator('.profile-chip').tap();await expect(page.locator('.profile-editor')).toBeVisible();await drop();
  await contained(page,'.app-modal');await expect(page.locator('.profile-editor')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('.profile-editor')).toHaveCount(0);
  await expect(page.locator('.pause-overlay .primary')).toBeFocused();
  for(const [width,height]of sizes){
    await page.setViewportSize({width,height});await contained(page,'.pause-overlay');
    assert(await page.locator('.topbar').evaluate(el=>!!el.closest('[inert]')),'paused header inert');
    for(const button of await page.locator('.pause-overlay button').all())await reachable(button,width,height);
    await page.locator('.g-noble').first().evaluate(el=>el.focus());await page.keyboard.press('Tab');
    assert(await page.locator('.pause-overlay').evaluate(el=>el.contains(document.activeElement)),'hidden card cannot retain focus');
    await page.screenshot({path:`${out}/${locale}-${width}x${height}-pause.png`,animations:'disabled'});
    const menu=page.locator('.pause-overlay button').last();await menu.tap();await contained(page,'.app-modal');
    await page.screenshot({path:`${out}/${locale}-${width}x${height}-menu.png`,animations:'disabled'});
    await page.keyboard.press('Escape');await expect(menu).toBeFocused();
  }
  // Escape gives access to recovery menu without hiding the disconnected state.
  await page.keyboard.press('Escape');await expect(page.locator('.menu-list')).toBeVisible();await expect(page.locator('.pause-overlay')).toHaveCount(1);
  await page.keyboard.press('Escape');assert(await page.locator('.pause-overlay').evaluate(el=>el.contains(document.activeElement)));
  // Repeated reconnect uses the same recovery boundary without losing focus.
  for(let i=0;i<2;i++){await page.locator('.pause-overlay .primary').tap();await expect(page.locator('.pause-overlay')).toBeVisible();await contained(page,'.pause-overlay');}
  assert.equal(lastHello.profile.id,guest.id);
  await page.locator('.pause-overlay button').last().tap();await expect(page.locator('.menu-list')).toBeVisible();
  await recover();await expect(page.locator('.menu-list')).toBeVisible();await contained(page,'.app-modal');
  for(let i=0;i<2;i++){
    await drop();await contained(page,'.app-modal');
    await page.waitForTimeout(1100);await recover();await contained(page,'.app-modal');
  }
  await page.setViewportSize({width:320,height:568});await page.screenshot({path:`${out}/${locale}-recovered-menu-portrait.png`,animations:'disabled'});
  await page.setViewportSize({width:568,height:320});await contained(page,'.app-modal');await page.screenshot({path:`${out}/${locale}-recovered-menu-landscape.png`,animations:'disabled'});
  await page.keyboard.press('Escape');await expect(page.locator('.brand .icon')).toBeFocused();
  await drop();mode='live';await page.locator('.pause-overlay .primary').tap();await expect(page.locator('.pause-overlay')).toHaveCount(0);await expect(page.locator('.brand .icon')).toBeFocused();
  // Async loss from BODY must restore a real control rather than BODY itself.
  await page.evaluate(()=>document.activeElement.blur());await drop();
  mode='live';await page.waitForTimeout(1100);await recover();await expect(page.locator('.brand .icon')).toBeFocused();
  assert.deepEqual(errors,[]);results.push({locale,viewports:sizes.length,waiting:'PASS',pause:'PASS',nestedRecovery:'PASS',rotation:'PASS',errors:0});
  console.log('PASS',engine,locale,'8 sizes, waiting/pause focus, touch, nested recovery, reconnect and rotation');await context.close();
 }
 await fs.writeFile(`${out}/proof.json`,JSON.stringify({engine,results,transport:'Playwright routed synthetic API/WebSocket',realWorker:false,productionRooms:false},null,2)+'\n');
}finally{await browser.close();}
