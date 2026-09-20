import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const base=process.env.TEST_API_BASE||'http://127.0.0.1:8787';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function socket(code,cred,invite){
 const ws=new WebSocket(base.replace(/^http/,'ws')+'/api/rooms/'+code),messages=[];
 ws.addEventListener('message',event=>messages.push(JSON.parse(event.data)));
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.send(JSON.stringify({type:'hello',...cred,invite}));
 return {ws,messages,send(message){ws.send(JSON.stringify({requestID:randomUUID(),...message}));},latest(){return messages.filter(m=>m.type==='snapshot').at(-1);},async wait(predicate,offset=0){for(let i=0;i<400;i++){const found=messages.slice(offset).find(predicate);if(found)return found;await sleep(15);}throw Error('Snapshot timeout: '+JSON.stringify(messages.slice(-2)));}};
}
const names=['梅林；红队','{votes}','红队；{plans}','{target}；梅林','UNO爱好者；甲','正常；玩家'];
for(const kind of ['avalon','werewolf']){
 const count=kind==='avalon'?5:6,creds=names.slice(0,count).map(name=>({profile:{id:randomUUID(),name,avatar:'🦊'},token:randomBytes(24).toString('hex')})),clients=[];
 let host,code,closed=false;
 async function act(index,action,values=[]){
  const before=clients[index].latest(),offsets=clients.map(c=>c.messages.length);
  clients[index].send({type:'action',actionRevision:before.actionRevision,command:{action,values}});
  await Promise.all(clients.map((c,i)=>c.wait(m=>m.view&&m.room.revision>before.room.revision,offsets[i])));
 }
 async function reconnect(index){
  const before=clients[index].latest().view,offset=host.messages.length;
  clients[index].ws.close();await host.wait(m=>m.paused,offset);
  const resumed=await socket(code,creds[index]);clients[index]=resumed;
  await resumed.wait(m=>m.view&&!m.paused);assert.deepEqual(resumed.latest().view,before);
  await Promise.all(clients.map(c=>c.wait(m=>m.view&&!m.paused&&m.room.revision>=resumed.latest().room.revision)));
 }
 try{
  const response=await fetch(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...creds[0],kind,mode:'cloud'})});
  assert.equal(response.status,200);const room=await response.json();code=room.code;
  for(const cred of creds){const c=await socket(code,cred,room.invite);clients.push(c);await c.wait(m=>m.type==='snapshot');}
  host=clients[0];for(const c of clients.slice(1))c.send({type:'ready',ready:true});
  await host.wait(m=>m.room?.players.length===count&&m.room.players.every(p=>p.ready));host.send({type:'start'});
  await Promise.all(clients.map(c=>c.wait(m=>m.view)));
  if(kind==='avalon'){
   const leader=clients.findIndex(c=>c.latest().view.actions.some(a=>a.id==='propose'));
   const a=clients[leader].latest().view.actions.find(a=>a.id==='propose');
   await act(leader,'propose',a.choices.slice(0,a.min).map(c=>c.id));
   for(let i=0;i<count;i++){
    await act(i,'approve',[i===1?'no':'yes']);
    if(i<count-1)for(const c of clients)assert.deepEqual(c.latest().view.logText,{});
   }
   const reference=host.latest().view.logText;
   assert.equal(Object.keys(reference).length,1);
   for(const c of clients){assert.deepEqual(c.latest().view.logText,reference);assert.equal(c.latest().view.log.at(-1),'表决：'+names.slice(0,count).map((n,i)=>n+' '+(i===1?'反对':'赞成')).join('；'));}
   const votes=Object.values(reference)[0].values.votes.filter(v=>v.values);
   assert.deepEqual(votes.map(v=>v.values.name),names.slice(0,count));
   assert.deepEqual(votes.map(v=>v.template),['{name} 赞成','{name} 反对','{name} 赞成','{name} 赞成','{name} 赞成']);
   await reconnect(1);
  }else{
   const wolves=clients.flatMap((c,i)=>c.latest().view.board.ownRoleKey==='wolf'?[i]:[]);assert.equal(wolves.length,2);
   await act(wolves[0],'wolf',[creds[1].profile.id]);await act(wolves[1],'wolf',['skip']);
   for(const [i,c]of clients.entries()){
    const v=c.latest().view,plan=v.sections[0].items.find(item=>item.id==='wolfPlans');
    if(wolves.includes(i)){
     assert(plan?.detailText);const entries=plan.detailText.values.plans.filter(p=>p.values);
     assert.deepEqual(entries.map(p=>p.values.name),wolves.map(n=>names[n]));
     assert.equal(entries[0].values.target,names[1]);assert.equal(entries[1].template,'{name}：空刀');
     assert.deepEqual(v.board.ownKnowledge.find(k=>k.id==='wolfPlans'),plan);
    }else{assert.equal(plan,undefined);assert(!v.board.ownKnowledge.some(k=>k.id==='wolfPlans'));}
    assert.deepEqual(v.logText,{});
   }
   // Rejoin a non-host wolf while private information is live.
   await reconnect(wolves.find(i=>i!==0));
   for(let step=0;step<35&&!host.latest().view.actions.some(a=>a.id==='vote');step++){
    if(clients.some(c=>c.latest().view.actions.some(a=>a.id==='vote')))break;
    const index=clients.findIndex(c=>c.latest().view.actions.some(a=>!['explode','withdraw'].includes(a.id)));assert(index>=0);
    const action=clients[index].latest().view.actions.find(a=>!['explode','withdraw'].includes(a.id));
    await act(index,action.id,action.id==='signup'?['no']:action.choices.length?['skip']:[]);
   }
   assert(clients.every(c=>c.latest().view.actions.some(a=>a.id==='vote')));
   const logCount=host.latest().view.log.length;
   for(let i=0;i<count;i++){
    await act(i,'vote',[i===0?'skip':creds[0].profile.id]);
    if(i<count-1)for(const c of clients)assert.equal(c.latest().view.log.length,logCount);
   }
   const index=host.latest().view.log.findIndex(line=>line.startsWith('放逐选票：'));
   assert(index>=0);const message=host.latest().view.logText[index];assert(message);
   for(const c of clients)assert.deepEqual(c.latest().view.logText[index],message);
   assert.deepEqual(message.values.votes.filter(v=>v.values).map(v=>v.values.name),names);
   await reconnect(1);
  }
  const offset=host.messages.length;host.send({type:'endGame'});await host.wait(m=>m.type==='snapshot'&&!m.room.started,offset);
  host.send({type:'leave'});await clients[1].wait(m=>m.type==='ended');closed=true;
  console.log(`PASS ${kind}: structured names survive real sockets and reconnect; disclosure timing/role permissions checked; room dissolved`);
 }finally{
  if(host&&!closed){try{host.send({type:'endGame'});await sleep(100);host.send({type:'leave'});await sleep(100);}catch{}}
  for(const client of clients)client.ws.close();
 }
}
