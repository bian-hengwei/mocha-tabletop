import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Real Worker + real App. CDP freezes Chromium execution; WebKit uses Playwright's
// clock to suspend page timers. Neither is a physical phone/OS suspension test.
const base=process.env.TEST_FRONTEND||'http://127.0.0.1:5174';
const engine=process.env.TEST_BROWSER||'chromium';
assert(['chromium','webkit'].includes(engine));
const browser=await(engine==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const contexts=[],errors=[];
let host,guest;
fs.mkdirSync('test-results',{recursive:true});
async function setup(name,viewport){
 const context=await browser.newContext({viewport,hasTouch:viewport.width<500,isMobile:viewport.width<500});contexts.push(context);
 await context.addInitScript(({name,id})=>{
  if(!['http:','https:'].includes(location.protocol))return;
  if(!localStorage.getItem('mocha-profile'))localStorage.setItem('mocha-profile',JSON.stringify({id,name,avatar:'🦊'}));
  window.initialTabSession=sessionStorage.getItem('mocha-room-session');
  window.testNet={sockets:[],history:[],snapshot:null};
  const Native=WebSocket;
  window.WebSocket=class extends Native{
   constructor(...args){super(...args);if(!new URL(String(args[0]),location.href).pathname.startsWith('/api/rooms/'))return;window.testNet.sockets.push(this);this.addEventListener('message',event=>{
    const msg=JSON.parse(event.data);if(msg.type==='snapshot'){window.testNet.snapshot=msg;window.testNet.history.push({paused:msg.paused,matchID:msg.room.matchID});}
   });}
  };
 },{name,id:crypto.randomUUID()});
 return newPage(context);
}
async function newPage(context){const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(base);return page;}
const table=async page=>{await expect(page.locator('.g-table')).toBeVisible();await expect(page.locator('.pause-overlay')).toHaveCount(0);};
const checkpoint=page=>page.evaluate(()=>({matchID:testNet.snapshot.room.matchID,selfID:JSON.parse(localStorage.getItem('mocha-room-session')).profile.id,view:testNet.snapshot.view,revision:testNet.snapshot.actionRevision}));
async function sameMatch(page,saved){await table(page);assert.deepEqual(await checkpoint(page),saved);assert.equal(await page.evaluate(()=>testNet.snapshot.room.players.length),2);}
try{
 host=await setup('恢复房主',{width:390,height:844});guest=await setup('恢复朋友',{width:1440,height:900});
 await host.getByRole('button',{name:'选择晶石商会',exact:true}).click();await host.getByRole('button',{name:/云端联机/}).click();await host.getByRole('button',{name:'创建牌桌',exact:true}).click();
 const code=(await host.locator('.room-code').innerText()).trim();
 await guest.getByRole('button',{name:'加入牌桌',exact:true}).click();await guest.getByRole('textbox',{name:'房间码',exact:true}).fill(code);await guest.getByRole('button',{name:'入桌',exact:true}).click();
 await host.getByRole('button',{name:'同意恢复朋友',exact:true}).click();await guest.getByRole('button',{name:'准备好了',exact:true}).click();await host.getByRole('button',{name:'开局',exact:true}).click();await table(host);await table(guest);
 for(let i=0;i<3;i++)await host.locator('.g-bank-gem').nth(i).click();await host.getByRole('button',{name:'拿取 3',exact:true}).click();await guest.locator('.your-turn').waitFor();
 await guest.evaluate(()=>localStorage.setItem('mocha-locale','en'));await guest.reload();await table(guest);await expect(guest.locator('html')).toHaveAttribute('lang','en');
 const hostSaved=await checkpoint(host),guestSaved=await checkpoint(guest);
 // Suspend timer execution beyond both old client (45s) and server (65s) cutoffs.
 const socketCount=await guest.evaluate(()=>testNet.sockets.length);
 await host.evaluate(()=>{testNet.history=[];});
 let cdp;
 if(engine==='chromium'){cdp=await guest.context().newCDPSession(guest);await cdp.send('Page.setWebLifecycleState',{state:'frozen'});}
 else{await guest.clock.install();await guest.clock.pauseAt(new Date());}
 console.log(engine+': suspending the guest for 95 seconds while the host remains active');
 await new Promise(resolve=>setTimeout(resolve,95000));
 assert.equal(await host.evaluate(()=>testNet.history.some(s=>s.paused)),false,'background suspension must not disconnect the guest');
 if(cdp)await cdp.send('Page.setWebLifecycleState',{state:'active'});else await guest.clock.resume();
 await guest.bringToFront();await guest.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 await sameMatch(guest,guestSaved);assert.equal(await guest.evaluate(()=>testNet.sockets.length),socketCount,'healthy transport survives suspension');
 console.log('PASS '+engine+' suspended timers, retained socket/seat, foreground state sync');
 // Real transport loss during offline state, then automatic recovery.
 await guest.context().setOffline(true);await guest.evaluate(()=>testNet.sockets.at(-1).close());await expect(host.locator('.pause-overlay')).toBeVisible();
 await guest.context().setOffline(false);await sameMatch(guest,guestSaved);await sameMatch(host,hostSaved);
 // Back navigation exercises the pageshow path when the engine uses BFCache.
 await guest.goto('about:blank');await guest.goBack();await sameMatch(guest,guestSaved);
 // Close BOTH pages, so neither keeps the room active. Fresh tabs have no sessionStorage.
 const hc=host.context(),gc=guest.context();await guest.close();await host.close();
 host=await newPage(hc);guest=await newPage(gc);
 assert.equal(await host.evaluate(()=>window.initialTabSession),null);assert.equal(await guest.evaluate(()=>window.initialTabSession),null);
 await sameMatch(host,hostSaved);await sameMatch(guest,guestSaved);
 await host.screenshot({path:`test-results/lifecycle-${engine}-mobile-reopened.png`});await guest.screenshot({path:`test-results/lifecycle-${engine}-desktop-reopened.png`});
 // Continue the restored turn through actual controls; no redeal or duplicate action.
 for(let i=0;i<3;i++)await guest.locator('.g-bank-gem').nth(i).click();await guest.getByRole('button',{name:'Take 3',exact:true}).click();await host.locator('.your-turn').waitFor();
 await expect(guest.locator('.g-own-stock .stock-numbers b').nth(0)).toHaveText('1');
 console.log('PASS '+engine+' offline transport recovery, back navigation, both tabs closed/reopened, original identities/match/private view, Chinese mobile + English desktop, continued turn');
 assert.deepEqual(errors,[]);
} catch(error){
 for(const [name,page] of [['host',host],['guest',guest]])if(page&&!page.isClosed()){console.error(name,await page.locator('body').innerText().catch(()=>'(unavailable)'));await page.screenshot({path:`test-results/lifecycle-${engine}-${name}-failure.png`}).catch(()=>{});}
 throw error;
} finally {
 if(host&&!host.isClosed())try{
  const s=await host.evaluate(()=>localStorage.getItem('mocha-room-session'));
  if(s)await host.evaluate(async raw=>{const session=JSON.parse(raw),url=new URL(testNet.sockets.at(-1).url);
   await new Promise(resolve=>{const ws=new WebSocket(url),timer=setTimeout(()=>{ws.close();resolve();},5000);ws.onopen=()=>ws.send(JSON.stringify({type:'hello',...session}));ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.type==='snapshot')ws.send(JSON.stringify({type:'leave',requestID:crypto.randomUUID()}));if(m.type==='ended'){clearTimeout(timer);ws.close();resolve();}};});
  },s);
 }catch(error){console.error('Room cleanup failed:',error.message);}
 await Promise.all(contexts.map(c=>c.close()));await browser.close();
}
