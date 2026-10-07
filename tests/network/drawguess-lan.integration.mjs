import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const url=process.env.TEST_FRONTEND||process.env.BASE_URL||'http://127.0.0.1:5174';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const contexts=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
 async function player(name) {
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  contexts.push(context);
  const page=await context.newPage();
  await page.route('**/__drawguess_lan_probe',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Draw LAN</title>'}));
  await page.goto(url+'/manifest-mocha.webmanifest');
  await page.evaluate(async name=>{const {RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();window.player={id:crypto.randomUUID(),name,avatar:'🦊'};},name);
  return page;
 }
 const host=await player('Host'),guest=await player('Guest'),third=await player('Third');
 await host.evaluate(()=>client.create(player,'drawguess','lan',{language:'en',drawRounds:1,drawSeconds:45}));
 await host.waitForFunction(()=>client.state.room?.code||client.state.error);assert.equal(await host.evaluate(()=>client.state.error),undefined);
 const invitation=await host.evaluate(()=>({code:client.state.room.code,invite:new URLSearchParams(new URL(client.state.inviteURL).hash.slice(1)).get('invite')}));
 for(const page of [guest,third]) await page.evaluate(({code,invite})=>client.join(player,code,invite),invitation);
 await host.waitForFunction(()=>client.state.room?.players.length===3);await Promise.all([guest,third].map(page=>page.waitForFunction(()=>client.state.transport==='lan')));
 for(const page of [guest,third]) await page.evaluate(()=>client.ready(true));
 await host.waitForFunction(()=>client.state.room.players.every(player=>player.ready));await host.evaluate(()=>client.start());
 await Promise.all([host,guest,third].map(page=>page.waitForFunction(()=>client.state.view&&!client.state.paused&&client.state.transport==='lan')));
 const choice=await host.evaluate(()=>client.state.view.actions.find(action=>action.id==='choose').choices[0].id);
 await host.evaluate(choice=>client.action({action:'choose',values:[choice]}),choice);
 await Promise.all([host,guest,third].map(page=>page.waitForFunction(()=>client.state.view?.board.phase==='draw')));
 assert.equal(await host.evaluate(()=>typeof client.state.view.board.answer==='string'),true);
 assert.equal(await guest.evaluate(()=>client.state.view.board.answer),undefined);
 await host.evaluate(()=>client.action({action:'stroke',values:['10,10','500,500'],text:'#112233'}));
 await guest.waitForFunction(()=>client.state.view.board.strokes.length===1);
 const beforePause=await host.evaluate(()=>client.localMatch.game.deadlineAt);
 await third.evaluate(()=>client.peers.get(client.state.room.hostID).dc.close());
 await host.waitForFunction(()=>client.state.paused&&client.localMatch.game.pausedRemaining!==undefined);
 assert.equal(await host.evaluate(()=>client.localMatch.game.deadlineAt),0);
 await host.waitForFunction(()=>!client.state.paused&&client.state.transport==='lan',{},{timeout:20000});
 await Promise.all([guest,third].map(page=>page.waitForFunction(()=>!client.state.paused&&client.state.transport==='lan',{},{timeout:20000})));
 const resumed=await host.evaluate(()=>({phase:client.localMatch.game.phase,deadlineAt:client.localMatch.game.deadlineAt}));
 assert.equal(resumed.phase,'draw');assert(resumed.deadlineAt>Date.now()+40000,`resume should retain most of ${beforePause}`);
 await host.evaluate(()=>client.switchToCloud());
 await Promise.all([host,guest,third].map(page=>page.waitForFunction(()=>client.state.room?.mode==='cloud'&&client.state.view&&!client.state.paused)));
 const handoff=await host.evaluate(()=>({phase:client.state.view.board.phase,deadlineAt:client.state.view.board.deadlineAt,transport:client.state.transport}));
 assert.equal(handoff.phase,'draw');assert.equal(handoff.transport,'cloud');assert(handoff.deadlineAt>Date.now()+39000,'cloud handoff preserves a live remaining deadline');
 console.log('PASS drawguess LAN: three browsers, private answer, stroke, disconnect pause/resume, cloud handoff');
 await host.evaluate(()=>client.endGame());
 await wait(50);
} finally {
 for(const context of contexts) for(const page of context.pages()) await page.evaluate(()=>{if(window.client?.state.room?.hostID===window.client?.state.selfID)client.leave();}).catch(()=>{});
 await browser.close();
}
