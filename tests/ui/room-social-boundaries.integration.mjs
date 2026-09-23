import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const out=`test-results/room-social-boundaries-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
const host={id:'social-host',name:'Long host name',avatar:'\uD83D\uDC31',ready:true,connected:true};
const guest={id:'social-guest',name:'Guest long <b>',avatar:'\uD83E\uDD8A',ready:true,connected:true};
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  let socket,mode='reject',lastRequest,snapshot;
  await context.routeWebSocket('**/api/rooms/**',ws=>{socket=ws;ws.onMessage(raw=>{
   const message=JSON.parse(String(raw));
   if(message.type==='hello')ws.send(JSON.stringify(snapshot));
   if(message.type==='social'){
    lastRequest=message;
    if(mode==='reject')ws.send(JSON.stringify({type:'socialError',requestID:message.requestID,error:'发送太快，请稍等片刻'}));
    if(mode==='accept'){
     snapshot.social={...snapshot.social,revision:snapshot.social.revision+1,messages:message.command.type==='chat'?[...snapshot.social.messages,{id:message.requestID,player:host,text:message.command.text,at:Date.now()}].slice(-80):snapshot.social.messages,reactions:message.command.type==='reaction'?[{id:message.requestID,playerID:host.id,reaction:message.command.reaction,at:Date.now()}]:snapshot.social.reactions};
     ws.send(JSON.stringify({type:'social',social:snapshot.social,serverNow:Date.now()}));
     ws.send(JSON.stringify({type:'socialAck',requestID:message.requestID}));
    }
   }
  });});
  await context.addInitScript(({locale,host})=>{
   localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify(host));
   sessionStorage.setItem('mocha-room-session',JSON.stringify({profile:host,code:'ABC234',token:'a'.repeat(48),savedAt:Date.now(),expiresAt:Date.now()+3600000}));
  },{locale,host});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  snapshot={type:'snapshot',room:{code:'ABC234',hostID:host.id,kind:'gems',mode:'cloud',players:[host,guest],pending:[],started:false,revision:1,expiresAt:Date.now()+3600000},social:{revision:80,messages:Array.from({length:80},(_,i)=>({id:`old-${i}`,player:i%2?host:guest,text:`Message ${i}: ${'long message '.repeat(12)}`,at:Date.now()-600000+i*1300})),reactions:[]},serverNow:Date.now()};
  await page.goto(base);await expect(page.locator('.room-code')).toContainText('ABC234');
  await expect(page.locator('.topbar .social-avatar-button')).toHaveCount(0);await page.locator('.profile-chip').click();await expect(page.locator('.profile-editor')).toBeVisible();await expect(page.locator('.social-dialog')).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.locator('.profile-chip')).toBeFocused();
  await page.locator('.social-chat-trigger').click();await expect(page.locator('.social-log article')).toHaveCount(80);
  await expect.poll(()=>page.locator('.social-log').evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)).toBeLessThan(30);
  // New arrivals must not move a reader who is browsing earlier messages.
  await page.locator('.social-log').evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
  snapshot.social={...snapshot.social,revision:81,messages:[...snapshot.social.messages.slice(1),{id:'live-bubble',player:guest,text:'Bubble after closing chat',at:Date.now()}]};
  socket.send(JSON.stringify({type:'social',social:snapshot.social,serverNow:Date.now()}));
  await expect(page.locator('.social-log article').last()).toContainText('Bubble after closing chat');
  assert.equal(await page.locator('.social-log').evaluate(el=>el.scrollTop),0);
  await page.keyboard.press('Escape');await expect(page.locator('.social-bubble')).toBeVisible();
  await page.locator('.social-chat-trigger').click();await expect(page.locator('.social-bubble')).toBeHidden();
  const input=page.locator('#room-chat-input');await input.fill('Keep this draft');
  await page.locator('.social-dialog button[type=submit]').click();await expect(page.locator('.social-error')).toContainText(locale==='zh'?'发送太快':'Sending too fast');await expect(input).toHaveValue('Keep this draft');
  mode='silent';await page.locator('.social-dialog button[type=submit]').click();await expect(page.locator('.social-dialog button[type=submit]')).toBeDisabled();
  await expect(page.locator('.social-error')).toContainText(locale==='zh'?'未确认发送':'Delivery not confirmed',{timeout:10000});await expect(input).toHaveValue('Keep this draft');
  socket.send(JSON.stringify({type:'socialAck',requestID:lastRequest.requestID}));await expect(input).toHaveValue('Keep this draft');
  mode='accept';await page.locator('.social-dialog button[type=submit]').click();await expect(input).toHaveValue('');await expect(page.locator('.social-log article')).toHaveCount(80);
  await input.fill('中'.repeat(280));await expect(page.locator('.social-dialog form small')).toHaveText('280/280');
  await input.dispatchEvent('keydown',{key:'Enter',keyCode:229});await expect(input).toHaveValue('中'.repeat(280));
  await input.dispatchEvent('keydown',{key:'Escape',isComposing:true});await expect(page.locator('.social-dialog')).toBeVisible();
  // Model a software keyboard's visual viewport without claiming OS keyboard coverage.
  await page.evaluate(()=>{const viewport=window.visualViewport;Object.defineProperty(viewport,'height',{configurable:true,value:360});Object.defineProperty(viewport,'offsetTop',{configurable:true,value:24});viewport.dispatchEvent(new Event('resize'));});
  await expect.poll(()=>page.locator('.social-shade').evaluate(el=>el.getBoundingClientRect().height)).toBe(360);
  for(const control of ['.social-dialog header button','#room-chat-input','.social-dialog button[type=submit]']){const rect=await page.locator(control).boundingBox();assert(rect&&rect.y>=24&&rect.y+rect.height<=384,`${control} reachable with keyboard viewport`);}
  await page.screenshot({path:`${out}/${locale}-keyboard-viewport.png`,animations:'disabled'});
  await page.evaluate(()=>{const viewport=window.visualViewport;delete viewport.height;delete viewport.offsetTop;viewport.dispatchEvent(new Event('resize'));});
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});
   await page.screenshot({path:`${out}/${locale}-${width}-history.png`,animations:'disabled'});
   const close=page.locator('.social-dialog header button');await close.focus();await page.keyboard.press('Shift+Tab');
   assert(await page.locator('.social-dialog').evaluate(el=>el.contains(document.activeElement)),'focus stays in dialog');
   await page.keyboard.press('Escape');await expect(page.locator('.social-chat-trigger')).toBeFocused();
   await page.locator('.social-avatar-button').click();await page.screenshot({path:`${out}/${locale}-${width}-picker.png`,animations:'disabled'});await page.keyboard.press('Escape');await page.locator('.social-chat-trigger').click();
  }
  await page.keyboard.press('Escape');await page.locator('.social-avatar-button').click();
  const pictures=page.locator('.social-sticker-grid img');await expect(pictures).toHaveCount(1);
  for(let i=0;i<await pictures.count();i++){
   const img=pictures.nth(i),frames=new Set();await expect.poll(()=>img.evaluate(el=>el.complete&&el.naturalWidth)).toBe(300);
   for(let frame=0;frame<8;frame++){
    const png=await img.screenshot({path:`${out}/${locale}-animation-${i}-${frame}.png`});frames.add(createHash('sha256').update(png).digest('hex'));await page.waitForTimeout(137);
   }
   assert(frames.size>1,`reaction ${i} must actually animate in ${engine}`);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  for(let i=0;i<await pictures.count();i++)await expect.poll(()=>pictures.nth(i).evaluate(el=>el.currentSrc)).toMatch(/-still\.png$/);
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});
  snapshot.social={...snapshot.social,revision:snapshot.social.revision+1,reactions:[{id:'seat-only-cow',playerID:host.id,reaction:'cow',at:Date.now()}]};
  socket.send(JSON.stringify({type:'social',social:snapshot.social,serverNow:Date.now()}));
  await expect(page.locator('.lobby-seats .social-avatar-reaction')).toHaveCount(1);
  await expect(page.locator('.topbar .social-avatar-reaction')).toHaveCount(0);
  await page.screenshot({path:`${out}/${locale}-seat-only-reaction.png`,animations:'disabled'});
  await page.locator('.social-chat-trigger').click();
  // Explicit seat transitions clear the draft and remove send permissions.
  snapshot={...snapshot,room:{...snapshot.room,hostID:guest.id,players:[guest],spectators:[host]},serverNow:Date.now()};socket.send(JSON.stringify(snapshot));
  await expect(page.locator('.social-dialog')).toHaveCount(0);await page.locator('.social-chat-trigger').click();await expect(input).toHaveCount(0);await expect(page.locator('.profile-chip')).toHaveCount(1);await expect(page.locator('.social-avatar-button')).toHaveCount(0);
  await expect(page.locator('.social-scope')).toContainText(locale==='zh'?'只读':'Read-only');await page.keyboard.press('Escape');
  snapshot={...snapshot,room:{...snapshot.room,hostID:host.id,players:[host,guest],spectators:[]},serverNow:Date.now()};socket.send(JSON.stringify(snapshot));
  await page.locator('.social-chat-trigger').click();await expect(input).toHaveValue('');
  for(const storage of ['localStorage','sessionStorage'])assert(!(await page.evaluate(key=>JSON.stringify({...window[key]}),storage)).includes('Keep this draft'));
  await page.keyboard.press('Escape');await page.locator('.brand .icon').click();await page.locator('.menu-list').getByRole('button',{name:locale==='zh'?'修改昵称头像':'Edit name and avatar',exact:true}).click();await expect(page.locator('.profile-editor input')).toBeVisible();
  await page.keyboard.press('Escape');
  const finished=await page.evaluate(async players=>{
   const {doudizhu}=await import('/src/core/games/poker.ts'),{chooseBotCommand}=await import('/src/core/bots/index.ts');
   let game=doudizhu.create(players,71);
   for(let step=0;step<1000;step++){
    if(doudizhu.view(game,players[0].id).finished)return doudizhu.view(game,players[0].id);
    const next=players.map(player=>({player,view:doudizhu.view(game,player.id)})).find(({view})=>view.actions.length);
    if(!next)throw Error('finished social fixture has no legal actor');
    const command=chooseBotCommand(next.view,next.player.id,'normal',step);if(!command)throw Error('finished social fixture has no legal command');
    game=doudizhu.apply(game,next.player.id,command);
   }
   throw Error('finished social fixture did not finish');
  },[host,guest,{...guest,id:'social-third',name:'Third player'}]);
  snapshot={...snapshot,room:{...snapshot.room,kind:'doudizhu',players:[host,guest,{...guest,id:'social-third',name:'Third player'}],started:true,matchID:'finished-social'},view:finished,serverNow:Date.now()};socket.send(JSON.stringify(snapshot));
  for(const [width,height] of sizes){await page.setViewportSize({width,height});await expect(page.locator('.classic-results .social-avatar-button')).toBeVisible();await page.locator('.classic-results .social-avatar-button').click();await expect(page.locator('.social-sticker-grid')).toBeVisible();await page.keyboard.press('Escape');await page.screenshot({path:`${out}/${locale}-${width}-finished.png`,animations:'disabled'});}
  await page.locator('.classic-results .social-avatar-button').click();await page.locator('.social-sticker-grid button').click();await expect(page.locator('.social-dialog')).toHaveCount(0);await expect(page.locator('.classic-results .social-avatar-reaction')).toHaveCount(1);await expect(page.locator('.topbar .social-avatar-button,.topbar .social-avatar-reaction')).toHaveCount(0);
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS',engine,locale,'history scroll, bubble visibility, rejected/uncertain delivery, drafts, IME, focus/rotation, animated cow/static alternative, seat-only overlays, read-only spectators, seat changes, no chat persistence, profile access');
 }
}finally{await browser.close();}
