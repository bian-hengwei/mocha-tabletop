export interface ReactionAsset {id:string;zh:string;en:string;src:string;still:string}
export interface ManagedReaction extends ReactionAsset {published:boolean}
export const BUILTIN_REACTIONS:ReactionAsset[]=[{id:'cow',zh:'奶牛',en:'Cow',src:'/art/reactions/cow.gif',still:'/art/reactions/cow-still.png'}];
export const customReactionID=(value:unknown):value is string=>typeof value==='string'&&/^r_[a-f0-9-]{36}$/.test(value);
