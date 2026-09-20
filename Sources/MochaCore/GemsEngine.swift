import Foundation

/// Host-owned classic base-game state. Only `view(for:)` may be sent to peers.
public struct GemsEngine: GameEngine {
    public let kind: GameKind = .gems
    public let players: [Player]
    public private(set) var isFinished = false
    static let colors = ["white", "blue", "green", "red", "black", "gold"]
    static let labels = ["白钻", "蓝宝石", "祖母绿", "红宝石", "黑玛瑙", "黄金"]
    static let symbols = ["⚪️", "🔵", "🟢", "🔴", "⚫️", "🟡"]

    struct Card: Equatable {
        let id: String
        let tier: Int
        let bonus: Int
        let points: Int
        let cost: [Int]
        var title: String { "\(GemsEngine.symbols[bonus]) \(GemsEngine.labels[bonus])\(["矿场", "商路", "工坊"][tier - 1]) \(id.split(separator: "-").last ?? "") · \(points) 分" }
        var detail: String { "永久 +1 \(GemsEngine.labels[bonus]) ｜价格：\(GemsEngine.describe(cost))" }
    }
    struct Noble: Equatable {
        let id: String
        let cost: [Int]
    }
    struct Merchant: Equatable {
        var tokens = [Int](repeating: 0, count: 6)
        var bought: [Card] = []
        var reserved: [Card] = []
        var nobles: [Noble] = []
        var discounts: [Int] { (0..<5).map { color in bought.filter { $0.bonus == color }.count } }
        var score: Int { bought.reduce(0) { $0 + $1.points } + nobles.count * 3 }
    }
    enum Phase: Equatable { case action, payment(Card), discard, noble }
    var merchants: [Merchant]
    var bank: [Int]
    var decks: [[Card]]
    var market: [[Card]]
    var nobles: [Noble]
    var current = 0
    var phase: Phase = .action
    var finalRound = false
    var round = 1
    var winners: [String] = []
    var history: [String] = []

    public init(players: [Player], seed: UInt64) throws {
        guard (2...4).contains(players.count), Set(players.map(\.id)).count == players.count,
              players.allSatisfy({ !$0.id.isEmpty }) else { throw GameError.invalid("宝石商人需要 2–4 位不同的玩家。") }
        self.players = players
        merchants = players.map { _ in Merchant() }
        bank = [Int](repeating: [2: 4, 3: 5, 4: 7][players.count]!, count: 5) + [5]
        var rng = SeededGenerator(seed: seed)
        decks = (1...3).map { tier in Self.catalog.filter { $0.tier == tier }.shuffled(using: &rng) }
        market = decks.map { Array($0.suffix(4)) }
        for tier in 0..<3 { decks[tier].removeLast(4) }
        nobles = Array(Self.nobleCatalog.shuffled(using: &rng).prefix(players.count + 1))
        history = ["\(players[0].name) 先手；达到 15 分后完成本轮，所有人回合数相同。"]
    }

    static func describe(_ amounts: [Int]) -> String {
        let result = amounts.enumerated().filter { $0.element > 0 }.map { "\(symbols[$0.offset])×\($0.element)" }.joined(separator: " ")
        return result.isEmpty ? "无" : result
    }
    func needed(_ card: Card) -> [Int] {
        zip(card.cost, merchants[current].discounts).map { max(0, $0 - $1) }
    }
    func defaultPayment(_ card: Card) -> [Int]? {
        let needs = needed(card)
        var result = [Int](repeating: 0, count: 6)
        for color in 0..<5 {
            result[color] = min(needs[color], merchants[current].tokens[color])
            result[5] += needs[color] - result[color]
        }
        return result[5] <= merchants[current].tokens[5] ? result : nil
    }
    func tokenChoices() -> [GameChoice] {
        merchants[current].tokens.enumerated().flatMap { color, amount in
            (0..<amount).map { GameChoice("\(Self.colors[color]):\($0)", "\(Self.symbols[color]) \(Self.labels[color]) · 第 \($0 + 1) 枚") }
        }
    }
    func eligibleNobles() -> [Noble] {
        let bonuses = merchants[current].discounts
        return nobles.filter { noble in zip(bonuses, noble.cost).allSatisfy { $0 >= $1 } }
    }
    func availableCards() -> [Card] { market.flatMap { $0 } + merchants[current].reserved }

