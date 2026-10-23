import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch(),out=`test-results/relay-active-task-${engine}`;
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
await fs.mkdir(out,{recursive:true});
async function commitComposition(input,text){
 await input.evaluate((element,value)=>{
  const setValue=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
  setValue.call(element,value);
  element.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,data:value,inputType:'insertCompositionText',isComposing:true}));
  element.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,composed:true,data:value}));
 },text);
}
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext();let socket,snapshot,revision=0;
  const errors=[];
  await context.addInitScript(locale=>{
   localStorage.setItem('mocha-locale',locale);
   const profile={id:'player_1',name:'Mocha',avatar:'🦊'};localStorage.setItem('mocha-profile',JSON.stringify(profile));
   sessionStorage.setItem('mocha-room-session',JSON.stringify({profile,code:'ABC234',token:'a'.repeat(48),savedAt:Date.now(),expiresAt:Date.now()+3600000}));
  },locale);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const project=async()=>{
   const view=await page.evaluate(async()=>{const {drawrelay}=await import('/src/core/games/drawrelay.ts');return drawrelay.view(window.relayState,'player_1');});
   snapshot={type:'snapshot',room:{code:'ABC234',kind:'drawrelay',hostID:'player_0',mode:'cloud',players:await page.evaluate(()=>window.relayState.players.map(p=>({...p,connected:true,ready:true}))),spectators:[],pending:[],started:true,options:{relayMode:'queue'},revision:++revision,matchID:'relay-active-task',expiresAt:Date.now()+3600000},view,actionRevision:revision,paused:false};
   socket.send(JSON.stringify(snapshot));
  };
  await context.routeWebSocket('**/api/rooms/**',ws=>{socket=ws;ws.onMessage(async raw=>{
   const message=JSON.parse(String(raw));
   if(message.type==='hello'&&snapshot)ws.send(JSON.stringify(snapshot));
   if(message.type==='action'){
    await page.evaluate(async command=>{const {drawrelay}=await import('/src/core/games/drawrelay.ts');window.relayState=drawrelay.apply(window.relayState,'player_1',command);},message.command);
    await project();
   }
  });});
  await page.goto(base);await expect.poll(()=>!!socket).toBe(true);
  async function seed(drawing=false){
   await page.evaluate(async drawing=>{
    const {drawrelay,encodeRelayStroke}=await import('/src/core/games/drawrelay.ts');
    const players=Array.from({length:6},(_,i)=>({id:`player_${i}`,name:`Player ${i}`,avatar:'🦊'}));
    let s=drawrelay.create(players,1,{relayMode:'queue'});
    if(drawing){
     // Player 1 has passed their opening and now owns drawing 4:3.
     for(const book of [1,4])for(let step=0;step<(book===4?3:1);step++){
      const values=[`${book}:${step}`],id=players[(book+step)%players.length].id;
      s=drawrelay.apply(s,id,step%2?{action:'stroke',values:[...values,encodeRelayStroke([[90,610],[340,220],[640,610]],3,2)]}:{action:'draft',values,text:'A fox in a teacup'});
      s=drawrelay.apply(s,id,{action:'submit',values});
     }
    }
    // Restore an accepted legacy checkpoint without pinned effective selections.
    s.queue.selected={};window.relayState=s;
   },drawing);
   await project();
   if(await page.locator('.relay-sealed button').count())await page.locator('.relay-sealed button').click();
   await expect(page.locator(drawing?'.relay-paper .relay-canvas':'.relay-writing textarea')).toBeVisible();
  }
  async function arrive(){
   await page.evaluate(async()=>{
    const {drawrelay,encodeRelayStroke}=await import('/src/core/games/drawrelay.ts');
    let s=window.relayState;const book=0,steps=1;
    for(let index=0;index<steps;index++){
     const step=s.books[book].length,id=s.players[(book+step)%s.players.length].id,values=[`${book}:${step}`];
     s=drawrelay.apply(s,id,step%2?{action:'stroke',values:[...values,encodeRelayStroke([[90,610],[340,220],[640,610]],3,2)]}:{action:'draft',values,text:'Incoming private page'});
     s=drawrelay.apply(s,id,{action:'submit',values});
    }
    window.relayState=s;
   });await project();
  }
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});await seed();
   const input=page.locator('.relay-writing textarea');
   const prefix='汉'.repeat(119),provisional=prefix+'zhongguo',text=prefix+'中';
   await input.dispatchEvent('compositionstart');await input.fill(provisional);await input.focus();
   // The composing buffer may exceed the product limit; the final candidate is
   // supplied separately below so this does not pretend compositionend replaces value.
   await expect(input).toHaveValue(provisional);
   await arrive();
   await expect(input).toHaveValue(provisional);await expect(input).toBeFocused();
   const tasks=page.locator('.relay-heading select');await expect(tasks).toHaveValue('1:0');await expect(tasks).toBeDisabled();
   await commitComposition(input,text);await expect(input).toHaveValue(text);
   await expect(page.locator('.relay-draft-status')).toContainText(locale==='zh'?'草稿已保存':'Draft saved');
   await expect(tasks).toBeEnabled();await expect(tasks).toHaveValue('1:0');
   await page.screenshot({path:`${out}/${locale}-${width}x${height}-arrival-text.png`});
   await page.locator('.relay-submit button').click();await expect(tasks).not.toHaveValue('1:0');
   await seed();const switchInput=page.locator('.relay-writing textarea');await arrive();
   await switchInput.dispatchEvent('compositionstart');await switchInput.fill(provisional);await commitComposition(switchInput,text);
   await expect(page.locator('.relay-draft-status')).toContainText(locale==='zh'?'草稿已保存':'Draft saved');
   await tasks.selectOption('0:1');await expect(page.locator('.relay-previous')).toContainText('Incoming private page');
   await tasks.selectOption('1:0');await expect(tasks).toHaveValue('1:0');await expect(switchInput).toHaveValue(text);
   await page.reload();await page.locator('.relay-sealed button').click();await expect(page.locator('.relay-writing textarea')).toHaveValue(text);
   // A separate final value above the limit must still be trimmed after composition.
   await seed();const trimInput=page.locator('.relay-writing textarea');
   await trimInput.dispatchEvent('compositionstart');await trimInput.fill(prefix+'zhonghua');
   await expect(trimInput).toHaveValue(prefix+'zhonghua');
   await commitComposition(trimInput,prefix+'中国');await expect(trimInput).toHaveValue(prefix+'中');
   await expect.poll(()=>page.evaluate(()=>window.relayState.queue.drafts[1].text)).toBe(prefix+'中');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow');
   // A lower-numbered task must not replace the canvas while the pointer is down.
   await seed(true);const canvas=page.locator('.relay-paper .relay-canvas'),box=await canvas.boundingBox();
   await page.mouse.move(box.x+box.width*.15,box.y+box.height*.7);await page.mouse.down();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.2);
   await expect(canvas.locator('polyline')).toHaveCount(1);await arrive();
   await expect(tasks).toHaveValue('4:3');await expect(canvas.locator('polyline')).toHaveCount(1);
   await page.mouse.move(box.x+box.width*.8,box.y+box.height*.7);await page.mouse.up();await expect(canvas.locator('polyline')).toHaveCount(1);
   await expect.poll(()=>page.evaluate(()=>window.relayState.queue.drafts[4].strokes.length)).toBe(1);
   await page.getByRole('button',{name:locale==='zh'?'清空画布':'Clear canvas',exact:true}).click();
   await expect(page.getByRole('dialog')).toBeVisible();await page.setViewportSize({width:height,height:width});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
   await page.setViewportSize({width,height});await expect(canvas.locator('polyline')).toHaveCount(1);
   await page.screenshot({path:`${out}/${locale}-${width}x${height}-arrival-drawing.png`});
   await tasks.selectOption('0:1');await expect(canvas.locator('polyline')).toHaveCount(0);
   await tasks.selectOption('4:3');await expect(canvas.locator('polyline')).toHaveCount(1);
   console.log('PASS',locale,width,height,'long composing buffer, final 120th codepoint, over-limit trim, task switch, reload, submit, live drawing and dialog rotation');
  }
  assert.deepEqual(errors,[]);await context.close();
 }
}finally{await browser.close();}
