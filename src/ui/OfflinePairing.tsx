import {useEffect,useState} from 'react';
import type {Player} from '../core/types';
import type {RoomClient} from '../net/RoomClient';
import {OFFLINE_PAIR_LIMIT,readPairing} from '../net/offlineRoom';
import {t} from '../i18n';
import './offline-pairing.css';

export function OfflinePairing({client,profile,host,onJoined}:{client:RoomClient;profile:Player;host:boolean;onJoined:()=>void}){
 const [input,setInput]=useState(''),[output,setOutput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[spectator,setSpectator]=useState(false),[recipient,setRecipient]=useState('');
 const [cached,setCached]=useState<boolean>();
 useEffect(()=>{
  let active=true;
  const check=async()=>{try{const registration=await navigator.serviceWorker?.getRegistration();if(!registration?.active){if(active)setCached(false);return;}
   const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();if(active)setCached(false);},5000);
   channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();const expected=document.querySelector<HTMLMetaElement>('meta[name="mocha-cache"]')?.content;if(active)setCached(!!expected&&e.data?.cache===expected&&e.data?.ready===true);};
   registration.active.postMessage({type:'OFFLINE_STATUS'},[channel.port2]);
  }catch{if(active)setCached(false);}};
  void check();
  const controllerChanged=()=>{if(active)void check();};
  navigator.serviceWorker?.addEventListener('controllerchange',controllerChanged);
  void navigator.serviceWorker?.ready.then(controllerChanged).catch(()=>{});
  return()=>{active=false;navigator.serviceWorker?.removeEventListener('controllerchange',controllerChanged);};
 },[]);
 const run=async(task:()=>Promise<void>)=>{setBusy(true);setError('');try{await task();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const load=async(file:File|undefined)=>{if(!file)return;if(file.size>OFFLINE_PAIR_LIMIT){setError('离线配对数据无效');return;}try{const text=await file.text();readPairing(text);setInput(text);setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}};
 let name='';try{const parsed=readPairing(input);if(parsed.type==='request')name=parsed.profile.name;}catch{}
 const download=()=>{const url=URL.createObjectURL(new Blob([output],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=`mocha-${host?'answer':'request'}-${JSON.parse(output).id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <div className="offline-pairing">
  <p>{t('每台设备先联网打开并缓存网页，再连接同一 Wi-Fi 或热点；网络必须允许设备互通。')}</p>
  <p className="panel-note" role="status">{t(cached===true?'本机离线资源已就绪':cached===false?'本机缓存未就绪，请联网重新打开网页并等待下载完成':'正在检查本机离线资源')}</p>
  {host?<p>{t('1. 客人生成加入请求，用隔空投送、附近分享或本地文件传给房主。')}</p>:<>
   <label className="spectator-setting join-spectator-setting"><span>{t('以观众身份加入')}</span><span className="join-spectator-control"><input type="checkbox" checked={spectator} disabled={busy||!!output} onChange={e=>setSpectator(e.target.checked)}/></span></label>
   <button className="compact primary" disabled={busy} onClick={()=>void run(async()=>{setOutput(await client.prepareOfflineJoin(profile,spectator));setInput('');})}>{t(output?'重新生成加入请求':'1. 生成加入请求')}</button>
  </>}
  {output&&<section className="offline-export" aria-label={t(host?'房主应答':'加入请求')}>
   <b>{t(host?'2. 将应答文件传回这位客人':'2. 将请求文件传给房主')}{host&&recipient?` · ${recipient}`:''}</b>
   <button className="compact primary" onClick={download}>{t('下载配对文件')}</button>
   <details><summary>{t('复制配对文本')}</summary><textarea readOnly value={output} aria-label={t(host?'房主应答':'加入请求')} onFocus={e=>e.target.select()}/><button className="compact" onClick={()=>void run(async()=>{if(!navigator.clipboard)throw new Error('请长按全选并复制');await navigator.clipboard.writeText(output);})}>{t('复制')}</button></details>
  </section>}
  {(host||output)&&<section className="offline-import">
   <b>{t(host?'导入客人的加入请求':'3. 导入房主应答')}</b>
   <label className="offline-file compact"><span>{t('选择配对文件')}</span><input type="file" accept=".json,.txt,application/json,text/plain" disabled={busy} onChange={e=>{void load(e.target.files?.[0]);e.target.value='';}}/></label>
   <details><summary>{t('粘贴配对文本')}</summary><textarea aria-label={t('配对文本')} value={input} maxLength={OFFLINE_PAIR_LIMIT} onChange={e=>setInput(e.target.value)}/></details>
   {input&&<p role="status">{host&&name?<>{t('加入请求')} · <b>{name}</b></>:t('已载入配对文件')}</p>}
   <button className="compact primary" disabled={busy||!input} onClick={()=>void run(async()=>{if(host){setRecipient(name);setOutput(await client.acceptOfflineRequest(input));setInput('');}else {await client.finishOfflineJoin(input);onJoined();}})}>{t(host?'同意加入并生成应答':'连接房主')}</button>
  </section>}
  {busy&&<p role="status">{t('正在准备本地连接')}</p>}{error&&<p role="alert">{t(error)}</p>}
  <p className="panel-note">{t('配对文件仅交给对应玩家。每位客人单独配对；刷新或断线后重新交换请求与应答。')}</p>
  <p className="panel-note">{t('房主保持网页打开。若浏览器不提供本地连接地址，或热点隔离设备，请换用其他浏览器或网络。')}</p>
 </div>;
}
