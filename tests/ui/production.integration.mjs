import {waitForOfflineReady} from './offline-ready.mjs';
import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.BASE_URL||'https://mocha-tabletop-web.pages.dev';
const safari=process.env.TEST_BROWSER==='webkit',skipOffline=process.env.TEST_SKIP_OFFLINE==='1';
const contexts=[],pages=[],errors=[];
fs.mkdirSync('test-results',{recursive:true});
const scenarios=[
 {title:'晶石商会',count:2,selector:'.g-table',key:'gems'},
 {title:'喵喵危机',count:2,selector:'.bt-table',key:'bombs'},
 {title:'月夜议会',count:6,selector:'.social-table-v2',key:'werewolf-standard',mode:'玩家操作'},
 {title:'迷雾远征',count:5,selector:'.social-table-v2',key:'avalon'},
 {title:'寿司小宴',count:2,selector:'.ng-table',key:'sushi'},
 {title:'香料商旅',count:2,selector:'.ng-table',key:'century'},
 {title:'七彩接龙',count:2,selector:'.ng-table',key:'uno'},
 {title:'密语行动',count:4,selector:'.wg-table',key:'codenames'},
 {title:'异词同伴',count:3,selector:'.wg-table',key:'undercover'},
 {title:'月夜议会',count:7,selector:'.social-table-v2',key:'werewolf-judge',mode:'法官主持'},
 {title:'月夜议会',count:6,selector:'.social-table-v2',key:'werewolf-deal',mode:'只发身份'},
];
const requested=process.env.TEST_GAMES?.split(',').map(key=>key.trim());
if(requested){
 const unknown=requested.filter(key=>!scenarios.some(s=>s.key===key));
 assert.equal(unknown.length,0,'Unknown TEST_GAMES: '+JSON.stringify(unknown)+'. Available: '+scenarios.map(s=>s.key).join(','));
}
const selectedScenarios=scenarios.filter(s=>!requested||requested.includes(s.key));
const browser=await(safari?webkit.launch({headless:true}):chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined}));
const reveal=async page=>{
 await expect(page.getByRole('dialog',{name:'我的秘密身份'})).toHaveCount(0);
 await page.getByRole('button',{name:'查看我的身份',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'我的秘密身份'})).toBeVisible();
 await expect(page.locator('.identity-story h2')).not.toHaveText('');
 await page.getByRole('button',{name:'收起身份',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'我的秘密身份'})).toHaveCount(0);
};
try{
 for(let i=0;i<7;i++){
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2});contexts.push(context);
  const delay=Number(process.env.TEST_ACTION_DELAY_MS||0);
  if(delay)await context.routeWebSocket('**/api/rooms/**',socket=>{
   const server=socket.connectToServer();let closed=false;const timers=new Set();
   socket.onClose(()=>{closed=true;for(const timer of timers)clearTimeout(timer);server.close();});
   server.onClose(()=>{closed=true;for(const timer of timers)clearTimeout(timer);socket.close();});
   server.onMessage(message=>{const timer=setTimeout(()=>{timers.delete(timer);if(!closed)socket.send(message);},delay);timers.add(timer);});
  });
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
  // Keep this identity across reloads, just as the real profile does.
  const profile={id:`acceptance-${i}-${crypto.randomUUID()}`,name:`验收${i+1}`,avatar:['🦊','🐼','🐱','🐻','🐰','🐨','🐯'][i]};
  await page.addInitScript(profile=>localStorage.setItem('mocha-profile',JSON.stringify(profile)),profile);
  await page.goto(base);await page.getByRole('button',{name:'选择晶石商会',exact:true}).waitFor();
 }
 const host=pages[0];
 for(const {title,count,selector,key,mode}of selectedScenarios){
  await host.getByRole('button',{name:'选择'+title,exact:true}).click();
  if(mode)await host.locator('.wolf-mode-picker button').filter({hasText:mode}).click();
  await host.getByRole('button',{name:/云端联机/}).click();await host.getByRole('button',{name:'创建牌桌',exact:true}).click();
  await host.locator('.room-code').waitFor();const code=(await host.locator('.room-code').textContent()).trim();assert.match(code,/^[A-Z2-9]{6}$/);
  for(let i=1;i<count;i++){
   const p=pages[i];await p.getByRole('button',{name:'加入牌桌',exact:true}).click();await p.getByRole('textbox',{name:'房间码',exact:true}).fill(code);await p.getByRole('button',{name:'入桌',exact:true}).click();
   await host.getByRole('button',{name:`同意验收${i+1}`,exact:true}).click();await p.getByRole('button',{name:'准备好了',exact:true}).click();
  }
  await host.getByRole('button',{name:'开局',exact:true}).click();
  for(let i=0;i<count;i++)await pages[i].locator(selector).waitFor();
  await expect(host.locator('.connection')).toHaveText('云端联机');
  if(key==='gems'){
   for(let i=0;i<3;i++)await host.locator('.g-bank-gem').nth(i).click();
   await host.getByRole('button',{name:'拿取 3',exact:true}).click();await pages[1].locator('.your-turn').waitFor();
   await expect(host.locator('.g-own-stock .stock-numbers b').nth(0)).toHaveText('1');
   await expect(pages[1].locator('.g-own-stock .stock-numbers b').nth(0)).toHaveText('0');
   await pages[1].reload();await pages[1].locator('.your-turn').waitFor();
   await expect(pages[1].locator('.g-merchant').nth(0).locator('.stock-numbers b').nth(0)).toHaveText('1');
  }else if(key==='bombs'){
   const actor=(await Promise.all(pages.slice(0,count).map(p=>p.locator('.bt-deck').isEnabled()))).findIndex(Boolean);assert.ok(actor>=0);
   const deck=pages[actor].locator('.bt-deck'),before=Number((await deck.getAttribute('aria-label')).match(/\d+/)[0]);
   await deck.click();
   for(const p of pages.slice(0,count))await expect(p.locator('.bt-deck')).toHaveAttribute('aria-label',`抽牌，剩余 ${before-1} 张`);
  }else if(key==='werewolf-judge'){
   await expect(host.locator('.judge-player')).toHaveCount(6);
   assert.ok(!(await host.locator('.judge-roster').textContent()).includes('验收1'));
   await expect(host.getByRole('button',{name:'查看我的身份',exact:true})).toHaveCount(0);
   for(const p of pages.slice(1,count)){
    await expect(p.locator('.personal-card-button')).toBeVisible();await expect(p.locator('.judge-table')).toHaveCount(0);await expect(p.locator('.dock-actions button')).toHaveCount(0);
   }
   await reveal(pages[1]);
   const prior=await host.locator('.judge-console h2').textContent();
   await host.locator('.judge-next').click();await host.locator('.action-sheet').getByRole('button',{name:'放弃 / 无人',exact:true}).click();await host.locator('.action-sheet').getByRole('button',{name:'确认',exact:true}).click();
   await expect(host.locator('.judge-console h2')).not.toHaveText(prior);
   await host.reload();await expect(host.locator('.judge-player')).toHaveCount(6);await expect(host.locator('.judge-console h2')).not.toHaveText(prior);
   await pages[1].reload();await expect(pages[1].locator('.personal-card-button')).toBeVisible();await expect(pages[1].locator('.judge-table')).toHaveCount(0);
  }else if(key==='werewolf-deal'){
   for(const p of pages.slice(0,count)){await expect(p.locator('.personal-seat small')).toHaveText('第 1 次发牌');await expect(p.locator('.judge-table')).toHaveCount(0);}
   await reveal(host);await reveal(pages[1]);
   await pages[1].getByRole('button',{name:'查看我的身份',exact:true}).click();
   await host.getByRole('button',{name:'重新发身份',exact:true}).click();
   await host.locator('.action-sheet').getByRole('button',{name:'确认重发，所有人原身份作废',exact:true}).click();await host.locator('.action-sheet').getByRole('button',{name:'确认',exact:true}).click();
   for(const p of pages.slice(0,count)){
    await expect(p.locator('.personal-seat small')).toHaveText('第 2 次发牌');await expect(p.getByRole('dialog',{name:'我的秘密身份'})).toHaveCount(0);
   }
   await pages[1].reload();await expect(pages[1].locator('.personal-seat small')).toHaveText('第 2 次发牌');
   await expect(pages[1].getByRole('button',{name:'重新发身份',exact:true})).toHaveCount(0);
  }else if(['sushi','century','uno','codenames','undercover'].includes(key)){
   if(key==='century'){
    const actor=(await Promise.all(pages.slice(0,count).map(async p=>await p.locator('.ng-century-hand-panel .ng-spice-card:enabled').count()?p:null))).find(Boolean);assert(actor);
    await actor.getByRole('button',{name:'升级 2 次',exact:true}).click();
    if(process.env.TEST_ACTION_DELAY_MS){await expect(actor.locator('.game-surface')).toHaveAttribute('inert','');await expect(actor.locator('.action-pending')).toContainText('正在提交');}
    await actor.getByRole('button',{name:'再升级 2 次',exact:true}).click();await actor.locator('.action-sheet .choice').first().click();await actor.locator('.action-sheet footer button').click();
    // Clicking the next step immediately must wait for the preceding server reply.
    await actor.getByRole('button',{name:'结束升级',exact:true}).click();await expect(actor.locator('.ng-pocket-active')).toHaveCount(0);await expect(actor.locator('.toast')).toHaveCount(0);
   }
   if(key==='uno'){
    let played=false;
    for(let attempt=0;attempt<12&&!played;attempt++){
     const actor=(await Promise.all(pages.slice(0,count).map(async p=>await p.locator('.ng-uno-playbar').count()?p:null))).find(Boolean);assert(actor,'UNO actor');
     const hand=actor.locator('.ng-uno-hand .ng-uno-card'),normal=actor.locator('.ng-uno-hand .ng-uno-card:not(:disabled):not(.ng-wild-card)'),wild=actor.locator('.ng-uno-hand .ng-wild-card:not(:disabled)');
     const before=await hand.count();
     if(await normal.count()){await normal.first().dblclick();played=true;}
     else if(await wild.count()){await wild.first().dblclick();await expect(actor.locator('.ng-uno-colors button')).toHaveCount(4);await actor.locator('.ng-uno-colors button').first().click();await actor.locator('.ng-uno-play').click();played=true;}
     else{await actor.locator('.ng-uno-play-actions button:not(:disabled)').first().click();await actor.waitForTimeout(250);}
     if(played){await expect(hand).toHaveCount(before-1);const top=await actor.locator('.ng-uno-center .ng-uno-card').getAttribute('aria-label');for(const p of pages.slice(0,count))await expect(p.locator('.ng-uno-center .ng-uno-card')).toHaveAttribute('aria-label',top);}
    }
    assert(played,'played through the actual cloud UI shortcut');
   }
   // Every recipient restores the authoritative board after reconnecting.
   for(const p of pages.slice(0,count)){
    await p.reload();await expect(p.locator(selector)).toBeVisible();
    await expect(p.locator('.connection')).toHaveText('云端联机');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,key+' cloud overflow');
   }
   if(key==='codenames')for(const p of pages.slice(0,count))await expect(p.locator('.wg-word.wg-assassin')).toHaveCount(0);
   if(key==='undercover')for(const p of pages.slice(0,count))await expect(p.locator('.wg-secret.wg-open')).toHaveCount(0);
  }else{
   for(const p of pages.slice(0,count)){await expect(p.getByRole('dialog',{name:'我的秘密身份'})).toHaveCount(0);await expect(p.locator('.seat')).toHaveCount(count);}
   await reveal(host);
  }
  await host.screenshot({path:`test-results/${safari?'webkit':'chrome'}-${key}-cloud.png`});
  await host.getByRole('button',{name:'牌桌菜单',exact:true}).click();host.once('dialog',d=>d.accept());await host.getByRole('button',{name:'离开牌桌',exact:true}).click();
  for(let i=0;i<count;i++)await pages[i].getByRole('button',{name:'选择晶石商会',exact:true}).waitFor();
  for(let i=0;i<count;i++){const dismiss=pages[i].getByRole('button',{name:'关闭提示',exact:true});if(await dismiss.count())await dismiss.click();}
  console.log('PASS live UI room',key,count,'people');
 }
 const manifest=await host.evaluate(async()=>await(await fetch(document.querySelector('link[rel=manifest]').href)).json());assert.equal(manifest.orientation,'any');assert.equal(manifest.display,'standalone');
 if(skipOffline)console.log('SKIP service worker/offline checks (TEST_SKIP_OFFLINE=1); manifest checked');
 else{
  await waitForOfflineReady(host);
  if(!safari){
   await contexts[0].setOffline(true);await host.reload();await host.getByRole('button',{name:'选择晶石商会',exact:true}).waitFor();
   for(const title of ['晶石商会','喵喵危机','月夜议会','迷雾远征','寿司小宴','香料商旅','七彩接龙','密语行动','异词同伴','斗地主','掼蛋','麻将']){
    await host.getByRole('button',{name:'选择'+title,exact:true}).click();await host.getByRole('button',{name:'同屏试玩',exact:true}).click();await host.locator('.game-surface').waitFor();
    await host.getByRole('button',{name:'牌桌菜单',exact:true}).click();host.once('dialog',d=>d.accept());await host.getByRole('button',{name:'结束试玩',exact:true}).click();
   }
   assert.equal(await host.locator('.game-cover img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
   console.log('PASS service worker installation, offline reload, all twelve offline practices, cached cover images');
  }else console.log('PASS WebKit manifest, activated controller and cached page assets; offline navigation excluded because this environment also fails a minimal service-worker offline control');
 }
 assert.deepEqual(errors,[]);console.log('PASS production acceptance',safari?'WebKit':'Chromium',base);
}catch(error){
 for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:`test-results/acceptance-failure-${safari?'webkit':'chrome'}-${i}.png`}).catch(()=>{});
 // Preserve failure evidence first, then dissolve this run's room even when an
 // assertion or an interaction fails before the normal end-of-scenario cleanup.
 const host=pages[0];
 if(host)try{
  await contexts[0].setOffline(false);
  if(await host.locator('.connection').count()){
   await host.getByRole('button',{name:'牌桌菜单',exact:true}).click({timeout:5000});
   host.once('dialog',dialog=>dialog.accept());
   await host.getByRole('button',{name:'离开牌桌',exact:true}).click({timeout:5000});
   await host.locator('.game-cover').first().waitFor({timeout:5000});
   console.log('Cleaned up acceptance room after failure');
  }
 }catch(cleanupError){console.error('Acceptance room cleanup failed:',cleanupError.message);}
 throw error;
}
finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();}
process.exit(0);
