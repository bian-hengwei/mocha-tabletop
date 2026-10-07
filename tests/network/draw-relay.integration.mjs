import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.TEST_FRONTEND||process.env.BASE_URL||'http://127.0.0.1:5174';
const browser=await chromium.launch();
const contexts=[];
async function player(name){const context=await browser.newContext();contexts.push(context);const page=await context.newPage();await page.goto(base+'/manifest-mocha.webmanifest');await page.evaluate(async name=>{const {RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();window.profile={id:crypto.randomUUID(),name,avatar:'🦊'};},name);return page;}
async function action(page,command){const before=await page.evaluate(()=>client.state.actionRevision);await page.evaluate(c=>client.action(c),command);await page.waitForFunction(before=>client.state.actionRevision!==before||client.state.error,before);assert.equal(await page.evaluate(()=>client.state.error),undefined);}
async function ready(page){await page.waitForFunction(()=>client.state.view&&!client.state.paused&&!client.state.error);}
try{for(const mode of ['cloud','lan'])for(const relayMode of ['rounds','queue']){
 const host=await player('Host'),guest=await player('Guest'),third=await player('Third'),observer=await player('Observer');
 await host.evaluate(({mode,relayMode})=>client.create(profile,'drawrelay',mode,{relaySeconds:60,relayMode,language:'en'}),{mode,relayMode});
 await host.waitForFunction(()=>client.state.room?.code||client.state.error);assert.equal(await host.evaluate(()=>client.state.error),undefined);
 const invitation=await host.evaluate(()=>({code:client.state.room.code,invite:new URLSearchParams(new URL(client.state.inviteURL).hash.slice(1)).get('invite')}));
 for(const p of [guest,third])await p.evaluate(({code,invite})=>client.join(profile,code,invite),invitation);
 await observer.evaluate(({code,invite})=>client.join(profile,code,invite,true),invitation);
 await host.waitForFunction(()=>client.state.room.players.length===3&&client.state.room.spectators.length===1);
 if(mode==='lan')await Promise.all([host,guest,third,observer].map(p=>p.waitForFunction(()=>client.state.transport==='lan')));
 for(const p of [guest,third])await p.evaluate(()=>client.ready(true));await host.waitForFunction(()=>client.state.room.players.every(p=>p.ready));await host.evaluate(()=>client.start());await Promise.all([host,guest,third,observer].map(ready));
 const pages=[host,guest,third];
 if(relayMode==='queue'){
  for(const [i,p] of pages.entries()){const task=`${i}:0`;await action(p,{action:'task',values:[task]});await action(p,{action:'draft',values:[task],text:`PRIVATE ${i}`});await action(p,{action:'submit',values:[task]});}
  await Promise.all(pages.map(p=>p.waitForFunction(()=>client.state.view.board.draft?.kind==='drawing')));
  const task=await host.evaluate(()=>client.state.view.board.taskID);await action(host,{action:'stroke',values:[task,'ABAAAAPPPX']});
  await third.evaluate(()=>client.destroy());await host.waitForFunction(()=>client.state.room.players.some(p=>!p.online));
  assert.equal(await host.evaluate(()=>client.state.paused),false);
  await action(host,{action:'submit',values:[task]});
  assert(!JSON.stringify(await observer.evaluate(()=>client.state.view)).includes('PRIVATE'));
  await third.evaluate(async()=>{const {RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();await client.connect();});await Promise.all(pages.map(ready));
  if(mode==='lan'){await host.evaluate(()=>client.switchToCloud());await Promise.all([...pages,observer].map(p=>p.waitForFunction(()=>client.state.mode==='cloud'&&client.state.view&&!client.state.paused)));}
  let rounds=0;
  while(!await host.evaluate(()=>client.state.view.finished)&&rounds++<20){
   for(const p of pages){const b=await p.evaluate(()=>client.state.view.board);if(!b.draft)continue;const values=[b.taskID];await action(p,b.draft.kind==='drawing'?{action:'stroke',values:[...values,'ABAAAAPPPX']}:{action:'draft',values,text:'Final queue guess'});await action(p,{action:'submit',values});}
  }
  await Promise.all(pages.map(p=>p.waitForFunction(()=>client.state.view.finished)));await host.evaluate(()=>client.leave());
  console.log('PASS queue',mode,'independent progression while player offline, recovery, privacy, complete game and LAN-to-cloud checkpoint');
  for(const p of [...pages,observer])await p.context().close();continue;
 }

 await Promise.all(pages.map((p,i)=>action(p,{action:'draft',values:['0'],text:`SECRET opening ${i}`})));
 for(const p of pages){const v=await p.evaluate(()=>client.state.view);assert.equal(v.board.books,undefined);assert.equal(v.board.drafts,undefined);assert.equal(v.board.previous,undefined);assert.equal((JSON.stringify(v).match(/SECRET/g)||[]).length,1);}
 assert(!JSON.stringify(await observer.evaluate(()=>client.state.view)).includes('SECRET'));
 await Promise.all(pages.map(p=>action(p,{action:'submit',values:['0']})));
 await Promise.all(pages.map(p=>p.waitForFunction(()=>client.state.view.board.step===1&&client.state.view.board.deadlineAt>Date.now())));
 assert.equal(await host.evaluate(()=>client.state.view.board.previous.text),'SECRET opening 2');
 assert.equal(await guest.evaluate(()=>client.state.view.board.previous.text),'SECRET opening 0');
 await Promise.all(pages.map(p=>action(p,{action:'stroke',values:['1','ABAAAAPPPX']})));
 assert.equal(await host.evaluate(()=>client.state.view.board.draft.strokes.length),1);
 assert(!JSON.stringify(await observer.evaluate(()=>client.state.view)).includes('ABAAAAPPPX'));
 const remainingBefore=await host.evaluate(()=>client.state.view.board.deadlineAt-Date.now());
 await third.evaluate(()=>client.destroy());await host.waitForFunction(()=>client.state.paused&&client.state.view.board.deadlineAt===0);
 await third.evaluate(async()=>{const {RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();await client.connect();});await Promise.all(pages.map(ready));
 assert(await host.evaluate(()=>client.state.view.board.deadlineAt-Date.now())>remainingBefore-2500);
 assert.equal(await third.evaluate(()=>client.state.view.board.draft.strokes.length),1);
 if(mode==='lan'){
  await host.evaluate(()=>client.switchToCloud());await Promise.all([...pages,observer].map(p=>p.waitForFunction(()=>client.state.mode==='cloud'&&client.state.view&&!client.state.paused)));assert.equal(await guest.evaluate(()=>client.state.view.board.previous.text),'SECRET opening 0');assert.equal(await guest.evaluate(()=>client.state.view.board.draft.strokes.length),1);
 }
 await Promise.all(pages.map(p=>action(p,{action:'submit',values:['1']})));await Promise.all(pages.map(p=>p.waitForFunction(()=>client.state.view.board.step===2)));
 for(const p of pages){assert.equal(await p.evaluate(()=>client.state.view.board.previous.kind),'drawing');assert(!JSON.stringify(await p.evaluate(()=>client.state.view)).includes('SECRET'));}
 await Promise.all(pages.map((p,i)=>action(p,{action:'draft',values:['2'],text:`Final ${i}`})));await Promise.all(pages.map(p=>action(p,{action:'submit',values:['2']})));await Promise.all(pages.map(p=>p.waitForFunction(()=>client.state.view.finished)));
 await action(guest,{action:'album',values:['2']});assert.equal(await guest.evaluate(()=>client.state.view.board.gallery.book),2);assert.equal(await host.evaluate(()=>client.state.view.board.gallery.book),0);await action(host,{action:'page',values:['1']});await observer.waitForFunction(()=>client.state.view.board.gallery.page===1);assert.equal(await observer.evaluate(()=>client.state.view.board.gallery.entry.kind),'drawing');
 await host.evaluate(()=>client.leave());console.log('PASS draw relay',mode,'simultaneous draft privacy, whole game, disconnect/restore, gallery and observer');
 for(const p of [...pages,observer])await p.context().close();
}
}finally{await browser.close();}
