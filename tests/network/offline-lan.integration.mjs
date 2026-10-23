import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {waitForOfflineReady} from '../ui/offline-ready.mjs';

const browserName=process.env.TEST_BROWSER||'chromium';
const locales=(process.env.TEST_LOCALES||'zh,en').split(',');
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
const artifacts=path.resolve('test-results/offline-lan');await fs.mkdir(artifacts,{recursive:true});
const root=path.resolve('dist');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
const browser=await (browserName==='webkit'?webkit:chromium).launch({headless:true,...(browserName==='chromium'?{executablePath:process.env.CHROME_PATH||undefined}:{})});
const groups=[],errors=[];
const labels={zh:{join:'加入牌桌',offline:'离线加入 / 重新配对',title:'离线联机',generate:'1. 生成加入请求',download:'下载配对文件',approve:'同意加入并生成应答',connect:'连接房主',close:'关闭',invite:'邀请',ready:'准备好了',start:'开局',menu:'牌桌菜单',end:'结束本局，返回准备',leave:'离开牌桌'},en:{join:'Join a table',offline:'Join offline / Pair again',title:'Offline multiplayer',generate:'1. Generate join request',download:'Download pairing file',approve:'Approve and generate answer',connect:'Connect to host',close:'Close',invite:'Invite',ready:'Ready',start:'Start',menu:'Table menu',end:'End game and return to lobby',leave:'Leave table'}};
async function button(page,name){await page.getByRole('button',{name,exact:true}).first().click();}
async function download(page,name){const event=page.waitForEvent('download');await button(page,name);const file=await event,target=path.join(artifacts,file.suggestedFilename());await file.saveAs(target);return target;}
async function layout(page,locale,stage){for(const [width,height]of sizes){await page.setViewportSize({width,height});const dialog=page.getByRole('dialog',{name:labels[locale].title,exact:true});await expect(dialog).toBeVisible();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal page overflow');const close=await dialog.getByRole('button',{name:labels[locale].close,exact:true}).boundingBox();assert(close&&close.x>=0&&close.y>=0&&close.x+close.width<=width&&close.y+close.height<=height);await page.screenshot({path:path.join(artifacts,`${locale}-${stage}-${width}x${height}.png`)});}await page.setViewportSize({width:390,height:844});}
async function pair(host,guest,locale,capture=false){const l=labels[locale];
 const received=await guest.evaluate(()=>window.offlineMessages.filter(m=>m.type==='lanSnapshot').length);
 if(await guest.locator('.pause-overlay').count())await button(guest,locale==='zh'?'重连':'Reconnect');else {await button(guest,l.join);await button(guest,l.offline);}
 await expect(guest.getByText(locale==='zh'?'本机离线资源已就绪':'This device is ready to load offline',{exact:true})).toBeVisible();
 if(capture){await button(guest,l.generate);await expect(guest.locator('.offline-export')).toBeVisible({timeout:15000});await button(guest,l.close);assert.equal(await guest.evaluate(()=>window.offlinePeers.at(-1).connectionState),'closed');await button(guest,l.join);await button(guest,l.offline);}
 await button(guest,l.generate);await expect(guest.locator('.offline-export')).toBeVisible({timeout:15000});
 if(capture)await layout(guest,locale,'guest-request');
 const request=await download(guest,l.download);
 if(await host.locator('.pause-overlay').count()){await host.locator('.pause-overlay').getByRole('button',{name:l.menu,exact:true}).click();await button(host,locale==='zh'?'分享邀请':'Share invitation');}else await button(host,l.invite);
 await host.locator('.offline-import input[type=file]').setInputFiles(request);await button(host,l.approve);await expect(host.locator('.offline-export')).toBeVisible({timeout:15000});
 if(capture)await layout(host,locale,'host-answer');
 const answer=await download(host,l.download);
 if(capture){const wrong=JSON.parse(await fs.readFile(answer,'utf8'));wrong.id=crypto.randomUUID();await guest.locator('.offline-import input[type=file]').setInputFiles({name:'wrong-answer.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(wrong))});await button(guest,l.connect);await expect(guest.locator('.offline-pairing [role=alert]')).toContainText(locale==='zh'?'应答不属于':'different request');}
 await guest.locator('.offline-import input[type=file]').setInputFiles(answer);await button(guest,l.connect);
 await button(host,l.close);
 await expect.poll(()=>guest.evaluate(()=>window.offlineMessages.filter(m=>m.type==='lanSnapshot').length),{timeout:25000}).toBeGreaterThan(received);
 await fs.unlink(request);await fs.unlink(answer);
}
try{
 // Every browser context downloads the production assets before the HTTP server is stopped.
 for(const locale of locales){const pages=[];for(let i=0;i<3;i++){
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  await context.addInitScript(({locale,i})=>{
   if(!localStorage.getItem('mocha-profile'))localStorage.setItem('mocha-profile',JSON.stringify({id:`offline-${locale}-${i}`,name:['Host','Guest One','Guest Two'][i],avatar:'🦊'}));
   localStorage.setItem('mocha-locale',locale);window.offlineMessages=[];window.outbound=[];window.offlinePeers=[];
   const Native=window.RTCPeerConnection,observe=dc=>{dc.addEventListener('message',e=>{try{window.offlineMessages.push(JSON.parse(e.data));}catch{}});};
   window.RTCPeerConnection=class extends Native{constructor(...args){super(...args);window.offlinePeers.push(this);this.addEventListener('datachannel',e=>observe(e.channel));}createDataChannel(...args){const dc=super.createDataChannel(...args);observe(dc);return dc;}};
   const original=RTCDataChannel.prototype.send;RTCDataChannel.prototype.send=function(value){window.outbound.push(JSON.parse(value));return original.call(this,value);};
  },{locale,i});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(url);await waitForOfflineReady(page);pages.push(page);
 }groups.push({locale,pages});}
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 for(const {locale,pages} of groups){const [host,one,two]=pages,l=labels[locale];
  for(const page of pages){await page.context().route('**/*',route=>route.abort());await page.context().routeWebSocket('**/*',socket=>socket.close());await page.reload();await page.locator('.cover-sushi').waitFor();assert(await page.locator('.game-cover img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())).then(()=>imgs.every(i=>i.naturalWidth>0))));}
  await host.locator('.cover-sushi').click();
  for(const [width,height]of sizes){await host.setViewportSize({width,height});await button(host,l.title);const create=host.getByRole('button',{name:locale==='zh'?'创建牌桌':'Create table',exact:true}),box=await create.boundingBox();assert(box&&box.y>=0&&box.y+box.height<=height,'create remains reachable after choosing offline mode');assert.equal(await host.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await host.screenshot({path:path.join(artifacts,`${locale}-setup-${width}x${height}.png`)});}
  await host.setViewportSize({width:390,height:844});await button(host,locale==='zh'?'创建牌桌':'Create table');await host.locator('.lobby').waitFor();
  await pair(host,one,locale,true);await pair(host,two,locale);
  await button(one,locale==='zh'?'房间聊天':'Room chat');await one.locator('#room-chat-input').fill('Offline table hello');await button(one,locale==='zh'?'发送消息':'Send message');await expect(one.locator('#room-chat-input')).toHaveValue('');await button(one,l.close);
  await button(host,locale==='zh'?'房间聊天':'Room chat');await expect(host.locator('.social-log')).toContainText('Offline table hello');await host.locator('#room-chat-input').fill('Host reply');await button(host,locale==='zh'?'发送消息':'Send message');await expect(host.locator('#room-chat-input')).toHaveValue('');await button(host,l.close);
  for(const guest of [one,two])await button(guest,l.ready);await expect(host.getByRole('button',{name:l.start,exact:true})).toBeEnabled();await button(host,l.start);
  for(const page of pages)await page.locator('.ng-hand .ng-sushi-card').first().waitFor();
  const snapshot=await one.evaluate(()=>window.offlineMessages.filter(m=>m.type==='lanSnapshot'&&m.view).at(-1));
  assert.equal(snapshot.room.players.length,3);assert.equal(snapshot.view.board.hand.length,9);assert(!('hands' in snapshot.view.board));assert(!('tokens' in snapshot.room));
  const originalMatch=await host.evaluate(()=>{const s=JSON.parse(localStorage.getItem('mocha-room-session'));return JSON.parse(localStorage.getItem('mocha-offline-host-'+s.code)).match;});
  assert.deepEqual(snapshot.view.board.hand,originalMatch.game.hands[1]);
  for(const page of pages){await page.locator('.ng-hand .ng-sushi-card:not([disabled])').first().click();await page.getByRole('button',{name:locale==='zh'?/^确认 1 张/:/^Confirm 1/}).click();}
  await expect.poll(()=>one.evaluate(()=>window.offlineMessages.filter(m=>m.type==='lanSnapshot'&&m.view).at(-1)?.view.board.step)).toBe(2);
  // Reload the host with no HTTP server. Its local authority and private hands must survive.
  const saved=await host.evaluate(()=>{const s=JSON.parse(localStorage.getItem('mocha-room-session'));return JSON.parse(localStorage.getItem('mocha-offline-host-'+s.code));});
  await host.reload();await host.locator('.pause-overlay').waitFor();
  await expect.poll(()=>one.locator('.pause-overlay').count()).toBe(1);
  await pair(host,one,locale);await pair(host,two,locale);
  await expect(host.locator('.pause-overlay')).toHaveCount(0);
  const restored=await host.evaluate(()=>{const s=JSON.parse(localStorage.getItem('mocha-room-session'));return JSON.parse(localStorage.getItem('mocha-offline-host-'+s.code));});
  assert.equal(restored.room.matchID,saved.room.matchID);assert.deepEqual(restored.match,saved.match);
  for(const page of pages){await page.locator('.ng-hand .ng-sushi-card:not([disabled])').first().click();await page.getByRole('button',{name:locale==='zh'?/^确认 1 张/:/^Confirm 1/}).click();}
  await expect.poll(()=>one.evaluate(()=>window.offlineMessages.filter(m=>m.type==='lanSnapshot'&&m.view).at(-1)?.view.board.step)).toBe(3);
  for(const page of pages)assert.equal(await page.evaluate(async()=>{for(const key of await caches.keys())for(const req of await(await caches.open(key)).keys())if(/\/api\/|mocha-(?:answer|request)|offline-host/.test(req.url))return false;return true;}),true,'public cache contains no API responses or pairing files');
  await button(host,l.menu);await button(host,l.end);await host.locator('.lobby').waitFor();await button(host,l.menu);await button(host,l.leave);
  for(const guest of [one,two])await expect(guest.locator('.lobby')).toHaveCount(0);
  console.log(`PASS ${browserName} ${locale}: production cache, HTTP server stopped and HTTP/WS blocked, 3 offline contexts, cancel/wrong answer, file exchange, chat acknowledgements, private hands, actual picks, host reload/re-pair, continued original match, dissolution; 7 sizes and rotation`);
 }
 assert.deepEqual(errors,[]);
}catch(error){for(const {locale,pages}of groups)for(let i=0;i<pages.length;i++){await pages[i].screenshot({path:path.join(artifacts,`${locale}-failure-${i}.png`)}).catch(()=>{});console.log(locale,i,(await pages[i].locator('body').innerText()).slice(-2000),await pages[i].evaluate(()=>window.offlinePeers?.map(p=>({state:p.connectionState,ice:p.iceConnectionState,local:p.localDescription?.sdp.split('\r\n').filter(l=>l.startsWith('a=candidate:')),remote:p.remoteDescription?.sdp.split('\r\n').filter(l=>l.startsWith('a=candidate:'))}))));}throw error;}
finally{await browser.close();server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}
