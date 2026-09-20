import Foundation

/// Host-authoritative 12-player 预女猎守. Only `view(for:)` may cross the network.
public struct WerewolfEngine: GameEngine {
    public let kind: GameKind = .werewolf
    public let players: [Player]
    public var isFinished: Bool { winner != nil }
    private enum Role: String { case wolf = "狼人", villager = "平民", seer = "预言家", witch = "女巫", hunter = "猎人", guardRole = "守卫" }
    private enum Phase { case signup, electionSpeech, electionVote, nightFirst, nightSecond, discussion, vote, pk, hunter, badge }
    private var roles: [String: Role] = [:]
    private var alive: Set<String>
    private var phase = Phase.nightFirst
    private var submissions: [String: String] = [:]
    private var candidates: [String] = []
    private var electionRunoff = false
    private var electionPending = true
    private var electionExplosions = 0
    private var dayRunoff = false
    private var sheriff: String?
    private var night = 1
    private var previousGuard: String?
    private var guarded: String?
    private var victim: String?
    private var poisoned: String?
    private var rescued = false
    private var antidote = true
    private var poison = true
    private var investigations: [String: String] = [:]
    private var hunterID: String?
    private var badgeOwner: String?
    private var continuation = Phase.discussion
    private var winner: String?
    private var history = ["12 人预女猎守 · 屠边 · 先进行第一夜，再在公布死讯前竞选警长。"]

