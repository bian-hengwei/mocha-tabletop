import type {ReactionAsset} from '../core/reactionCatalog';
const API=(import.meta.env.VITE_API_BASE||'').replace(/\/$/,'');
export const reactionURL=(path:string)=>path.startsWith('/api/reactions/')?API+path:path;
export async function loadReactions(signal?:AbortSignal):Promise<ReactionAsset[]>{
 const response=await fetch(API+'/api/reactions',{signal,cache:'no-store'});if(!response.ok)throw new Error('表情目录暂不可用');return response.json();
}
export async function adminRequest(path:string,token:string,body?:BodyInit){
 const response=await fetch(API+'/api/admin/reactions'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(typeof body==='string'?{'Content-Type':'application/json'}:{})},body,cache:'no-store'});
 const value=await response.json();if(!response.ok)throw new Error(value.error||'操作失败');return value;
}

export async function adminImage(id:string,token:string){
 const response=await fetch(API+'/api/admin/reactions/'+id+'/still',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(!response.ok)throw new Error('图片无效');return response.blob();
}
