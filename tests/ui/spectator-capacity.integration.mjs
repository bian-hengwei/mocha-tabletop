import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const out='test-results/spectator-capacity';
await fs.mkdir(out,{recursive:true});

const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
const contexts=[],errors=[];

async function page(name,locale='zh'){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  contexts.push(context);
  await context.addInitScript(({name,locale})=>{
    localStorage.setItem('mocha-profile',JSON.stringify({id:crypto.randomUUID(),name,avatar:'🦊'}));
    if(!localStorage.getItem('mocha-locale'))localStorage.setItem('mocha-locale',locale);
  },{name,locale});
  const p=await context.newPage();
  p.setDefaultTimeout(15000);
  p.on('pageerror',error=>errors.push(`${name}: ${error.message}`));
  p.on('dialog',dialog=>dialog.accept());
  await p.goto(base);
  return p;
}

async function join(p,code,spectator=false){
  await p.getByRole('button',{name:'加入牌桌',exact:true}).click();
  await p.getByRole('textbox',{name:'房间码'}).fill(code);
  if(spectator)await p.getByRole('checkbox',{name:'以观众身份加入'}).check();
  await p.getByRole('button',{name:'入桌',exact:true}).click();
}

async function approve(host,name){
  const row=host.locator('.join-requests').filter({hasText:name});
  await row.locator('.approve').scrollIntoViewIfNeeded();
  await row.locator('.approve').click();
}

async function leaveAsPlayer(p){
  await p.getByRole('button',{name:'牌桌菜单',exact:true}).click();
  await p.getByRole('button',{name:'离开牌桌',exact:true}).click();
  await p.locator('.game-cover').first().waitFor();
}

async function removeOfflineSeat(host,name){
  const seat=host.locator('.lobby-seat').filter({hasText:name});
  await seat.locator('.remove-seat').scrollIntoViewIfNeeded();
  await seat.locator('.remove-seat').click();
}

async function setLocale(p,locale){
  const current=await p.evaluate(()=>localStorage.getItem('mocha-locale'));
  if(current===locale)return;
  await p.locator('.language-toggle').click();
  await p.waitForTimeout(150);
}

