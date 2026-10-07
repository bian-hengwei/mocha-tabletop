import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import assert from 'node:assert/strict';

// Exercise real SQLite transactions in workerd, including an error after partial
// writes. This test-only RPC dispatcher is never included in the application.
const bundle=await build({stdin:{contents:`
 import {ReactionCatalog} from './worker/reactionStorage';
 export {ReactionCatalog};
 export default {async fetch(request,env){
  const body=await request.json(),stub=env.REACTIONS.getByName(body.name||'test');
  if(body.method==='commit'){if(body.args[0]===null)body.args[0]=undefined;for(const file of body.args[2])file.bytes=Uint8Array.from(file.bytes);}
  try{return Response.json(await stub[body.method](...body.args));}
  catch{return new Response('storage failure',{status:503});}
 }};`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',external:['cloudflare:workers'],platform:'neutral'});
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-19',durableObjects:{REACTIONS:{className:'ReactionCatalog',useSQLite:true}}}));
async function rpc(method,args=[],name='test'){return mf.dispatchFetch('https://test/',{method:'POST',body:JSON.stringify({method,args,name})});}
try{
 assert.deepEqual(await (await rpc('readCatalog')).json(),{data:[]});
 const file={key:'image',bytes:Array.from({length:140000},(_,i)=>i%251),contentType:'image/png'};
 assert.equal(await (await rpc('commit',[null,[{id:'original'}],[file],[]])).json(),true);
 const original=await (await rpc('readCatalog')).json();
 // Duplicate key fails after deletion and a new insertion; the transaction must
 // restore both the old catalog and all old image chunks.
 const failed=await rpc('commit',[original.etag,[{id:'bad'}],[{...file,key:'new'},{...file,key:'new'}],['image']]);
 assert.equal(failed.status,503);
 assert.deepEqual(await (await rpc('readCatalog')).json(),original);
 assert.equal(await (await rpc('readImage',['new'])).json(),null);
 const image=await (await rpc('readImage',['image'])).json();
 assert.deepEqual(Object.values(image.bytes),file.bytes);
 // Two updates from the same snapshot cannot both succeed.
 const results=await Promise.all([rpc('commit',[original.etag,[{id:'winner1'}],[],[]]),rpc('commit',[original.etag,[{id:'winner2'}],[],[]])]);
 assert.deepEqual((await Promise.all(results.map(r=>r.json()))).sort(),[false,true]);
 assert.deepEqual(await (await rpc('readCatalog',[],'separate')).json(),{data:[]});
 const current=await (await rpc('readCatalog')).json();
 assert.equal(await (await rpc('commit',[current.etag,[],[],['image']])).json(),true);
 assert.equal(await (await rpc('readImage',['image'])).json(),null);
 console.log('PASS SQLite chunk reconstruction, transaction rollback, stale version concurrency, instance isolation and deletion');
}finally{await mf.dispose();}
