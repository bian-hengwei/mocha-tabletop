import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const browser=await(process.env.TEST_BROWSER==='webkit'?webkit:chromium).launch({executablePath:process.env.CHROME_PATH||undefined});
try {
 const contexts=await Promise.all([browser.newContext({viewport:{width:390,height:844}}),browser.newContext({viewport:{width:320,height:568}})]);
 const pages=[];const errors=[];
 for(const [i,context] of contexts.entries()){
  await context.addInitScript(({i,id})=>localStorage.setItem('mocha-profile',JSON.stringify({id,name:i?'Guest':'Host',avatar:'🐶'})),{i,id:crypto.randomUUID()});
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());pages.push(page);await page.goto(base);
 }
 const [host,guest]=pages;await host.locator('.cover-uno').click();await host.getByRole('button',{name:/云端联机/}).click();await host.getByRole('button',{name:'创建牌桌',exact:true}).click();
 await host.locator('.room-code').waitFor();assert.match(await host.locator('.lobby-start-status').innerText(),/还需 1/);
 const code=(await host.locator('.room-code').textContent()).trim();await guest.getByRole('button',{name:'加入牌桌',exact:true}).click();await guest.getByRole('textbox',{name:'房间码',exact:true}).fill(code);await guest.getByRole('button',{name:'入桌',exact:true}).click();await host.getByRole('button',{name:'同意Guest',exact:true}).click();
 await guest.locator('.lobby').waitFor();assert(await guest.getByRole('combobox',{name:'比赛长度'}).isDisabled());assert(await guest.getByRole('switch',{name:'+4 质疑规则'}).isDisabled());await host.waitForFunction(()=>document.querySelector('.lobby-start-status')?.textContent.includes('等待所有玩家准备'));
 await guest.getByRole('button',{name:'准备好了',exact:true}).click();await host.waitForFunction(()=>document.querySelector('.lobby-start-status')?.textContent.includes('所有人已准备'));
 await host.getByRole('combobox',{name:'比赛长度'}).selectOption('single');await guest.getByRole('button',{name:'准备好了',exact:true}).waitFor();await expect(guest.getByRole('combobox',{name:'比赛长度'})).toHaveValue('single');assert.match(await host.locator('.lobby-start-status').innerText(),/重新准备/);
 await host.locator('.language-toggle').click();assert.match(await host.locator('.lobby-start-status').innerText(),/rule or bot changes reset readiness/);
 for(const p of pages)assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 host.removeAllListeners('dialog');
 for(const locale of ['en','zh']){
  if(locale==='zh')await host.locator('.language-toggle').click();
  await host.getByRole('button',{name:locale==='zh'?'牌桌菜单':'Table menu',exact:true}).click();
  let warning='';host.once('dialog',async dialog=>{warning=dialog.message();await dialog.dismiss();});
  await host.getByRole('button',{name:locale==='zh'?'离开牌桌':'Leave table',exact:true}).click();
  assert.equal(warning,locale==='zh'?'离开将关闭这张牌桌，确定？':'Leaving as host closes this table. Continue?');
  await expect(host.locator('.room-code')).toHaveText(code);await expect(guest.locator('.room-code')).toHaveText(code);
  await host.keyboard.press('Escape');
 }
 host.once('dialog',dialog=>dialog.accept());await host.getByRole('button',{name:'牌桌菜单',exact:true}).click();await host.getByRole('button',{name:'离开牌桌',exact:true}).click();await guest.locator('.game-cover').first().waitFor();await host.locator('.game-cover').first().waitFor();assert.deepEqual(errors,[]);
 console.log('PASS lobby start explanations, synchronized guest rule visibility, readiness reset and mobile fit');
}finally{await browser.close();}
