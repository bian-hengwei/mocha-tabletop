import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5224';
const out='test-results/screen-wake-lock';
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]];
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(locale=>{
   localStorage.setItem('mocha-locale',locale);
   localStorage.setItem('mocha-profile',JSON.stringify({id:'wake-lock-player',name:'Wake Lock',avatar:'🦊'}));
   const sentinels=[],pending=[];let calls=0,deferred=false,rejectNext=false;
   Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:()=>{
    calls++;
    if(rejectNext){rejectNext=false;return Promise.reject(new DOMException('Denied','NotAllowedError'));}
    const sentinel=new EventTarget();sentinel.released=false;
    sentinel.release=async()=>{if(!sentinel.released){sentinel.released=true;sentinel.dispatchEvent(new Event('release'));}};
    sentinels.push(sentinel);
    return deferred?new Promise(resolve=>pending.push(()=>resolve(sentinel))):Promise.resolve(sentinel);
   }}});
   window.__wakeLockTest={sentinels,requests:()=>calls,setDeferred:value=>{deferred=value;},rejectNext:()=>{rejectNext=true;},resolvePending:()=>pending.shift()?.()};
  },locale);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(base);
  await page.locator('.cover-gems').click();
  await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();
  await page.locator('.game-surface').waitFor();
  const menu=page.getByRole('button',{name:locale==='zh'?'牌桌菜单':'Table menu',exact:true});
  await menu.click();
  const awake=page.getByRole('button',{name:new RegExp(locale==='zh'?'本局保持亮屏':'Keep screen awake')});
  await expect(awake).toContainText(locale==='zh'?'未开启':'Off');
  assert.equal(await page.evaluate(()=>window.__wakeLockTest.requests()),0,'the setting stays off until the player enables it');
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});
   await expect(awake).toBeVisible();
   await page.screenshot({path:`${out}/${locale}-${width}x${height}-off.png`});
  }
  await page.setViewportSize({width:390,height:844});
  await awake.click();
  await expect(awake).toContainText(locale==='zh'?'已开启':'On');
  assert.equal(await page.evaluate(()=>window.__wakeLockTest.requests()),1);
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await expect(awake).toContainText(locale==='zh'?'已开启':'On');
  await page.setViewportSize({width:844,height:390});
  await expect(awake).toBeVisible();
  await page.screenshot({path:`${out}/${locale}-844x390-on.png`});
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(awake).toContainText(locale==='zh'?'返回页面后恢复':'Resumes when you return');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(()=>page.evaluate(()=>window.__wakeLockTest.requests())).toBe(2);
  await expect(awake).toContainText(locale==='zh'?'已开启':'On');
  await page.evaluate(()=>window.__wakeLockTest.sentinels.at(-1).release());
  await expect(awake).toContainText(locale==='zh'?'亮屏已停止':'Screen stay-awake stopped');
  await awake.click();
  await expect(awake).toContainText(locale==='zh'?'未开启':'Off');
  assert.equal(await page.evaluate(()=>window.__wakeLockTest.requests()),2,'turning off after a release does not retry');
  await awake.click();
  await expect.poll(()=>page.evaluate(()=>window.__wakeLockTest.requests())).toBe(3);
  await expect(awake).toContainText(locale==='zh'?'已开启':'On');
  await awake.click();
  await page.evaluate(()=>window.__wakeLockTest.setDeferred(true));
  await awake.click();
  await expect(awake).toContainText(locale==='zh'?'正在开启':'Turning on');
  await expect(awake).toHaveAttribute('aria-pressed','true');
  assert.equal(await page.evaluate(()=>window.__wakeLockTest.requests()),4);
  await awake.click();
  await expect(awake).toContainText(locale==='zh'?'未开启':'Off');
  await expect(awake).toHaveAttribute('aria-pressed','false');
  await page.evaluate(()=>window.__wakeLockTest.resolvePending());
  await expect.poll(()=>page.evaluate(()=>window.__wakeLockTest.sentinels.at(-1).released)).toBe(true);
  assert.equal(await page.evaluate(()=>window.__wakeLockTest.requests()),4,'turning off a pending request prevents another request');
  await page.evaluate(()=>window.__wakeLockTest.setDeferred(false));
  await page.evaluate(()=>window.__wakeLockTest.rejectNext());
  await awake.click();
  await expect(awake).toContainText(locale==='zh'?'未能开启':'Could not turn on');
  await expect(awake).toHaveAttribute('aria-pressed','true');
  assert.equal(await page.evaluate(()=>window.__wakeLockTest.requests()),5);
  await awake.click();
  await expect(awake).toContainText(locale==='zh'?'未开启':'Off');
  await expect(awake).toHaveAttribute('aria-pressed','false');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.evaluate(()=>window.__wakeLockTest.requests()),5,'turning off after denial prevents visibility retry');
  await awake.click();
  await expect.poll(()=>page.evaluate(()=>window.__wakeLockTest.requests())).toBe(6);
  await expect(awake).toContainText(locale==='zh'?'已开启':'On');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:locale==='zh'?'结束试玩':'End practice',exact:true}).click();
  await expect(page.locator('.game-surface')).toHaveCount(0);
  await page.locator('.cover-gems').click();
  await page.getByRole('button',{name:locale==='zh'?'单人人机':'Solo vs bots',exact:true}).click();
  await page.locator('.game-surface').waitFor();
  await menu.click();
  await expect(awake).toContainText(locale==='zh'?'未开启':'Off');
  assert.equal(await page.evaluate(()=>window.__wakeLockTest.requests()),6,'a new practice session starts opted out');
  await page.getByRole('button',{name:locale==='zh'?'结束单机':'End solo game',exact:true}).click();
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(`PASS ${locale}: all required menu viewports, opt-in toggle, visibility restore, pending cancellation, denied opt-out, explicit retry, and new-practice reset`);
 }
}finally{await browser.close();}
