import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const base=process.env.TEST_API_BASE||'http://127.0.0.1:8787';
const profile=name=>({id:randomUUID(),name,avatar:'🦊'});
const credentials=name=>({profile:profile(name),token:randomBytes(24).toString('hex')});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const request=async(path,body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
async function socket(code,cred,invite){const ws=new WebSocket(base.replace(/^http/,'ws')+'/api/rooms/'+code);const messages=[];ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});ws.send(JSON.stringify({type:'hello',...cred,invite}));return {ws,messages,send(msg){ws.send(JSON.stringify({requestID:randomUUID(),...msg}));},async wait(predicate,offset=0){for(let i=0;i<200;i++){const m=messages.slice(offset).find(predicate);if(m)return m;await sleep(20);}throw Error('timeout: '+JSON.stringify(messages.slice(-3)));}};}
const sockets=[];
try{
 const a=credentials('房主'),b=credentials('朋友'),c=credentials('第三人'),outsider=credentials('陌生人');
 const made=await request('/api/create',{...a,kind:'gems',mode:'cloud'});assert.equal(made.status,200);assert.match(made.data.code,/^[A-Z2-9]{6}$/);const {code,invite}=made.data;
 const host=await socket(code,a);sockets.push(host);const hs=await host.wait(m=>m.type==='snapshot');assert.equal(hs.room.hostID,a.profile.id);assert.equal(hs.invite,invite);
 const guest=await socket(code,b);sockets.push(guest);await guest.wait(m=>m.type==='pending');assert(!guest.messages.some(m=>m.room||m.view));
 await host.wait(m=>m.type==='snapshot'&&m.room.pending.some(p=>p.id===b.profile.id));host.send({type:'approve',playerID:b.profile.id,accept:true});
 await guest.wait(m=>m.type==='snapshot');assert(!guest.messages.some(m=>m.invite));
 const third=await socket(code,c,invite);sockets.push(third);await third.wait(m=>m.type==='snapshot');
 const pending=await socket(code,outsider);sockets.push(pending);await pending.wait(m=>m.type==='pending');host.send({type:'approve',playerID:outsider.profile.id,accept:false});await pending.wait(m=>m.type==='rejected');
 guest.send({type:'ready',ready:true});third.send({type:'ready',ready:true});await host.wait(m=>m.type==='snapshot'&&m.room.players.length===3&&m.room.players.every(p=>p.ready));
 host.send({type:'start'});const started=await host.wait(m=>m.type==='snapshot'&&m.view);const gs=await guest.wait(m=>m.type==='snapshot'&&m.view);
 assert.equal(started.room.started,true);assert.equal(gs.room.pending.length,0);assert(!('match'in gs));assert(!('tokens'in gs));assert.equal(gs.invite,undefined);
 const active=[host,guest,third].find(s=>s.messages.some(m=>m.view?.actions.length));assert(active);const snap=active.messages.filter(m=>m.view).at(-1);const action=snap.view.actions[0];const cmd={action:action.id,values:action.choices.slice(0,action.min).map(c=>c.id)};const id=randomUUID();let offset=active.messages.length;
 active.send({type:'action',command:cmd,requestID:id,actionRevision:snap.actionRevision});const after=await active.wait(m=>m.type==='snapshot'&&m.room.revision>snap.room.revision,offset);
 offset=active.messages.length;active.send({type:'action',command:cmd,requestID:id,actionRevision:snap.actionRevision});const duplicate=await active.wait(m=>m.type==='snapshot',offset);assert.equal(duplicate.room.revision,after.room.revision);assert.equal(duplicate.actionRevision,after.actionRevision);
 offset=active.messages.length;active.send({type:'action',command:cmd,actionRevision:snap.actionRevision});await active.wait(m=>m.type==='error'&&m.error.includes('变化'),offset);
 const forged=await socket(code,{profile:b.profile,token:randomBytes(24).toString('hex')});sockets.push(forged);await forged.wait(m=>m.type==='error'&&m.error==='身份不匹配');assert(!forged.messages.some(m=>m.room));
 const off=host.messages.length;guest.ws.close();await host.wait(m=>m.type==='snapshot'&&m.paused,off);
 const resumed=await socket(code,b);sockets.push(resumed);const resumeSnap=await resumed.wait(m=>m.type==='snapshot');assert(resumeSnap.view);assert.equal(resumeSnap.paused,false);
 host.send({type:'endGame'});await host.wait(m=>m.type==='snapshot'&&!m.room.started&&m.room.revision>after.room.revision);const discovery=await request('/api/discover');assert(discovery.data.some(r=>r.code===code));assert(!JSON.stringify(discovery.data).includes(invite));assert(discovery.data.every(r=>!('hash'in r)));
 const cors=await fetch(base+'/api/discover',{headers:{Origin:'https://attacker.invalid'}});assert.equal(cors.status,403);
 host.send({type:'leave'});await resumed.wait(m=>m.type==='ended');
 console.log('PASS cloud integration: create, private approval, invite, ready, start, per-player snapshots, actor revision, dedup, impersonation rejection, pause/reconnect, replay discovery, CORS, dissolve');
}finally{for(const s of sockets)s.ws.close();}
