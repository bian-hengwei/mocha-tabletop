import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {RoomClient} from '../../src/net/RoomClient';
import {applyMatch,createMatch,viewMatch,type RoomInfo} from '../../src/core/room';
const profile={id:'host0000',name:'阿茶',avatar:'🦊'};
const guest={id:'guest000',name:'阿木',avatar:'🐻'};
const token='a'.repeat(48);
class MemoryStorage {private data=new Map<string,string>();get length(){return this.data.size;}key(index:number){return [...this.data.keys()][index]??null;}getItem(key:string){return this.data.get(key)??null;}setItem(key:string,value:string){this.data.set(key,value);}removeItem(key:string){this.data.delete(key);}clear(){this.data.clear();}}
class Socket {
 static OPEN=1;static all:Socket[]=[];readyState=0;sent:any[]=[];onopen?:()=>void;onmessage?:(event:any)=>void;onclose?:(event:any)=>void;onerror?:()=>void;
 constructor(public url:URL){Socket.all.push(this);}send(raw:string){this.sent.push(JSON.parse(raw));}close(code=1000){if(this.readyState===3)return;this.readyState=3;this.onclose?.({code});}open(){this.readyState=1;this.onopen?.();}receive(data:unknown){this.onmessage?.({data:JSON.stringify(data)});}
}
const room=(mode:'cloud'|'lan'='cloud',started=false):RoomInfo=>({code:'ABC234',hostID:profile.id,kind:'gems',mode,players:[profile,guest].map(p=>({...p,ready:true,connected:true})),pending:[],revision:1,started,matchID:started?'match-1':undefined,expiresAt:Date.now()+3600000});
let clients:RoomClient[]=[];
const client=()=>{const c=new RoomClient();clients.push(c);return c;};
beforeEach(()=>{vi.useFakeTimers();Socket.all=[];vi.stubGlobal('localStorage',new MemoryStorage());vi.stubGlobal('sessionStorage',new MemoryStorage());vi.stubGlobal('location',{origin:'https://table.test',pathname:'/'});vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',Object.assign(new EventTarget(),{visibilityState:'visible'}));vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}')));vi.stubGlobal('WebSocket',Socket);localStorage.setItem('mocha-network-token',token);});
afterEach(()=>{clients.forEach(c=>c.destroy());clients=[];vi.useRealTimers();vi.unstubAllGlobals();});
describe('same-device room recovery',()=>{
 it('persists a renewed server expiry and reconnects after the original deadline',async()=>{
  const first=client();await first.join(profile,'ABC234');Socket.all[0].open();
  const initial=room(),renewed=initial.expiresAt!+6*3600000;
  Socket.all[0].receive({type:'snapshot',room:initial});
  Socket.all[0].receive({type:'snapshot',room:{...initial,expiresAt:renewed}});
  expect(first.getSavedSession()?.expiresAt).toBe(renewed);first.destroy();sessionStorage.clear();
  vi.setSystemTime(initial.expiresAt!+1);const restored=client();
  expect(restored.getSavedSession()).toMatchObject({code:'ABC234',profile,expiresAt:renewed});
  await restored.connect();Socket.all[1].open();expect(Socket.all[1].sent[0]).toMatchObject({type:'hello',profile,token});
 });
 it('uses tab recovery when the localStorage property itself is blocked',()=>{sessionStorage.setItem('mocha-room-session',JSON.stringify({profile,token,code:'ABC234'}));Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new DOMException('Storage denied','SecurityError');}});expect(client().getSavedSession()?.code).toBe('ABC234');});
 it('keeps a stable create/join credential when local writes are full and tab storage works',async()=>{localStorage.removeItem('mocha-network-token');localStorage.setItem=()=>{throw new DOMException('Storage full','QuotaExceededError');};const request=vi.fn(async(_url:string,_init?:RequestInit)=>new Response(JSON.stringify({code:'ABC234',invite:'invite-1'})));vi.stubGlobal('fetch',request);const c=client();await c.create(profile,'gems','cloud');expect(Socket.all).toHaveLength(1);Socket.all[0].open();expect(Socket.all[0].sent[0].token).toBe(JSON.parse(request.mock.calls[0][1]!.body as string).token);expect(c.getSavedSession()?.code).toBe('ABC234');});
 it('can join and reconnect in memory when both storage properties are blocked',async()=>{for(const name of ['localStorage','sessionStorage'])Object.defineProperty(globalThis,name,{configurable:true,get(){throw new DOMException('Storage denied','SecurityError');}});const c=client();expect(()=>c.getSavedSession()).not.toThrow();await c.join(profile,'ABC234');expect(Socket.all).toHaveLength(1);Socket.all[0].open();const first=Socket.all[0].sent[0].token;await c.connect();Socket.all[1].open();expect(Socket.all[1].sent[0].token).toBe(first);expect(()=>c.leave()).not.toThrow();expect(()=>c.resetIdentity()).not.toThrow();});
 it('restores a valid tab checkpoint despite a corrupted local checkpoint',async()=>{const r=room('lan',true),match=createMatch('gems',r.players);const c=client() as any;await c.join(profile,r.code);c.ensurePeers=()=>{};localStorage.setItem('mocha-host-'+r.code,'{broken');sessionStorage.setItem('mocha-host-'+r.code,JSON.stringify({kind:r.kind,matchID:r.matchID,players:r.players.map(p=>p.id).join(','),match}));Socket.all[0].open();Socket.all[0].receive({type:'snapshot',room:r});expect(c.localMatch).toEqual(match);expect(c.state.view).toBeDefined();});
 it.each(['localStorage','sessionStorage'] as const)('restores the newest valid checkpoint when %s has the latest action',async latest=>{const r=room('lan',true),before=createMatch('gems',r.players),actor=r.players.find(p=>viewMatch(before,'gems',p.id).view.actions.length)!,view=viewMatch(before,'gems',actor.id),action=view.view.actions[0],after=applyMatch(before,'gems',r.players,actor.id,{action:action.id,values:action.choices.slice(0,action.min).map(c=>c.id)},'new-checkpoint',view.actionRevision);expect(after.revision).toBeGreaterThan(before.revision);for(const name of ['localStorage','sessionStorage'] as const)globalThis[name].setItem('mocha-host-'+r.code,JSON.stringify({kind:r.kind,matchID:r.matchID,players:r.players.map(p=>p.id).join(','),match:name===latest?after:before}));const c=client() as any;await c.join(profile,r.code);c.ensurePeers=()=>{};const socket=Socket.all.at(-1)!;socket.open();socket.receive({type:'snapshot',room:r});expect(c.localMatch).toEqual(after);expect(c.state.view).toEqual(viewMatch(after,'gems',profile.id).view);});
 it('restores a closed tab with its original identity and credential and server expiry',async()=>{const first=client();await first.join(profile,'ABC234','invite-1');Socket.all[0].open();Socket.all[0].receive({type:'snapshot',room:room()});const expires=first.getSavedSession()!.expiresAt;first.destroy();sessionStorage.clear();const reopened=client();expect(reopened.getSavedSession()).toEqual({code:'ABC234',profile,savedAt:expect.any(Number),expiresAt:expires});await reopened.connect();Socket.all[1].open();expect(Socket.all[1].sent[0]).toMatchObject({type:'hello',profile,token,invite:'invite-1'});});
 it('migrates a tab-only legacy session when its first snapshot arrives',async()=>{sessionStorage.setItem('mocha-room-session',JSON.stringify({profile,token,code:'ABC234'}));const c=client();await c.connect();Socket.all[0].open();Socket.all[0].receive({type:'snapshot',room:room()});expect(JSON.parse(localStorage.getItem('mocha-room-session')!).profile).toEqual(profile);});
 it('rejects corrupt, expired, and invalid-profile session records',()=>{for(const value of ['{bad',JSON.stringify({profile,token,code:'ABC234',expiresAt:Date.now()-1}),JSON.stringify({profile:{...profile,id:'x'},token,code:'ABC234'})]){localStorage.setItem('mocha-room-session',value);expect(client().getSavedSession()).toBeUndefined();expect(localStorage.getItem('mocha-room-session')).toBeNull();}});
 it('preserves resume credentials and LAN checkpoint when a second tab takes over',async()=>{const c=client();await c.join(profile,'ABC234');localStorage.setItem('mocha-host-ABC234','checkpoint');Socket.all[0].open();Socket.all[0].close(4001);expect(c.getSavedSession()?.code).toBe('ABC234');expect(localStorage.getItem('mocha-host-ABC234')).toBe('checkpoint');expect(c.state.error).toContain('另一窗口');});
 it('clears current recovery on explicit leave but never clears another tab room',async()=>{const c=client();await c.join(profile,'ABC234');Socket.all[0].open();localStorage.setItem('mocha-room-session',JSON.stringify({profile,token,code:'XYZ234'}));c.leave();expect(sessionStorage.getItem('mocha-room-session')).toBeNull();expect(JSON.parse(localStorage.getItem('mocha-room-session')!).code).toBe('XYZ234');});
 it('cancels a resume attempt without dissolving the room or forgetting its credential',async()=>{const c=client();await c.join(profile,'ABC234');Socket.all[0].open();c.cancelConnection();expect(Socket.all[0].sent.some(m=>m.type==='leave')).toBe(false);expect(c.state.status).toBe('idle');expect(c.getSavedSession()?.code).toBe('ABC234');expect(vi.getTimerCount()).toBe(0);});
 it.each([false,true])('does not resubmit a cancelled admission request after reload (disconnected: %s)',async disconnected=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}')));
  const c=client();await c.join(guest,'ABC234');const socket=Socket.all[0];socket.open();socket.receive({type:'pending'});
  if(disconnected){socket.close();await vi.advanceTimersByTimeAsync(1);expect(c.state.waitingApproval).toBe(false);}
  c.cancelConnection();expect(c.state.status).toBe('idle');expect(c.getSavedSession()).toBeUndefined();
  expect(localStorage.getItem('mocha-room-session')).toBeNull();expect(sessionStorage.getItem('mocha-room-session')).toBeNull();
  expect(socket.sent.some(m=>m.type==='leave')).toBe(!disconnected);expect(vi.getTimerCount()).toBe(0);
  const reopened=client();await reopened.connect();expect(Socket.all).toHaveLength(1);
 });
 it('remembers pending admission across reload, then preserves an approved seat when cancelling recovery',async()=>{
  const first=client();await first.join(guest,'ABC234');Socket.all[0].open();Socket.all[0].receive({type:'pending'});first.destroy();sessionStorage.clear();
  const reopened=client();await reopened.connect();reopened.cancelConnection();expect(reopened.getSavedSession()).toBeUndefined();
  await reopened.join(guest,'ABC234');const socket=Socket.all.at(-1)!;socket.open();socket.receive({type:'pending'});socket.receive({type:'snapshot',room:room()});
  reopened.cancelConnection();expect(reopened.getSavedSession()?.code).toBe('ABC234');
  await reopened.connect();Socket.all.at(-1)!.open();expect(Socket.all.at(-1)!.sent[0]).toMatchObject({type:'hello',profile:guest,token});
 });
 it('cancels a pending request without deleting another tab’s saved room',async()=>{
  const c=client();await c.join(guest,'ABC234');Socket.all[0].open();Socket.all[0].receive({type:'pending'});
  localStorage.setItem('mocha-room-session',JSON.stringify({profile,token,code:'XYZ234'}));c.cancelConnection();
  expect(sessionStorage.getItem('mocha-room-session')).toBeNull();expect(JSON.parse(localStorage.getItem('mocha-room-session')!).code).toBe('XYZ234');
 });
 it.each(['pending','snapshot'])('keeps the storage failure explanation after a %s reply',async type=>{
  for(const storage of [localStorage,sessionStorage])vi.spyOn(storage,'setItem').mockImplementation(()=>{throw new DOMException('Storage full','QuotaExceededError');});
  const c=client();await c.join(guest,'ABC234');Socket.all[0].open();Socket.all[0].receive(type==='pending'?{type}:{type,room:room()});
  expect(c.state.status).toBe(type==='pending'?'connecting':'lobby');expect(c.state.error).toContain('浏览器无法保存房间');
  expect(c.getConnectionTarget()).toEqual({code:'ABC234',profile:guest});
 });
 it('restores a LAN host checkpoint after browser close and rejects a different round',async()=>{const r=room('lan',true),match=createMatch('gems',r.players);const c=client() as any;await c.join(profile,r.code);c.ensurePeers=()=>{};localStorage.setItem('mocha-host-'+r.code,JSON.stringify({kind:r.kind,matchID:r.matchID,players:r.players.map(p=>p.id).join(','),match}));Socket.all[0].open();Socket.all[0].receive({type:'snapshot',room:r});expect(c.localMatch).toEqual(match);expect(c.state.view).toBeDefined();c.localMatch=undefined;Socket.all[0].receive({type:'snapshot',room:{...r,matchID:'different-round'}});expect(c.localMatch).toBeUndefined();expect(c.state.paused).toBe(true);expect(c.state.error).toContain('状态已丢失');});
 it('resets only idle network identity and local checkpoints, preserving unrelated storage',async()=>{const c=client();localStorage.setItem('mocha-host-ABC234','checkpoint');localStorage.setItem('other-app','keep');c.resetIdentity();expect(localStorage.getItem('mocha-network-token')).toBeNull();expect(localStorage.getItem('mocha-host-ABC234')).toBeNull();expect(localStorage.getItem('other-app')).toBe('keep');await c.join(profile,'ABC234');expect(()=>c.resetIdentity()).toThrow('先离开');});
});
describe('socket resilience',()=>{
 it('ignores an old create failure after joining another room',async()=>{let reject!:(error:Error)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise((_,fail)=>{reject=fail;})));const c=client();const creation=c.create(profile,'gems','cloud');await c.join(profile,'XYZ234');Socket.all[0].open();Socket.all[0].receive({type:'snapshot',room:{...room(),code:'XYZ234'}});reject(new Error('old request timed out'));await creation;expect(c.state.status).toBe('lobby');expect(c.state.room?.code).toBe('XYZ234');expect(c.state.error).toBeUndefined();});
 it('does not resurrect an error after the user cancels a pending create',async()=>{let reject!:(error:Error)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise((_,fail)=>{reject=fail;})));const c=client();const creation=c.create(profile,'gems','cloud');c.cancelConnection();reject(new Error('old request timed out'));await creation;expect(c.state.status).toBe('idle');expect(c.state.error).toBeUndefined();expect(Socket.all).toHaveLength(0);});
 it('ends a nonexistent room only after an explicit read-only HTTP 404',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response('{"error":"missing"}',{status:404})));const c=client();await c.join(profile,'ABC234');Socket.all[0].close();await vi.advanceTimersByTimeAsync(1);expect(c.state.status).toBe('idle');expect(c.state.error).toContain('不存在');expect(c.getSavedSession()).toBeUndefined();expect(vi.getTimerCount()).toBe(0);});
 it('retains the room when the existence probe fails because the network is offline',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>{throw new TypeError('offline');}));const c=client();await c.join(profile,'ABC234');Socket.all[0].close();await vi.advanceTimersByTimeAsync(1);expect(c.state.status).toBe('reconnecting');expect(c.getSavedSession()?.code).toBe('ABC234');});
 it('detects a half-open socket, pauses, reconnects, and resumes from an authoritative snapshot',async()=>{const c=client();await c.join(profile,'ABC234');Socket.all[0].open();Socket.all[0].receive({type:'snapshot',room:room('cloud',true),view:{title:'牌局'},actionRevision:4});await vi.advanceTimersByTimeAsync(60000);expect(Socket.all[0].readyState).toBe(3);expect(c.state.status).toBe('reconnecting');expect(c.state.paused).toBe(true);await vi.advanceTimersByTimeAsync(1000);expect(Socket.all).toHaveLength(2);Socket.all[1].open();Socket.all[1].receive({type:'snapshot',room:room('cloud',true),view:{title:'牌局'},actionRevision:5,paused:false});expect(c.state.status).toBe('playing');expect(c.state.paused).toBe(false);expect(c.state.actionRevision).toBe(5);});
 it('keeps a quiet healthy room connected through ping/pong',async()=>{const c=client();await c.join(profile,'ABC234');Socket.all[0].open();Socket.all[0].receive({type:'snapshot',room:room()});for(let i=0;i<8;i++){await vi.advanceTimersByTimeAsync(15000);Socket.all[0].receive({type:'pong'});}expect(Socket.all).toHaveLength(1);expect(Socket.all[0].sent.filter(m=>m.type==='ping')).toHaveLength(8);expect(c.state.status).toBe('lobby');});
 it('keeps retrying a long outage at a bounded rate and recovers without a lifecycle event',async()=>{
  const c=client();await c.join(profile,'ABC234');Socket.all[0].close();expect(c.state.status).toBe('reconnecting');
  await vi.advanceTimersByTimeAsync(200000);expect(c.state.status).toBe('disconnected');expect(Socket.all.length).toBeGreaterThan(7);expect(Socket.all.length).toBeLessThan(12);expect(c.getSavedSession()?.code).toBe('ABC234');
  const count=Socket.all.length;await vi.advanceTimersByTimeAsync(40000);expect(Socket.all.length).toBe(count+1);
  const next=Socket.all.at(-1)!;next.open();next.receive({type:'snapshot',room:room()});expect(c.state.status).toBe('lobby');c.leave();const stopped=Socket.all.length;await vi.advanceTimersByTimeAsync(60000);expect(Socket.all).toHaveLength(stopped);
 });
});

