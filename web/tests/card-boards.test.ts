import { createElement as h } from 'react';
import { describe,it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GemsBoard,BombsBoard,ActionSheet } from '../src/ui/Boards';
import { gems } from '../src/core/games/gems';
import { bombs } from '../src/core/games/bombs';
const players=[{id:'a',name:'甲',avatar:'🦊'},{id:'b',name:'乙',avatar:'🐼'}];
const noop=()=>{};
describe('card table decision information',()=>{
  it('offers public inventory inspection on each merchant',()=>{
    const view=gems.view(gems.create(players,1),'a');
    const html=renderToStaticMarkup(h(GemsBoard,{view,selfID:"a",command:noop,open:noop}));
    expect(html).toContain('查看 乙 的公开筹码和奖励');
    expect(html).toContain('role="button"');
  });
  it('shows the pending purchase and payment before confirming',()=>{
    let state=gems.create(players,1);const card=state.market[0][0];state.merchants[0].tokens=[7,7,7,7,7,5];
    state=gems.apply(state,'a',{action:'buy',values:[card.id]});const view=gems.view(state,'a');
    const html=renderToStaticMarkup(h(GemsBoard,{view,selfID:"a",command:noop,open:noop}));
    expect(html).toContain('待购买的发展牌和自动支付筹码');
    const sheet=renderToStaticMarkup(h(ActionSheet,{action:view.actions.find(a=>a.id==='pay_custom')!,selected:[],view,onClose:noop,onSubmit:noop}));
    expect(sheet).toContain('折扣后费用');expect(sheet).toContain('黄金可代任意颜色');
  });
  it('shows triple target and requested kind even after a Nope is discarded',()=>{
    const state=bombs.create(players,1),cards=[1,2,3].map(i=>({id:`cat-${i}`,kind:'moonCat' as const,title:'月亮猫'}));
    state.phase={kind:'response',effect:{actor:'a',cards,target:'b',requested:'defuse',cancelled:true,passed:[]}};
    state.discard=[...cards,{id:'last-nope',kind:'nope',title:'否决'}];
    const html=renderToStaticMarkup(h(BombsBoard,{view:bombs.view(state,'b'),selfID:"b",command:noop,open:noop}));
    expect(html).toContain('3 张同名组合');expect(html).toContain('→ 乙');expect(html).toContain('索要拆弹');expect(html).toContain('效果已否决');
  });
});