    public mutating func apply(_ command: GameCommand, by playerID: String) throws {
        guard !isFinished, players[current].id == playerID else { throw GameError.invalid("现在不是你的回合。") }
        guard Set(command.values).count == command.values.count else { throw GameError.invalid("不能重复选择同一个选项。") }
        // Transactional copy makes every rejection atomic, including multi-step validation.
        var next = self
        try next.perform(command)
        self = next
    }
    mutating func perform(_ command: GameCommand) throws {
        let options = actionPrompts()
        guard let prompt = options.first(where: { $0.id == command.action }),
              (prompt.min...prompt.max).contains(command.values.count),
              Set(command.values).isSubset(of: Set(prompt.choices.map(\.id))) else {
            throw GameError.invalid("这个操作或选择已经无效，请按当前提示重新选择。")
        }
        switch command.action {
        case "take_distinct":
            for value in command.values { let color = Self.colors.firstIndex(of: value)!; bank[color] -= 1; merchants[current].tokens[color] += 1 }
            history.append("\(players[current].name) 拿取了 \(command.values.map { Self.labels[Self.colors.firstIndex(of: $0)!] }.joined(separator: "、"))。")
            settle()
        case "take_pair":
            let color = Self.colors.firstIndex(of: command.values[0])!
            bank[color] -= 2; merchants[current].tokens[color] += 2
            history.append("\(players[current].name) 拿取了 2 枚\(Self.labels[color])。")
            settle()
        case "reserve":
            let value = command.values[0]
            let card: Card
            if value.hasPrefix("deck:") { card = decks[Int(value.dropFirst(5))! - 1].removeLast() }
            else { card = removeMarketCard(value)! }
            merchants[current].reserved.append(card)
            if bank[5] > 0 { bank[5] -= 1; merchants[current].tokens[5] += 1 }
            history.append("\(players[current].name) 预留了 1 张 \(card.tier) 级牌。")
            settle()
        case "buy":
            phase = .payment(availableCards().first { $0.id == command.values[0] }!)
        case "pay_auto", "pay_custom":
            guard case .payment(let card) = phase else { throw GameError.invalid("没有待支付的牌。") }
            let payment: [Int]
            if command.action == "pay_auto" { payment = defaultPayment(card)! }
            else {
                payment = selectedTokens(command.values)
                let needs = needed(card)
                guard (0..<5).allSatisfy({ payment[$0] <= needs[$0] }),
                      (0..<5).reduce(0, { $0 + needs[$1] - payment[$1] }) == payment[5] else {
                    throw GameError.invalid("支付不匹配。每种宝石支付不超过折扣后价格，余款用黄金补足。")
                }
            }
            for color in 0..<6 { merchants[current].tokens[color] -= payment[color]; bank[color] += payment[color] }
            if let index = merchants[current].reserved.firstIndex(where: { $0.id == card.id }) { merchants[current].reserved.remove(at: index) }
            else { _ = removeMarketCard(card.id) }
            merchants[current].bought.append(card)
            history.append("\(players[current].name) 购买了\(card.title)。")
            settle()
        case "cancel_buy": phase = .action
        case "discard":
            let returned = selectedTokens(command.values)
            for color in 0..<6 { merchants[current].tokens[color] -= returned[color]; bank[color] += returned[color] }
            history.append("\(players[current].name) 归还了 \(Self.describe(returned))。")
            settle()
        case "noble":
            let index = nobles.firstIndex { $0.id == command.values[0] }!
            let noble = nobles.remove(at: index)
            merchants[current].nobles.append(noble)
            history.append("\(players[current].name) 获得贵族来访，声望 +3。")
            finishTurn()
        case "pass": history.append("\(players[current].name) 无可用行动，跳过回合。"); settle()
        default: throw GameError.invalid("未知操作。")
        }
        history = Array(history.suffix(40))
    }
    func selectedTokens(_ values: [String]) -> [Int] {
        var result = [Int](repeating: 0, count: 6)
        for value in values { result[Self.colors.firstIndex(of: String(value.split(separator: ":")[0]))!] += 1 }
        return result
    }
    mutating func removeMarketCard(_ id: String) -> Card? {
        for tier in 0..<3 {
            if let index = market[tier].firstIndex(where: { $0.id == id }) {
                let card = market[tier].remove(at: index)
                if let replacement = decks[tier].popLast() { market[tier].insert(replacement, at: index) }
                return card
            }
        }
        return nil
    }
    mutating func settle() {
        if merchants[current].tokens.reduce(0, +) > 10 { phase = .discard; return }
        let eligible = eligibleNobles()
        if eligible.count > 1 { phase = .noble; return }
        if let noble = eligible.first {
            nobles.removeAll { $0.id == noble.id }; merchants[current].nobles.append(noble)
            history.append("\(players[current].name) 获得贵族来访，声望 +3。")
        }
        finishTurn()
    }
    mutating func finishTurn() {
        if merchants[current].score >= 15 && !finalRound {
            finalRound = true; history.append("进入最后一轮：本轮结束后按声望决胜。")
        }
        if finalRound && current == players.count - 1 {
            isFinished = true
            let highScore = merchants.map(\.score).max()!
            let fewest = merchants.filter { $0.score == highScore }.map { $0.bought.count }.min()!
            winners = players.indices.filter { merchants[$0].score == highScore && merchants[$0].bought.count == fewest }.map { players[$0].id }
            history.append("胜者：\(players.filter { winners.contains($0.id) }.map(\.name).joined(separator: "、"))；\(highScore) 分。")
        } else {
            current = (current + 1) % players.count
            if current == 0 { round += 1 }
        }
        phase = .action
    }