try{
  const host=await page('Host');
  const player1=await page('Player1');
  const player2=await page('Player2');
  const player3=await page('Player3');
  const watcher1=await page('Watcher1');
  const watcher2=await page('Watcher2');

  await host.locator('.cover-gems').click();
  await host.locator('.mode-picker button').filter({hasText:'云端联机'}).click();
  await host.locator('.create-body footer .primary').click();
  await host.locator('.room-code').waitFor();
  const code=(await host.locator('.room-code').textContent()).trim();

  for(const [p,name] of [[player1,'Player1'],[player2,'Player2'],[player3,'Player3']]){
    await join(p,code);
    await p.locator('.connection-target').waitFor();
    await approve(host,name);
    await p.locator('.lobby').waitFor();
    await p.getByRole('button',{name:'准备好了',exact:true}).click();
  }
  await host.locator('.lobby-seat:not(.vacant)').nth(3).waitFor();

  await join(watcher1,code,true);
  await watcher1.locator('.connection-target').waitFor();
  await approve(host,'Watcher1');
  await watcher1.locator('.lobby').waitFor();
  await join(watcher2,code,true);
  await watcher2.locator('.connection-target').waitFor();
  await approve(host,'Watcher2');
  await watcher2.locator('.lobby').waitFor();

  const button=watcher1.getByRole('button',{name:'转为玩家',exact:true});
  const note=watcher1.locator('.seat-capacity-note');
  await expect(button).toBeDisabled();
  await expect(note).toHaveText('玩家座位已满');
  await expect(button).not.toBeFocused();
  await watcher1.locator('.lobby-audience').scrollIntoViewIfNeeded();
  await watcher1.locator('.lobby-audience').screenshot({path:`${out}/zh-390x844-full.png`});
  await watcher1.screenshot({path:`${out}/zh-390x844-full-page.png`});

  await player3.close();
  await removeOfflineSeat(host,'Player3');
  await watcher1.locator('.lobby-seat:not(.vacant)').nth(2).waitFor();
  await expect(button).toBeEnabled();
  await button.focus();
  await expect(button).toBeFocused();
  await watcher1.locator('.lobby-audience').screenshot({path:`${out}/zh-390x844-open.png`});
  await button.click();
  await watcher1.getByRole('button',{name:'准备好了',exact:true}).waitFor();
  await expect(watcher1.getByRole('button',{name:'转为玩家',exact:true})).toHaveCount(0);
  await expect(host.locator('.lobby-seat:not(.vacant)')).toHaveCount(4);

  const matrix=[
    ['zh',390,844],
    ['en',390,844],
    ['zh',568,320],
    ['en',568,320],
  ];
  for (const [locale,width,height] of matrix) {
    await setLocale(watcher2,locale);
    await watcher2.setViewportSize({width,height});
    const suffix=`${locale}-${width}x${height}`;
    const lobbyButton=watcher2.locator('.lobby-audience').getByRole('button',{name:locale==='zh'?'转为玩家':'Take a player seat',exact:true});
    await expect(lobbyButton).toBeDisabled();
    await expect(watcher2.locator('.lobby-audience .seat-capacity-note')).toHaveText(locale==='zh'?'玩家座位已满':'Player seats are full');
    await expect(lobbyButton).not.toBeFocused();
    await watcher2.locator('.lobby-audience').scrollIntoViewIfNeeded();
    await watcher2.locator('.lobby-audience').screenshot({path:`${out}/${suffix}-full.png`});
    if (locale==='zh'&&width===390) await watcher2.screenshot({path:`${out}/${suffix}-full-page.png`});
  }

  await watcher2.locator('.audience-trigger').click();
  const disabledDialogButton=watcher2.locator('.room-audience').getByRole('button',{name:'Take a player seat',exact:true});
  const disabledDialogNote=watcher2.locator('.room-audience').locator('.seat-capacity-note');
  await expect(disabledDialogButton).toBeDisabled();
  await expect(disabledDialogNote).toHaveText('Player seats are full');
  await watcher2.locator('.room-audience').screenshot({path:`${out}/en-568x320-audience-full.png`});
  await watcher2.keyboard.press('Escape');
  await expect(watcher2.locator('.room-audience')).toHaveCount(0);

  await leaveAsPlayer(player2);
  await watcher2.locator('.lobby-seat:not(.vacant)').nth(2).waitFor();
  for (const [locale,width,height] of matrix) {
    await setLocale(watcher2,locale);
    await watcher2.setViewportSize({width,height});
    const suffix=`${locale}-${width}x${height}`;
    const lobbyButton=watcher2.locator('.lobby-audience').getByRole('button',{name:locale==='zh'?'转为玩家':'Take a player seat',exact:true});
    await expect(lobbyButton).toBeEnabled();
    await lobbyButton.focus();
    await expect(lobbyButton).toBeFocused();
    await watcher2.locator('.lobby-audience').screenshot({path:`${out}/${suffix}-open.png`});
  }

  await watcher2.locator('.audience-trigger').click();
  const englishDialogButton=watcher2.locator('.room-audience').getByRole('button',{name:'Take a player seat',exact:true});
  const englishDialogNote=watcher2.locator('.room-audience').locator('.seat-capacity-note');
  await setLocale(watcher2,'en');
  await watcher2.setViewportSize({width:568,height:320});
  await expect(englishDialogButton).toBeEnabled();
  await englishDialogButton.focus();
  await expect(englishDialogButton).toBeFocused();
  await watcher2.locator('.room-audience').screenshot({path:`${out}/en-568x320-audience-open.png`});
  await englishDialogButton.click();
  await watcher2.getByRole('button',{name:'Ready',exact:true}).waitFor();
  await expect(watcher2.getByRole('button',{name:'Take a player seat',exact:true})).toHaveCount(0);
  await expect(host.locator('.lobby-seat:not(.vacant)')).toHaveCount(4);

  assert.deepEqual(errors,[]);
  console.log('PASS spectator capacity UI: full room blocks conversion, host removal and normal leave reopen it, conversions apply once, zh/en and both viewport sizes');
}catch(error){
  console.error(error);
  throw error;
}finally{
  await Promise.allSettled(contexts.map(context=>context.close()));
  await browser.close();
}
