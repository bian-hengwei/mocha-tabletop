/** Stable mode IDs. References and the selected rulesets are documented in docs/MAHJONG.md. */
export const MAHJONG_MODES={
 guangdong:'广东推倒胡',sichuan:'四川血战',bloodflow:'血流成河',laizi:'红中赖子',
 bloodflowAny:'血流 · 任意换',bloodflowThree:'血流 · 任意换三张',
 redBloodflow:'红中血流',redBattle:'红中血战',
 guangdongFan:'广东做牌 · 无鬼牌',guangdongGhost:'广东做牌 · 单鬼牌'
} as const;
export type MahjongMode=keyof typeof MAHJONG_MODES;
export type ExchangeRule='none'|'sameThree'|'anyThree'|'any';
export interface MahjongRules {
 family:'pushdown'|'battle'|'flow'|'guangdong';exchange:ExchangeRule;missing:boolean;redCount:number;ghost:boolean;
}
export const MAHJONG_RULES:Record<MahjongMode,MahjongRules>={
 guangdong:{family:'pushdown',exchange:'none',missing:false,redCount:4,ghost:false},
 laizi:{family:'pushdown',exchange:'none',missing:false,redCount:4,ghost:true},
 sichuan:{family:'battle',exchange:'sameThree',missing:true,redCount:0,ghost:false},
 bloodflow:{family:'flow',exchange:'sameThree',missing:true,redCount:0,ghost:false},
 bloodflowAny:{family:'flow',exchange:'any',missing:true,redCount:0,ghost:false},
 bloodflowThree:{family:'flow',exchange:'anyThree',missing:true,redCount:0,ghost:false},
 redBloodflow:{family:'flow',exchange:'anyThree',missing:true,redCount:6,ghost:true},
 redBattle:{family:'battle',exchange:'sameThree',missing:true,redCount:4,ghost:true},
 guangdongFan:{family:'guangdong',exchange:'none',missing:false,redCount:4,ghost:false},
 guangdongGhost:{family:'guangdong',exchange:'none',missing:false,redCount:4,ghost:true}
};
export function isMahjongMode(value:unknown):value is MahjongMode{return typeof value==='string'&&Object.hasOwn(MAHJONG_MODES,value);}