    public init(players: [Player], seed: UInt64) throws {
        guard players.count == 12, Set(players.map(\.id)).count == 12 else { throw GameError.invalid("此板子需要 12 名不同玩家") }
        self.players = players; alive = Set(players.map(\.id))
        var deck: [Role] = [.wolf,.wolf,.wolf,.wolf,.villager,.villager,.villager,.villager,.seer,.witch,.hunter,.guardRole]
        var rng = SeededGenerator(seed: seed); deck.shuffle(using: &rng)
        for (p,r) in zip(players,deck) { roles[p.id] = r }
    }
    private func name(_ id: String) -> String { players.first { $0.id == id }?.name ?? id }
    private var living: [String] { players.map(\.id).filter { alive.contains($0) } }
    private func options(_ ids: [String]) -> [GameChoice] { ids.map { GameChoice($0,name($0)) } }
    private func prompt(_ id: String, _ title: String, ids: [String], skip: Bool = false, help: String = "") -> ActionPrompt {
        ActionPrompt(id,title,help:help,choices: options(ids) + (skip ? [GameChoice("skip","放弃 / 不使用")] : []),min:1,max:1)
    }
    private var voters: [String] { phase == .electionVote ? living.filter { !candidates.contains($0) } : living }
    private func personalActions(_ id: String) -> [ActionPrompt] {
        var actions = standardActions(id)
        guard !isFinished, alive.contains(id) else { return actions }
        if phase == .electionSpeech && candidates.contains(id) {
            actions.append(ActionPrompt("withdraw","退水：退出警长竞选"))
        }
        if roles[id] == .wolf && [.electionSpeech,.discussion,.pk].contains(phase) {
            actions.append(ActionPrompt("explode","狼人自爆",help:"公开狼人身份并结束白天。警上首次自爆将竞选延至次日；第二次自爆吞警徽。"))
        }
        return actions
    }
    private func standardActions(_ id: String) -> [ActionPrompt] {
        guard !isFinished else { return [] }
        if phase == .hunter { return id == hunterID ? [prompt("shoot","猎人：开枪或放弃",ids:living,skip:true)] : [] }
        if phase == .badge { return id == badgeOwner ? [prompt("badge","移交警徽或撕毁",ids:living,skip:true)] : [] }
        guard alive.contains(id), submissions[id] == nil else { return [] }
        switch phase {
        case .signup: return [ActionPrompt("signup","是否竞选警长？",choices:[GameChoice("yes","上警"),GameChoice("no","不上警")],min:1,max:1)]
        case .electionSpeech, .discussion, .pk: return [ActionPrompt("ready","讨论结束，我已准备好",help:"所有存活玩家确认后进入投票。")]
        case .electionVote: return voters.contains(id) ? [prompt("elect","投票选警长",ids:candidates,skip:true)] : []
        case .vote: return [prompt("vote",dayRunoff ? "PK 复投" : "放逐投票",ids:dayRunoff ? candidates : living,skip:true)]
        case .nightFirst:
            switch roles[id]! {
            case .wolf: return [prompt("wolf","狼人：商议后选择刀口",ids:living,skip:true,help:"所有存活狼人必须选择同一目标；意见不一致则空刀。")]
            case .seer: return [prompt("inspect","预言家：查验一名玩家",ids:living.filter { $0 != id },skip:true)]
            case .guardRole: return [prompt("guard","守卫：选择守护对象",ids:living.filter { $0 != previousGuard },skip:true,help:"不可连续两夜守护同一人。可以自守或空守。")]
            default: return [ActionPrompt("sleep","闭眼，等待天亮")]
            }
        case .nightSecond:
            if roles[id] == .witch {
                var choices = [GameChoice("skip","不用药")]
                if antidote, let victim, victim != id { choices.append(GameChoice("save","使用解药救 \(name(victim))")) }
                if poison { choices += living.filter { $0 != id }.map { GameChoice("poison:" + $0,"毒杀 " + name($0)) } }
                return [ActionPrompt("potion","女巫：选择是否用药",help:antidote ? "今晚刀口：\(victim.map(name) ?? "无人")。不可自救；同夜只能用一瓶药。" : "解药已用，之后不再获知刀口。",choices:choices,min:1,max:1)]
            }
            return [ActionPrompt("sleep","继续闭眼，等待天亮")]
        case .hunter, .badge: return []
        }
    }
    public func view(for playerID: String) -> GameView {
        guard let role = roles[playerID] else { return GameView(title:kind.title,phase:"不可查看",isFinished:isFinished) }
        var identity = [DisplayItem("role",role.rawValue,detail:role == .wolf ? "狼人阵营 · 杀死全部平民或全部神职获胜" : "好人阵营 · 放逐所有狼人获胜")]
        if role == .wolf { identity.append(DisplayItem("wolves","狼队友",detail:players.filter { roles[$0.id] == .wolf && $0.id != playerID }.map(\.name).joined(separator:"、"))) }
        if role == .wolf && phase == .nightFirst {
            identity.append(DisplayItem("wolfPlans","狼队已提交的刀口",detail:players.filter { roles[$0.id] == .wolf && submissions[$0.id] != nil }.map { "\($0.name)：\(submissions[$0.id] == "skip" ? "空刀" : name(submissions[$0.id]!))" }.joined(separator:"；")))
        }
        if role == .seer { identity += players.compactMap { p in investigations[p.id].map { DisplayItem("check:" + p.id,p.name,detail:$0) } } }
        if role == .witch { identity.append(DisplayItem("potions","药剂",detail:"解药：\(antidote ? "有" : "无") · 毒药：\(poison ? "有" : "无")")) }
        var sections = [DisplaySection("identity","仅你可见",items:identity,isPrivate:true),DisplaySection("players","座次与状态",items:players.enumerated().map { i,p in DisplayItem(p.id,"\(i+1) · \(p.name)",detail: "\(alive.contains(p.id) ? "存活" : "出局")\(sheriff == p.id ? " · 警长" : "")") })]
        var label: String
        switch phase {
        case .signup: label = "警长竞选 · 上警"
        case .electionSpeech: label = electionRunoff ? "警长竞选 · PK 发言" : "警长竞选 · 发言"
        case .electionVote: label = "警长竞选 · 投票"
        case .nightFirst, .nightSecond: label = "第 \(night) 夜 · 请闭眼"
        case .discussion: label = "第 \(night) 天 · 自由讨论"
        case .vote: label = dayRunoff ? "第 \(night) 天 · PK 复投" : "第 \(night) 天 · 放逐投票"
        case .pk: label = "第 \(night) 天 · 平票 PK 发言"
        case .hunter: label = "猎人发动技能"
        case .badge: label = "警徽移交"
        }
        if [.electionSpeech,.electionVote,.pk].contains(phase) || (phase == .vote && dayRunoff) { sections.append(DisplaySection("candidates","候选玩家",items:candidates.map { DisplayItem($0,name($0)) })) }
        if let winner { label = winner; sections.append(DisplaySection("reveal","身份揭晓",items:players.map { DisplayItem($0.id,$0.name,detail:roles[$0.id]!.rawValue) })) }
        let actions = personalActions(playerID)
        return GameView(title:kind.title,phase:label,instruction:isFinished ? "本局结束" : (actions.isEmpty ? "等待其他玩家。夜间身份和提交进度不会公开。" : "请独立操作；夜间不要说话或展示屏幕。"),sections:sections,actions:actions,log:history,isFinished:isFinished)
    }
    public mutating func apply(_ command: GameCommand, by playerID: String) throws {
        guard let action = personalActions(playerID).first(where: { $0.id == command.action }), command.values.count >= action.min, command.values.count <= action.max, Set(command.values).count == command.values.count, command.values.allSatisfy({ v in action.choices.contains { $0.id == v } }) else { throw GameError.invalid("当前不能执行此操作") }
        if command.action == "withdraw" {
            candidates.removeAll { $0 == playerID }
            history.append("\(name(playerID)) 退出警长竞选。")
            if candidates.count <= 1 { sheriff = candidates.first; finishElection() }
            return
        }
        if command.action == "explode" { explode(playerID); return }
        let value = command.values.first ?? "ready"
        switch phase {
        case .hunter:
            if value != "skip" { alive.remove(value); history.append("猎人带走了 \(name(value))。"); if sheriff == value { badgeOwner = value; sheriff = nil } }
            hunterID = nil; afterDeath()
        case .badge:
            sheriff = value == "skip" ? nil : value; badgeOwner = nil
            history.append(sheriff.map { "警徽移交给 \(name($0))。" } ?? "警徽已撕毁。")
            resume()
        case .signup:
            submissions[playerID] = value
            if submissions.count == alive.count {
                candidates = living.filter { submissions[$0] == "yes" }; submissions = [:]
                if candidates.count == 1 { sheriff = candidates[0]; finishElection() }
                else if candidates.isEmpty { finishElection() }
                else { phase = .electionSpeech }
            }
        case .electionSpeech, .discussion, .pk:
            submissions[playerID] = value
            if submissions.count == alive.count {
                submissions = [:]
                if phase == .electionSpeech {
                    if candidates.count <= 1 { sheriff = candidates.first; finishElection() }
                    else { phase = .electionVote; if voters.isEmpty { history.append("全员上警，无人投票，本局无警长。"); finishElection() } }
                }
                else { phase = .vote }
            }
        case .electionVote, .vote:
            submissions[playerID] = value
            if submissions.count == voters.count { resolveVote() }
        case .nightFirst:
            submissions[playerID] = value
            if command.action == "guard" { guarded = value == "skip" ? nil : value }
            if command.action == "inspect", value != "skip" { investigations[value] = roles[value] == .wolf ? "狼人" : "好人" }
            if submissions.count == alive.count {
                let wolfTargets = Set(living.filter { roles[$0] == .wolf }.compactMap { submissions[$0] })
                victim = wolfTargets.count == 1 && wolfTargets.first != "skip" ? wolfTargets.first : nil
                previousGuard = guarded; submissions = [:]; phase = .nightSecond
            }
        case .nightSecond:
            submissions[playerID] = value
            if command.action == "potion" {
                if value == "save" { antidote = false; rescued = true }
                else if value.hasPrefix("poison:") { poison = false; poisoned = String(value.dropFirst(7)) }
            }
            if submissions.count == alive.count {
                submissions = [:]
                if electionPending {
                    if electionExplosions > 0 { phase = .electionSpeech; candidates = candidates.filter { alive.contains($0) } }
                    else { phase = .signup; candidates = []; electionRunoff = false }
                }
                else { resolveNight() }
            }
        }
    }
    private mutating func beginNight() {
        phase = .nightFirst; submissions = [:]; guarded = nil; victim = nil; poisoned = nil; rescued = false; dayRunoff = false
        if electionPending && electionExplosions > 0 { candidates = candidates.filter { alive.contains($0) } }
        else { candidates = [] }

    }
    private mutating func finishElection() {
        electionPending = false
        history.append(sheriff.map { "\(name($0)) 当选警长，放逐票计 1.5 票。" } ?? "本局无警长。")
        resolveNight()
    }
    private mutating func explode(_ id: String) {
        let duringElection = phase == .electionSpeech
        alive.remove(id)
        history.append("\(name(id)) 公开狼人身份并自爆，白天结束。")
        if sheriff == id { badgeOwner = id; sheriff = nil }
        submissions = [:]
        if duringElection {
            electionExplosions += 1
            if electionExplosions >= 2 { electionPending = false; history.append("连续两次警上自爆，警徽流失，本局无警长。") }
            else { history.append("警长竞选推迟到次日。") }
            resolveNight(next:.nightFirst)
        } else {
            continuation = .nightFirst
            afterDeath()
        }
    }
    private mutating func resolveNight(next: Phase = .discussion) {
        var deaths = Set<String>()
        if let victim {
            let protected = victim == guarded
            // 守救同死：exactly one of guarding and antidote saves the knife target.
            if protected == rescued { deaths.insert(victim) }
        }
        if let poisoned { deaths.insert(poisoned) }
        alive.subtract(deaths)
        history.append(deaths.isEmpty ? "第 \(night) 天：平安夜。" : "第 \(night) 天出局：" + players.filter { deaths.contains($0.id) }.map(\.name).joined(separator:"、") + "。")
        hunterID = deaths.first { roles[$0] == .hunter && $0 != poisoned }
        if let sheriff, deaths.contains(sheriff) { badgeOwner = sheriff; self.sheriff = nil }
        continuation = next; submissions = [:]; afterDeath()
    }
    private mutating func resolveVote() {
        let election = phase == .electionVote
        history.append((election ? "警长选票：" : "放逐选票：") + voters.map { "\(name($0)) → \(submissions[$0] == "skip" ? "弃票" : name(submissions[$0]!))" }.joined(separator:"；"))
        var counts: [String:Int] = [:]
        for (id,target) in submissions where target != "skip" { counts[target,default:0] += !election && id == sheriff ? 3 : 2 }
        let highest = counts.values.max() ?? 0
        let tied = living.filter { counts[$0] == highest && highest > 0 }
        submissions = [:]
        if election {
            if tied.count == 1 { sheriff = tied[0]; finishElection() }
            else if tied.count > 1 && !electionRunoff { candidates = tied; electionRunoff = true; phase = .electionSpeech }
            else { history.append("警长竞选未产生结果。"); finishElection() }
        } else {
            if tied.count == 1 {
                let target = tied[0]; alive.remove(target); history.append("\(name(target)) 被放逐。")
                hunterID = roles[target] == .hunter ? target : nil
                if sheriff == target { badgeOwner = target; sheriff = nil }
                continuation = .nightFirst; afterDeath()
            } else if tied.count > 1 && !dayRunoff { candidates = tied; dayRunoff = true; phase = .pk }
            else { history.append("无人被放逐。"); night += 1; beginNight() }
        }
    }
    private mutating func afterDeath() {
        // Hunter gets their legally triggered shot before faction victory is evaluated.
        if hunterID != nil { phase = .hunter; return }
        evaluateWinner()
        if isFinished { return }
        if badgeOwner != nil { phase = .badge; return }
        resume()
    }
    private mutating func resume() {
        submissions = [:]
        if continuation == .nightFirst { night += 1; beginNight() }
        else { phase = .discussion }
    }
    private mutating func evaluateWinner() {
        if !living.contains(where: { roles[$0] == .wolf }) { winner = "好人获胜 · 狼人全部出局" }
        else if !living.contains(where: { roles[$0] == .villager }) || !living.contains(where: { roles[$0] != .wolf && roles[$0] != .villager }) { winner = "狼人获胜 · 屠边成功" }
    }
}