describe('browser lifecycle recovery',()=>{
 const visibility=(value:'visible'|'hidden')=>{Object.defineProperty(document,'visibilityState',{configurable:true,value});document.dispatchEvent(new Event('visibilitychange'));};
 async function playing(){const c=client();await c.join(profile,'ABC234');const ws=Socket.all[0];ws.open();ws.receive({type:'snapshot',room:room('cloud',true),actionRevision:4});return {c,ws};}
 it('does not close an open connection or send leave while hidden and resynchronizes on return',async()=>{
  const {c,ws}=await playing();visibility('hidden');await vi.advanceTimersByTimeAsync(180000);
  expect(Socket.all).toHaveLength(1);expect(ws.readyState).toBe(Socket.OPEN);expect(c.state.paused).toBe(false);expect(ws.sent.some(m=>m.type==='leave')).toBe(false);
  visibility('visible');expect(ws.sent.at(-1)).toEqual({type:'ping',sync:true});ws.receive({type:'snapshot',room:room('cloud',true),actionRevision:5});await vi.advanceTimersByTimeAsync(5000);expect(Socket.all).toHaveLength(1);expect(c.state.actionRevision).toBe(5);
 });
 it.each(['online','pageshow'])('probes an open but broken transport on %s and retries even when close never fires',async event=>{
  const {c,ws}=await playing();ws.close=()=>{ws.readyState=2;};window.dispatchEvent(new Event(event));
  expect(ws.sent.at(-1)).toEqual({type:'ping',sync:true});await vi.advanceTimersByTimeAsync(5000);expect(c.state.paused).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);expect(Socket.all).toHaveLength(2);const next=Socket.all[1];next.open();next.receive({type:'snapshot',room:room('cloud',true),actionRevision:5});
  ws.onclose?.({code:1006});ws.receive({type:'snapshot',room:room(),actionRevision:1});expect(c.state.actionRevision).toBe(5);expect(c.state.paused).toBe(false);
 });
 it('gives a delayed timer a fresh probe window after the browser freezes',async()=>{
  const {c,ws}=await playing();vi.setSystemTime(Date.now()+180000);await vi.advanceTimersByTimeAsync(15000);
  expect(ws.readyState).toBe(Socket.OPEN);expect(ws.sent.at(-1)).toEqual({type:'ping',sync:true});ws.receive({type:'pong'});await vi.advanceTimersByTimeAsync(5000);expect(c.state.paused).toBe(false);
 });
 it('coalesces wake events and cancels all lifecycle work after destroy',async()=>{
  const {c,ws}=await playing();window.dispatchEvent(new Event('pageshow'));window.dispatchEvent(new Event('online'));visibility('visible');expect(ws.sent.filter(m=>m.sync)).toHaveLength(1);
  c.destroy();window.dispatchEvent(new Event('pageshow'));visibility('visible');await vi.advanceTimersByTimeAsync(60000);expect(Socket.all).toHaveLength(1);expect(vi.getTimerCount()).toBe(0);
 });
 it('reopens an admitted session whose cached expiry missed another player’s renewal',async()=>{
  const {c}=await playing(),expiry=c.getSavedSession()!.expiresAt;c.destroy();sessionStorage.clear();vi.setSystemTime(expiry+1);
  const reopened=client();expect(reopened.getSavedSession()?.code).toBe('ABC234');await reopened.connect();const ws=Socket.all.at(-1)!;ws.open();ws.receive({type:'snapshot',room:room('cloud',true),actionRevision:4});expect(reopened.state.status).toBe('playing');expect(reopened.getSavedSession()!.expiresAt).toBeGreaterThan(Date.now());
 });
 it('clears a stale admitted session only after authoritative expiry, with a bounded local retention window',async()=>{
  const {c}=await playing(),expiry=c.getSavedSession()!.expiresAt;c.destroy();sessionStorage.clear();vi.setSystemTime(expiry+1);
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:404})));const reopened=client();await reopened.connect();Socket.all.at(-1)!.close();await vi.advanceTimersByTimeAsync(1);expect(reopened.getSavedSession()).toBeUndefined();expect(reopened.state.status).toBe('idle');
  localStorage.setItem('mocha-room-session',JSON.stringify({profile,token,code:'ABC234',expiresAt:expiry,pendingApproval:false}));vi.setSystemTime(expiry+6*3600000);expect(client().getSavedSession()).toBeUndefined();
 });
});

