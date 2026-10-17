import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_FRONTEND||process.env.BASE_URL||'http://127.0.0.1:5174';
const modes=(process.env.TEST_ROOM_MODES||'cloud,lan').split(',');
assert(modes.every(mode=>['cloud','lan'].includes(mode)),'unknown room mode');
const browser=await chromium.launch(),out='test-results/relay-gallery-recovery';await fs.mkdir(out,{recursive:true});
async function player(name){const context=await browser.newContext(),page=await context.newPage();await page.goto(base+'/manifest-mocha.webmanifest');await page.evaluate(async name=>{const {RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();window.profile={id:crypto.randomUUID(),name,avatar:'🦊'};},name);return page;}
async function action(page,command){const before=await page.evaluate(()=>client.state.actionRevision);await page.evaluate(command=>{client.clearError();client.action(command);},command);await page.waitForFunction(before=>client.state.actionRevision!==before||client.state.error,before);assert.equal(await page.evaluate(()=>client.state.error),undefined,JSON.stringify(command));}
async function rejected(page,command,error){await page.evaluate(command=>{client.clearError();client.action(command);},command);await page.waitForFunction(()=>!!client.state.error);assert.equal(await page.evaluate(()=>client.state.error),error);await page.evaluate(()=>client.clearError());}
async function ready(page){await page.waitForFunction(()=>client.state.view&&!client.state.paused&&!client.state.error);}
try{for(const mode of modes){
 const pages=await Promise.all(['Host','Guest','Third','Observer'].map(player)),[host,guest,third,observer]=pages;
 try{
  await host.evaluate(mode=>client.create(profile,'drawrelay',mode,{relayMode:'rounds',relaySeconds:0}),mode);
  await host.waitForFunction(()=>client.state.room?.code||client.state.error);assert.equal(await host.evaluate(()=>client.state.error),undefined);
  const invite=await host.evaluate(()=>({code:client.state.room.code,invite:new URLSearchParams(new URL(client.state.inviteURL).hash.slice(1)).get('invite')}));
  for(const page of [guest,third])await page.evaluate(data=>client.join(profile,data.code,data.invite),invite);
  await observer.evaluate(data=>client.join(profile,data.code,data.invite,true),invite);
  await host.waitForFunction(()=>client.state.room.players.length===3&&client.state.room.spectators.length===1);
  if(mode==='lan')await Promise.all(pages.map(page=>page.waitForFunction(()=>client.state.transport==='lan')));
  for(const page of [guest,third])await page.evaluate(()=>client.ready(true));await host.waitForFunction(()=>client.state.room.players.every(p=>p.ready));await host.evaluate(()=>client.start());await Promise.all(pages.map(ready));
  await third.evaluate(()=>client.destroy());await host.waitForFunction(()=>client.state.paused);
  await rejected(host,{action:'draft',values:['0'],text:'must stay paused'},'连接恢复后继续');
  await rejected(host,{action:'page',values:['1']},'连接恢复后继续');
  assert.equal(await host.evaluate(()=>client.state.view.board.draft.text),'');
  await third.evaluate(async()=>{const {RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();await client.connect();});await Promise.all(pages.map(ready));
  for(let step=0;step<3;step++){
   for(const page of [host,guest,third])await action(page,step%2?{action:'stroke',values:[String(step),'ABAAAAPPPX']}:{action:'draft',values:[String(step)],text:`Sentence ${step}`});
   for(const page of [host,guest,third])await action(page,{action:'submit',values:[String(step)]});
   await Promise.all(pages.map(page=>page.waitForFunction(step=>client.state.view.board.step===step+1,step)));
  }
  await Promise.all(pages.map(page=>page.waitForFunction(()=>client.state.view.finished)));
  await third.evaluate(()=>client.destroy());await host.waitForFunction(()=>client.state.room.players.some(p=>!p.connected));
  const snapshot=await host.evaluate(()=>({paused:client.state.paused,finished:client.state.view.finished,players:client.state.room.players.map(p=>({name:p.name,connected:p.connected}))}));
  await fs.writeFile(`${out}/${mode}-offline-snapshot.json`,JSON.stringify(snapshot,null,2));
  await action(host,{action:'page',values:['1']});
  await expect.poll(()=>host.evaluate(()=>client.state.view.board.gallery.page)).toBe(1);
  await action(guest,{action:'album',values:['2']});await action(guest,{action:'page',values:['2']});
  assert.equal(await guest.evaluate(()=>client.state.view.board.gallery.book),2);assert.equal(await host.evaluate(()=>client.state.view.board.gallery.book),0);
  await observer.waitForFunction(()=>client.state.view.board.gallery.page===1);
  await rejected(observer,{action:'page',values:['1']},'观众不能操作牌局');
  await rejected(host,{action:'submit',values:['3']},'连接恢复后继续');
  await rejected(host,{action:'page',values:['01']},'连接恢复后继续');
  await rejected(host,{action:'page',values:['3']},'操作无效');
  assert.equal(await host.evaluate(()=>client.state.view.board.gallery.page),1);
  await guest.evaluate(()=>client.destroy());
  await guest.evaluate(async()=>{const {RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();await client.connect();});
  await guest.waitForFunction(()=>client.state.view?.finished&&client.state.transport===client.state.mode);
  assert.equal(await guest.evaluate(()=>client.state.view.board.gallery.book),2);assert.equal(await guest.evaluate(()=>client.state.view.board.gallery.page),2);
  await action(guest,{action:'page',values:['1']});
  assert.equal(await guest.evaluate(()=>client.state.view.board.gallery.page),1);
  console.log('PASS',mode,'finished gallery host/guest browse with another player offline, independent cursors and read-only spectator projection');
 }finally{await host.evaluate(()=>client.leave()).catch(()=>{});for(const page of pages)await page.context().close();}
}}finally{await browser.close();}
