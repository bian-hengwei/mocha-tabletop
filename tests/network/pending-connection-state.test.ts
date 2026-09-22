import {afterEach,expect,it,vi} from 'vitest';
import {RoomClient} from '../../src/net/RoomClient';

class Socket {
 static OPEN=1;static current:Socket;readyState=1;
 onopen?:()=>void;onmessage?:(event:{data:string})=>void;onclose?:(event:{code:number})=>void;
 constructor(){Socket.current=this;}
 send(){}close(){this.readyState=3;}
 receive(data:unknown){this.onmessage?.({data:JSON.stringify(data)});}
}
let client:RoomClient|undefined;
afterEach(()=>{client?.destroy();client=undefined;vi.useRealTimers();vi.unstubAllGlobals();});
it('keeps the public join target but clears approval-waiting when its connection drops',async()=>{
 vi.useFakeTimers();
 vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});
 vi.stubGlobal('document',{addEventListener(){},removeEventListener(){}});
 vi.stubGlobal('location',{origin:'https://table.test',pathname:'/'});
 vi.stubGlobal('fetch',vi.fn(async()=>({status:200})));
 for(const key of ['localStorage','sessionStorage'])vi.stubGlobal(key,{getItem(){return null;},setItem(){throw Error('storage unavailable');},removeItem(){}});
 vi.stubGlobal('WebSocket',Socket);
 const profile={id:'guest123',name:'等待 Ready 玩家',avatar:'🦊'};
 client=new RoomClient();await client.join(profile,'abc234');Socket.current.onopen?.();
 expect(client.getConnectionTarget()).toEqual({code:'ABC234',profile});
 Socket.current.receive({type:'pending'});expect(client.state.waitingApproval).toBe(true);
 Socket.current.onclose?.({code:1006});
 expect(client.state.status).toBe('reconnecting');expect(client.state.waitingApproval).toBe(false);
 expect(client.getConnectionTarget()).toEqual({code:'ABC234',profile});
 await vi.advanceTimersByTimeAsync(1000);Socket.current.onopen?.();Socket.current.receive({type:'pending'});
 expect(client.state.waitingApproval).toBe(true);client.cancelConnection();
 expect(client.getConnectionTarget()).toBeUndefined();expect(client.state.status).toBe('idle');expect(client.state.waitingApproval).toBeUndefined();
});
