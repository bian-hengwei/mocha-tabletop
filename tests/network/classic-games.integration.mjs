import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const base=process.env.TEST_API_BASE||'http://127.0.0.1:8787';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function socket(code,cred,invite){const ws=new WebSocket(base.replace(/^http/,'ws')+'/api/rooms/'+code),messages=[];ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});ws.send(JSON.stringify({type:'hello',...cred,invite}));return{ws,messages,send(msg){ws.send(JSON.stringify({requestID:randomUUID(),...msg}));},latest(){return messages.filter(m=>m.type==='snapshot').at(-1);},async wait(fn,offset=0){for(let i=0;i<400;i++){const result=messages.slice(offset).find(fn);if(result)return result;await sleep(15);}throw Error('timeout '+JSON.stringify(messages.slice(-2)));}};}
for(const [kind,mode]of [['doudizhu'],['guandan'],['mahjong','guangdong'],['mahjong','sichuan'],['mahjong','bloodflow'],['mahjong','laizi'],...['bloodflowAny','bloodflowThree','redBloodflow','redBattle','guangdongFan','guangdongGhost'].map(mode=>['mahjong',mode])].filter(([kind])=>!process.env.TEST_MAHJONG_ONLY||kind==='mahjong')){
 const creds=Array.from({length:kind==='doudizhu'?3:4},(_,i)=>({profile:{id:randomUUID(),name:`Classic Test ${i}`,avatar:'🐶'},token:randomBytes(24).toString('hex')})),clients=[];let host;
 try{
  const res=await fetch(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...creds[0],kind,mode:'cloud',options:mode?{mahjongMode:mode}:undefined})});assert.equal(res.status,200);const {code,invite}=await res.json();
  for(const cred of creds){const c=await socket(code,cred,invite);clients.push(c);await c.wait(m=>m.type==='snapshot');}
  host=clients[0];for(const c of clients.slice(1))c.send({type:'ready',ready:true});await host.wait(m=>m.room?.players.length===creds.length&&m.room.players.every(p=>p.ready));host.send({type:'start'});await Promise.all(clients.map(c=>c.wait(m=>m.view)));
  const room=host.latest().room;assert.equal(room.kind,kind);if(mode)assert.equal(room.options.mahjongMode,mode);
  // Private views contain no deck, full-state wrapper, other hand or private response map.
  for(const c of clients){const snap=c.latest();assert(!('game'in snap));assert(!('wall'in snap.view.board));assert(!('responses'in(snap.view.board.pending||{})));assert(snap.view.board.players.every(p=>p.hand===undefined));}
  for(let step=0;step<70;step++){
   if(kind==='mahjong')for(const c of clients){const offered=c.latest().view.actions;assert(!offered.some(a=>a.id==='pass')||offered.length>1,'forced passes never require a client command');}
   if(clients.some(c=>c.latest().view.finished)||host.latest().view.board.phase==='roundEnd')break;
   const actor=clients.find(c=>c.latest().view.actions.length);assert(actor);const snap=actor.latest(),view=snap.view,b=view.board;
   let action=view.actions.find(a=>a.id==='hu')||view.actions.find(a=>a.id==='pass')||view.actions[0],values=action.choices.slice(0,action.min).map(c=>c.id);
   if(b.phase==='bid'){action=view.actions.find(a=>a.id==='bid');values=['3'];}
   if(kind!=='mahjong'&&b.phase==='play'){action=view.actions.find(a=>a.id===(b.hint.length?'play':'pass'));values=b.hint.length?b.hint:[];}
   if(action.id==='exchange'){const suit=[0,1,2].find(s=>b.hand.filter(t=>Math.floor(t.value/9)===s).length>=3);values=b.hand.filter(t=>Math.floor(t.value/9)===suit).slice(0,3).map(t=>t.id);}
   const requestID=randomUUID(),command={action:action.id,values};const offsets=clients.map(c=>c.messages.length);actor.send({type:'action',command,requestID,actionRevision:snap.actionRevision});await Promise.all(clients.map((c,i)=>c.wait(m=>m.view&&m.room.revision>snap.room.revision,offsets[i])));
   if(step===1){const after=actor.latest(),offset=actor.messages.length;actor.send({type:'action',command,requestID,actionRevision:snap.actionRevision});const duplicate=await actor.wait(m=>m.type==='snapshot',offset);assert.equal(duplicate.room.revision,after.room.revision);}
   if(step===15){const index=1,old=clients[index].latest(),off=host.messages.length;clients[index].ws.close();await host.wait(m=>m.paused,off);const resumed=await socket(code,creds[index]);clients[index]=resumed;await resumed.wait(m=>m.view&&!m.paused);assert.deepEqual(resumed.latest().view,old.view);await Promise.all(clients.map(c=>c.wait(m=>m.view&&!m.paused&&m.room.revision>=resumed.latest().room.revision)));}
  }
  const off=host.messages.length;host.send({type:'endGame'});await host.wait(m=>m.type==='snapshot'&&!m.room.started,off);host.send({type:'leave'});await clients[1].wait(m=>m.type==='ended');console.log(`PASS ${kind}/${mode||'classic'}: real Worker sockets, private views, 70 actions, dedup, pause/reconnect and teardown`);
 }finally{for(const c of clients)c.ws.close();}
}
