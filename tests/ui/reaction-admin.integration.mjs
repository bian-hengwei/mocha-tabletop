import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const out=path.resolve('test-results/reaction-admin');await fs.mkdir(out,{recursive:true});
await fs.mkdir('.wrangler',{recursive:true});
const dir=await fs.mkdtemp(path.resolve('.wrangler/reaction-test-'));
const port=Number(process.env.REACTION_TEST_PORT||8893),frontPort=Number(process.env.REACTION_FRONTEND_PORT||5293),base=`http://127.0.0.1:${frontPort}`,api=`http://127.0.0.1:${port}`;
const token=randomBytes(32).toString('hex');
const config=JSON.parse(await fs.readFile('wrangler.jsonc','utf8'));
delete config.account_id;config.main=path.resolve('worker/index.ts');config.assets.directory=path.resolve('dist');config.vars={ALLOWED_ORIGINS:base,REACTION_ADMIN_TOKEN:token};config.r2_buckets=[{binding:'REACTION_ASSETS',bucket_name:'local-reaction-test'}];
const configPath=path.join(dir,'wrangler.json');await fs.writeFile(configPath,JSON.stringify(config));
const logs=[];
function start(args,env={}){const child=spawn(process.execPath,args,{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs.push(String(d)));child.stderr.on('data',d=>logs.push(String(d)));return child;}
const worker=start(['node_modules/wrangler/bin/wrangler.js','dev','--local','--config',configPath,'--port',String(port),'--inspector-port',String(port+1),'--persist-to',path.join(dir,'state')]);
const vite=start(['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(frontPort),'--strictPort'],{MOCHA_DEV_API:api,VITE_API_BASE:''});
let browser;const errors=[];
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw new Error('Service did not start: '+url);}
async function request(pathname,body,auth=true){return fetch(api+pathname,{method:body?'POST':'GET',headers:auth?{Authorization:`Bearer ${token}`}:{},body});}
async function newPlayer(name){const context=await browser.newContext();await context.addInitScript(name=>{localStorage.setItem('mocha-profile',JSON.stringify({id:crypto.randomUUID(),name,avatar:'🦊'}));localStorage.setItem('mocha-locale','zh');},name);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);return page;}
try{
 await ready(api+'/api/health');await ready(base);
 assert.equal((await request('/api/admin/reactions',undefined,false)).status,401);
 assert.equal((await fetch(api+'/api/admin/reactions',{headers:{Authorization:'Bearer incorrect'}})).status,401);
 assert.equal((await fetch(api+'/api/admin/reactions',{headers:{Origin:'https://evil.invalid',Authorization:`Bearer ${token}`}})).status,403);
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/admin/reactions');
 await page.getByLabel('管理员凭据').fill('wrong');await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('管理员凭据无效');
 await page.getByLabel('管理员凭据').fill(token);await page.getByRole('button',{name:'登录',exact:true}).click();await page.getByRole('heading',{name:'上传表情',exact:true}).waitFor();
 await page.getByLabel('中文名称').fill('测试奶牛');await page.getByLabel('英文名称').fill('Test cow');
 await page.getByLabel('表情图片（GIF / PNG）').setInputFiles('public/art/reactions/cow-still.png');await page.getByLabel('静态预览（PNG）').setInputFiles('public/art/reactions/cow-still.png');
 await expect(page.locator('.admin-previews img')).toBeVisible();await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByRole('status')).toHaveText('草稿已保存');
 let entries=await (await request('/api/admin/reactions')).json();assert.equal(entries.length,1);const entry=entries[0];assert.equal(entry.published,false);assert.equal((await request(entry.src,undefined,false)).status,404);
 assert.equal((await (await request('/api/reactions',undefined,false)).json()).length,1);await expect(page.locator('li img')).toBeVisible();
 for(const locale of ['zh','en']){await page.getByRole('combobox').selectOption(locale);await expect(page.locator('li').first().getByRole('button',{name:locale==='zh'?'删除':'Delete',exact:true})).toBeVisible();for(const [width,height]of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){await page.setViewportSize({width,height});await page.locator('.reaction-admin').evaluate(el=>el.scrollTo(0,0));await page.screenshot({animations:'disabled',path:`${out}/${locale}-${width}-top.png`});await page.getByRole('button',{name:locale==='zh'?'上架':'Publish',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:`${out}/${locale}-${width}-list.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('.reaction-admin').evaluate(el=>el.scrollWidth<=el.clientWidth));}}
 await page.getByRole('combobox').selectOption('zh');await page.getByRole('button',{name:'上架',exact:true}).click();await expect(page.getByRole('status')).toHaveText('已上架');assert.equal((await request(entry.src,undefined,false)).status,200);
 const published=await (await request('/api/reactions',undefined,false)).json();assert.equal(published.length,2);
 for(const mode of ['cloud','lan']){
  const host=await newPlayer('Admin test host'),guest=await newPlayer('Admin test guest');
  await host.locator('.cover-gems').click();if(mode==='cloud')await host.getByRole('button',{name:/云端联机/}).click();await host.getByRole('button',{name:'创建牌桌',exact:true}).click();await host.locator('.room-code').waitFor();const code=(await host.locator('.room-code').textContent()).trim();
  await guest.getByRole('button',{name:'加入牌桌',exact:true}).click();await guest.getByRole('textbox',{name:'房间码',exact:true}).fill(code);await guest.getByRole('button',{name:'入桌',exact:true}).click();await host.getByRole('button',{name:'同意Admin test guest',exact:true}).click();await guest.getByRole('button',{name:'准备好了',exact:true}).waitFor();
  await host.locator('.lobby-seats .social-avatar-button').click();await host.getByRole('button',{name:'测试奶牛',exact:true}).click();await expect(guest.locator('.social-avatar-reaction img')).toHaveAttribute('src',entry.src);await expect(guest.locator('.social-avatar-reaction img')).toHaveJSProperty('naturalWidth',300);
  await guest.getByRole('button',{name:'准备好了',exact:true}).click();await host.getByRole('button',{name:'开局',exact:true}).click();await guest.locator('.g-table').waitFor();if(mode==='lan')await expect(guest.locator('.connection')).toContainText('Wi-Fi');
  await host.locator('.social-avatar-button').click();
  for(const locale of ['zh','en']){if(locale==='en'){await host.keyboard.press('Escape');await host.locator('.language-toggle').click();await host.locator('.social-avatar-button').click();}for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){await host.setViewportSize({width,height});await expect(host.getByRole('button',{name:locale==='zh'?'测试奶牛':'Test cow',exact:true})).toBeVisible();await host.screenshot({animations:'disabled',path:`${out}/${mode}-${locale}-${width}-picker.png`});}}
  await request('/api/admin/reactions/'+entry.id,JSON.stringify({published:false}));
  await host.getByRole('button',{name:'Test cow',exact:true}).click();await expect(host.locator('.social-error')).toHaveText('Choose a reaction');
  await request('/api/admin/reactions/'+entry.id,JSON.stringify({published:true}));
  await host.keyboard.press('Escape');await expect(host.locator('.social-avatar-button')).toBeFocused();await host.locator('.brand .icon').click();host.once('dialog',d=>d.accept());await host.getByRole('button',{name:/^(离开牌桌|Leave table)$/}).click();await host.context().close();await guest.context().close();
 }
 await page.getByRole('button',{name:'下架',exact:true}).click();await expect(page.getByRole('status')).toHaveText('已下架');assert.equal((await request(entry.src,undefined,false)).status,404);assert.equal((await (await request('/api/reactions',undefined,false)).json()).length,1);
 // A malformed upload cannot change the catalog or publish anything.
 const invalid=new FormData();invalid.set('zh','坏图片');invalid.set('en','Bad image');invalid.set('image',new Blob(['<svg/>']),'bad.png');invalid.set('still',new Blob(['x']),'still.png');assert.equal((await request('/api/admin/reactions',invalid)).status,400);
 const png=await fs.readFile('public/art/reactions/cow-still.png');
 for(let i=0;i<12;i++){const form=new FormData();form.set('zh','测试长名称'.repeat(8));form.set('en','LongName'.repeat(5));form.set('image',new Blob([png]),'test.png');form.set('still',new Blob([png]),'still.png');const response=await request('/api/admin/reactions',form);assert.equal(response.status,201);const item=await response.json();assert.equal((await request('/api/admin/reactions/'+item.id,JSON.stringify({published:true}))).status,200);}
 await page.getByRole('button',{name:'刷新目录',exact:true}).click();await expect(page.locator('li')).toHaveCount(13);
 for(const locale of ['zh','en']){await page.getByRole('combobox').selectOption(locale);await expect(page.locator('li').first().getByRole('button',{name:locale==='zh'?'删除':'Delete',exact:true})).toBeVisible();for(const [width,height]of [[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]]){await page.setViewportSize({width,height});await page.locator('li').last().scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:`${out}/${locale}-${width}-dense.png`});assert(await page.locator('.reaction-admin').evaluate(el=>el.scrollWidth<=el.clientWidth));}}
 await page.getByRole('combobox').selectOption('zh');
 page.once('dialog',dialog=>dialog.dismiss());await page.locator('li').last().getByRole('button',{name:'删除',exact:true}).click();await expect(page.locator('li')).toHaveCount(13);
 page.once('dialog',dialog=>dialog.accept());await page.locator('li').last().getByRole('button',{name:'删除',exact:true}).click();await expect(page.locator('li')).toHaveCount(12);await expect(page.getByRole('status')).toHaveText('表情已删除');
 await page.getByRole('button',{name:'退出管理',exact:true}).click();await expect(page.getByLabel('管理员凭据')).toHaveValue('');await page.reload();await expect(page.getByLabel('管理员凭据')).toHaveValue('');assert.deepEqual(errors,[]);
 console.log('PASS admin auth, upload draft, preview, publish/unpublish, cloud/LAN delivery, bilingual seven-size UI and sign out');
}catch(error){await fs.writeFile(path.join(out,'services.log'),logs.join('').replaceAll(token,'[redacted]'));throw error;}finally{await browser?.close();worker.kill('SIGTERM');vite.kill('SIGTERM');await fs.rm(dir,{recursive:true,force:true});}
