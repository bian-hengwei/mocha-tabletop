import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const api=process.env.TEST_API_BASE||'http://127.0.0.1:8787';
const engine=process.env.TEST_BROWSER||'chromium';
assert(['chromium','webkit'].includes(engine),`Unsupported TEST_BROWSER=${engine}`);
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const output=`test-results/relay-lobby-players-${engine}`;
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
const contexts=[],errors=[],reports=[],roomCodes=[];
await fs.mkdir(output,{recursive:true});

const waitRoom=async page=>{await page.locator('.lobby').waitFor();await expect(page.locator('.lobby-player-count select')).toBeVisible();};
const addProfile=async(locale,name,id)=>{
 const profile={id,name,avatar:['🦊','🐼','🐱','🐻','🐰','🐨','🐯','🦉','🐸','🐧','🦋','🦝'][contexts.length%12]};
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});contexts.push(context);
 await context.addInitScript(({profile,locale})=>{localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale',locale);}, {profile,locale});
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));
 return {context,page,profile};
};
const enterHome=async p=>{await p.goto(base);await p.locator('.cover-drawrelay').waitFor();};
const enterRoom=async(p,code)=>{await p.getByRole('button',{name:/加入牌桌|Join a table/}).click();await p.getByRole('textbox',{name:/房间码|Room code/}).fill(code);await p.getByRole('button',{name:/^(入桌|Join)$/}).click();};
const readyButton=p=>p.getByRole('button',{name:/^(准备好了|Ready)$/});
const approve=async(host,guestName,locale)=>host.getByRole('button',{name:`${locale==='zh'?'同意':'Approve'}${locale==='zh'?'':' '}${guestName}`,exact:true}).click();
const toggleCount=page=>page.locator('.lobby-player-count select');
const capture=async(page,label,viewport)=>{
 await page.screenshot({path:`${output}/${label}-${viewport.width}x${viewport.height}.png`,fullPage:false});
};
const inspectCountControl=async(page,locale,expected)=>{
 const select=toggleCount(page),rect=await select.boundingBox();assert(rect,`${locale} count control visible`);
 assert(rect.width>=44&&rect.height>=44,`${locale} count control target below 44px: ${JSON.stringify(rect)}`);
 const hit=await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('.lobby-player-count select')),{x:rect.x+rect.width/2,y:rect.y+rect.height/2});
 assert(hit,'center point of player-count control must hit the native select');
 assert.equal(await select.getAttribute('aria-label'),locale==='zh'?'本局人数':'Players this game');
 await expect(select).toHaveValue(String(expected));
 return rect;
};

async function createRoomViaUi(host){
 await enterHome(host);await host.locator('.cover-drawrelay').click();
 await host.getByRole('button',{name:/云端联机|Online/}).click();await host.getByRole('button',{name:/创建牌桌|Create table/}).click();await waitRoom(host);
 const code=(await host.locator('.room-code').innerText()).trim();assert.match(code,/^[A-Z2-9]{6}$/);roomCodes.push(code);return code;
}
async function joinAndApprove(host,guest,code,locale){
 await enterHome(guest.page);await enterRoom(guest.page,code);
 await approve(host,guest.profile.name,locale);await waitRoom(guest.page);
}
async function createLegacyRoom(host){
 const token=Buffer.from(randomUUID().replaceAll('-',''),'hex').toString('hex').padEnd(48,'a').slice(0,48);
 const response=await fetch(`${api}/api/create`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:host.profile,kind:'drawrelay',mode:'cloud',token})});
 const body=await response.json();assert.equal(response.status,200,`legacy room create: ${JSON.stringify(body)}`);
 roomCodes.push(body.code);
 await host.context.addInitScript(({profile,code,invite,token})=>sessionStorage.setItem('mocha-room-session',JSON.stringify({profile,code,invite,token,savedAt:Date.now(),expiresAt:Date.now()+3600000})),{profile:host.profile,code:body.code,invite:body.invite,token});
 await host.page.goto(base);await waitRoom(host.page);return body.code;
}
async function leaveRoom(page){
 if(!await page.locator('.lobby,.game-surface').count())return;
 await page.getByRole('button',{name:/牌桌菜单|Table menu/}).click();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:/离开牌桌|Leave table/}).click();
 await page.locator('.cover-drawrelay').waitFor({timeout:10000}).catch(()=>{});
}

