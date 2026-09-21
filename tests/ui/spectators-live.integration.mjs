import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',out='test-results/spectators-live';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined}),errors=[];
try{for(const mode of (process.env.TEST_MODES?.split(',')||['cloud','lan'])){
 const contexts=[];let host,invite;
 async function page(name){const c=await browser.newContext({viewport:{width:390,height:844}});contexts.push(c);await c.addInitScript(name=>{if(!localStorage.getItem('mocha-profile'))localStorage.setItem('mocha-profile',JSON.stringify({id:crypto.randomUUID(),name,avatar:'🦊'}));if(!localStorage.getItem('mocha-locale'))localStorage.setItem('mocha-locale','zh');},name);const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));await p.goto(base);return p;}
 try{
  host=await page('Host');const guest=await page('Player'),watcher=await page('Observer');
  host.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const m=JSON.parse(payload);if(m.invite)invite=m.invite;}catch{}}));
  await host.locator('.cover-gems').click();if(mode==='cloud')await host.getByRole('button',{name:/云端联机/}).click();await host.getByRole('button',{name:'创建牌桌',exact:true}).click();await host.locator('.room-code').waitFor();const code=(await host.locator('.room-code').textContent()).trim();
  async function join(p,spectator=false,link=false){if(link){await p.goto(base+'/manifest-mocha.webmanifest');await p.goto(`${base}/?room=${code}#invite=${invite}`);}else{await p.getByRole('button',{name:'加入牌桌',exact:true}).click();await p.getByRole('textbox',{name:'房间码',exact:true}).fill(code);}if(spectator)await p.getByRole('checkbox',{name:'以观众身份加入'}).check();await p.getByRole('button',{name:'入桌',exact:true}).click();}
  await join(guest);await host.getByRole('button',{name:'同意 Player',exact:true}).click();await guest.getByRole('button',{name:'准备好了',exact:true}).waitFor();
  await join(watcher,true,true);await watcher.getByRole('button',{name:'转为玩家',exact:true}).click();await expect(watcher.locator('.lobby-seats .lobby-seat:not(.vacant)')).toHaveCount(3);await watcher.getByRole('button',{name:'进入观战席',exact:true}).click();await expect(watcher.locator('.lobby-seats .lobby-seat:not(.vacant)')).toHaveCount(2);
  await host.locator('.audience-trigger').click();await expect(host.locator('.spectator-list')).toContainText('Observer');await host.getByRole('checkbox',{name:'允许观战'}).waitFor();await host.screenshot({path:`${out}/${mode}-lobby-audience.png`});await host.keyboard.press('Escape');
  await guest.getByRole('button',{name:'准备好了',exact:true}).click();await host.getByRole('button',{name:'开局',exact:true}).click();await watcher.locator('.spectator-surface .g-table').waitFor();await expect(watcher.locator('.g-own-tray')).toHaveCount(0);
  if(mode==='lan')await expect(watcher.locator('.connection')).toContainText('Wi-Fi');
  const late=await page('Late observer');await join(late);await host.locator('.audience-trigger').click();await host.getByRole('button',{name:'同意 Late observer',exact:true}).click();await late.locator('.spectator-surface .g-table').waitFor();
  // Public inventory stays usable, and no private reserve is offered.
  await watcher.locator('.g-merchant').first().click();await watcher.getByRole('dialog').waitFor();await watcher.keyboard.press('Escape');
  await late.reload();await late.locator('.spectator-surface .g-table').waitFor();await expect(host.locator('.spectator-list')).toContainText('Late observer');
  if(mode==='lan'){
   await host.keyboard.press('Escape');await host.getByRole('button',{name:'牌桌菜单',exact:true}).click();await host.getByRole('button',{name:'切换云端联机',exact:true}).click();
   await expect(watcher.locator('.connection')).toContainText('云端联机');await expect(watcher.locator('.spectator-surface')).toBeVisible();await expect(watcher.locator('.g-own-tray')).toHaveCount(0);await host.locator('.audience-trigger').click();
  }
  for(const language of ['zh','en']){
   if(language==='en'){await host.keyboard.press('Escape');await host.locator('.language-toggle').click();await host.locator('.audience-trigger').click();}
   for(const [width,height]of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){await host.setViewportSize({width,height});await expect(host.getByRole('checkbox',{name:language==='zh'?'允许观战':'Allow spectators'})).toBeVisible();assert(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'audience dialog fits');await host.screenshot({path:`${out}/${mode}-${language}-${width}.png`});}
  }
  await host.keyboard.press('Escape');await host.reload();await host.locator('.g-table').waitFor();await host.locator('.audience-trigger').click();await expect(host.getByRole('checkbox',{name:'Allow spectators'})).toBeVisible();host.once('dialog',d=>d.accept());await host.getByRole('checkbox',{name:'Allow spectators'}).click();await expect(host.getByRole('checkbox',{name:'Allow spectators'})).not.toBeChecked();await expect(watcher.locator('.spectator-surface')).toHaveCount(0);await expect(late.locator('.spectator-surface')).toHaveCount(0);await expect(host.locator('.spectator-list')).toHaveCount(0);
  await host.getByRole('checkbox',{name:'Allow spectators'}).click();await expect(host.getByRole('checkbox',{name:'Allow spectators'})).toBeChecked();await host.keyboard.press('Escape');await host.locator('.language-toggle').click();await host.reload();await host.locator('.g-table').waitFor();await host.locator('.audience-trigger').click();await expect(host.getByRole('checkbox',{name:'允许观战'})).toBeVisible();await host.keyboard.press('Escape');await join(watcher,false,true);await watcher.locator('.spectator-surface').waitFor();
  await watcher.getByRole('button',{name:'牌桌菜单',exact:true}).click();await watcher.getByRole('button',{name:'离开牌桌',exact:true}).click();await expect(watcher.locator('.spectator-surface')).toHaveCount(0);await expect(host.locator('.pause-overlay')).toHaveCount(0);
  console.log('PASS actual spectator UI',mode,'manual/automatic join, approval in game, all viewport dialogs, reconnection, public inventory, host toggle and observer leave');
 }finally{if(host&&!host.isClosed()){await host.keyboard.press('Escape');await host.locator('.brand .icon').click().catch(()=>{});host.once('dialog',d=>d.accept());await host.getByRole('button',{name:/^(离开牌桌|Leave table)$/}).click().catch(()=>{});}await Promise.all(contexts.map(c=>c.close()));}
}assert.deepEqual(errors,[]);}finally{await browser.close();}
