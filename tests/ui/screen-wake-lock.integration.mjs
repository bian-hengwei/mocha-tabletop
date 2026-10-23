import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5224';
const out='test-results/screen-wake-lock';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(locale=>{
   localStorage.setItem('mocha-locale',locale);
   localStorage.setItem('mocha-profile',JSON.stringify({id:'wake-lock-player',name:'Wake Lock',avatar:'🦊'}));
   const sentinels=[];
   Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{
    const sentinel=new EventTarget();sentinel.released=false;
    sentinel.release=async()=>{if(!sentinel.released){sentinel.released=true;sentinel.dispatchEvent(new Event('release'));}};
    sentinels.push(sentinel);return sentinel;
   }}});
   window.__wakeLockTest={sentinels,requests:()=>sentinels.length};
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
  await page.screenshot({path:`${out}/${locale}-portrait-off.png`});
  await awake.click();
  await expect(awake).toContainText(locale==='zh'?'已开启':'On');
  assert.equal(await page.evaluate(()=>window.__wakeLockTest.requests()),1);
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await expect(awake).toContainText(locale==='zh'?'已开启':'On');
  await page.setViewportSize({width:844,height:390});
  await expect(awake).toBeVisible();
  await page.screenshot({path:`${out}/${locale}-landscape-on.png`});
  await page.evaluate(()=>window.__wakeLockTest.sentinels.at(-1).release());
  await expect(awake).toContainText(locale==='zh'?'亮屏已停止':'Screen stay-awake stopped');
  await awake.click();
  await expect.poll(()=>page.evaluate(()=>window.__wakeLockTest.requests())).toBe(2);
  await expect(awake).toContainText(locale==='zh'?'已开启':'On');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:locale==='zh'?'结束试玩':'End practice',exact:true}).click();
  await expect(page.locator('.game-surface')).toHaveCount(0);
  await page.locator('.cover-gems').click();
  await page.getByRole('button',{name:locale==='zh'?'单人人机':'Solo vs bots',exact:true}).click();
  await page.locator('.game-surface').waitFor();
  await menu.click();
  await expect(awake).toContainText(locale==='zh'?'未开启':'Off');
  assert.equal(await page.evaluate(()=>window.__wakeLockTest.requests()),2,'a new practice session starts opted out');
  await page.getByRole('button',{name:locale==='zh'?'结束单机':'End solo game',exact:true}).click();
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(`PASS ${locale}: wake-lock opt-in, menu focus, rotation, released-state retry, and new-practice reset`);
 }
}finally{await browser.close();}
