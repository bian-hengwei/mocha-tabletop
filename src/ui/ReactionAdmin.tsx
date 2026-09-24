import {useEffect,useState,type FormEvent} from 'react';
import {setLocale,t,useLocale} from '../i18n';
import type {ManagedReaction} from '../core/reactionCatalog';
import {adminRequest,adminImage} from '../net/reactionCatalog';
import {reactionStill} from '../net/reactionUpload';
import './reaction-admin.css';
function SavedPreview({entry,token}:{entry:ManagedReaction;token:string}){
 const [src,setSrc]=useState<{image:string;still:string}>();useEffect(()=>{let active=true;const urls:string[]=[];Promise.all([adminImage(entry.id,token,'image'),adminImage(entry.id,token,'still')]).then(blobs=>{if(active){urls.push(...blobs.map(blob=>URL.createObjectURL(blob)));setSrc({image:urls[0],still:urls[1]});}}).catch(()=>{});return()=>{active=false;urls.forEach(url=>URL.revokeObjectURL(url));};},[entry.id,token]);
 return src?<picture className="admin-preview"><source media="(prefers-reduced-motion: reduce)" srcSet={src.still}/><img src={src.image} alt={t('表情')}/></picture>:null;
}
export function ReactionAdmin(){
 const locale=useLocale(),[credential,setCredential]=useState(''),[token,setToken]=useState(''),[entries,setEntries]=useState<ManagedReaction[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [progress,setProgress]=useState<[number,number]|null>(null),[uploadResult,setUploadResult]=useState<[number,number]|null>(null),[failures,setFailures]=useState<{name:string;message:string}[]>([]),[formKey,setFormKey]=useState(0);
 async function run(action:()=>Promise<void>){setBusy(true);setError('');setNotice('');setUploadResult(null);setFailures([]);try{await action();}catch(e){setError(e instanceof Error?e.message:'操作失败');}finally{setBusy(false);}}
 function login(event:FormEvent){event.preventDefault();void run(async()=>{const list=await adminRequest('',credential);setEntries(list);setToken(credential);setCredential('');});}
 async function upload(files:File[]){
  if(!files.length||busy)return;
  await run(async()=>{
   if(entries.length+files.length>100)throw new Error('最多保存 100 个表情');
   const failed:{name:string;message:string}[]=[];let saved=0;
   for(const [index,file] of files.entries()){
    setProgress([index+1,files.length]);
    try{
     const still=await reactionStill(file),form=new FormData();form.set('image',file);form.set('still',still,'preview.png');
     const entry:ManagedReaction=await adminRequest('',token,form);setEntries(previous=>[...previous,entry]);saved++;
    }catch(e){failed.push({name:file.name,message:e instanceof Error?e.message:'操作失败'});}
   }
   setProgress(null);setFormKey(key=>key+1);setUploadResult([saved,files.length]);setFailures(failed);
  });
 }
 return <main className="reaction-admin"><div className="admin-page"><header><a href="/">{t('返回游戏')}</a><select aria-label={t('语言')} value={locale} onChange={e=>setLocale(e.target.value as 'zh'|'en')}><option value="zh">中文</option><option value="en">English</option></select></header><h1>{t('表情管理')}</h1>
 {!token?<form className="admin-card" onSubmit={login}><label>{t('管理员凭据')}<input type="password" autoComplete="current-password" maxLength={256} value={credential} onChange={e=>setCredential(e.target.value)}/></label><button disabled={busy||!credential}>{t('登录')}</button></form>:<>
 <nav><button disabled={busy} onClick={()=>void run(async()=>setEntries(await adminRequest('',token)))}>{t('刷新目录')}</button><button disabled={busy} onClick={()=>{setToken('');setEntries([]);setError('');setNotice('');setUploadResult(null);setFailures([]);}}>{t('退出管理')}</button></nav>
 <section className="admin-card admin-upload"><h2>{t('上传表情')}</h2><label>{t('选择图片（可多选）')}<input key={formKey} disabled={busy} type="file" multiple accept="image/gif,image/png" onChange={e=>void upload(Array.from(e.target.files||[]))}/></label><p>{t('支持 GIF / PNG，每张不超过 2 MB、1024 × 1024。动图自动生成静态预览。')}</p>{progress&&<p role="status">{t('上传中')} {progress[0]}/{progress[1]}</p>}</section>
 <section className="admin-card"><h2>{t('已上传表情')}</h2>{!entries.length&&<p>{t('还没有上传表情')}</p>}<ul>{entries.map(entry=><li key={entry.id}><SavedPreview entry={entry} token={token}/><div><span>{entry.published?t('已上架'):t('未上架')}</span></div><div className="admin-actions"><button disabled={busy} onClick={()=>void run(async()=>{await adminRequest('/'+entry.id,token,JSON.stringify({published:!entry.published}));setEntries(await adminRequest('',token));setNotice(entry.published?'已下架':'已上架');})}>{entry.published?t('下架'):t('上架')}</button><button className="admin-delete" disabled={busy} onClick={()=>{if(!confirm(t('删除此表情及其图片？此操作无法撤销。')))return;void run(async()=>{await adminRequest('/'+entry.id,token,JSON.stringify({delete:true}));setEntries(await adminRequest('',token));setNotice('表情已删除');});}}>{t('删除')}</button></div></li>)}</ul></section></>}
 {error&&<p className="admin-error" role="alert">{t(error)}</p>}{failures.length>0&&<div className="admin-error" role="alert">{failures.map((failure,index)=><p key={index}>{failure.name}: {t(failure.message)}</p>)}</div>}{uploadResult&&<p role="status">{t('已上传')} {uploadResult[0]}/{uploadResult[1]}</p>}{notice&&<p role="status">{t(notice)}</p>}</div></main>;
}
