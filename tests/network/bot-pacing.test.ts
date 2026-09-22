import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {RoomClient} from '../../src/net/RoomClient';
import {createMatch,type RoomInfo} from '../../src/core/room';
const human={id:'host0000',name:'Human',avatar:'🦊',ready:true,connected:true};
let client:RoomClient;
beforeEach(()=>{
 vi.useFakeTimers();
 for(const key of ['window','document'])vi.stubGlobal(key,{addEventListener(){},removeEventListener(){}});
 for(const key of ['localStorage','sessionStorage'])vi.stubGlobal(key,{getItem(){return null;},setItem(){},removeItem(){}});
 const room:RoomInfo={code:'ABC234',kind:'sushi',mode:'lan',hostID:human.id,players:[human,...[1,2].map(i=>({...human,id:`bot_${i}`,bot:{difficulty:'easy' as const}}))],pending:[],started:true,revision:1,matchID:'pacing'};
 client=new RoomClient();client['session']={profile:human,code:room.code,token:'test'};
 client.state={status:'playing',room,mode:'lan',selfID:human.id,paused:false,transport:'lan',actionRevision:1};
 client['localMatch']=createMatch('sushi',room.players);client['broadcastLocal']();
});
afterEach(()=>{client.destroy();vi.useRealTimers();vi.unstubAllGlobals();});
it('restarts the wait after a human action while bots are already thinking',()=>{
 vi.advanceTimersByTime(800);
 const action=client.state.view!.actions.find(a=>a.id==='pick')!;
 client.action({action:'pick',values:[action.choices[0].id]});
 const revision=client['localMatch']!.revision;
 vi.advanceTimersByTime(100);expect(client['localMatch']!.revision).toBe(revision);
 vi.advanceTimersByTime(799);expect(client['localMatch']!.revision).toBe(revision);
 vi.advanceTimersByTime(1);expect(client['localMatch']!.revision).toBe(revision+1);
 vi.advanceTimersByTime(899);expect(client['localMatch']!.revision).toBe(revision+1);
 vi.advanceTimersByTime(1);expect(client['localMatch']!.revision).toBe(revision+2);
});
it('does not postpone bots for presence broadcasts, and clears timers on teardown',()=>{
 const revision=client['localMatch']!.revision;
 vi.advanceTimersByTime(800);client['broadcastLocal']();
 vi.advanceTimersByTime(100);expect(client['localMatch']!.revision).toBe(revision+1);
 client.destroy();expect(vi.getTimerCount()).toBe(0);
});
it('starts a fresh wait after pausing, and prevents stale timers entering a replacement match',()=>{
 vi.advanceTimersByTime(800);client.state.paused=true;client['scheduleLocalBot']();
 const revision=client['localMatch']!.revision;vi.advanceTimersByTime(2000);expect(client['localMatch']!.revision).toBe(revision);
 client.state.paused=false;client['broadcastLocal']();vi.advanceTimersByTime(800);
 client['localMatch']=createMatch('sushi',client.state.room!.players);client['broadcastLocal']();
 vi.advanceTimersByTime(100);expect(client['localMatch']!.revision).toBe(1);
 vi.advanceTimersByTime(800);expect(client['localMatch']!.revision).toBe(2);
});
