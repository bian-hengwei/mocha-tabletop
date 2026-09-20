import SwiftUI
import MochaCore

struct RulesView: View {
    let kind: GameKind
    @Environment(\.dismiss) private var dismiss
    private var rules: [(String, String)] {
        switch kind {
        case .gems:
            return [("目标", "发展产业、吸引贵族，率先达到 15 分触发最后一轮。所有人回合数相同时，分数最高者胜；同分时已购发展卡较少者优先。"), ("每回合一个动作", "拿 3 种不同颜色宝石（不足 3 种则拿现有颜色）；或在该色余量至少 4 个时拿 2 个同色；或预留一张牌并拿 1 金；或购买一张公开／预留牌。"), ("经营与支付", "已购卡永久减免同色费用，黄金可以替代任意宝石。最多预留 3 张，回合结束最多持有 10 枚筹码，超出时自行选择退回。每回合最多获得一位符合条件的贵族。"), ("操作提示", "支付、退还筹码、选择贵族会分成几个步骤；请按屏幕提示确认。预留牌和牌库不会展示给其他玩家。")]
        case .bombs:
            return [("目标", "抽到炸弹且没有拆弹牌就出局；最后存活的人获胜。每人开局 1 张拆弹和 7 张普通牌，安全发牌后再将人数减一张炸弹放入牌库。"), ("一回合怎么玩", "可以先使用任意张动作牌，最后抽牌结束回合。拆弹后秘密选择炸弹放回牌库的位置。攻击让下家承担回合；被攻击时再攻击，会继续叠加剩余回合。"), ("动作与否决", "跳过减少一个回合，洗牌重新打乱，预见未来只能自己看，索取由对方选择交给你的牌。相同两张可随机偷牌，三张可指定索要牌种。"), ("给每个人反应机会", "动作牌先进入响应阶段：大家选择放行或使用否决，否决也能被再次否决。所有仍存活玩家都放行后才结算，记得留意手机。炸弹与拆弹不能被否决。")]
        case .werewolf:
            return [("12 人预女猎守", "4 狼、4 平民、预言家、女巫、猎人、守卫。系统自动发身份并结算，房主也可以正常参与。白天请面对面讨论，手机负责夜间操作与投票。"), ("本房间采用的板子", "第一夜行动后、公布死讯前竞选警长，支持发言期退水。警长放逐票计 1.5 票，死亡可移交或撕掉警徽。狼人屠边获胜：神职全灭或平民全灭；好人消灭所有狼人获胜。"), ("夜间规则", "守卫不能连续守同一人。女巫不能自救，同夜最多用一种药；同守同救仍死亡。猎人被毒不能开枪。狼人提交统一目标后才会袭击，意见不统一则空刀。"), ("隐私与讨论", "夜间所有存活玩家都提交私密选择或等待确认，公开桌面不展示角色行动顺序。放逐平票进入 PK 后重投，再平票则无人出局。狼人可在警上或白天发言期自爆，警上双爆吞警徽；投票和结算期不可自爆。发言顺序和时长由现场约定。")]
        case .avalon:
            return [("目标与身份", "5–10 人，梅林、派西维尔、莫甘娜、刺客及忠臣／爪牙。善方争取 3 次任务成功，邪方争取 3 次任务失败；善方完成 3 次后，刺客仍可通过刺中梅林获胜。"), ("组队与投票", "队长提出符合人数的队伍，所有人投赞成／反对，严格过半数才通过。队长轮换，连续 5 次组队被否决，邪方直接获胜。"), ("秘密任务", "仅队员提交任务牌；好人只能成功，坏人可选成功或失败。7 人及以上的第 4 个任务需要两张失败才失败，其余任务一张失败即失败。"), ("谁知道什么", "梅林看到邪方；派西维尔看到梅林和莫甘娜但无法分辨；邪方互相认识。所有投票收齐后统一公布，任务只公布失败张数，不公开谁出了什么。当前角色配置不包含莫德雷德、奥伯伦和湖中仙女。")]
        }
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack { Eyebrow(text: "HOW TO PLAY"); Spacer(); Button("完成") { dismiss() } }
                Image(systemName: kind.symbol).font(.system(size: 42)).foregroundStyle(TableTheme.accent(kind))
                Text(kind.title).font(.system(size: 32, weight: .bold, design: .rounded))
                Text(kind.subtitle).foregroundStyle(TableTheme.muted)
                ForEach(rules, id: \.0) { title, detail in
                    VStack(alignment: .leading, spacing: 9) { Text(title).font(.headline); Text(detail).font(.subheadline).foregroundStyle(TableTheme.muted).lineSpacing(6) }
                }
                Text("这是朋友间使用的独立实现，使用自制界面和图标。具体结算以这里列出的规则为准。").font(.caption).foregroundStyle(TableTheme.muted).padding(.top, 8)
            }.padding(26).frame(maxWidth: 640)
        }.background(TableTheme.background).foregroundStyle(TableTheme.cream).tint(TableTheme.gold).preferredColorScheme(.dark)
    }
}
