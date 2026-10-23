import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';

const legacyTemplate=await fs.readFile(new URL('./legacy-sw-165cdca.js',import.meta.url),'utf8');
const currentTemplate=await fs.readFile(new URL('../../public/sw.js',import.meta.url),'utf8');
const legacyResources=['/','/asset.txt','/tile.svg','/lazy-old.js'];
const cacheName=version=>version===1?'mocha-legacy-fixture':'mocha-current-fixture';
let version=1,apiRequests=0;
const html=build=>`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>PWA migration fixture</title><style>body{font:20px system-ui;background:#f5efe3;color:#24352f;padding:30px}img{width:160px;display:block}output{display:block;margin-top:16px}</style><h1>Game in progress ${build}</h1><img src="/tile.svg" alt="Visited build artwork"><output>Loading asset</output><script>navigator.serviceWorker.register('/sw.js');fetch('/asset.txt').then(r=>r.text()).then(text=>document.querySelector('output').textContent=text)</script></html>`;
const asset=(path,build)=>path==='/'?html(build):path==='/asset.txt'?`asset from build ${build}`:path==='/html-fetched'?html(build):path==='/lazy-old.js'?'export const oldGameTurn=3;':`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="24" fill="${build===1?'#3f6d5a':'#c3653b'}"/><text x="80" y="102" text-anchor="middle" font-size="64" fill="white">${build}</text></svg>`;
const server=http.createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname,build=version;
 res.setHeader('Cache-Control','no-store');
 if(path==='/sw.js'){
  res.setHeader('Content-Type','application/javascript');
  const template=build===1?legacyTemplate:currentTemplate;
  res.end(template.replace("'__MOCHA_CACHE__'",JSON.stringify(cacheName(build))).replace("['__MOCHA_PRECACHE__']",JSON.stringify(legacyResources)));
 }else if(path==='/api/probe'){
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({request:++apiRequests}));
 }else if(['/','/asset.txt','/html-fetched','/lazy-old.js','/tile.svg'].includes(path)){
  res.setHeader('Content-Type',path==='/'||path==='/html-fetched'?'text/html':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.js')?'application/javascript':'text/plain');
  res.end(asset(path,build));
 }else{
  res.writeHead(404);res.end();
 }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;

async function until(predicate,label,timeout=10000){
 const deadline=Date.now()+timeout;
 while(!await predicate()){
  if(Date.now()>=deadline)throw new Error(`Timed out: ${label}`);
  await new Promise(resolve=>setTimeout(resolve,25));
 }
}
const cachePaths=async page=>page.evaluate(async()=>{
 const result={};
 for(const name of await caches.keys())result[name]=(await(await caches.open(name)).keys()).map(request=>new URL(request.url).pathname).sort();
 return result;
});

try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 let page=await context.newPage();
 await page.goto(base);
 await until(()=>page.evaluate(()=>navigator.serviceWorker.controller?.state==='activated'),'legacy controller');
 assert.equal(await page.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.active?.scriptURL),`${base}/sw.js`);
 assert.deepEqual(await cachePaths(page),{[cacheName(1)]:[...legacyResources].sort()});
 await page.reload();
 assert.equal(await page.locator('h1').textContent(),'Game in progress 1');

 const localData={profile:'fixture-profile',history:'fixture-history',practice:'fixture-practice','room-session':'fixture-session'};
 await page.evaluate(localData=>{for(const [key,value]of Object.entries(localData))localStorage.setItem(`mocha-${key}`,value);window.openGame={turn:2};window.initialController=navigator.serviceWorker.controller;},localData);
 console.log('PASS legacy worker is active on the same origin with the baseline precache and online page');

 version=2;
 const workerEvent=context.waitForEvent('serviceworker');
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 const nextWorker=await workerEvent;
 await until(()=>page.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.waiting?.state==='installed'),'current worker waiting');
 assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller===window.initialController),true);
 assert.equal(await page.locator('h1').textContent(),'Game in progress 1');
 const lazyResult=await page.evaluate(async()=>{window.openGame.turn+=1;const {oldGameTurn}=await import('/lazy-old.js');return{turn:window.openGame.turn,oldGameTurn};});
 assert.deepEqual(lazyResult,{turn:3,oldGameTurn:3});
 assert.deepEqual(await cachePaths(page),{[cacheName(1)]:[...legacyResources].sort()});
 console.log('PASS current worker waits while the open game keeps its controller, cache and late-loaded legacy chunk');

 await page.close();
 await until(async()=>await nextWorker.evaluate(()=>CACHE)===cacheName(2),'current worker activation');
 await until(()=>nextWorker.evaluate(async()=>(await caches.keys()).filter(key=>key.startsWith('mocha-')).length===0),'legacy cache cleanup');
 page=await context.newPage();
 await page.goto(base);
 await until(()=>page.evaluate(()=>navigator.serviceWorker.controller?.state==='activated'),'current page controller');
 assert.equal(await page.locator('h1').textContent(),'Game in progress 2');
 await page.evaluate(async()=>{await fetch('/asset.txt');await fetch('/html-fetched');});
 assert.deepEqual(await cachePaths(page),{[cacheName(2)]:['/asset.txt','/tile.svg']});
 assert.deepEqual(await page.evaluate(localData=>Object.fromEntries(Object.keys(localData).map(key=>[key,localStorage.getItem(`mocha-${key}`)])),localData),localData);
 assert.deepEqual(await page.evaluate(async()=>[await(await fetch('/api/probe')).json(),await(await fetch('/api/probe')).json()]),[{request:1},{request:2}]);
 assert.equal(await page.evaluate(async()=>!!await caches.match('/api/probe')),false);
 assert.equal(await page.evaluate(async()=>!!await caches.match('/')),false);
 console.log('PASS closing the old page activates the new worker, deletes whole-site caches and preserves local data');

 await context.setOffline(true);
 assert.equal(await page.evaluate(async()=>await(await fetch('/asset.txt')).text()),'asset from build 2');
 const coldPage=await context.newPage();
 await assert.rejects(coldPage.goto(base),/ERR_INTERNET_DISCONNECTED|ERR_FAILED/);
 await fs.mkdir(new URL('../../test-results/pwa-update/',import.meta.url),{recursive:true});
 await page.screenshot({path:new URL('../../test-results/pwa-update/after-upgrade-without-html-cache.png',import.meta.url).pathname,fullPage:true});
 console.log('PASS visited static assets remain available, but offline cold navigation fails without an HTML fallback');
}finally{
 await browser?.close();
 server.closeAllConnections();
 await new Promise(resolve=>server.close(resolve));
}
