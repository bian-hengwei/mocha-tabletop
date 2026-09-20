import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
// Local emulator only: production Cloudflare owns/overwrites CF-Connecting-IP.
const base='http://127.0.0.1:8787';const a='2001:db8:1234:5678::11',b='2001:db8:1234:5678::22',other='2001:db8:1234:5679::22';
const request=async(path,ip,body)=>{const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'CF-Connecting-IP':ip,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};};
const profile={id:randomUUID(),name:'IPv6 test',avatar:'🦊'},token=randomBytes(24).toString('hex');
const made=await request('/api/create',a,{profile,token,mode:'cloud',kind:'gems'});assert.equal(made.status,200,JSON.stringify(made));const {code,invite}=made.data;
try{
 const same=await request('/api/discover',b);assert(same.data.some(r=>r.code===code),'same /64 discovers candidate');
 const adjacent=await request('/api/discover',other);assert(!adjacent.data.some(r=>r.code===code),'adjacent /64 excluded');
 const canonical=await request('/api/discover','2001:0DB8:1234:5678:0000:0000:0000:0099');assert(canonical.data.some(r=>r.code===code));
 const invalid=await request('/api/discover','2001::db8::1');assert.equal(invalid.status,400);
 for(const candidate of same.data){assert(!('hash'in candidate));assert(!('ip'in candidate));assert(!('invite'in candidate));assert(!JSON.stringify(candidate).includes('2001:'));}
 console.log('PASS local IPv6 discovery: distinct interface IDs share /64 candidate list; adjacent subnet excluded; canonical forms match; invalid address rejected; no IP/hash/invite exposed');
}finally{
 const ws=new WebSocket(base.replace('http:','ws:')+'/api/rooms/'+code);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('cleanup timeout')),5000);ws.addEventListener('open',()=>ws.send(JSON.stringify({type:'hello',profile,token,invite})));ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.type==='snapshot')ws.send(JSON.stringify({type:'leave',requestID:randomUUID()}));if(m.type==='ended'){clearTimeout(timer);ws.close();resolve();}});ws.addEventListener('error',reject);});
}
