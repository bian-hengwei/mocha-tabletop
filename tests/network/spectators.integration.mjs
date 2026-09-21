import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const base=process.env.TEST_API_BASE||'http://127.0.0.1:8787';
const profile=name=>({id:randomUUID(),name,avatar:'🦊'});
const credentials=name=>({profile:profile(name),token:randomBytes(24).toString('hex')});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const request=async(path,body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
async function socket(code,cred,invite,spectator=false){const ws=new WebSocket(base.replace(/^http/,'ws')+'/api/rooms/'+code);const messages=[];ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});ws.send(JSON.stringify({type:'hello',...cred,invite,spectator}));return {ws,messages,send(msg){ws.send(JSON.stringify({requestID:randomUUID(),...msg}));},async wait(predicate,offset=0){for(let i=0;i<200;i++){const m=messages.slice(offset).find(predicate);if(m)return m;await sleep(20);}throw Error('timeout: '+JSON.stringify(messages.slice(-3)));}};}
const sockets=[];
let host;
const connect=async(...args)=>{const s=await socket(...args);sockets.push(s);return s;};
const change=async(s,msg,predicate=m=>m.type==='snapshot')=>{const offset=s.messages.length;s.send(msg);return s.wait(predicate,offset);};
try{
 const a=credentials('Host'),b=credentials('Player'),c=credentials('Watcher'),d=credentials('Code watcher');
 const made=await request('/api/create',{...a,kind:'gems',mode:'cloud'});assert.equal(made.status,200);const {code,invite}=made.data;
 host=await connect(code,a);await host.wait(m=>m.type==='snapshot');
 const player=await connect(code,b,invite);await player.wait(m=>m.type==='snapshot');
 const watcher=await connect(code,c,invite,true);let ws=await watcher.wait(m=>m.type==='snapshot');assert.equal(ws.room.players.length,2);assert.equal(ws.room.spectators.length,1);
 ws=await change(watcher,{type:'setSeat',spectator:false});assert.equal(ws.room.players.length,3);assert.equal(ws.room.players.find(p=>p.id===c.profile.id).ready,false);
 ws=await change(watcher,{type:'setSeat',spectator:true});assert.equal(ws.room.players.length,2);
 await change(watcher,{type:'ready',ready:true},m=>m.type==='error'&&m.error.includes('观众'));
 const pending=await connect(code,d);await pending.wait(m=>m.type==='pending');assert(!pending.messages.some(m=>m.room));
 await change(player,{type:'ready',ready:true});const started=await change(host,{type:'start'},m=>m.room?.started);assert(started.view);assert(started.room.pending[0].spectator);
 await change(host,{type:'approve',playerID:d.profile.id,accept:true});const approved=await pending.wait(m=>m.view);assert(approved.view.spectating);assert.equal(approved.view.actions.length,0);assert.equal(approved.room.players.length,2);
 const lateCred=credentials('Late watcher'),late=await connect(code,lateCred,invite);const lateSnap=await late.wait(m=>m.view);assert(lateSnap.view.spectating);assert.deepEqual(lateSnap.view.board.hand,[]);assert.equal(lateSnap.invite,undefined);
 for(const type of ['start','replay','endGame','setSpectators','selectGame','switchToCloud','setSeat','action'])await change(late,{type,allowed:false,spectator:false,kind:'uno',command:{action:'take_pair',values:['white']},actionRevision:0},m=>m.type==='error');
 const forged=await connect(code,{profile:lateCred.profile,token:randomBytes(24).toString('hex')},invite);await forged.wait(m=>m.error==='身份不匹配');assert(!forged.messages.some(m=>m.room));
 let offset=host.messages.length;late.ws.close();const offline=await host.wait(m=>m.room?.spectators.some(p=>p.id===lateCred.profile.id&&!p.connected),offset);assert(!offline.paused);
 const resumed=await connect(code,lateCred);const resume=await resumed.wait(m=>m.view);assert.equal(resume.room.matchID,started.room.matchID);assert(resume.view.spectating);
 offset=host.messages.length;resumed.send({type:'leave'});await host.wait(m=>m.room&&!m.room.spectators.some(p=>p.id===lateCred.profile.id),offset);
 // A departed observer may rejoin but never becomes a participant midgame.
 const again=await connect(code,lateCred,invite);assert((await again.wait(m=>m.view)).view.spectating);
 const off=watcher.messages.length;await change(host,{type:'setSpectators',allowed:false});await watcher.wait(m=>m.type==='rejected'&&m.error.includes('关闭观战'),off);
 const denied=await connect(code,credentials('Denied'),invite);await denied.wait(m=>m.error==='房主已关闭观战');assert(!denied.messages.some(m=>m.view||m.room));
 const playerAgain=await connect(code,b);const ps=await playerAgain.wait(m=>m.view);assert(!ps.view.spectating);assert(ps.room.players.some(p=>p.id===b.profile.id));
 await change(host,{type:'setSpectators',allowed:true});const reopened=await connect(code,credentials('Reopened'),invite);assert((await reopened.wait(m=>m.view)).view.spectating);
 await change(host,{type:'endGame'},m=>m.room&&!m.room.started);const seated=await change(reopened,{type:'setSeat',spectator:false});assert.equal(seated.room.players.length,3);assert.equal(seated.room.spectators.length,0);
 console.log('PASS spectator cloud integration: seat switching, queued approval across start, late invite/code join, privacy, permissions, reconnect, no spectator pause, disable/re-enable, player recovery and replay');
}finally{if(host?.ws.readyState===WebSocket.OPEN)host.send({type:'leave'});for(const s of sockets)s.ws.close();}
