import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.TEST_FRONTEND||'http://127.0.0.1:5174';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
try{
 async function make(name){const context=await browser.newContext(),page=await context.newPage();await page.goto(base+'/manifest-mocha.webmanifest');await page.evaluate(async name=>{const {RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();window.player={id:crypto.randomUUID(),name,avatar:'🦊'};},name);return page;}
 const host=await make('主人'),guest=await make('客人');
 await guest.evaluate(()=>client.join(player,'bad'));assert.equal(await guest.evaluate(()=>client.state.status),'idle');assert.match(await guest.evaluate(()=>client.state.error),/六位/);
 await guest.evaluate(()=>client.join(player,'AAAAAA'));await guest.waitForFunction(()=>client.state.status==='idle'&&client.state.error);
 await host.evaluate(()=>client.create(player,'gems','cloud'));await host.waitForFunction(()=>client.state.room);const code=await host.evaluate(()=>client.state.room.code);
 await guest.evaluate(code=>client.join(player,code),code);await guest.waitForFunction(()=>client.state.waitingApproval);const id=await guest.evaluate(()=>player.id);await host.waitForFunction(id=>client.state.room.pending.some(p=>p.id===id),id);await host.evaluate(id=>client.approve(id,false),id);await guest.waitForFunction(()=>client.state.status==='idle'&&client.state.error?.includes('婉拒'));
 assert.equal(await guest.evaluate(()=>client.state.room),undefined);assert.equal(await guest.evaluate(()=>sessionStorage.getItem('mocha-room-session')),null);
 const invite=await host.evaluate(()=>new URLSearchParams(new URL(client.state.inviteURL).hash.slice(1)).get('invite'));await guest.evaluate(({code,invite})=>client.join(player,code,invite),{code,invite});await guest.waitForFunction(()=>client.state.room);await guest.evaluate(()=>client.ready(true));await host.waitForFunction(()=>client.state.room.players.every(p=>p.ready));await host.evaluate(()=>client.start());await guest.waitForFunction(()=>client.state.view);
 await host.evaluate(()=>client.leave());await guest.waitForFunction(()=>client.state.status==='idle'&&client.state.error?.includes('解散'));assert.equal(await guest.evaluate(()=>client.state.view),undefined);assert.equal(await guest.evaluate(()=>client.state.room),undefined);assert.equal(await guest.evaluate(()=>client.state.paused),false);
 await guest.evaluate(()=>client.leave());assert.equal(await guest.evaluate(()=>client.state.error),undefined);await guest.evaluate(()=>client.create(player,'bombs','cloud'));await guest.waitForFunction(()=>client.state.room?.kind==='bombs');await guest.evaluate(()=>client.leave());
 console.log('PASS browser terminal flow: malformed/nonexistent code recover, rejected application clears room/session, host dissolves active game, guest returns home and creates another room');
}finally{await browser.close();}
