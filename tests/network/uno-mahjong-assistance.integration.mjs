import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const base=process.env.TEST_API_BASE||'http://127.0.0.1:8787';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function connect(code,credential,invite){
 const ws=new WebSocket(base.replace(/^http/,'ws')+'/api/rooms/'+code),messages=[];
 ws.addEventListener('message',event=>messages.push(JSON.parse(event.data)));
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 const client={ws,messages,send(message){ws.send(JSON.stringify({requestID:randomUUID(),...message}));},latest(){return messages.filter(message=>message.type==='snapshot').at(-1);},async wait(predicate,offset=0){
  for(let i=0;i<500;i++){const found=messages.slice(offset).find(predicate);if(found)return found;const error=messages.slice(offset).find(message=>message.type==='error');if(error)throw Error(error.message||'server rejected action');await pause(20);}throw Error('Timed out waiting for room update');
 }};
 client.send({type:'hello',...credential,invite});await client.wait(message=>message.type==='snapshot');return client;
}
function verifyCounts(view){
 const board=view.board,assist=board.assistance;if(!assist)return;
 const visible=new Map(),add=tiles=>tiles.forEach(tile=>visible.set(tile.id,tile));add(board.hand);
 for(const player of board.players){assert.equal(player.hand,undefined);add(player.discards);for(const meld of player.melds)add(meld.tiles);}
 if(board.pending)add([board.pending.tile]);for(const win of board.wins)add([win.tile]);
 for(const wait of [...assist.waits,...assist.discards.flatMap(discard=>discard.waits)])assert.equal(wait.unseen,Math.max(0,4-[...visible.values()].filter(tile=>tile.value===wait.value).length));
}
for(const kind of ['uno','mahjong']){
 const credentials=Array.from({length:kind==='uno'?3:4},(_,i)=>({profile:{id:randomUUID(),name:`Assist Test ${i}`,avatar:'🐶'},token:randomBytes(24).toString('hex')}));
 const clients=[];let code,invite,confirmed=0,recovered=false,assisted=0;
 try{
  const response=await fetch(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...credentials[0],kind,mode:'cloud',options:kind==='uno'?{unoMode:'single',unoChallenge:false}:{mahjongMode:'guangdong'}})});
  assert.equal(response.status,200,'create room');({code,invite}=await response.json());
  for(const credential of credentials)clients.push(await connect(code,credential,invite));
  for(const client of clients.slice(1))client.send({type:'ready',ready:true});
  await clients[0].wait(message=>message.room?.players.length===credentials.length&&message.room.players.every(player=>player.ready));clients[0].send({type:'start'});
  await Promise.all(clients.map(client=>client.wait(message=>message.view)));
  for(let step=0;step<500;step++){
   if(clients[0].latest().view.finished)break;
   if(kind==='mahjong'){for(const client of clients){verifyCounts(client.latest().view);assisted+=!!client.latest().view.board.assistance;}if(step>=40)break;}
   let actorIndex=clients.findIndex(client=>client.latest().view.actions.length);assert(actorIndex>=0,'some player can act');
   let actor=clients[actorIndex],snap=actor.latest();
   const pending=snap.view.actions.some(action=>action.id==='acceptPenalty');
   if(!recovered&&(pending||kind==='mahjong'&&step===4)){
    const before=structuredClone(snap.view),offset=clients[0].messages.length;actor.ws.close();
    if(actorIndex!==0)await clients[0].wait(message=>message.paused,offset);
    clients[actorIndex]=actor=await connect(code,credentials[actorIndex]);await actor.wait(message=>message.view&&!message.paused);
    snap=actor.latest();assert.deepEqual(snap.view,before,'same private view restored');
    await Promise.all(clients.map(client=>client.wait(message=>message.view&&!message.paused&&message.room.revision>=snap.room.revision)));recovered=true;
   }
   const actions=snap.view.actions;
   let action=actions.find(action=>action.id==='acceptPenalty')||actions.find(action=>action.id==='hu')||actions.find(action=>action.id==='callUno')||actions.find(action=>action.id==='passUno')||actions.find(action=>action.id==='pass')||actions.find(action=>action.id==='play')||actions[0];
   let values=action.choices.slice(0,action.min).map(choice=>choice.id);
   if(kind==='uno'&&action.id==='play'){
    const attack=action.choices.find(choice=>snap.view.board.hand.find(card=>card.id===choice.id)?.value==='draw2');if(attack)values=[attack.id];
   }
   if(kind==='uno'&&actions.some(action=>action.id.startsWith('wild:'))&&!pending){const plus=actions.find(action=>action.id.startsWith('wild:')&&snap.view.board.hand.find(card=>card.id===action.id.slice(5))?.value==='wild4');if(plus){action=plus;values=[plus.choices[0].id];}}
   const command={action:action.id,values},requestID=randomUUID(),offsets=clients.map(client=>client.messages.length);
   actor.send({type:'action',command,requestID,actionRevision:snap.actionRevision});
   await Promise.all(clients.map((client,i)=>client.wait(message=>message.view&&message.room.revision>snap.room.revision,offsets[i])));
   if(pending){
    const after=actor.latest(),count=snap.view.board.pendingPenalty.count;assert.equal(after.view.board.hand.length,snap.view.board.hand.length+count);assert.notEqual(after.view.board.current,snap.view.board.current);
    const offset=actor.messages.length;actor.send({type:'action',command,requestID,actionRevision:snap.actionRevision});const retry=await actor.wait(message=>message.type==='snapshot',offset);assert.deepEqual(retry.view,after.view,'retry cannot draw twice');confirmed++;
    if(confirmed>=2)break;
   }
  }
  assert(recovered,'recovery scenario exercised');assert(kind==='uno'?confirmed>=1:assisted>0,'feature exercised');
  console.log(`PASS ${kind}: ${kind==='uno'?`${confirmed} manual penalties and idempotent confirmation`:`${assisted} private assistance views counted from visible tiles`}, original view restored on reconnect`);
 }finally{
  if(code){const host=clients[0];if(host?.ws.readyState===WebSocket.OPEN){host.send({type:'leave'});for(let i=0;i<100;i++){if((await fetch(base+'/api/rooms/'+code)).status===404)break;await pause(50);}}for(const client of clients)client.ws.close();assert.equal((await fetch(base+'/api/rooms/'+code)).status,404,'test room cleaned up');}
 }
}
