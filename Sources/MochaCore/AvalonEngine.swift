import Foundation

public struct AvalonEngine: GameEngine {
    public let kind: GameKind = .avalon
    public let players: [Player]
    public var isFinished: Bool { winner != nil }
    private enum Role: String { case merlin = "梅林", percival = "派西维尔", servant = "忠臣", morgana = "莫甘娜", assassin = "刺客", minion = "爪牙"
        var evil: Bool { self == .morgana || self == .assassin || self == .minion }
    }
    private enum Phase { case propose, approve, mission, assassinate }
    private var roles: [String: Role] = [:]
    private var phase = Phase.propose
    private var leader = 0
    private var team: [String] = []
    private var votes: [String: Bool] = [:]
    private var results: [Bool] = []
    private var rejections = 0
    private var winner: String?
    private var history = ["每人查看自己的身份后开始讨论。"]
    private var teamSizes: [Int] {
        switch players.count { case 5: return [2,3,2,3,3]; case 6: return [2,3,4,3,4]; case 7: return [2,3,3,4,4]; default: return [3,4,4,5,5] }
    }
    public init(players: [Player], seed: UInt64) throws {
        guard (5...10).contains(players.count), Set(players.map(\.id)).count == players.count else { throw GameError.invalid("阿瓦隆需要 5–10 名不同玩家") }
        self.players = players
        let evil = [5:2,6:2,7:3,8:3,9:3,10:4][players.count]!
        var deck: [Role] = [.merlin,.percival,.morgana,.assassin]
        deck += Array(repeating: .minion, count: evil - 2)
        deck += Array(repeating: .servant, count: players.count - evil - 2)
        var rng = SeededGenerator(seed: seed); deck.shuffle(using: &rng)
        for (p,r) in zip(players,deck) { roles[p.id] = r }
        leader = Int.random(in: players.indices, using: &rng)
    }
    private func name(_ id: String) -> String { players.first { $0.id == id }?.name ?? id }
    private func choices(_ ids: [String]) -> [GameChoice] { ids.map { GameChoice($0,name($0)) } }
    public func view(for playerID: String) -> GameView {
        guard let role = roles[playerID] else { return GameView(title: kind.title, phase: "不可查看", isFinished: isFinished) }
        var knowledge = [DisplayItem("role",role.rawValue,detail: role.evil ? "邪恶阵营" : "正义阵营")]
        if role.evil || role == .merlin {
            knowledge.append(DisplayItem("evil","你看到的邪恶玩家",detail: players.filter { roles[$0.id]!.evil && $0.id != playerID }.map(\.name).joined(separator: "、")))
        } else if role == .percival {
            knowledge.append(DisplayItem("merlin","梅林与莫甘娜（不区分）",detail: players.filter { roles[$0.id] == .merlin || roles[$0.id] == .morgana }.map(\.name).joined(separator: "、")))
        }
        let quest = min(results.count + 1,5)
        var sections = [DisplaySection("identity","仅你可见",items: knowledge,isPrivate: true), DisplaySection("table","圆桌",items: [DisplayItem("leader","队长：\(players[leader].name)"),DisplayItem("score","任务：\(results.map { $0 ? "✅" : "❌" }.joined(separator: " "))",detail: "连续否决 \(rejections)/5"),DisplayItem("team","队伍",detail: team.map(name).joined(separator: "、"))])]
        var actions: [ActionPrompt] = []
        var label = "第 \(quest) 次任务 · 组队"
        if !isFinished {
            switch phase {
            case .propose:
                if players[leader].id == playerID { actions = [ActionPrompt("propose","选择 \(teamSizes[results.count]) 名队员",choices: choices(players.map(\.id)),min: teamSizes[results.count],max: teamSizes[results.count])] }
            case .approve:
                label = "第 \(quest) 次任务 · 全员表决"
                if votes[playerID] == nil { actions = [ActionPrompt("approve","是否同意这支队伍？",choices: [GameChoice("yes","赞成"),GameChoice("no","反对")],min:1,max:1)] }
            case .mission:
                label = "第 \(quest) 次任务 · 秘密执行"
                if team.contains(playerID), votes[playerID] == nil {
                    var opts = [GameChoice("success","成功")]; if role.evil { opts.append(GameChoice("fail","失败")) }
                    actions = [ActionPrompt("mission","秘密提交任务牌",help: players.count >= 7 && results.count == 3 ? "本次至少 2 张失败牌才失败" : "出现 1 张失败牌即失败",choices:opts,min:1,max:1)]
                }
            case .assassinate:
                label = "刺杀梅林"
                if role == .assassin { actions = [ActionPrompt("assassinate","选择你认为是梅林的玩家",choices: choices(players.filter { !roles[$0.id]!.evil }.map(\.id)),min:1,max:1)] }
            }
        }
        if let winner { label = winner; sections.append(DisplaySection("reveal","身份揭晓",items: players.map { DisplayItem($0.id,$0.name,detail:roles[$0.id]!.rawValue) })) }
        return GameView(title:kind.title,phase:label,instruction: isFinished ? "本局结束" : (actions.isEmpty ? "等待其他玩家。秘密提交进度不会公开。" : "面对面讨论，再在自己的手机上操作。"),sections:sections,actions:actions,log:history,isFinished:isFinished)
    }
    public mutating func apply(_ command: GameCommand, by playerID: String) throws {
        guard !isFinished, roles[playerID] != nil,
              let prompt = view(for:playerID).actions.first(where: { $0.id == command.action }),
              command.values.count >= prompt.min, command.values.count <= prompt.max,
              Set(command.values).count == command.values.count,
              command.values.allSatisfy({ value in prompt.choices.contains { $0.id == value } }) else { throw GameError.invalid("当前不能执行此操作") }
        switch phase {
        case .propose: team = command.values; votes = [:]; phase = .approve
        case .approve:
            votes[playerID] = command.values[0] == "yes"
            guard votes.count == players.count else { return }
            history.append("表决：" + players.map { "\($0.name) \(votes[$0.id]! ? "赞成" : "反对")" }.joined(separator:"；"))
            if votes.values.filter({ $0 }).count > players.count / 2 { rejections = 0; phase = .mission }
            else { rejections += 1; leader = (leader + 1) % players.count; phase = .propose; if rejections == 5 { winner = "邪恶获胜 · 连续五次否决" } }
            votes = [:]
        case .mission:
            votes[playerID] = command.values[0] == "success"
            guard votes.count == team.count else { return }
            let fails = votes.values.filter { !$0 }.count
            let success = fails < ((players.count >= 7 && results.count == 3) ? 2 : 1)
            results.append(success); history.append("第 \(results.count) 次任务\(success ? "成功" : "失败")，\(fails) 张失败牌。")
            votes = [:]
            if results.filter({ !$0 }).count == 3 { winner = "邪恶获胜 · 三次任务失败" }
            else if results.filter({ $0 }).count == 3 { phase = .assassinate }
            else { leader = (leader + 1) % players.count; phase = .propose; team = [] }
        case .assassinate:
            let target = command.values[0]; history.append("刺客选择了 \(name(target))。")
            winner = roles[target] == .merlin ? "邪恶获胜 · 梅林被刺杀" : "正义获胜 · 梅林幸存"
        }
    }
}
