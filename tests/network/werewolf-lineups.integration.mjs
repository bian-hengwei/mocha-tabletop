import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const base=process.env.TEST_API_BASE||'http://127.0.0.1:8787';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const identities=Array.from({length:14},(_,index)=>({profile:{id:randomUUID(),name:'配置验收'+index,avatar:'🦊'},token:randomBytes(24).toString('hex')}));
const sockets=[],seats=[];let host,invitation;
const roleCounts={classic9:{wolf:3,villager:3,seer:1,witch:1,hunter:1},classic:{wolf:4,villager:4,seer:1,witch:1,hunter:1,guard:1},idiot:{wolf:4,villager:4,seer:1,witch:1,hunter:1,idiot:1},wolfKing:{wolf:3,wolfKing:1,villager:4,seer:1,witch:1,hunter:1,guard:1}};
async function connect(index){
 const ws=new WebSocket(base.replace(/^http/,'ws')+'/api/rooms/'+invitation.code),messages=[];
 ws.addEventListener('message',event=>messages.push(JSON.parse(event.data)));
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 const client={index,ws,messages,send(message){ws.send(JSON.stringify({requestID:randomUUID(),...message}));},async wait(predicate,offset=0){for(let tries=0;tries<250;tries++){const result=messages.slice(offset).find(predicate);if(result)return result;await sleep(20);}throw Error(`Timed out for synthetic seat ${index}; last message type: ${messages.at(-1)?.type}`);}};
 sockets.push(client);ws.send(JSON.stringify({type:'hello',...identities[index],invite:invitation.invite}));return client;
}
async function join(index){const client=await connect(index);await client.wait(message=>message.type==='snapshot');seats.push(client);return client;}
async function allReady(){const offset=host.messages.length;for(const client of seats)client.send({type:'ready',ready:true});await host.wait(message=>message.room?.players.length===seats.length&&message.room.players.every(player=>player.ready),offset);}
async function hostError(message,expected){const offset=host.messages.length;host.send(message);const result=await host.wait(message=>message.type==='error',offset);assert.match(result.error,expected);}
async function select(preset,mode='judge'){
 const offset=host.messages.length;host.send({type:'selectGame',kind:'werewolf',options:{werewolfMode:mode,werewolfPreset:preset,language:'en'}});
 const snapshot=await host.wait(message=>message.room?.options?.werewolfPreset===preset&&message.room?.options?.werewolfMode===mode,offset);
 assert.equal(snapshot.room.players.find(player=>player.id===identities[0].profile.id).ready,true);
 assert(snapshot.room.players.filter(player=>player.id!==identities[0].profile.id).every(player=>!player.ready),'Changing the board or mode must reset every guest’s readiness');
 assert.equal(snapshot.room.options.moderatorID,mode==='standard'?undefined:identities[0].profile.id);
 return snapshot;
}
async function startAndCheck(preset,mode='judge'){
 await allReady();const offsets=seats.map(client=>client.messages.length);host.send({type:'start'});
 const snapshots=await Promise.all(seats.map((client,index)=>client.wait(message=>message.room?.started&&message.view,offsets[index])));
 const participantCount=preset==='classic9'?9:12;const hostID=identities[0].profile.id;
 assert.equal(snapshots[0].room.players.length,participantCount+(mode==='judge'?1:0));
 const dealtRoles=[];
 for(let index=0;index<snapshots.length;index++){
  const snapshot=snapshots[index],ownID=identities[seats[index].index].profile.id,board=snapshot.view.board;
  assert.equal(snapshot.room.options.werewolfPreset,preset);assert.equal(board.preset,preset);assert.equal(board.players.length,participantCount);assert.equal(snapshot.paused,false);
  assert.equal(board.players.some(player=>player.id===hostID),mode!=='judge');
  if(index===0&&mode==='judge'){
   assert.equal(board.ownRoleKey,'moderator');assert.equal(board.isModerator,true);assert(board.moderatorOnly);assert.equal(board.players.filter(player=>player.roleKey).length,participantCount);
  }else{
   assert.equal(board.moderatorOnly,undefined);assert.equal(board.players.filter(player=>player.roleKey).length,1);assert.equal(board.players.find(player=>player.roleKey).id,ownID);dealtRoles.push(board.ownRoleKey);
   assert.equal(snapshot.invite,index===0?invitation.invite:undefined);assert(!('roles' in board),'The private full role map must never be sent to a participant');
  }
 }
 const actual=Object.fromEntries([...new Set(dealtRoles)].map(role=>[role,dealtRoles.filter(value=>value===role).length]));assert.deepEqual(actual,roleCounts[preset]);
 const offset=host.messages.length;host.send({type:'endGame'});await host.wait(message=>message.room&&!message.room.started,offset);
 console.log(`PASS cloud ${preset}/${mode}: exact ${participantCount} participants${mode==='judge'?' + separate moderator':''}, correct role deck, private participant views, round returns to lobby`);
}
try{
 const response=await fetch(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...identities[0],kind:'werewolf',mode:'cloud',options:{werewolfMode:'judge',werewolfPreset:'classic9',language:'en'}})});assert.equal(response.status,200,`Create failed with HTTP ${response.status}`);invitation=await response.json();
 host=await join(0);for(let index=1;index<9;index++)await join(index);await allReady();await hostError({type:'start'},/10–10/);
 const guestOffset=seats[1].messages.length;seats[1].send({type:'selectGame',kind:'werewolf',options:{werewolfPreset:'wolfKing',werewolfMode:'judge'}});await seats[1].wait(message=>message.type==='error',guestOffset);assert.equal(host.messages.filter(message=>message.room).at(-1).room.options.werewolfPreset,'classic9');
 await join(9);const extra=await connect(13);await extra.wait(message=>message.type==='error'&&message.error==='房间已满');assert(!extra.messages.some(message=>message.room||message.view));extra.ws.close();
 await startAndCheck('classic9');
 await hostError({type:'selectGame',kind:'werewolf',options:{werewolfMode:'standard',werewolfPreset:'classic9'}},/上限/);
 const leaveOffset=host.messages.length;const departing=seats.pop();departing.send({type:'leave'});await host.wait(message=>message.room?.players.length===9,leaveOffset);
 await select('classic9','standard');await startAndCheck('classic9','standard');
 await select('classic9','deal');await startAndCheck('classic9','deal');
 await select('classic','judge');for(let index=9;index<13;index++)await join(index);await allReady();
 await hostError({type:'selectGame',kind:'werewolf',options:{werewolfMode:'judge',werewolfPreset:'classic9'}},/上限/);
 const thirteenth=await connect(13);await thirteenth.wait(message=>message.type==='error'&&message.error==='房间已满');assert(!thirteenth.messages.some(message=>message.room||message.view));thirteenth.ws.close();
 await startAndCheck('classic');
 for(const preset of ['idiot','wolfKing']){await allReady();await select(preset);await hostError({type:'start'},/准备/);await startAndCheck(preset);}
 const finalOffset=seats[1].messages.length;host.send({type:'leave'});await seats[1].wait(message=>message.type==='ended',finalOffset);
 console.log('PASS named-lineup boundaries: undersized/overcapacity rejection, all 4 presets, 9-player standard/deal + 10-seat judge, 13-seat judge excludes moderator, guest cannot reconfigure, configuration resets readiness, clean room dissolution');
}finally{if(host?.ws.readyState===WebSocket.OPEN)host.send({type:'leave'});for(const client of sockets)client.ws.close();}
