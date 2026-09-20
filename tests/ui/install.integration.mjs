import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',safari=process.env.TEST_BROWSER==='webkit';
const browser=await(safari?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
try {
 const context=await browser.newContext({viewport:{width:844,height:390},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('mocha-profile',JSON.stringify({id:'install-test-0001',name:'测试',avatar:'🦊'})));
 await page.goto(base);await page.getByRole('button',{name:'选择晶石商会',exact:true}).waitFor();assert.equal(await page.title(),'Mocha 桌游');
 const manifest=await page.evaluate(async()=>await(await fetch(document.querySelector('link[rel=manifest]').href)).json());assert.equal(manifest.orientation,'any');assert.equal(manifest.icons.length,2);
 for(const size of [{width:844,height:390},{width:390,height:844}]){
  await page.setViewportSize(size);await page.locator('.home-footer .install-button').click();await page.getByRole('dialog',{name:'添加到主屏幕'}).waitFor();assert.match(await page.locator('.install-steps').textContent(),/Safari/);
  const box=await page.locator('.install-panel').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=size.width+1&&box.y>=0&&box.y+box.height<=size.height+1);await page.getByRole('button',{name:'关闭安装说明'}).click();
 }
 assert.equal(await page.locator('.rotate-screen').count(),0);
 await page.evaluate(()=>{window.installCalls=0;const e=new Event('beforeinstallprompt');e.prompt=async()=>{window.installCalls++};e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);});
 await page.getByRole('button',{name:'安装到主屏幕',exact:true}).click();assert.equal(await page.evaluate(()=>window.installCalls),1);await page.getByRole('status').filter({hasText:'已取消'}).waitFor();
 assert.equal(await page.getByRole('dialog',{name:'添加到主屏幕'}).count(),0);
 await page.evaluate(()=>{const e=new Event('beforeinstallprompt');e.prompt=async()=>{window.installCalls++};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e);});
 await page.getByRole('button',{name:'安装到主屏幕',exact:true}).click();await page.getByRole('status').filter({hasText:'已确认安装'}).waitFor();assert.equal(await page.evaluate(()=>window.installCalls),2);
 await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));assert.ok(await page.getByRole('button',{name:'已添加到主屏幕',exact:true}).isDisabled());
 await page.locator('.game-cover img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));assert.deepEqual(errors,[]);await context.close();
 const desktop=await browser.newPage({viewport:{width:1280,height:800}});await desktop.goto(base);await desktop.getByPlaceholder('你的昵称').fill('桌面测试');await desktop.getByRole('button',{name:'入座',exact:true}).click();await desktop.locator('.home-footer .install-button').click();assert.doesNotMatch(await desktop.locator('.install-steps').textContent(),/Safari/);
 console.log('PASS installation prompt, dismissal, accepted vs installed, iOS/desktop fallback, portrait');
} finally {await browser.close();}