    func actionPrompts() -> [ActionPrompt] {
        guard !isFinished else { return [] }
        switch phase {
        case .discard:
            let excess = merchants[current].tokens.reduce(0, +) - 10
            return [ActionPrompt("discard", "归还 \(excess) 枚筹码", help: "回合结束最多持有 10 枚，黄金也计入。可以归还刚拿到的筹码。", choices: tokenChoices(), min: excess, max: excess)]
        case .noble:
            return [ActionPrompt("noble", "选择一位贵族", help: "每回合最多一位贵族来访。", choices: eligibleNobles().map { GameChoice($0.id, "\($0.id) · 3 分", subtitle: "需要永久奖励：\(Self.describe($0.cost))") }, min: 1, max: 1)]
        case .payment(let card):
            let amount = needed(card).reduce(0, +)
            return [
                ActionPrompt("pay_auto", "确认购买 · 优先使用宝石", help: "\(card.title)\n自动支付：\(Self.describe(defaultPayment(card) ?? []))"),
                ActionPrompt("pay_custom", "自行选择支付筹码", help: "\(card.title)\n折扣后价格：\(Self.describe(needed(card)))。黄金可替代任何颜色，包括你已经持有的颜色。", choices: tokenChoices(), min: amount, max: amount),
                ActionPrompt("cancel_buy", "取消购买")
            ]
        case .action:
            var actions: [ActionPrompt] = []
            let different = (0..<5).filter { bank[$0] > 0 }
            if !different.isEmpty {
                let count = min(3, different.count)
                actions.append(ActionPrompt("take_distinct", "拿取 \(count) 种不同宝石", help: "供应不足 3 种时，拿取所有仍有供应的种类。", choices: different.map { GameChoice(Self.colors[$0], "\(Self.symbols[$0]) \(Self.labels[$0])", subtitle: "供应 \(bank[$0]) 枚") }, min: count, max: count))
            }
            let pairs = (0..<5).filter { bank[$0] >= 4 }
            if !pairs.isEmpty { actions.append(ActionPrompt("take_pair", "拿取 2 枚同色宝石", help: "拿取前该颜色至少有 4 枚。", choices: pairs.map { GameChoice(Self.colors[$0], "\(Self.symbols[$0]) \(Self.labels[$0])") }, min: 1, max: 1)) }
            let buyable = availableCards().filter { defaultPayment($0) != nil }
            if !buyable.isEmpty { actions.append(ActionPrompt("buy", "购买发展牌", choices: buyable.map { GameChoice($0.id, $0.title, subtitle: "\($0.detail) ｜ 折扣后：\(Self.describe(needed($0)))") }, min: 1, max: 1)) }
            if merchants[current].reserved.count < 3 {
                var choices = market.flatMap { $0 }.map { GameChoice($0.id, $0.title, subtitle: $0.detail) }
                choices += (0..<3).filter { !decks[$0].isEmpty }.map { GameChoice("deck:\($0 + 1)", "盲抽 \($0 + 1) 级牌", subtitle: "仅你能看到抽到的牌") }
                if !choices.isEmpty { actions.append(ActionPrompt("reserve", "预留一张牌", help: "最多预留 3 张。有黄金时获得 1 枚；无黄金仍可预留。", choices: choices, min: 1, max: 1)) }
            }
            if actions.isEmpty { actions.append(ActionPrompt("pass", "无可用行动 · 跳过")) }
            return actions
        }
    }