describe('pending game commands',()=>{
 async function playing(){const c=client(),r=room('cloud',true),match=createMatch('gems',r.players);await c.join(profile,r.code);const socket=Socket.all.at(-1)!;socket.open();const snapshot={type:'snapshot',room:r,...viewMatch(match,'gems',profile.id),paused:false};socket.receive(snapshot);const a=c.state.view!.actions[0],command={action:a.id,values:a.choices.slice(0,a.min).map(choice=>choice.id)};return{c,socket,snapshot,command,r,match};}
 it('sends once until a changed actionable revision, ignoring heartbeat and presence-only snapshots',async()=>{
  const {c,socket,snapshot,command,r,match}=await playing();c.action(command);c.action(command);
  expect(c.state.actionPending).toBe(true);expect(socket.sent.filter(m=>m.type==='action')).toHaveLength(1);
  socket.receive({type:'pong'});socket.receive({...snapshot,room:{...r,revision:r.revision+1}});expect(c.state.actionPending).toBe(true);
  const sent=socket.sent.find(m=>m.type==='action'),next=applyMatch(match,'gems',r.players,profile.id,command,sent.requestID,sent.actionRevision);
  socket.receive({...snapshot,...viewMatch(next,'gems',profile.id)});expect(c.state.actionPending).toBe(false);expect(c.state.actionRevision).toBe(sent.actionRevision+1);
 });
 it('unlocks after a server rejection and permits correcting the command',async()=>{
  const {c,socket,command}=await playing();c.action({action:'invalid',values:[]});socket.receive({type:'error',error:'操作无效'});expect(c.state.actionPending).toBe(false);c.clearError();c.action(command);expect(socket.sent.filter(m=>m.type==='action')).toHaveLength(2);expect(c.state.actionPending).toBe(true);
 });
 it('unlocks on connection loss and never replays an uncertain action on recovery',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}')));const {c,socket,snapshot,command}=await playing();c.action(command);socket.close();expect(c.state.actionPending).toBe(false);expect(c.state.paused).toBe(true);await vi.advanceTimersByTimeAsync(1000);const next=Socket.all.at(-1)!;next.open();next.receive(snapshot);expect(c.state.paused).toBe(false);expect(next.sent.some(m=>m.type==='action')).toBe(false);c.action(command);expect(c.state.actionPending).toBe(true);
 });
 it('does not remain locked after a synchronous send failure, room pause, or explicit exit',async()=>{
  const {c,socket,snapshot,command}=await playing();socket.readyState=3;c.action(command);expect(c.state.actionPending).toBe(false);socket.readyState=1;socket.receive(snapshot);c.action(command);socket.receive({...snapshot,paused:true});expect(c.state.actionPending).toBe(false);socket.receive(snapshot);c.action(command);c.leave();expect(c.state.actionPending).toBeFalsy();expect(c.state.status).toBe('idle');
 });
});
