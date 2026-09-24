import {DurableObject} from 'cloudflare:workers';
import type {ManagedReaction} from '../src/core/reactionCatalog';
import type {ReactionFile} from './reactionCatalog';

// The catalog and its images form one atomic coordination domain. Room state
// remains in separate GameRoom objects. Images use small rows below SQLite limits.
export class ReactionCatalog extends DurableObject {
 constructor(ctx:DurableObjectState,env:unknown){
  super(ctx,env);
  ctx.blockConcurrencyWhile(async()=>{
   ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS catalog (id INTEGER PRIMARY KEY CHECK(id=1), etag TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS images (key TEXT PRIMARY KEY, content_type TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS chunks (key TEXT NOT NULL, part INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(key,part));`);
  });
 }
 async readCatalog(){
  const row=this.ctx.storage.sql.exec<{etag:string;data:string}>('SELECT etag,data FROM catalog WHERE id=1').toArray()[0];
  return {etag:row?.etag,data:row?JSON.parse(row.data) as unknown:[]};
 }
 async readImage(key:string){
  const row=this.ctx.storage.sql.exec<{content_type:string}>('SELECT content_type FROM images WHERE key=?',key).toArray()[0];
  if(!row)return null;
  const chunks=this.ctx.storage.sql.exec<{bytes:ArrayBuffer}>('SELECT bytes FROM chunks WHERE key=? ORDER BY part',key).toArray();
  const bytes=new Uint8Array(chunks.reduce((sum,c)=>sum+c.bytes.byteLength,0));
  let offset=0;for(const chunk of chunks){bytes.set(new Uint8Array(chunk.bytes),offset);offset+=chunk.bytes.byteLength;}
  return {bytes,contentType:row.content_type};
 }
 async commit(etag:string|undefined,entries:ManagedReaction[],files:ReactionFile[],deleted:string[]){
  return this.ctx.storage.transactionSync(()=>{
   const sql=this.ctx.storage.sql;
   const current=sql.exec<{etag:string}>('SELECT etag FROM catalog WHERE id=1').toArray()[0];
   if(current?.etag!==etag)return false;
   for(const key of deleted){sql.exec('DELETE FROM chunks WHERE key=?',key);sql.exec('DELETE FROM images WHERE key=?',key);}
   for(const file of files){
    sql.exec('INSERT INTO images(key,content_type) VALUES (?,?)',file.key,file.contentType);
    for(let offset=0,part=0;offset<file.bytes.length;offset+=65536,part++)sql.exec('INSERT INTO chunks(key,part,bytes) VALUES (?,?,?)',file.key,part,file.bytes.slice(offset,offset+65536));
   }
   sql.exec('INSERT INTO catalog(id,etag,data) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET etag=excluded.etag,data=excluded.data',crypto.randomUUID(),JSON.stringify(entries));
   return true;
  });
 }
}