    public func view(for playerID: String) -> GameView {
        guard let viewer = players.firstIndex(where: { $0.id == playerID }) else {
            return GameView(title: kind.title, phase: "不在本局", instruction: "仅本局玩家可以查看游戏。", isFinished: isFinished)
        }
        var sections = [DisplaySection("bank", "公共供应", items: (0..<6).map { DisplayItem(Self.colors[$0], "\(Self.symbols[$0]) \(Self.labels[$0])", detail: "\(bank[$0]) 枚") })]
        sections.append(DisplaySection("players", "商人", items: players.indices.map { i in
            let m = merchants[i]
            return DisplayItem(players[i].id, "\(players[i].avatar) \(players[i].name)\(i == current && !isFinished ? " · 当前回合" : "")", detail: "\(m.score) 分 · 发展牌 \(m.bought.count) · 贵族 \(m.nobles.count) · 预留 \(m.reserved.count)\n永久奖励：\(Self.describe(m.discounts))\n筹码：\(Self.describe(m.tokens))（\(m.tokens.reduce(0,+))/10）")
        }))
        for tier in (0..<3).reversed() {
            sections.append(DisplaySection("market:\(tier)", "\(tier + 1) 级市场 · 牌堆余 \(decks[tier].count) 张", items: market[tier].map { DisplayItem($0.id, $0.title, detail: $0.detail, symbol: "suit.diamond.fill") }))
        }
        sections.append(DisplaySection("nobles", "贵族 · 每位 3 分", items: nobles.map { DisplayItem($0.id, $0.id, detail: "永久奖励要求：\(Self.describe($0.cost))", symbol: "crown.fill") }))
        sections.append(DisplaySection("reserved", "我的预留牌（\(merchants[viewer].reserved.count)/3）", items: merchants[viewer].reserved.map { DisplayItem($0.id, $0.title, detail: $0.detail) }, isPrivate: true))
        for seat in players.indices where !merchants[seat].bought.isEmpty {
            sections.append(DisplaySection("collection:\(players[seat].id)", "\(players[seat].name) · 已购发展牌", items: merchants[seat].bought.map { DisplayItem($0.id, $0.title, detail: $0.detail) }))
        }
        var instruction = players[current].id == playerID ? "选择一个行动。牌的永久奖励会抵扣以后购买的费用。" : "等待 \(players[current].name) 操作。"
        if players[current].id == playerID {
            switch phase {
            case .payment: instruction = "确认支付方案；取消可重新选择行动。"
            case .discard: instruction = "筹码超过 10 枚，请归还超出部分。"
            case .noble: instruction = "你同时满足多位贵族，请选择其中一位。"
            case .action: break
            }
        }
        if isFinished { instruction = "胜者：\(players.filter { winners.contains($0.id) }.map(\.name).joined(separator: "、"))。同分时发展牌较少者胜；仍相同则共享胜利。" }
        return GameView(title: kind.title, phase: isFinished ? "游戏结束" : "第 \(round) 轮\(finalRound ? " · 最后一轮" : "")", instruction: instruction, sections: sections, actions: current == viewer ? actionPrompts() : [], log: history, isFinished: isFinished)
    }

