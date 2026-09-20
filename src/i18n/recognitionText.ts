/** Plain mechanics remain recognizable beneath Mocha's original game names. */
export const recognitionText:Record<string,string>={
 '先知':'Seer','守望者':'Watcher','伪先知':'False Seer','刺客':'Assassin',
 '爆炸牌':'Bomb','拆弹':'Defuse','攻击':'Attack','索取':'Favor','预知三张':'Peek 3','否决':'Nope',
 '使用拆弹牌，否则立即出局。':'Use a Defuse card or be eliminated.',
 '所有存活玩家确认后结算；否决可取消效果。':'Resolve after every survivor confirms. Nope cancels the effect.',
 '效果已取消，可再次否决恢复':'Cancelled; another Nope restores the effect',
 '不否决，继续':'Allow effect and continue','保持取消，继续':'Keep cancelled and continue',
 '结束自己的回合，下家做 2 回合；若已被攻击，转交剩余回合再加 2':'End your turn. The next player takes 2 turns, or your remaining attacked turns plus 2.',
 '先出任意张功能牌，再抽 1 张结束回合。':'Play any number of action cards, then draw 1 to end your turn.',
};
