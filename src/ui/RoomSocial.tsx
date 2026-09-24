import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {MessageCircle,Send,X} from 'lucide-react';
import {CHAT_LIMIT,SOCIAL_DURATION,supportsRoomSocial,type ReactionID} from '../core/roomSocial';
import type {ClientState} from '../core/room';
import type {RoomClient} from '../net/RoomClient';
import {t,useLocale} from '../i18n';
import {useDialog} from './useDialog';
import './room-social.css';
import {BUILTIN_REACTIONS,type ReactionAsset} from '../core/reactionCatalog';
import {reactionURL,loadReactions} from '../net/reactionCatalog';

type SocialContextValue={state:ClientState;now:number;canSend:boolean;openReactions:()=>void;openChat:()=>void;unread:boolean};
const SocialContext=createContext<SocialContextValue|null>(null);

function ReactionArt({reaction,asset}:{reaction:ReactionID;asset?:ReactionAsset}){
 const locale=useLocale(),art=asset||BUILTIN_REACTIONS.find(a=>a.id===reaction);
 if(!art)return null;
 return <picture className="social-sticker"><source media="(prefers-reduced-motion: reduce)" srcSet={reactionURL(art.still)}/><img src={reactionURL(art.src)} alt={art[locale]}/></picture>;
}

/** Portals keep messages out of clipped card regions without making them clickable. */
function Bubble({anchor,text}:{anchor:HTMLElement;text:string}){
 const ref=useRef<HTMLSpanElement>(null);
 useLayoutEffect(()=>{
  const place=()=>{
   const box=anchor.getBoundingClientRect(),bubble=ref.current;if(!bubble)return;
   let visible=!anchor.closest('[inert]')&&box.bottom>0&&box.top<innerHeight&&box.right>0&&box.left<innerWidth;
   for(let parent=anchor.parentElement;parent&&visible;parent=parent.parentElement){
    const style=getComputedStyle(parent),clip=parent.getBoundingClientRect();
    if(/hidden|auto|scroll|clip/.test(style.overflowX)&& (box.right<=clip.left||box.left>=clip.right))visible=false;
    if(/hidden|auto|scroll|clip/.test(style.overflowY)&& (box.bottom<=clip.top||box.top>=clip.bottom))visible=false;
   }
   bubble.style.visibility=visible?'visible':'hidden';
   bubble.style.left=`${Math.max(8,Math.min(innerWidth-bubble.offsetWidth-8,box.left+box.width/2-bubble.offsetWidth/2))}px`;
   const top=box.top-bubble.offsetHeight-8;
   bubble.style.top=`${Math.max(8,Math.min(innerHeight-bubble.offsetHeight-8,top>60?top:box.bottom+8))}px`;
  };
  place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  const observer=new ResizeObserver(place),visibility=new MutationObserver(place);
  // Dialogs toggle inert without resizing the avatar. Restore live bubbles on close.
  for(let parent:HTMLElement|null=anchor;parent;parent=parent.parentElement){observer.observe(parent);visibility.observe(parent,{attributes:true,attributeFilter:['inert']});}
  return()=>{observer.disconnect();visibility.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[anchor,text]);
 return createPortal(<span ref={ref} className="social-bubble" aria-hidden="true">{text}</span>,document.body);
}

export function PlayerAvatar({id,avatar,className=''}:{id:string;avatar:ReactNode;className?:string}){
 const social=useContext(SocialContext),anchor=useRef<HTMLSpanElement>(null);
 const own=!!social?.canSend&&social.state.selfID===id;
 const reaction=social?.state.social?.reactions.find(r=>r.playerID===id&&r.at+SOCIAL_DURATION>social.now);
 const message=social?.state.social?.messages.slice().reverse().find(m=>m.player.id===id&&m.at+SOCIAL_DURATION>social.now);
 const art=<>{avatar}{reaction&&<span className="social-avatar-reaction" key={reaction.id}><ReactionArt reaction={reaction.reaction} asset={reaction.asset}/></span>}</>;
 return <span ref={anchor} className={`social-avatar ${className}`} data-social-player={id}>
  {own?<button className="social-avatar-button" type="button" aria-label={t('发送表情')} aria-haspopup="dialog" onClick={e=>{e.stopPropagation();social.openReactions();}}>{art}</button>:art}
  {message&&anchor.current&&<Bubble anchor={anchor.current} text={message.text}/>}
 </span>;
}

/** Chat lives beside the existing profile control; only seat avatars send reactions. */
export function SocialControls({children}:{children:ReactNode}){
 const social=useContext(SocialContext);if(!social)return children;
 return <><button className="social-chat-trigger" type="button" aria-label={t('房间聊天')} aria-haspopup="dialog" onClick={social.openChat}><MessageCircle size={20}/>{social.unread&&<i aria-label={t('未读消息')}/>}</button>{children}</>;
}

export function RoomSocial({state,client,active,children}:{state:ClientState;client:RoomClient;active:boolean;children:ReactNode}){
 const locale=useLocale(),[panel,setPanel]=useState<'chat'|'reaction'|null>(null),[draft,setDraft]=useState(''),[now,setNow]=useState(Date.now),[read,setRead]=useState<string>();
 const [catalog,setCatalog]=useState<ReactionAsset[]>(BUILTIN_REACTIONS),[catalogError,setCatalogError]=useState(false);
 useEffect(()=>{if(panel!=='reaction')return;const controller=new AbortController();setCatalogError(false);loadReactions(controller.signal).then(setCatalog).catch(()=>{if(!controller.signal.aborted)setCatalogError(true);});return()=>controller.abort();},[panel]);
 const room=state.room,enabled=active&&!!room&&supportsRoomSocial(room.kind)&&!state.waitingApproval;
 const canSend=enabled&&!!room.players.find(p=>p.id===state.selfID&&!p.bot);
 const dialog=useDialog<HTMLElement>(enabled&&!!panel,()=>setPanel(null)),log=useRef<HTMLDivElement>(null),pending=useRef<{id:string;type:'chat'|'reaction';draft:string}|undefined>(undefined),atBottom=useRef(true);
 const messages=state.social?.messages||[],latest=messages.at(-1)?.id;
 useEffect(()=>{setPanel(null);setDraft('');setRead(undefined);pending.current=undefined;},[room?.code,room?.kind,state.selfID,canSend,enabled]);
 useEffect(()=>{if(panel==='chat'){setRead(latest);if(atBottom.current)log.current?.scrollTo({top:log.current.scrollHeight});}},[panel,latest]);
 useEffect(()=>{
  if(!enabled)return;
  const current=Date.now();setNow(current);
  const expiries=[...messages,...state.social?.reactions||[]].map(m=>m.at+SOCIAL_DURATION).filter(at=>at>current);
  if(!expiries.length)return;
  const timers=expiries.map(at=>setTimeout(()=>setNow(Date.now()),at-current+10));
  return()=>timers.forEach(clearTimeout);
 },[state.social,enabled]);
 useEffect(()=>{
  const sent=pending.current;if(!sent||state.socialAck!==sent.id)return;
  if(sent.type==='chat')setDraft(value=>value===sent.draft?'':value);else setPanel(null);
  pending.current=undefined;
 },[state.socialAck]);
 useLayoutEffect(()=>{
  if(!panel)return;
  const viewport=window.visualViewport;
  const place=()=>{const shade=dialog.current?.parentElement;if(!shade)return;shade.style.height=`${viewport?.height||innerHeight}px`;shade.style.top=`${viewport?.offsetTop||0}px`;};
  place();viewport?.addEventListener('resize',place);viewport?.addEventListener('scroll',place);
  return()=>{viewport?.removeEventListener('resize',place);viewport?.removeEventListener('scroll',place);};
 },[panel,dialog]);
 const send=(type:'chat'|'reaction',reaction?:ReactionID)=>{
  const id=client.sendSocial(type==='chat'?{type,text:draft}:{type,reaction:reaction!});
  if(id)pending.current={id,type,draft};
 };
 const disabled=!!state.socialPending||!state.socialOnline||!canSend;
 const unread=!!latest&&latest!==read&&messages.at(-1)?.player.id!==state.selfID;
 const value=enabled?{state,now,canSend,openReactions:()=>setPanel('reaction'),openChat:()=>{atBottom.current=true;setPanel('chat');},unread}:null;
 return <SocialContext.Provider value={value}>{children}{enabled&&<>
  <span className="social-sr-only" role="status">{messages.at(-1)&&`${messages.at(-1)!.player.name}: ${messages.at(-1)!.text}`}</span>
  {panel&&createPortal(<div className="social-shade" onClick={()=>setPanel(null)}><section className={`social-dialog social-${panel}`} ref={dialog} role="dialog" aria-modal="true" aria-label={t(panel==='chat'?'房间聊天':'发送表情')} tabIndex={-1} onClick={e=>e.stopPropagation()}>
   <header><h2>{t(panel==='chat'?'房间聊天':'发送表情')}</h2><button type="button" aria-label={t('关闭')} onClick={()=>setPanel(null)}><X size={20}/></button></header>
   {panel==='chat'?<><p className="social-scope">{t(canSend?'全桌可见 · 保留最近 80 条':'观战中 · 聊天只读')}</p><div className="social-log" role="log" aria-label={t('聊天记录')} aria-live="off" tabIndex={0} ref={log} onScroll={e=>{const el=e.currentTarget;atBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<30;}}>
    {!messages.length&&<p className="social-empty">{t('还没有消息')}</p>}
    {messages.map(m=><article className={m.player.id===state.selfID?'social-own':''} key={m.id}><div><span aria-hidden="true">{m.player.avatar}</span><b>{m.player.name}</b><time dateTime={new Date(m.at).toISOString()}>{new Date(m.at).toLocaleTimeString(locale==='zh'?'zh-CN':'en-US',{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.text}</p></article>)}
   </div>{canSend&&<form onSubmit={e=>{e.preventDefault();if(draft.trim()&&!disabled)send('chat');}}><label className="social-sr-only" htmlFor="room-chat-input">{t('消息')}</label><textarea id="room-chat-input" rows={2} maxLength={CHAT_LIMIT} placeholder={t('说点什么…')} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&e.keyCode!==229){e.preventDefault();if(draft.trim()&&!disabled)send('chat');}}}/><button type="submit" aria-label={t('发送消息')} disabled={disabled||!draft.trim()}><Send size={19}/></button><small>{draft.length}/{CHAT_LIMIT}</small></form>}</>:<div className="social-sticker-grid">{catalog.map(art=><button key={art.id} disabled={disabled} type="button" aria-label={art[locale]} onClick={()=>send('reaction',art.id)}><ReactionArt reaction={art.id} asset={art}/><span>{art[locale]}</span></button>)}</div>}
   {panel==='reaction'&&catalogError&&<p className="social-error" role="status">{t('表情目录暂不可用')}</p>}
   {(state.socialError||!state.socialOnline)&&<p role="alert" className="social-error">{t(state.socialError||'聊天连接中断，请重连后发送')}</p>}
  </section></div>,document.body)}
 </>}</SocialContext.Provider>;
}
