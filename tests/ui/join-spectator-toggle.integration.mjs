import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch(),out=`test-results/join-spectator-toggle-${engine}`;
await fs.mkdir(out,{recursive:true});
try{for(const locale of ['zh','en'])for(const [width,height]of [[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]]){
 const zh=locale==='zh',context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),errors=[],hello=[];
 page.on('pageerror',error=>errors.push(error.message));
 await context.addInitScript(locale=>{localStorage.setItem('mocha-profile',JSON.stringify({id:'join-option-person',name:'Mocha',avatar:'🦊'}));localStorage.setItem('mocha-locale',locale);},locale);
 await context.routeWebSocket('**/api/rooms/**',socket=>socket.onMessage(raw=>{const message=JSON.parse(raw);if(message.type==='hello'){hello.push(message);socket.send(JSON.stringify({type:'pending'}));}if(message.type==='ping')socket.send(JSON.stringify({type:'pong'}));}));
 await page.goto(base);const open=page.getByRole('button',{name:zh?'加入牌桌':'Join a table',exact:true});await open.click();
 const checkbox=page.getByRole('checkbox',{name:zh?'以观众身份加入':'Join as a spectator',exact:true}),code=page.getByRole('textbox',{name:zh?'房间码':'Room code',exact:true}),submit=page.getByRole('button',{name:zh?'入桌':'Join',exact:true});
 await expect(checkbox).not.toBeChecked();await expect(submit).toBeDisabled();
 await code.fill('a01-_?');await expect(code).toHaveValue('A');await expect(submit).toBeDisabled();
 await code.fill('ABC234');await expect(submit).toBeEnabled();
 const hit=page.locator('.join-spectator-control'),bounds=await hit.boundingBox();assert.ok(bounds.width>=44&&bounds.height>=44);
 // Clicking the outer label and the padded hit area both operates the native input.
 await page.locator('.join-spectator-setting>span').first().click();await expect(checkbox).toBeChecked();
 await hit.click({position:{x:3,y:3}});await expect(checkbox).not.toBeChecked();
 await checkbox.focus();await page.keyboard.press('Space');await expect(checkbox).toBeChecked();
 await page.screenshot({path:`${out}/${locale}-${width}x${height}-checked.png`});
 await page.keyboard.press('Space');await expect(checkbox).not.toBeChecked();await page.screenshot({path:`${out}/${locale}-${width}x${height}-unchecked.png`});
 await page.setViewportSize({width:height,height:width});await expect(hit).toBeInViewport();await page.setViewportSize({width,height});
 await page.keyboard.press('Escape');await expect(open).toBeFocused();await open.click();await expect(code).toHaveValue('ABC234');await expect(checkbox).not.toBeChecked();
 await checkbox.check();await page.keyboard.press('Escape');await open.click();await expect(checkbox).toBeChecked();
 await submit.click();await expect(page.locator('.connecting-overlay')).toContainText(zh?'等待房主同意':'Waiting for host approval');await expect.poll(()=>hello.length).toBe(1);assert.equal(hello[0].spectator,true);
 await page.getByRole('button',{name:zh?'取消':'Cancel',exact:true}).click();await open.click();await checkbox.uncheck();await submit.click();await expect.poll(()=>hello.length).toBe(2);assert.equal(hello[1].spectator,false);
 await page.getByRole('button',{name:zh?'取消':'Cancel',exact:true}).click();assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await context.close();console.log('PASS',engine,locale,width,height,'native label/padded click, Space, checked state, validation, reopen, spectator/player hello and rotation');
}}finally{await browser.close();}
