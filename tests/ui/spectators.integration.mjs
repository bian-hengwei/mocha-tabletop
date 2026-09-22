import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',out='test-results/spectators',sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined}),errors=[],issues=[];
try{
 const page=await browser.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 let snapshot,connection;
 await page.routeWebSocket('**/api/rooms/ABC234',ws=>{connection=ws;ws.onMessage(raw=>{const m=JSON.parse(raw);if(m.type==='hello')ws.send(JSON.stringify(snapshot));if(m.type==='ping')ws.send(JSON.stringify({type:'pong'}));});});
 for(const language of ['zh','en'])for(const scenario of (process.env.TEST_GAMES?.split(',')||['doudizhu','guandan','mahjong','gems','bombs','sushi','century','uno','codenames','undercover','werewolf','werewolf-judge','werewolf-deal','avalon'])){
  const kind=scenario.startsWith('werewolf')?'werewolf':scenario,werewolfMode=scenario.split('-')[1];
  await page.goto(base+'/manifest-mocha.webmanifest');
  snapshot=await page.evaluate(async({kind,language,werewolfMode})=>{
   const {GAMES}=await import('/src/core/types.ts'),{createMatch,viewRoomMatch}=await import('/src/core/room.ts');
   const players=Array.from({length:GAMES[kind].max+(werewolfMode==='judge'?1:0)},(_,i)=>({id:`watch-player-${i}`,name:`Player ${i+1}`,avatar:'🦊',ready:true,connected:true}));
   const watcher={id:'watcher-00',name:'Watcher',avatar:'🐼',connected:true},spectators=[watcher,...Array.from({length:19},(_,i)=>({id:`watcher-long-${i}`,name:`观众 Observer ${i}`,avatar:'🐻',connected:i%2===0}))];
   const options={language,...(werewolfMode?{werewolfMode}:{})},room={code:'ABC234',kind,hostID:players[0].id,mode:'cloud',players,spectators,allowSpectators:true,pending:[],started:true,revision:1,matchID:'spectator-layout-match',options},match=createMatch(kind,players,options);
   if(kind==='sushi')match.game.table=players.map((_,i)=>[{id:`public-dumpling-${i}`,kind:'dumpling'},{id:`public-maki-${i}`,kind:'maki2'}]);
   localStorage.clear();sessionStorage.clear();localStorage.setItem('mocha-profile',JSON.stringify(watcher));localStorage.setItem('mocha-locale',language);localStorage.setItem('mocha-room-session',JSON.stringify({profile:watcher,code:'ABC234',token:'a'.repeat(48),savedAt:Date.now(),expiresAt:Date.now()+3600000}));
   return{type:'snapshot',room,...viewRoomMatch(match,room,watcher.id),paused:false};
  },{kind,language,werewolfMode});
  await page.goto(base);await page.locator('.spectator-surface').waitFor();
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});await page.waitForTimeout(60);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1),`${kind} ${language} ${width}: page fits`);
   const overflow=await page.locator('.game-surface').evaluate(surface=>[surface,...surface.querySelectorAll('*')].filter(x=>x instanceof HTMLElement&&x.clientHeight>0&&x.scrollHeight>x.clientHeight+2&&['hidden','auto','scroll'].includes(getComputedStyle(x).overflowY)&&!x.matches('.illustrated-tile,.role-art')).map(x=>({class:x.className,h:x.clientHeight,content:x.scrollHeight})));
   if(overflow.length)issues.push({kind,language,width,height,overflow,details:await page.locator('.social-table-v2,.social-board,.round-table,.seats,.seat-pagination').evaluateAll(xs=>xs.map(x=>({class:x.className,y:x.getBoundingClientRect().y,h:x.getBoundingClientRect().height,style:getComputedStyle(x).height,flex:getComputedStyle(x).flex}))) });
   for(const selector of ['.mj-hand-panel','.classic-hand-panel','.g-own-tray','.identity-deck','.bt-hand-zone','.ng-sushi-hand-panel','.ng-uno-hand-panel','.ng-century-hand-dock','.wg-secret-panel'])await expect(page.locator(selector)).toHaveCount(0);
   if(kind==='mahjong'){await expect(page.locator('.mj-seat.seat-self')).toBeVisible();await expect(page.locator('.mahjong-assist-button,.mj-tile')).toHaveCount(0);await expect(page.locator('.mj-rack')).toHaveCount(4);await expect(page.locator('.mj-rack .mj-face:not(.mj-back)')).toHaveCount(0);}
   await page.screenshot({path:`${out}/${scenario}-${language}-${width}.png`});
   await page.locator('.audience-trigger').click();const dialog=page.getByRole('dialog',{name:language==='zh'?'观战席':'Spectators',exact:true});await expect(dialog).toBeVisible();
   await expect(dialog.locator('.spectator-list li')).toHaveCount(20);if(scenario==='gems')await page.screenshot({path:`${out}/audience-${language}-${width}.png`});await dialog.locator('.spectator-list li').last().scrollIntoViewIfNeeded();
   // Rotate with the long audience dialog open, then close and restore focus.
   await page.setViewportSize({width:height,height:width});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.locator('.audience-trigger')).toBeFocused();await page.setViewportSize({width,height});
  }
  if(kind==='uno'){snapshot.view.finished=true;snapshot.view.board.winners=[snapshot.room.players[0].id];snapshot.room.revision++;connection.send(JSON.stringify(snapshot));await expect(page.locator('.end-banner')).toBeVisible();assert.equal(await page.evaluate(()=>localStorage.getItem('mocha-history-v1')),null,'Watching never records a personal result');}
  console.log('CHECK spectator App, public table and audience dialog',language,scenario);
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/layout-issues.json`,JSON.stringify(issues,null,2));assert.deepEqual(issues,[],'Spectator public tables fit without clipping');
}finally{await browser.close();}
