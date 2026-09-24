import {useEffect,useState,type FormEvent} from 'react';
import {setLocale,t,useLocale} from '../i18n';
import type {ManagedReaction} from '../core/reactionCatalog';
import {adminRequest,adminImage} from '../net/reactionCatalog';
import './reaction-admin.css';
function Preview({file}:{file:File|null}){
 const [src,setSrc]=useState('');useEffect(()=>{if(!file){setSrc('');return;}const url=URL.createObjectURL(file);setSrc(url);return()=>URL.revokeObjectURL(url);},[file]);
 return src?<img className="admin-preview" src={src} alt={t('图片预览')}/>:null;
}
function SavedPreview({entry,token}:{entry:ManagedReaction;token:string}){
 const [src,setSrc]=useState('');useEffect(()=>{let active=true,url='';adminImage(entry.id,token).then(blob=>{if(active){url=URL.createObjectURL(blob);setSrc(url);}}).catch(()=>{});return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[entry.id,token]);
 return src?<img className="admin-preview" src={src} alt={t('图片预览')}/>:null;
}
export function ReactionAdmin(){
 const locale=useLocale(),[credential,setCredential]=useState(''),[token,setToken]=useState(''),[entries,setEntries]=useState<ManagedReaction[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [zh,setZh]=useState(''),[en,setEn]=useState(''),[file,setFile]=useState<File|null>(null),[still,setStill]=useState<File|null>(null),[formKey,setFormKey]=useState(0);
 async function run(action:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await action();}catch(e){setError(e instanceof Error?e.message:'操作失败');}finally{setBusy(false);}}
 function login(event:FormEvent){event.preventDefault();void run(async()=>{const list=await adminRequest('',credential);setEntries(list);setToken(credential);setCredential('');});}
 function upload(event:FormEvent){event.preventDefault();if(!file||!still)return;void run(async()=>{const form=new FormData();form.set('zh',zh);form.set('en',en);form.set('image',file);form.set('still',still);await adminRequest('',token,form);setEntries(await adminRequest('',token));setZh('');setEn('');setFile(null);setStill(null);setFormKey(key=>key+1);setNotice('草稿已保存');});}
 return <main className="reaction-admin"><div className="admin-page"><header><a href="/">{t('返回游戏')}</a><select aria-label={t('语言')} value={locale} onChange={e=>setLocale(e.target.value as 'zh'|'en')}><option value="zh">中文</option><option value="en">English</option></select></header><h1>{t('表情管理')}</h1>
 {!token?<form className="admin-card" onSubmit={login}><label>{t('管理员凭据')}<input type="password" autoComplete="current-password" maxLength={256} value={credential} onChange={e=>setCredential(e.target.value)}/></label><button disabled={busy||!credential}>{t('登录')}</button></form>:<>
 <nav><button disabled={busy} onClick={()=>void run(async()=>setEntries(await adminRequest('',token)))}>{t('刷新目录')}</button><button disabled={busy} onClick={()=>{setToken('');setEntries([]);setFile(null);setStill(null);setError('');setNotice('');}}>{t('退出管理')}</button></nav>
 <form className="admin-card admin-upload" onSubmit={upload} key={formKey}><h2>{t('上传表情')}</h2><label>{t('中文名称')}<input required maxLength={40} value={zh} onChange={e=>setZh(e.target.value)}/></label><label>{t('英文名称')}<input required maxLength={40} value={en} onChange={e=>setEn(e.target.value)}/></label><label>{t('表情图片（GIF / PNG）')}<input required type="file" accept="image/gif,image/png" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><label>{t('静态预览（PNG）')}<input required type="file" accept="image/png" onChange={e=>setStill(e.target.files?.[0]||null)}/></label><p>{t('每张不超过 2 MB，尺寸不超过 1024 × 1024。静态预览用于减少动态效果。')}</p><div className="admin-previews"><Preview file={still}/></div><button disabled={busy||!file||!still||!zh.trim()||!en.trim()}>{t(busy?'处理中…':'保存草稿')}</button></form>
 <section className="admin-card"><h2>{t('已上传表情')}</h2>{!entries.length&&<p>{t('还没有上传表情')}</p>}<ul>{entries.map(entry=><li key={entry.id}><SavedPreview entry={entry} token={token}/><div><b>{entry[locale]}</b><span>{entry.published?t('已上架'):t('未上架')}</span></div><button disabled={busy} onClick={()=>void run(async()=>{await adminRequest('/'+entry.id,token,JSON.stringify({published:!entry.published}));setEntries(await adminRequest('',token));setNotice(entry.published?'已下架':'已上架');})}>{entry.published?t('下架'):t('上架')}</button></li>)}</ul></section></>}
 {error&&<p className="admin-error" role="alert">{t(error)}</p>}{notice&&<p role="status">{t(notice)}</p>}</div></main>;
}
