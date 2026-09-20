import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {waitForOfflineReady} from './offline-ready.mjs';

const swTemplate=await fs.readFile(new URL('../../public/sw.js',import.meta.url),'utf8');
const resources=['/','/asset.txt','/tile.svg'];
const cacheName=version=>`mocha-update-fixture-${version}`;
const output=new URL('../../test-results/pwa-update/',import.meta.url);
let version=1,apiRequests=0,releaseAsset;
const assetGate=new Promise(resolve=>{releaseAsset=resolve;});
let assetRequested;
const assetRequest=new Promise(resolve=>{assetRequested=resolve;});
const html=build=>`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>PWA update fixture</title><style>body{font:20px system-ui;background:#f5efe3;color:#24352f;padding:30px}img{width:160px;display:block}output{display:block;margin-top:16px}</style><h1>Build ${build}</h1><img src="/tile.svg" alt="Cached build artwork"><output>Loading asset</output><script>navigator.serviceWorker.register('/sw.js');fetch('/asset.txt').then(r=>r.text()).then(text=>document.querySelector('output').textContent=text)</script></html>`;
const asset=(path,build)=>path==='/'?html(build):path==='/asset.txt'?`asset from build ${build}`:`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="24" fill="${build===1?'#3f6d5a':'#c3653b'}"/><text x="80" y="102" text-anchor="middle" font-size="64" fill="white">${build}</text></svg>`;
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname,build=version;
 res.setHeader('Cache-Control','no-store');
 if(path==='/sw.js'){
  res.setHeader('Content-Type','application/javascript');
  res.end(swTemplate.replace("'__MOCHA_CACHE__'",JSON.stringify(cacheName(build))).replace("['__MOCHA_PRECACHE__']",JSON.stringify(resources)));
 }else if(path==='/api/probe'){
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({request:++apiRequests}));
 }else if(resources.includes(path)){
  if(path==='/asset.txt'&&build===2){assetRequested();await assetGate;}
  res.setHeader('Content-Type',path==='/'?'text/html':path.endsWith('.svg')?'image/svg+xml':'text/plain');
  res.end(asset(path,build));
 }else{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;

// Await predicates in Node: Playwright 1.55 treats a Promise returned by
// waitForFunction as truthy, even when that Promise resolves to false.
async function until(predicate,label,timeout=10000){
 const deadline=Date.now()+timeout;
 while(!await predicate()){
  if(Date.now()>=deadline)throw new Error(`Timed out: ${label}`);
  await new Promise(resolve=>setTimeout(resolve,25));
 }
}
const cachedPaths=async(page,key)=>page.evaluate(async key=>{
 if(!(await caches.keys()).includes(key))return [];
 return(await(await caches.open(key)).keys()).map(request=>new URL(request.url).pathname).sort();
},key);
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 let page=await context.newPage();
 await page.goto(base);
 await until(()=>page.evaluate(()=>navigator.serviceWorker.controller?.state==='activated'),'initial controller');
 // The initial document was never reloaded: activate/clients.claim controlled it.
 assert.equal(await page.locator('h1').textContent(),'Build 1');
 await until(async()=>JSON.stringify(await cachedPaths(page,cacheName(1)))===JSON.stringify([...resources].sort()),'initial precache');
 await waitForOfflineReady(page,{paths:resources});
 // Exercise the shared production-readiness helper, including an async false
 // result and a waiter that must remain pending until its missing asset exists.
 const probe='/uncached-probe.txt';
 await assert.rejects(waitForOfflineReady(page,{paths:[...resources,probe],timeout:200}),/uncached-probe\.txt/);
 let becameReady=false;
 const readiness=waitForOfflineReady(page,{paths:[...resources,probe],timeout:5000}).then(()=>{becameReady=true;});
 await new Promise(resolve=>setTimeout(resolve,100));assert.equal(becameReady,false);
 await page.evaluate(async({key,probe})=>{await(await caches.open(key)).put(probe,new Response('readiness probe'));},{key:cacheName(1),probe});
 await readiness;
 await page.evaluate(async({key,probe})=>{await(await caches.open(key)).delete(probe);},{key:cacheName(1),probe});
 await page.evaluate(()=>{window.initialController=navigator.serviceWorker.controller;});
 console.log('PASS first worker activates, claims the open page and precaches all resources');
 console.log('PASS shared offline readiness times out for a missing asset and stays pending until that asset is cached');

 version=2;
 const workerEvent=context.waitForEvent('serviceworker');
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 const nextWorker=await workerEvent;
 await nextWorker.evaluate(()=>{self.auditActivated=false;self.addEventListener('activate',()=>{self.auditActivated=true;},{once:true});});
 await assetRequest;
 await assert.rejects(until(async()=>JSON.stringify(await cachedPaths(page,cacheName(2)))===JSON.stringify([...resources].sort()),'gated precache',200),/Timed out: gated precache/);
 assert.equal(await page.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).installing?.state),'installing');
 console.log('PASS a held resource prevents precache readiness; the awaited guard times out');
 releaseAsset();
 await until(()=>page.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).waiting?.state==='installed'),'new worker waiting');
 assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller===window.initialController),true);
 assert.deepEqual(await cachedPaths(page,cacheName(2)),[...resources].sort());
 await assert.rejects(until(()=>nextWorker.evaluate(()=>self.auditActivated),'activation with old client open',200),/Timed out: activation with old client open/);
 console.log('PASS the new worker is installed/waiting and cannot activate while the old client stays open');

 await page.close();
 await until(()=>nextWorker.evaluate(()=>self.auditActivated),'new worker activate event');
 await until(()=>nextWorker.evaluate(async expected=>{
  const keys=(await caches.keys()).filter(key=>key.startsWith('mocha-'));
  return keys.length===1&&keys[0]===expected;
 },cacheName(2)),'old cache deletion');
 page=await context.newPage();await page.goto(base);
 await until(()=>page.evaluate(()=>navigator.serviceWorker.controller?.state==='activated'),'new page controller');
 assert.equal(await page.locator('h1').textContent(),'Build 2');
 for(const path of resources)assert.equal(await page.evaluate(async({key,path})=>(await(await caches.open(key)).match(path)).text(),{key:cacheName(2),path}),asset(path,2));
 assert.deepEqual(await page.evaluate(()=>caches.keys()),[cacheName(2)]);
 await waitForOfflineReady(page,{paths:resources});
 console.log('PASS the new worker really activates, removes the old cache and serves the complete new build');

 assert.deepEqual(await page.evaluate(async()=>[await(await fetch('/api/probe')).json(),await(await fetch('/api/probe')).json()]),[{request:1},{request:2}]);
 assert.equal(await page.evaluate(async()=>!!await caches.match('/api/probe')),false);
 await context.setOffline(true);await page.reload();
 await until(()=>page.locator('output').textContent().then(text=>text===asset('/asset.txt',2)),'offline asset content');
 assert.equal(await page.locator('h1').textContent(),'Build 2');
 assert.equal(await page.locator('img').evaluate(async image=>{await image.decode();return image.naturalWidth;}),160);
 assert.equal(await page.evaluate(async()=>{try{await fetch('/api/probe');return true;}catch{return false;}}),false);
 assert.equal(apiRequests,2);
 assert.deepEqual(await cachedPaths(page,cacheName(2)),[...resources].sort());
 assert.deepEqual(await page.evaluate(()=>caches.keys()),[cacheName(2)]);
 await fs.mkdir(output,{recursive:true});await page.screenshot({path:new URL('after-upgrade-offline.png',output).pathname,fullPage:true});
 console.log('PASS upgraded page, asset and artwork load offline; API responses never enter the cache');
}finally{
 releaseAsset();await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
