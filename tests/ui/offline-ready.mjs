import {expect} from '@playwright/test';

/** Await the async cache query on the test side, including its false results. */
export async function waitForOfflineReady(page,{paths=['/'],timeout=30000}={}){
 await expect.poll(()=>page.evaluate(async paths=>{
  const controlled=navigator.serviceWorker?.controller?.state==='activated';
  const required=[...new Set([
   ...paths,
   ...Array.from(document.querySelectorAll('script[src],link[rel="stylesheet"][href]'),node=>node.getAttribute('src')||node.getAttribute('href')),
  ].filter(Boolean).map(path=>new URL(path,location.href).href).filter(url=>new URL(url).origin===location.origin))];
  const missing=[];
  for(const url of required)if(!(await caches.match(url))?.ok)missing.push(new URL(url).pathname);
  return {controlled,missing};
 },paths),{timeout,message:'An activated service worker and the current page assets must be ready for offline use'}).toEqual({controlled:true,missing:[]});
}
