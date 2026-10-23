import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const root=path.resolve('dist');
const sw=await fs.readFile(path.join(root,'sw.js'),'utf8');
assert.doesNotMatch(sw,/__MOCHA_(?:CACHE|PRECACHE)__/);
assert.doesNotMatch(sw,/cache\.addAll|catch\(\(\)=>caches\.match\(/,'generated worker must not precache or provide a navigation fallback');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.end(await fs.readFile(file));
 }catch{
  res.writeHead(404);res.end();
 }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 await page.addInitScript(()=>{localStorage.setItem('mocha-locale','zh');localStorage.setItem('mocha-profile',JSON.stringify({id:'pwa-policy',name:'Mocha',avatar:'🐶'}));});
 await page.goto(base);
 await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller?.state)).toBe('activated');
 await expect(page.locator('.game-cover').first()).toBeVisible();
 assert.equal(await page.locator('.game-cover').count(),14);
 const manifest=await page.evaluate(async()=>await(await fetch(document.querySelector('link[rel="manifest"]').href)).json());
 assert.equal(manifest.display,'standalone');assert.equal(manifest.icons.length,2);

 const before=await page.evaluate(async()=>{
  const paths=[];
  for(const name of await caches.keys())for(const request of await(await caches.open(name)).keys())paths.push(new URL(request.url).pathname);
  return paths;
 });
 assert.equal(before.some(path=>path==='/'||path==='/index.html'),false,'page navigation must never be precached');
 await page.evaluate(async()=>{await fetch('/art/reactions/cow.gif');await fetch('/art/game-covers-v3.jpg');});
 const after=await page.evaluate(async()=>{
  const paths=[];
  for(const name of await caches.keys())for(const request of await(await caches.open(name)).keys())paths.push(new URL(request.url).pathname);
  return paths;
 });
 assert(after.includes('/art/reactions/cow.gif'));assert(after.includes('/art/game-covers-v3.jpg'));assert(!after.some(path=>path==='/'||path==='/index.html'));

 await page.getByRole('button',{name:'玩法和安装帮助',exact:true}).click();
 const help=await page.getByRole('dialog',{name:'使用帮助'}).textContent();
 assert(!help.includes('离线使用')&&!help.includes('offline play'),'public help must not advertise whole-site offline use');
 await page.keyboard.press('Escape');
 await page.locator('.cover-gems').click();
 await page.getByRole('button',{name:'同屏试玩',exact:true}).click();
 await expect(page.locator('.game-surface')).toBeVisible();
 await fs.mkdir('test-results/pwa-policy',{recursive:true});
 await page.screenshot({path:'test-results/pwa-policy/online-practice.png',fullPage:true});

 await context.setOffline(true);
 const cold=await context.newPage();
 await assert.rejects(cold.goto(base),/ERR_INTERNET_DISCONNECTED|ERR_FAILED/);
 console.log('PASS production build renders online, caches only visited static assets, contains no offline-use help claim, and rejects offline cold start');
 await context.close();
}finally{
 await browser.close();
 server.closeAllConnections();
 await new Promise(resolve=>server.close(resolve));
}
