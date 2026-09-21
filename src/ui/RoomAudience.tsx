import {Check, Eye, X} from 'lucide-react';
import type {RoomInfo} from '../core/room';
import type {RoomClient} from '../net/RoomClient';
import {t} from '../i18n';
import './spectators.css';

export function JoinRequests({room,client}:{room:RoomInfo;client:RoomClient}){
 return <div className="join-requests">{room.pending.map(p=><div key={p.id}><span>{p.avatar} {p.name} {t(p.spectator||room.started?'申请观战':'想入座')}</span><button className="icon" aria-label={`${t('拒绝')} ${p.name}`} onClick={()=>client.approve(p.id,false)}><X size={16}/></button><button className="icon approve" aria-label={`${t('同意')} ${p.name}`} onClick={()=>client.approve(p.id,true)}><Check size={16}/></button></div>)}</div>;
}
export function RoomAudience({room,selfID,client}:{room:RoomInfo;selfID:string;client:RoomClient}){
 const host=room.hostID===selfID,spectators=room.spectators||[],watching=spectators.some(p=>p.id===selfID),allowed=room.allowSpectators!==false;
 return <div className="room-audience">
  <p className="panel-note">{t(watching?'你在观战席，仅可查看公开信息':'观众只能查看公开信息，不占玩家席位')}</p>
  {host?<label className="spectator-setting"><span><Eye size={18}/>{t('允许观战')}</span><input type="checkbox" checked={allowed} onChange={e=>{const next=e.target.checked;if(next||!spectators.length||confirm(t('关闭观战将移出所有观众，确定？')))client.setSpectators(next);}}/></label>:<p>{t(allowed?'观战已开启':'观战已关闭')}</p>}
  {!host&&!room.started&&(watching||allowed)&&<button className="compact" onClick={()=>client.setSeat(!watching)}>{t(watching?'转为玩家':'进入观战席')}</button>}
  <h3>{t('观众')} · {spectators.length}</h3>
  {spectators.length?<ul className="spectator-list">{spectators.map(p=><li key={p.id}><span aria-hidden="true">{p.avatar}</span><b>{p.name}</b><small>{t(p.connected?'在线':'离线')}</small></li>)}</ul>:<p className="panel-note">{t('暂无观众')}</p>}
  {host&&room.pending.length>0&&<><h3>{t('加入申请')}</h3><JoinRequests room={room} client={client}/></>}
 </div>;
}
