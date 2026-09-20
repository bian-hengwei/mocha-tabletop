import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
const url=process.env.TEST_FRONTEND||'http://127.0.0.1:5174';
const browserName=process.env.TEST_BROWSER||'chromium';
if(!['chromium','webkit'].includes(browserName))throw new Error('TEST_BROWSER must be chromium or webkit');
const browser=browserName==='webkit'?await webkit.launch({headless:true}):await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const contexts=[];
try{
 async function player(name){const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});contexts.push(context);const page=await context.newPage();page.on('pageerror',e=>console.log(name+' pageerror',e.message));await page.route('**/__network_probe',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>LAN integration</title>'}));await page.goto(url+(browserName==='chromium'?'/manifest.webmanifest':'/__network_probe'));await page.evaluate(async name=>{const {RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();window.player={id:crypto.randomUUID(),name,avatar:'🦊'};window.states=[];client.subscribe(s=>window.states.push(structuredClone(s)));window.cloudMessages=[];const original=WebSocket.prototype.send;WebSocket.prototype.send=function(data){window.cloudMessages.push(JSON.parse(data));return original.call(this,data);};},name);return page;}
 const host=await player('房主'),guest=await player('朋友');
 await host.evaluate(()=>client.create(player,'gems','lan'));await host.waitForFunction(()=>client.state.room?.code);
 const {code,invite}=await host.evaluate(()=>({code:client.state.room.code,invite:new URLSearchParams(new URL(client.state.inviteURL).hash.slice(1)).get('invite')}));
 await guest.evaluate(({code,invite})=>client.join(player,code,invite),{code,invite});
 await guest.waitForFunction(()=>client.state.transport==='lan',undefined,{timeout:20000});await host.waitForFunction(()=>client.state.transport==='lan'&&client.state.room.players.length===2,undefined,{timeout:20000});
 await guest.evaluate(()=>client.ready(true));await host.waitForFunction(()=>client.state.room.players.every(p=>p.ready));await host.evaluate(()=>client.start());
 await host.waitForFunction(()=>!!client.state.view);await guest.waitForFunction(()=>!!client.state.view);assert.equal(await host.evaluate(()=>client.state.paused),false);
 const active=await host.evaluate(()=>client.state.view.actions.length)?host:guest;
 const before=await active.evaluate(()=>({revision:client.state.actionRevision,actions:cloudMessages.filter(m=>m.type==='action').length}));
 await active.evaluate(()=>{const a=client.state.view.actions[0];client.action({action:a.id,values:a.choices.slice(0,a.min).map(c=>c.id)});});
 await active.waitForFunction(revision=>client.state.actionRevision>revision,before.revision);
 assert.equal(await active.evaluate(()=>cloudMessages.filter(m=>m.type==='action').length),before.actions);
 // Force a channel failure: host must pause and then renegotiate without silently changing mode.
 await guest.evaluate(()=>client.peers.get(client.state.room.hostID).dc.close());
 await host.waitForFunction(()=>client.state.paused);
 await host.waitForFunction(()=>!client.state.paused&&client.state.transport==='lan',undefined,{timeout:20000});
 await guest.waitForFunction(()=>!client.state.paused&&client.state.transport==='lan',undefined,{timeout:20000});
 // Reconstruct the host controller using persisted private state, as after a page reload.
 const hostRevision=await host.evaluate(()=>client.state.actionRevision);
 await host.evaluate(async()=>{client.destroy();const {RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();await client.connect();});
 await host.waitForFunction(()=>client.state.view&&!client.state.paused&&client.state.transport==='lan',undefined,{timeout:20000});
 assert.equal(await host.evaluate(()=>client.state.actionRevision),hostRevision);
 // Simulate losing internet/signaling while the local data channel stays alive.
 await host.evaluate(()=>{client.stopped=true;client.ws.close();});await guest.evaluate(()=>{client.stopped=true;client.ws.close();});
 await new Promise(r=>setTimeout(r,500));
 const nextActive=await host.evaluate(()=>client.state.view.actions.length)?host:guest;const rev=await nextActive.evaluate(()=>client.state.actionRevision);
 await nextActive.evaluate(()=>{const a=client.state.view.actions[0];client.action({action:a.id,values:a.choices.slice(0,a.min).map(c=>c.id)});});await nextActive.waitForFunction(revision=>client.state.actionRevision>revision,rev);assert.equal(await nextActive.evaluate(()=>client.state.paused),false);
 // Reconnect signaling, then explicitly transfer authority once to Cloudflare.
 await host.evaluate(()=>client.connect());await guest.evaluate(()=>client.connect());await host.waitForFunction(()=>client.ws.readyState===WebSocket.OPEN);await guest.waitForFunction(()=>client.ws.readyState===WebSocket.OPEN);
 await host.evaluate(()=>client.switchToCloud());await host.waitForFunction(()=>client.state.mode==='cloud'&&client.state.view);await guest.waitForFunction(()=>client.state.mode==='cloud'&&client.state.view);
 assert.equal(await host.evaluate(()=>client.state.transport),'cloud');assert.equal(await host.evaluate(()=>cloudMessages.filter(m=>m.type==='switchToCloud').length),1);
 console.log('PASS '+browserName+' LAN integration: two browser contexts, authenticated DataChannel proof, start, private snapshots, no cloud action traffic, peer failure pause/recovery, host-controller reconstruction, internet/signaling loss continues, explicit in-progress cloud handoff');
 await host.evaluate(()=>{client.endGame();});await host.waitForFunction(()=>!client.state.room.started);await host.evaluate(()=>client.leave());
}catch(error){for(const context of contexts){for(const page of context.pages()){console.log(browserName+' diagnostics',await page.evaluate(()=>({status:window.client?.state.status,error:window.client?.state.error,transport:window.client?.state.transport,paused:window.client?.state.paused,peers:window.client?[...window.client.peers.values()].map(p=>({connection:p.pc.connectionState,ice:p.pc.iceConnectionState,signaling:p.pc.signalingState,channel:p.dc?.readyState,proven:p.proven})):[]})).catch(()=>({page:'unavailable'})));}}throw error;}finally{await browser.close();}
