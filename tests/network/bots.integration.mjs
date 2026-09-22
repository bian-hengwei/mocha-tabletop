import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.TEST_FRONTEND||'http://127.0.0.1:5207';
const engine=process.env.TEST_BROWSER||'chromium';
const modes=(process.env.TEST_ROOM_MODES||'cloud,lan').split(',');
assert(modes.length&&modes.every(mode=>['cloud','lan'].includes(mode)),'TEST_ROOM_MODES must contain cloud and/or lan');
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const contexts=[];
try{
 async function make(name){const context=await browser.newContext();contexts.push(context);const page=await context.newPage();await page.route('**/__bot_network',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Bot room network verification</title>'}));await page.goto(base+'/__bot_network');await page.evaluate(async name=>{const{RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();window.profile={id:crypto.randomUUID(),name,avatar:'🦊'};window.errors=[];window.snapshots=[];client.subscribe(s=>{if(s.error)errors.push(s.error);snapshots.push(structuredClone(s));});},name);return page;}
 for(const mode of modes){
  const host=await make('Host'),guest=await make('Guest');
  await host.evaluate(mode=>client.create(profile,'sushi',mode),mode);await host.waitForFunction(()=>client.state.room?.code);
  const joining=await host.evaluate(()=>({code:client.state.room.code,invite:new URLSearchParams(new URL(client.state.inviteURL).hash.slice(1)).get('invite')}));
  await guest.evaluate(({code,invite})=>client.join(profile,code,invite),joining);await host.waitForFunction(()=>client.state.room.players.length===2);
  await host.evaluate(()=>client.addBot('easy'));await host.waitForFunction(()=>client.state.room.players.length===3);await host.evaluate(()=>client.addBot('hard'));await host.waitForFunction(()=>client.state.room.players.length===4);
  if(mode==='lan')await host.waitForFunction(()=>client.state.transport==='lan',undefined,{timeout:25000});
  await guest.evaluate(()=>client.ready(true));await host.waitForFunction(()=>client.state.room.players.every(p=>p.ready));await host.evaluate(()=>client.start());await guest.waitForFunction(()=>client.state.view);
  await host.waitForFunction(()=>client.state.view.board.players.filter(p=>p.bot).every(p=>p.ready),undefined,{timeout:12000});
  assert.equal(await host.evaluate(()=>client.state.paused),false);assert.equal(await host.evaluate(()=>client.state.room.players.filter(p=>p.bot).every(p=>p.connected)),true);
  const matchID=await host.evaluate(()=>client.state.room.matchID);
  // Bot hands never appear in human payloads (their public plate is allowed).
  assert.equal(await host.evaluate(()=>client.state.view.board.players.filter(p=>p.bot).some(p=>'hand' in p||'hands' in p||'selected' in p)),false);
  // Close the human guest transport. The host must preserve the seat and pause.
  await guest.evaluate(()=>client.destroy());await host.waitForFunction(()=>client.state.paused,undefined,{timeout:20000});
  const before=await host.evaluate(()=>JSON.stringify(client.state.view));await new Promise(r=>setTimeout(r,1500));assert.equal(await host.evaluate(()=>JSON.stringify(client.state.view)),before);
  await guest.evaluate(async()=>{const{RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();await client.connect();});await host.waitForFunction(()=>!client.state.paused,undefined,{timeout:25000});await guest.waitForFunction(()=>client.state.view&&!client.state.paused);
  assert.equal(await guest.evaluate(()=>client.state.room.matchID),matchID);
  // Reconstruct the LAN host from persisted state; cloud reconstructs from DO.
  await host.evaluate(async()=>{client.destroy();const{RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();await client.connect();});await host.waitForFunction(()=>client.state.view&&!client.state.paused,undefined,{timeout:25000});assert.equal(await host.evaluate(()=>client.state.room.matchID),matchID);
  if(mode==='lan'){
   assert.equal(await host.evaluate(()=>client.peers.size),1);
   await host.evaluate(()=>client.switchToCloud());await host.waitForFunction(()=>client.state.room.mode==='cloud'&&client.state.view);await guest.waitForFunction(()=>client.state.room.mode==='cloud'&&client.state.view);assert.equal(await host.evaluate(()=>client.state.room.matchID),matchID);
  }
  // A complete three-round match via public per-player views is network regression,
  // separate from the LLM UI playtest. Humans choose their first offered card.
  for(let step=0;step<35&&!await host.evaluate(()=>client.state.view.finished);step++){
   const roundStep=await host.evaluate(()=>client.state.view.board.round*100+client.state.view.board.step);
   for(const page of [host,guest])await page.evaluate(()=>{const a=client.state.view.actions.find(a=>a.id==='pick');if(a)client.action({action:'pick',values:[a.choices[0].id]});});
   await host.waitForFunction(step=>client.state.view.finished||client.state.view.board.round*100+client.state.view.board.step>step,roundStep,{timeout:15000});
  }
  assert.equal(await host.evaluate(()=>client.state.view.finished),true);await guest.waitForFunction(()=>client.state.view.finished);assert.equal(await host.evaluate(()=>client.state.room.botError),undefined);
  await host.evaluate(()=>client.replay());await host.waitForFunction(()=>!client.state.room.started);assert.equal(await host.evaluate(()=>client.state.room.players.filter(p=>p.bot).every(p=>p.ready)),true);await host.evaluate(()=>client.leave());await guest.waitForFunction(()=>client.state.status==='idle');
 }
 for(const mode of modes){
  const host=await make('Solo Host');await host.evaluate(mode=>client.create(profile,'sushi',mode),mode);await host.waitForFunction(()=>client.state.room?.code);
  for(let count=0;count<4;count++){await host.evaluate(()=>client.addBot('normal'));await host.waitForFunction(count=>client.state.room.players.filter(p=>p.bot).length===count,count+1);}
  await host.evaluate(()=>client.start());await host.waitForFunction(()=>client.state.view&&!client.state.paused);
  if(mode==='lan')assert.equal(await host.evaluate(()=>client.peers.size),0,'bots require no LAN peers');
  for(let step=0;step<35&&!await host.evaluate(()=>client.state.view.finished);step++){
   const roundStep=await host.evaluate(()=>client.state.view.board.round*100+client.state.view.board.step);
   await host.evaluate(()=>{const action=client.state.view.actions.find(a=>a.id==='pick');if(action)client.action({action:'pick',values:[action.choices[0].id]});});
   await host.waitForFunction(step=>client.state.view.finished||client.state.view.board.round*100+client.state.view.board.step>step,roundStep,{timeout:15000});
  }
  assert.equal(await host.evaluate(()=>client.state.view.finished),true);assert.equal(await host.evaluate(()=>client.state.room.botError),undefined);await host.evaluate(()=>client.leave());await host.waitForFunction(()=>client.state.status==='idle');
 }
 console.log(`PASS ${engine} ${modes.join('/')}: mixed and solo-human Sushi complete matches, automatic bots, private payloads, pause/reconnect, host reconstruction, ${modes.includes('lan')?'LAN-to-cloud handoff, ':''}replay and cleanup`);
}finally{await browser.close();}
