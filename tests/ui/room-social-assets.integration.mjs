import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';

const root=path.resolve('dist'),paths=['/art/reactions/cow.gif','/art/reactions/cow-still.png'];
const originalHash='09d3aa80e9a9087fff5a29ae2cc01c63a71ec316d31adf8ecedadb59bbe22e16';
assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,paths[0]))).digest('hex'),originalHash,'the shipped cow GIF preserves its exact original frames');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"offline fixture"}');return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 await context.addInitScript(()=>localStorage.setItem('mocha-profile',JSON.stringify({id:'asset-test-host',name:'Asset test',avatar:'\uD83D\uDC31'})));
 const base=`http://127.0.0.1:${server.address().port}`;
 await page.goto(base);await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller?.state)).toBe('activated');
 await page.evaluate(async paths=>{for(const path of paths)await fetch(path);},paths);
 const cached=await page.evaluate(async()=>{const names=await caches.keys();return(await Promise.all(names.map(async name=>(await(await caches.open(name)).keys()).map(r=>new URL(r.url).pathname)))).flat();});
 assert(paths.every(p=>cached.includes(p)));assert(!cached.some(p=>p.startsWith('/api/')));assert(!cached.some(p=>p==='/'||p==='/index.html'),'HTML navigation must not enter the static asset cache');
 assert(!cached.some(p=>/reactions\/(blep|blink|yawn|wiggle)/.test(p)),'removed reactions must not ship in the cache');
 await context.setOffline(true);await expect(page.locator('.social-chat-trigger')).toHaveCount(0);
 const decoded=await page.evaluate(async paths=>{
  const results=[];
  for(const src of paths){const img=new Image();img.src=src;await img.decode();results.push({src,width:img.naturalWidth,height:img.naturalHeight});}
  return results;
 },paths);
 assert.deepEqual(decoded,paths.map(src=>({src,width:300,height:300})));
 const cold=await context.newPage();await assert.rejects(cold.goto(base),/ERR_INTERNET_DISCONNECTED|ERR_FAILED/);
 console.log('PASS production cow GIF identity, visited static cache and decode, no cached HTML/API/retired reaction entries, offline cold start rejected');
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