try{
 for(const locale of ['zh','en']){
  // New Online rooms start with a three-player target. Raise it before the
  // additional seats join, then verify the host-only change resets readiness.
  const group=[];
  for(let i=0;i<4;i++)group.push(await addProfile(locale,i===0?(locale==='zh'?'接龙桌主长名01':'Long Host Name'):(locale==='zh'?`接龙长昵称${i}号`:`Player Long ${i}`),`relay-lobby-small-${locale}-${i}`));
  const host=group[0].page;
  const frames=[];host.on('websocket',socket=>socket.on('framereceived',({payload})=>{try{const msg=JSON.parse(String(payload));if(msg.room)frames.push(msg);}catch{}}));
  const code=await createRoomViaUi(host),count=toggleCount(host);
  await expect(count).toHaveValue('3');
  await expect(host.locator('.lobby-player-count label')).toContainText(locale==='zh'?'本局人数':'Players this game');
  await count.selectOption('6');await expect(count).toHaveValue('6');
  for(const guest of group.slice(1))await joinAndApprove(host,guest,code,locale);
  for(const guest of group.slice(1)){await readyButton(guest.page).click();await expect(guest.page.getByRole('button',{name:/^(取消准备|Not ready)$/})).toBeVisible();}
  await expect(host.locator('.lobby-seats .lobby-seat:not(.vacant)')).toHaveCount(4);
  await count.selectOption('4');await expect(count).toHaveValue('4');
  for(const guest of group.slice(1)){
   await expect(guest.page.locator('.lobby-player-count select')).toBeDisabled();
   await expect(toggleCount(guest.page)).toHaveValue('4');
   await expect(readyButton(guest.page)).toBeVisible();
  }
  await expect(host.locator('.lobby-seats .lobby-seat:not(.vacant)')).toHaveCount(4);
  // A target below occupied seats must be rejected without evicting anyone.
  await count.selectOption('3');await expect(count).toHaveValue('4');
  await expect(host.locator('.lobby-seats .lobby-seat:not(.vacant)')).toHaveCount(4);
  await expect(host.locator('.toast')).toContainText(locale==='zh'?'本局人数不能少于已入座人数':'cannot be below the seated count');
  for(const guest of group.slice(1))await readyButton(guest.page).click();
  await expect(host.getByRole('button',{name:/^(开局|Start)$/})).toBeEnabled();
  await host.getByRole('button',{name:/^(开局|Start)$/}).click();await host.locator('.relay-table').waitFor();
  await expect(host.locator('.lobby-player-count')).toHaveCount(0);
  await expect.poll(()=>frames.some(msg=>msg.room?.started&&msg.room?.options?.relayPlayers===4&&msg.room.players.length===4&&msg.view?.board?.players?.length===4)).toBe(true);
  await capture(host,`${locale}-four-player-start`,{width:390,height:844});
  for(const guest of group)await leaveRoom(guest.page).catch(()=>{});
  console.log(`PASS ${engine} ${locale}: new-room target 3, 6→4 sync, guest readonly/readiness reset, under-seat rejection, actual four-player start, no active-game selector`);
 }

 // Maximum roster is a real twelve-browser room. Check long names, scrolling,
 // readable/touchable control geometry and host/guest synchronization at every
 // required viewport in both locales, then reconnect both seats.
 for(const locale of ['zh','en']){
  const group=[];
  for(let i=0;i<12;i++)group.push(await addProfile(locale,i===0?(locale==='zh'?'长昵称接龙房主01':'Long Host Name'):(locale==='zh'?`接龙长昵称${String(i).padStart(2,'0')}号`:`Player Long ${String(i).padStart(2,'0')}`), `relay-lobby-max-${locale}-${i}`));
  const host=group[0].page,code=await createRoomViaUi(host),count=toggleCount(host);
  await count.selectOption('12');await expect(count).toHaveValue('12');
  for(const guest of group.slice(1))await joinAndApprove(host,guest,code,locale);
  await expect(host.locator('.lobby-seats .lobby-seat')).toHaveCount(12);
  await expect(host.locator('.lobby-seats')).toContainText(locale==='zh'?'接龙长昵称':'Player Long');
  await expect(group[1].page.locator('.lobby-player-count select')).toBeDisabled();
  await expect(toggleCount(group[1].page)).toHaveValue('12');
  for(const [index,[width,height]] of sizes.entries()){
   const viewport={width,height};await host.setViewportSize(viewport);await group[1].page.setViewportSize(viewport);
   const hostRect=await inspectCountControl(host,locale,12);await inspectCountControl(group[1].page,locale,12);
   const metrics=await host.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,lobbyScroll:document.querySelector('.lobby-content').scrollHeight>document.querySelector('.lobby-content').clientHeight,controlText:document.querySelector('.lobby-player-count').innerText,seatCount:document.querySelectorAll('.lobby-seat').length}));
   assert(metrics.scrollWidth<=metrics.viewport+1,`${locale} ${width}x${height}: page horizontal overflow ${JSON.stringify(metrics)}`);
   assert.equal(metrics.seatCount,12,`${locale} ${width}x${height} complete max roster`);
   if((width===568&&height===320)||(width===320&&height===568))assert(metrics.lobbyScroll,`${locale} ${width}x${height} must allow roster scroll`);
   await capture(host,`${locale}-max12-host`,viewport);
   if(width===568&&height===320){
    const scroll=await host.locator('.lobby-content').evaluate(el=>{el.scrollTop=el.scrollHeight;const box=el.getBoundingClientRect(),start=el.querySelector('.lobby-start').getBoundingClientRect();return{top:el.scrollTop,max:el.scrollHeight-el.clientHeight,contentBottom:box.bottom,startBottom:start.bottom};});
    assert(scroll.top>0&&scroll.max>0&&scroll.startBottom<=scroll.contentBottom+1,`${locale} 568x320 scroll must reach start controls: ${JSON.stringify(scroll)}`);
    await capture(host,`${locale}-max12-scroll-bottom`,viewport);
   }
   if(index===2||index===7)await capture(group[1].page,`${locale}-max12-guest`,viewport);
   reports.push({engine,locale,viewport,hostRect,metrics});
  }
  await host.reload();await waitRoom(host);await expect(toggleCount(host)).toHaveValue('12');
  await group[1].page.reload();await waitRoom(group[1].page);await expect(toggleCount(group[1].page)).toHaveValue('12');
  await expect(group[1].page.locator('.lobby-player-count select')).toBeDisabled();
  await expect(host.locator('.lobby-seats .lobby-seat')).toHaveCount(12);
  await leaveRoom(host);
  await Promise.all(group.slice(1).map(guest=>guest.context.close()));
  console.log(`PASS ${engine} ${locale}: twelve long-name seats, both-language 8-viewport control/scroll screenshots, guest readonly and target survives reload/reconnect`);
 }

 // An API-created legacy room deliberately omits relayPlayers, matching rooms
 // made before the fixed target was introduced.
 for(const locale of ['zh','en']){
  const legacy=await addProfile(locale,`Legacy Host ${locale}`,`relay-lobby-legacy-${locale}`);
  await createLegacyRoom(legacy);await expect(toggleCount(legacy.page)).toHaveValue('auto');
  await expect(toggleCount(legacy.page).locator('option[value="auto"]')).toHaveText(locale==='zh'?'按入座人数（3–12）':'Use seated count (3–12)');
  await inspectCountControl(legacy.page,locale,'auto');
  await capture(legacy.page,`${locale}-legacy-auto`,{width:390,height:844});
  await leaveRoom(legacy.page);await legacy.context.close();
 }

 // Practice remains independent from the online lobby option.
 const practice=await addProfile('zh','练习玩家','relay-lobby-practice');await enterHome(practice.page);
 await practice.page.locator('.cover-drawrelay').click();
 await practice.page.getByRole('button',{name:/同屏试玩|Pass & play/}).click();await practice.page.locator('.relay-table').waitFor();
 await expect(practice.page.locator('.lobby-player-count')).toHaveCount(0);
 await capture(practice.page,'zh-practice-no-online-count',{width:390,height:844});
 await expect(practice.page.locator('.relay-table')).toBeVisible();
 await practice.context.close();
 assert.deepEqual(errors,[]);
 await fs.writeFile(`${output}/report.json`,JSON.stringify({engine,base,api,roomCodes,reports,errors},null,2));
 console.log(`PASS ${engine}: relay lobby player count full UI acceptance; rooms ${roomCodes.join(', ')}`);
}finally{
 for(const context of contexts)await context.close().catch(()=>{});
 await browser.close();
}
