import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
const url=process.env.TEST_FRONTEND||'http://127.0.0.1:5174';
const browserName=process.env.TEST_BROWSER||'chromium';
const browser=browserName==='webkit'?await webkit.launch({headless:true}):await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
try{
 async function player(name){const context=await browser.newContext();const page=await context.newPage();await page.route('**/__fallback_probe',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Pairing fallback</title>'}));await page.goto(url+(browserName==='chromium'?'/manifest-mocha.webmanifest':'/__fallback_probe'));await page.evaluate(async name=>{const {RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();window.player={id:crypto.randomUUID(),name,avatar:'🦊'};const original=WebSocket.prototype.send;WebSocket.prototype.send=function(data){if(JSON.parse(data).type==='signal')return;return original.call(this,data);};},name);return page;}
 const host=await player('房主'),guest=await player('朋友');
 await host.evaluate(()=>client.create(player,'gems','lan'));await host.waitForFunction(()=>client.state.room||client.state.error);assert.equal(await host.evaluate(()=>client.state.error),undefined,'LAN room creation must succeed');
 const invitation=await host.evaluate(()=>({code:client.state.room.code,invite:new URLSearchParams(new URL(client.state.inviteURL).hash.slice(1)).get('invite')}));
 await guest.evaluate(({code,invite})=>client.join(player,code,invite),invitation);await guest.waitForFunction(()=>client.state.room);await guest.evaluate(()=>client.ready(true));await host.waitForFunction(()=>client.state.room.players.length===2&&client.state.room.players.every(p=>p.ready));
 await host.evaluate(()=>client.start());assert.equal(await host.evaluate(()=>client.state.room.started),false);assert.match(await host.evaluate(()=>client.state.error),/切换云端/);
 await host.evaluate(()=>client.switchToCloud());for(const page of [host,guest])await page.waitForFunction(()=>client.state.room.mode==='cloud');
 await host.evaluate(()=>client.start());for(const page of [host,guest])await page.waitForFunction(()=>client.state.view&&!client.state.paused);
 const active=await host.evaluate(()=>client.state.view.actions.length)?host:guest;const revision=await active.evaluate(()=>client.state.actionRevision);
 await active.evaluate(()=>{const action=client.state.view.actions[0];client.action({action:action.id,values:action.choices.slice(0,action.min).map(c=>c.id)});});await active.waitForFunction(revision=>client.state.actionRevision>revision,revision);
 await host.evaluate(()=>client.leave());await guest.waitForFunction(()=>client.state.status==='idle');
 console.log(`PASS ${browserName} blocked LAN fallback: unpaired start explains recovery, explicit cloud switch retains roster/readiness, game starts and actions advance, clean dissolution`);
}finally{await browser.close();}
