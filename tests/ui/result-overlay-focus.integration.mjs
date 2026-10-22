import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const browser=await({chromium,webkit}[engine]).launch(),out=`test-results/result-overlay-focus-${engine}`;
await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
const counts={gems:4,century:5,sushi:5,bombs:5,uno:10,codenames:4,avalon:5,werewolf:9,drawguess:3,doudizhu:3,mahjong:4};
async function seed(page,kind,locale){
 await page.goto(`${base}/manifest-mocha.webmanifest`);
 return page.evaluate(async({kind,locale,count})=>{
  const {createPractice,writePractice,readPractice,practiceView}=await import('/src/local/practice.ts');
  localStorage.clear();const profile={id:'result-focus-person',name:'Mocha',avatar:'🦊'};
  localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale',locale);
  const p=createPractice(kind,count,profile,{language:locale,...(kind==='werewolf'?{werewolfMode:'standard'}:{})},undefined,11),g=p.game;
  // Explicit terminal UI fixtures: no claim of complete rule simulation.
  if(kind==='avalon')g.winner='正义获胜 · 梅林幸存';
  else if(kind==='werewolf')g.winner='好人获胜';
  else if(kind==='bombs'){g.alive=[p.players[0].id];g.current=p.players[0].id;g.phase={kind:'turn'};}
  else if(kind==='doudizhu'){g.finished=true;g.winners=[p.players[0].id];}
  else if(kind==='mahjong'){g.finished=true;g.winners=[];}
  else if(kind==='drawguess'){g.finished=true;g.phase='finished';g.winnerIDs=[p.players[0].id];}
  else{g.finished=true;g.winners=[p.players[0].id];if(kind==='codenames')g.winnerTeam='red';}
  if(kind==='sushi'){g.round=3;g.step=7;g.scores=[22,20,25,24,25];g.puddings=[2,3,3,1,2];g.roundScores=[[7,5,8,10,8],[7,6,7,10,8],[8,6,7,10,9]];g.hands=p.players.map(()=>[]);g.table=p.players.map(()=>[]);g.winners=[p.players[2].id];}
  if(kind==='gems')g.merchants.forEach((m,i)=>{m.bought=[{id:`focus-gem-${i}`,tier:3,bonus:'white',points:5-i,cost:[0,0,0,0,0]}];});
  if(kind==='century')g.caravans.forEach((c,i)=>{c.orders=[{id:`focus-order-${i}`,points:10-i,cost:[0,0,0,0]}];});
  writePractice(p);if(readPractice()?.id!==p.id||!practiceView(readPractice()).finished)throw Error(`Rejected terminal fixture ${kind}`);
  return {id:p.id,title:practiceView(p).board.winner||practiceView(p).instruction};
 },{kind,locale,count:counts[kind]});
}
async function focusInside(page){assert(await page.evaluate(()=>!!document.activeElement?.closest('.end-banner')),'result owns focus');}
async function dismiss(page){await page.keyboard.press('Escape');await expect(page.locator('.end-banner')).toHaveCount(0);await expect(page.locator('.topbar .brand button')).toBeFocused();}
try{
 for(const locale of ['zh','en'])for(const kind of Object.keys(counts)){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(7000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const fixture=await seed(page,kind,locale);await page.goto(base);
  const banner=page.locator('.end-banner');await expect(banner).toBeVisible();
  if(kind==='mahjong'){await expect(banner).not.toHaveAttribute('role','dialog');assert.equal(await banner.evaluate(el=>getComputedStyle(el).position),'static');await page.getByRole('button',{name:locale==='zh'?'牌桌菜单':'Table menu',exact:true}).click();await expect(page.locator('.app-modal')).toBeVisible();await page.keyboard.press('Escape');}
  else{
   await expect(banner).toHaveAttribute('role','dialog');await expect(banner).toHaveAttribute('aria-modal','true');await expect(banner).toHaveAccessibleName(/.+/);await focusInside(page);
   for(let i=0;i<5;i++){await page.keyboard.press('Tab');await focusInside(page);}await page.keyboard.press('Shift+Tab');await focusInside(page);
   assert(await page.locator('.topbar').evaluate(el=>!!el.closest('[inert]')));
   const representative=['codenames','avalon','gems','century','sushi'].includes(kind);
   for(const [width,height]of representative?sizes:[[390,844]]){
    await page.setViewportSize({width,height});await focusInside(page);
    assert(await banner.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&el.scrollWidth<=el.clientWidth+1;}));
    for(const button of await banner.locator('button').all()){await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();}
    await page.screenshot({path:`${out}/${kind}-${locale}-${width}x${height}.png`});
    await page.setViewportSize({width:height,height:width});await focusInside(page);await page.setViewportSize({width,height});
   }
   await dismiss(page);
   const show=page.getByRole('button',{name:locale==='zh'?'得分明细':'Score breakdown',exact:true});
   if(['gems','century','sushi'].includes(kind)){await show.click();await focusInside(page);await page.keyboard.press('Escape');await expect(show).toBeFocused();}
   await page.locator('.language-toggle').click();assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice)).id,fixture.id);
   await page.reload();await expect(banner).toBeVisible();await focusInside(page);
   await banner.locator('.compact.primary').click();await expect(banner).toHaveCount(0);assert.notEqual((await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice)).id,fixture.id);
  }
  assert.deepEqual(errors,[]);await context.close();console.log('PASS result endpoint',engine,locale,kind,'focus/Tab/Escape/replay or unchanged inline');
 }
 for(const role of ['host','guest'])for(const existing of ['menu','word-help','none']){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});let socket,lastSnapshot;const messages=[];
  await context.routeWebSocket('**/api/rooms/**',ws=>{socket=ws;ws.onMessage(raw=>{const message=JSON.parse(String(raw));messages.push(message);if(message.type==='hello'&&lastSnapshot)ws.send(JSON.stringify(lastSnapshot));});});
  await context.addInitScript(()=>{localStorage.setItem('mocha-locale','en');sessionStorage.setItem('mocha-room-session',JSON.stringify({profile:{id:'result-player-0',name:'Mocha',avatar:'🦊'},code:'ABC234',token:'a'.repeat(48),savedAt:Date.now(),expiresAt:Date.now()+3600000}));});
  const page=await context.newPage();page.setDefaultTimeout(7000);await page.goto(base);
  const fixture=await page.evaluate(async()=>{const {codenames}=await import('/src/core/games/codenames.ts');const players=Array.from({length:4},(_,i)=>({id:`result-player-${i}`,name:i?'Player '+i:'Mocha',avatar:'🦊',ready:true,connected:true}));const g=codenames.create(players,11,{language:'en'}),end=structuredClone(g);end.finished=true;end.winnerTeam='red';end.winners=[players[0].id,players[2].id];return {players,active:codenames.view(g,players[0].id),finished:codenames.view(end,players[0].id)};});
  await expect.poll(()=>!!socket).toBe(true);let revision=1;
  const send=(view,matchID='focus-remote')=>{lastSnapshot={type:'snapshot',room:{code:'ABC234',hostID:fixture.players[role==='host'?0:1].id,kind:'codenames',mode:'cloud',players:fixture.players,pending:[],started:true,revision:revision++,matchID,expiresAt:Date.now()+3600000},view,actionRevision:1,paused:false};socket.send(JSON.stringify(lastSnapshot));};
  send(fixture.active);await expect(page.locator('.wg-signals')).toBeVisible();
  if(existing==='menu')await page.getByRole('button',{name:'Table menu',exact:true}).click();
  if(existing==='word-help')await page.getByRole('button',{name:'Table rules',exact:true}).click();
  send(fixture.finished);
  if(existing!=='none'){
   await expect(page.locator('.end-banner')).toHaveCount(0);assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')));await page.screenshot({path:`${out}/arrival-${role}-${existing}.png`});
   await page.keyboard.press('Escape');
  }
  const banner=page.locator('.end-banner');await expect(banner).toBeVisible();await focusInside(page);
  if(role==='guest'){await expect(banner.locator('.compact.primary')).toHaveCount(0);await expect(banner.locator('small')).toHaveText('Waiting for the host to start again');await expect(banner.locator('.dismiss-result')).toBeFocused();}
  else await expect(banner.locator('.compact.primary')).toHaveText('Back to lobby');
  await page.screenshot({path:`${out}/remote-${role}-${existing}.png`});
  if(existing==='none'){
   socket.close();await page.reload();await expect(banner).toBeVisible();await focusInside(page);
   send(fixture.finished);await expect(banner).toHaveCount(1);await focusInside(page);
  }
  if(role==='host'){await banner.locator('.compact.primary').click();await expect.poll(()=>messages.some(m=>m.type==='replay')).toBe(true);send(fixture.active,'focus-next');await expect(banner).toHaveCount(0);}
  else{await page.keyboard.press('Escape');await expect(banner).toHaveCount(0);send(fixture.active,'focus-next');await expect(banner).toHaveCount(0);send(fixture.finished,'focus-next');await expect(banner).toBeVisible();await focusInside(page);}
  await context.close();console.log('PASS remote arrival',engine,role,existing,'queued existing dialog, host/guest, replay/new match, reconnect');
 }
}finally{await browser.close();}
