import {BUILTIN_REACTIONS,customReactionID,type ManagedReaction} from '../src/core/reactionCatalog';
import type {ReactionCatalog} from './reactionStorage';
export interface ReactionFile {key:string;bytes:Uint8Array;contentType:string}
export interface ReactionStore {
 readCatalog():Promise<{data:unknown;etag?:string}>;
 readImage(key:string):Promise<{bytes:Uint8Array;contentType:string}|null>;
 commit(etag:string|undefined,entries:ManagedReaction[],files:ReactionFile[],deleted:string[]):Promise<boolean>;
}
export interface ReactionEnv {REACTIONS?:DurableObjectNamespace<ReactionCatalog>;REACTION_ADMIN_TOKEN?:string}
function store(env:ReactionEnv):ReactionStore|undefined{return env.REACTIONS?.getByName('catalog-v1');}
class CatalogError extends Error {}
const limit=2*1024*1024;
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function authorized(request:Request,secret?:string){
 if(!secret||secret.length<32)return false;
 const header=request.headers.get('Authorization')||'';if(!header.startsWith('Bearer '))return false;
 const supplied=header.slice(7);
 if(supplied.length>256)return false;
 const encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(secret));
 return crypto.subtle.verify('HMAC',key,signature,encoder.encode(supplied));
}
async function catalog(bucket?:ReactionStore){
 const object=await bucket?.readCatalog();
 const data:unknown=object?.data??[];
 if(!Array.isArray(data)||data.length>100)throw new CatalogError('表情目录暂不可用');
 const ids=new Set<string>();
 const entries:ManagedReaction[]=data.map((value:unknown)=>{
  if(!value||typeof value!=='object')throw new CatalogError('表情目录暂不可用');
  const e=value as Record<string,unknown>;
  if(!customReactionID(e.id)||ids.has(e.id)||typeof e.zh!=='string'||typeof e.en!=='string'||![e.zh,e.en].every(v=>v.trim()&&v.length<=40&&!/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(v))||typeof e.published!=='boolean'||e.src!==`/api/reactions/${e.id}/image`||e.still!==`/api/reactions/${e.id}/still`)throw new CatalogError('表情目录暂不可用');
  ids.add(e.id);return {id:e.id,zh:e.zh,en:e.en,src:e.src as string,still:e.still as string,published:e.published};
 });
 return {entries,etag:object?.etag};
}
export async function publishedReaction(env:ReactionEnv,id:unknown){
 if(!customReactionID(id))return undefined;
 try{const entry=(await catalog(store(env))).entries.find(entry=>entry.id===id&&entry.published);if(!entry)return;const {published,...asset}=entry;return asset;}catch{throw new CatalogError('表情目录暂不可用');}
}
async function boundedBody(request:Request,max:number){
 if(Number(request.headers.get('Content-Length'))>max)throw new CatalogError('文件过大');
 const reader=request.body?.getReader();if(!reader)throw new CatalogError('文件无效');
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new CatalogError('文件过大');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export function imageType(bytes:Uint8Array,still=false){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let width=0,height=0,type='';
 if(bytes.length>=33&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)){
  type='image/png';width=view.getUint32(16);height=view.getUint32(20);
  let offset=8,ended=false;
  while(offset+12<=bytes.length){const size=view.getUint32(offset),chunk=String.fromCharCode(...bytes.slice(offset+4,offset+8));if(offset+12+size>bytes.length)throw new CatalogError('图片无效');if(chunk==='acTL'&&still)throw new CatalogError('静态预览必须是 PNG 静态图片');offset+=size+12;if(chunk==='IEND'){ended=true;break;}}
  if(!ended)throw new CatalogError('图片无效');
 }else if(!still&&bytes.length>=14&&['GIF87a','GIF89a'].includes(String.fromCharCode(...bytes.slice(0,6)))&&bytes.at(-1)===59){type='image/gif';width=view.getUint16(6,true);height=view.getUint16(8,true);}
 if(!type||width<1||height<1||width>1024||height>1024||bytes.length>limit)throw new CatalogError('仅支持 2 MB 内、1024 × 1024 内的 GIF 或 PNG');
 return type;
}
export async function reactionAPI(request:Request,env:ReactionEnv):Promise<Response>{
 const path=new URL(request.url).pathname,bucket=store(env);
 const admin=path.startsWith('/api/admin/reactions');
 if(admin){
  if(!env.REACTION_ADMIN_TOKEN||!bucket)return json({error:'表情管理尚未配置'},503);
  if(!await authorized(request,env.REACTION_ADMIN_TOKEN))return json({error:'管理员凭据无效'},401);
 }
 try{
  if(request.method==='GET'&&(path==='/api/reactions'||path==='/api/admin/reactions')){
   const {entries}=await catalog(bucket);return json(admin?entries:[...BUILTIN_REACTIONS,...entries.filter(e=>e.published).map(({published,...e})=>e)]);
  }
  const asset=path.match(/^\/api\/(?:admin\/)?reactions\/(r_[a-f0-9-]{36})\/(image|still)$/);
  if(asset&&request.method==='GET'){
   if(!admin&&!await publishedReaction(env,asset[1]))return json({error:'表情不存在'},404);
   const object=await bucket?.readImage(`reactions/${asset[1]}/${asset[2]}`);if(!object)return json({error:'表情不存在'},404);
   return new Response(object.bytes,{headers:{'Content-Type':object.contentType,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(!admin||request.method!=='POST'||!bucket)return json({error:'请求无效'},405);
  const {entries,etag}=await catalog(bucket);
  const save=(next:ManagedReaction[],files:ReactionFile[]=[],deleted:string[]=[])=>bucket.commit(etag,next,files,deleted);
  if(path==='/api/admin/reactions'){
   if(entries.length>=100)return json({error:'最多保存 100 个表情'},409);
   const body=await boundedBody(request,limit*2+16384);
   const form=await new Response(body,{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();
   const zh=form.get('zh')??'表情',en=form.get('en')??'Reaction',image=form.get('image'),still=form.get('still');
   if(typeof zh!=='string'||typeof en!=='string'||![zh,en].every(v=>v.trim()&&v.length<=40&&!/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(v)))throw new CatalogError('请填写 1–40 字的中英文名称');
   if(!image||typeof image==='string'||!still||typeof still==='string')throw new CatalogError('请选择图片和静态预览');
   const bytes=new Uint8Array(await image.arrayBuffer()),preview=new Uint8Array(await still.arrayBuffer());
   const type=imageType(bytes);imageType(preview,true);
   const id=`r_${crypto.randomUUID()}`,keys=[`reactions/${id}/image`,`reactions/${id}/still`];
   const entry:ManagedReaction={id,zh:zh.trim(),en:en.trim(),src:`/api/reactions/${id}/image`,still:`/api/reactions/${id}/still`,published:false};
   if(!await save([...entries,entry],[{key:keys[0],bytes,contentType:type},{key:keys[1],bytes:preview,contentType:'image/png'}]))return json({error:'目录已更新，请刷新后重试'},409);
   return json(entry,201);
  }
  const update=path.match(/^\/api\/admin\/reactions\/(r_[a-f0-9-]{36})$/);
  if(update){
   const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,1024))) as {published?:unknown;delete?:unknown};
   if(!body||(body.delete!==true&&typeof body.published!=='boolean'))throw new CatalogError('请求无效');
   if(!entries.some(e=>e.id===update[1]))return json({error:'表情不存在'},404);
   const next=body.delete===true?entries.filter(e=>e.id!==update[1]):entries.map(e=>e.id===update[1]?{...e,published:body.published as boolean}:e);
   if(!await save(next,[],body.delete===true?[`reactions/${update[1]}/image`,`reactions/${update[1]}/still`]:[]))return json({error:'目录已更新，请刷新后重试'},409);
   return json({ok:true});
  }
  return json({error:'不存在'},404);
 }catch(e){return json({error:e instanceof CatalogError?e.message:'操作失败'},e instanceof CatalogError?400:500);}
}
