import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const base=process.env.TEST_API_BASE||'http://127.0.0.1:8787';
const credentials=name=>({profile:{id:randomUUID(),name,avatar:'🦊'},token:randomBytes(24).toString('hex')});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function socket(code,cred,invite,spectator=false){
 const ws=new WebSocket(base.replace(/^http/,'ws')+'/api/rooms/'+code),messages=[];
 ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 ws.send(JSON.stringify({type:'hello',...cred,invite,spectator}));
 return {ws,messages,send(msg){ws.send(JSON.stringify({requestID:randomUUID(),...msg}));},async wait(predicate,offset=0){for(let i=0;i<250;i++){const m=messages.slice(offset).find(predicate);if(m)return m;await sleep(20);}throw Error('timeout: '+JSON.stringify(messages.slice(-2)));}};
}
const change=async(s,msg,predicate=m=>m.type==='snapshot')=>{const offset=s.messages.length;s.send(msg);return s.wait(predicate,offset);};
for(const mode of ['cloud','lan']){
 const peers=[],a=credentials('Host'),b=credentials('Player'),c=credentials('Observer'),d=credentials('Pending');let host;
 const connect=async(...args)=>{const p=await socket(...args);peers.push(p);return p;};
 try{
  const response=await fetch(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...a,kind:'gems',mode})});assert.equal(response.status,200);const {code,invite}=await response.json();
  host=await connect(code,a);await host.wait(m=>m.room);
  const player=await connect(code,b,invite);await player.wait(m=>m.room);
  const watcher=await connect(code,c,invite,true);await watcher.wait(m=>m.room);
  const pending=await connect(code,d);await pending.wait(m=>m.type==='pending');
  const baseline=await change(host,{type:'ping',sync:true});
  const requestID=randomUUID(),text='Hello 狼人杀 <script>alert(1)</script>';
  const chat=await change(host,{type:'social',requestID,command:{type:'chat',text}},m=>m.type==='social');
  assert.equal(chat.social.messages[0].text,text);assert.deepEqual(chat.social.messages[0].player,a.profile);
  assert.deepEqual(Object.keys(chat.social).sort(),['messages','reactions','revision']);assert(!('room'in chat));assert(!('view'in chat));
  await player.wait(m=>m.social?.messages.length===1);await watcher.wait(m=>m.social?.messages.length===1);
  await change(host,{type:'social',requestID,command:{type:'chat',text:'duplicate'}},m=>m.type==='socialAck');
  const synced=await change(host,{type:'ping',sync:true});assert.equal(synced.room.revision,baseline.room.revision);assert.equal(synced.social.messages.length,1);
  await change(host,{type:'social',command:{type:'reaction',reaction:'cow'}},m=>m.type==='socialError'&&m.error.includes('太快'));
  for(const command of [{type:'chat',text:''},{type:'chat',text:'x'.repeat(281)},{type:'chat',text:'spoof',playerID:a.profile.id},{type:'reaction',reaction:'https://evil.invalid/x.gif'}])await change(player,{type:'social',command},m=>m.type==='socialError');
  await change(watcher,{type:'social',command:{type:'chat',text:'spoiler'}},m=>m.type==='socialError');
  await change(pending,{type:'social',command:{type:'chat',text:'spoiler'}},m=>m.type==='error');assert(!pending.messages.some(m=>m.social||m.room||m.view));
  await change(player,{type:'social',command:{type:'reaction',reaction:'cow'}},m=>m.type==='socialAck');
  const reaction=await host.wait(m=>m.type==='social'&&m.social.reactions.length===1);assert.equal(reaction.social.reactions[0].playerID,b.profile.id);assert.equal(reaction.social.messages.length,1);
  player.ws.close();const restored=await connect(code,b);const recovered=await restored.wait(m=>m.room);assert.equal(recovered.social.messages.length,1);assert.equal(recovered.room.players.length,2);
  await sleep(5100);const expired=await change(restored,{type:'ping',sync:true});assert.equal(expired.social.reactions.length,0);
  await change(restored,{type:'ready',ready:true});
  const started=await change(host,{type:'start',directPeers:[b.profile.id]},m=>m.room?.started);
  const actorRevision=started.actionRevision;
  await change(host,{type:'social',command:{type:'chat',text:'in game'}},m=>m.type==='socialAck');
  const after=await change(host,{type:'ping',sync:true});assert.equal(after.room.matchID,started.room.matchID);assert.equal(after.actionRevision,actorRevision);assert.deepEqual(after.view,started.view);
  await change(host,{type:'endGame'},m=>m.room&&!m.room.started);assert.equal((await change(host,{type:'ping',sync:true})).social.messages.length,2);
  await change(host,{type:'selectGame',kind:'uno'});assert.equal((await change(host,{type:'ping',sync:true})).social.messages.length,2);
  for(const kind of ['codenames','werewolf','avalon','undercover']){
   const switched=await change(host,{type:'selectGame',kind});assert.deepEqual(switched.social.messages,[]);
   for(const command of [{type:'chat',text:'secret'},{type:'reaction',reaction:'cow'}])await change(host,{type:'social',command},m=>m.type==='socialError'&&m.error.includes('不开放'));
  }
  await change(host,{type:'selectGame',kind:'gems'});assert.equal((await change(host,{type:'ping',sync:true})).social.messages.length,2);
  const replacement=await connect(code,a);await replacement.wait(m=>m.room);host=replacement;
  const forged=await connect(code,{...a,token:randomBytes(24).toString('hex')});await forged.wait(m=>m.error==='身份不匹配');assert(!forged.messages.some(m=>m.social));
  const endings=peers.filter(p=>p.ws.readyState===WebSocket.OPEN).map(p=>({peer:p,offset:p.messages.length}));
  await change(host,{type:'leave'},m=>m.type==='ended');await sleep(100);
  for(const {peer,offset} of endings)assert(!peer.messages.slice(offset).some(m=>m.type==='snapshot'||m.type==='social'),'no room/chat payload after dissolution');
  assert.equal((await fetch(base+'/api/rooms/'+code)).status,404);
  const freshResponse=await fetch(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...a,kind:'gems',mode})});assert.equal(freshResponse.status,200);const fresh=await freshResponse.json();
  host=await connect(fresh.code,a);const freshRoom=await host.wait(m=>m.room);assert.notEqual(fresh.code,code);assert.deepEqual(freshRoom.social.messages,[]);assert.deepEqual(freshRoom.social.reactions,[]);
  console.log('PASS room social network',mode,'authentication, approval boundary, read-only observers, literal messages, dedup, cooldown, invalid inputs, reconnect, expiry, game revisions, room-level game switching, exclusions, dissolution and fresh-room isolation');
 }finally{if(host?.ws.readyState===WebSocket.OPEN){host.send({type:'leave'});await sleep(100);}for(const p of peers)p.ws.close();}
}