    // Numeric component facts only; no commercial artwork, character names, or rulebook text.
    // Cost order: white, blue, green, red, black. Full catalog provenance in docs/GEMS.md.
    static let catalog: [Card] = {
        let raw = """
        white-L1-01,1,0,0,0,3,0,0,0
        white-L1-02,1,0,1,0,0,4,0,0
        white-L1-03,1,0,0,0,0,0,2,1
        white-L1-04,1,0,0,0,2,0,0,2
        white-L1-05,1,0,0,3,1,0,0,1
        white-L1-06,1,0,0,0,2,2,0,1
        white-L1-07,1,0,0,0,1,1,1,1
        white-L1-08,1,0,0,0,1,2,1,1
        white-L2-01,2,0,2,0,0,0,5,0
        white-L2-02,2,0,3,6,0,0,0,0
        white-L2-03,2,0,2,0,0,0,5,3
        white-L2-04,2,0,2,0,0,1,4,2
        white-L2-05,2,0,1,0,0,3,2,2
        white-L2-06,2,0,1,2,3,0,3,0
        white-L3-01,3,0,4,0,0,0,0,7
        white-L3-02,3,0,4,3,0,0,3,6
        white-L3-03,3,0,3,0,3,3,5,3
        white-L3-04,3,0,5,3,0,0,0,7
        blue-L1-01,1,1,0,0,0,0,0,3
        blue-L1-02,1,1,1,0,0,0,4,0
        blue-L1-03,1,1,0,1,0,0,0,2
        blue-L1-04,1,1,0,0,0,2,0,2
        blue-L1-05,1,1,0,0,1,3,1,0
        blue-L1-06,1,1,0,1,0,2,2,0
        blue-L1-07,1,1,0,1,0,1,1,1
        blue-L1-08,1,1,0,1,0,1,2,1
        blue-L2-01,2,1,2,0,5,0,0,0
        blue-L2-02,2,1,3,0,6,0,0,0
        blue-L2-03,2,1,2,5,3,0,0,0
        blue-L2-04,2,1,2,2,0,0,1,4
        blue-L2-05,2,1,1,0,2,2,3,0
        blue-L2-06,2,1,1,0,2,3,0,3
        blue-L3-01,3,1,4,7,0,0,0,0
        blue-L3-02,3,1,4,6,3,0,0,3
        blue-L3-03,3,1,3,3,0,3,3,5
        blue-L3-04,3,1,5,7,3,0,0,0
        green-L1-01,1,2,0,0,0,0,3,0
        green-L1-02,1,2,1,0,0,0,0,4
        green-L1-03,1,2,0,2,1,0,0,0
        green-L1-04,1,2,0,0,2,0,2,0
        green-L1-05,1,2,0,1,3,1,0,0
        green-L1-06,1,2,0,0,1,0,2,2
        green-L1-07,1,2,0,1,1,0,1,1
        green-L1-08,1,2,0,1,1,0,1,2
        green-L2-01,2,2,2,0,0,5,0,0
        green-L2-02,2,2,3,0,0,6,0,0
        green-L2-03,2,2,2,0,5,3,0,0
        green-L2-04,2,2,2,4,2,0,0,1
        green-L2-05,2,2,1,2,3,0,0,2
        green-L2-06,2,2,1,3,0,2,3,0
        green-L3-01,3,2,4,0,7,0,0,0
        green-L3-02,3,2,4,3,6,3,0,0
        green-L3-03,3,2,3,5,3,0,3,3
        green-L3-04,3,2,5,0,7,3,0,0
        red-L1-01,1,3,0,3,0,0,0,0
        red-L1-02,1,3,1,4,0,0,0,0
        red-L1-03,1,3,0,0,2,1,0,0
        red-L1-04,1,3,0,2,0,0,2,0
        red-L1-05,1,3,0,1,0,0,1,3
        red-L1-06,1,3,0,2,0,1,0,2
        red-L1-07,1,3,0,1,1,1,0,1
        red-L1-08,1,3,0,2,1,1,0,1
        red-L2-01,2,3,2,0,0,0,0,5
        red-L2-02,2,3,3,0,0,0,6,0
        red-L2-03,2,3,2,3,0,0,0,5
        red-L2-04,2,3,2,1,4,2,0,0
        red-L2-05,2,3,1,2,0,0,2,3
        red-L2-06,2,3,1,0,3,0,2,3
        red-L3-01,3,3,4,0,0,7,0,0
        red-L3-02,3,3,4,0,3,6,3,0
        red-L3-03,3,3,3,3,5,3,0,3
        red-L3-04,3,3,5,0,0,7,3,0
        black-L1-01,1,4,0,0,0,3,0,0
        black-L1-02,1,4,1,0,4,0,0,0
        black-L1-03,1,4,0,0,0,2,1,0
        black-L1-04,1,4,0,2,0,2,0,0
        black-L1-05,1,4,0,0,0,1,3,1
        black-L1-06,1,4,0,2,2,0,1,0
        black-L1-07,1,4,0,1,1,1,1,0
        black-L1-08,1,4,0,1,2,1,1,0
        black-L2-01,2,4,2,5,0,0,0,0
        black-L2-02,2,4,3,0,0,0,0,6
        black-L2-03,2,4,2,0,0,5,3,0
        black-L2-04,2,4,2,0,1,4,2,0
        black-L2-05,2,4,1,3,2,2,0,0
        black-L2-06,2,4,1,3,0,3,0,2
        black-L3-01,3,4,4,0,0,0,7,0
        black-L3-02,3,4,4,0,0,3,6,3
        black-L3-03,3,4,3,3,3,5,3,0
        black-L3-04,3,4,5,0,0,0,7,3
        """
        return raw.split(separator: "\n").map { line in
            let v = line.split(separator: ",").map(String.init)
            return Card(id: v[0], tier: Int(v[1])!, bonus: Int(v[2])!, points: Int(v[3])!, cost: v[4...8].map { Int($0)! })
        }
    }()
    static let nobleCatalog: [Noble] = {
        let requirements = [
            [4,4,0,0,0], [0,4,4,0,0], [0,0,4,4,0], [0,0,0,4,4], [4,0,0,0,4],
            [3,3,3,0,0], [0,3,3,3,0], [0,0,3,3,3], [3,0,0,3,3], [3,3,0,0,3]
        ]
        return requirements.enumerated().map { Noble(id: "贵族 \($0.offset + 1)", cost: $0.element) }
    }()
}
