import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
// Keep Worker runtime types out of the DOM application build.
const {reactionAPI,imageType}=await import('../worker/'+'reactionCatalog') as {reactionAPI:(request:Request,env:{REACTION_ASSETS?:object;REACTION_ADMIN_TOKEN?:string})=>Promise<Response>;imageType:(bytes:Uint8Array,still?:boolean)=>string};
import {applyRoomSocial,emptySocial} from '../src/core/roomSocial';
import type {RoomInfo} from '../src/core/room';
const png=new Uint8Array(readFileSync('public/art/reactions/cow-still.png'));
const gif=new Uint8Array(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'));
describe('reaction upload boundaries',()=>{
 it('accepts the independent bundled images and rejects wrong formats, oversized dimensions, truncated data and animated stills',()=>{
  expect(imageType(png,true)).toBe('image/png');expect(imageType(gif)).toBe('image/gif');
  expect(()=>imageType(gif,true)).toThrow();expect(()=>imageType(new TextEncoder().encode('<svg/>'))).toThrow();expect(()=>imageType(png.slice(0,35))).toThrow();
  const large=png.slice();new DataView(large.buffer).setUint32(16,1025);expect(()=>imageType(large)).toThrow();
 });
 it('fails closed when management is unconfigured or credentials are absent/wrong',async()=>{
  const request=(authorization?:string)=>new Request('https://site/api/admin/reactions',{headers:authorization?{Authorization:authorization}:{}});
  expect((await reactionAPI(request(),{})).status).toBe(503);
  // Authentication must complete before touching storage.
  const env={REACTION_ASSETS:{},REACTION_ADMIN_TOKEN:'a'.repeat(48)};
  expect((await reactionAPI(request(),env)).status).toBe(401);
  expect((await reactionAPI(request('Bearer '+'b'.repeat(48)),env)).status).toBe(401);
  expect((await reactionAPI(request('a'.repeat(48)),env)).status).toBe(401);
 });
 it('keeps built-ins available without storage',async()=>{
  const response=await reactionAPI(new Request('https://site/api/reactions'),{});
  expect(await response.json()).toMatchObject([{id:'cow'}]);
 });
 it('requires an authoritative catalog entry for custom IDs and does not accept a missing ID',()=>{
  const room={kind:'gems',players:[{id:'player1',name:'One',avatar:'🐼'}]} as RoomInfo;
  const asset={id:'r_12345678-1234-1234-1234-123456789012',zh:'测试',en:'Test',src:'/api/reactions/a/image',still:'/api/reactions/a/still'};
  const state=emptySocial();
  expect(()=>applyRoomSocial(state,room,'player1',{type:'reaction'},'one',1000)).toThrow();
  expect(()=>applyRoomSocial(state,room,'player1',{type:'reaction',reaction:asset.id},'one',1000)).toThrow();
  expect(applyRoomSocial(state,room,'player1',{type:'reaction',reaction:asset.id},'one',1000,asset).reactions[0]).toMatchObject({reaction:asset.id,asset});
  expect(state.reactions).toEqual([]);
 });
});
