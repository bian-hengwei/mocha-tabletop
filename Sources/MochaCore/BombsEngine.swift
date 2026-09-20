import Foundation

/// Host-only state. Send only `view(for:)` over the network.
public struct BombsEngine: GameEngine {
    public let kind: GameKind = .bombs
    public let players: [Player]
    public var isFinished: Bool { alive.count == 1 }

    enum CardKind: String, CaseIterable {
        case bomb, defuse, attack, skip, favor, shuffle, future, nope
        case moonCat, cloudCat, leafCat, starCat, sunCat
        var title: String {
            switch self {
            case .bomb: return "炸弹"; case .defuse: return "拆弹"; case .attack: return "攻击"
            case .skip: return "跳过"; case .favor: return "索取"; case .shuffle: return "洗牌"
            case .future: return "预见未来"; case .nope: return "否决"
            case .moonCat: return "月亮猫"; case .cloudCat: return "云朵猫"; case .leafCat: return "叶子猫"
            case .starCat: return "星星猫"; case .sunCat: return "太阳猫"
            }
        }
        var help: String {
            switch self {
            case .bomb: return "没有拆弹牌就出局。"
            case .defuse: return "抽到炸弹时使用，然后秘密放回牌堆。"
            case .attack: return "结束当前所有回合，下家承担剩余攻击回合再加 2 回合。"
            case .skip: return "不抽牌，结束一个回合。"
            case .favor: return "指定一人，对方选择一张手牌交给你。"
            case .shuffle: return "随机打乱抽牌堆。"
            case .future: return "只有你能看牌堆顶端最多 3 张。"
            case .nope: return "响应时取消效果；再次否决可恢复效果。"
            default: return "收集同名牌，使用对子或三张组合。"
            }
        }
        var playable: Bool { [.attack, .skip, .favor, .shuffle, .future].contains(self) }
    }
    struct Card: Equatable { let id: String; let kind: CardKind }
    struct Effect {
        let actor: String
        let cards: [Card]
        var target: String?
        var requested: CardKind?
        var cancelled = false
        var passed: Set<String> = []
        var description: String { cards.count == 1 ? cards[0].kind.title : "\(cards.count) 张同名组合" }
    }
    enum Phase {
        case turn, target([Card]), request([Card], String), response(Effect)
        case give(actor: String, target: String), future([Card]), bomb(Card), insert(Card)
    }
    var hands: [String: [Card]] = [:]
    var deck: [Card] = [] // top is first
    var discard: [Card] = []
    var eliminatedCards: [Card] = [] // dead hands remain face down
    var alive: [String]
    var current: String
    var turnsRemaining = 1
    var attacked = false
    var phase: Phase = .turn
    var history: [String] = []
    var rng: SeededGenerator
    private var cardSerial = 0

    public init(players: [Player], seed: UInt64) throws {
        guard (2...5).contains(players.count), Set(players.map(\.id)).count == players.count,
              players.allSatisfy({ !$0.id.isEmpty }) else { throw GameError.invalid("拆弹猫需要 2–5 名不同玩家。") }
        self.players = players; self.alive = players.map(\.id); self.current = players[0].id
        self.rng = SeededGenerator(seed: seed)
        for player in players { hands[player.id] = [makeCard(.defuse)] }
        for kind in CardKind.allCases where kind != .bomb && kind != .defuse {
            let count = (kind == .future || kind == .nope) ? 5 : 4
            for _ in 0..<count { deck.append(makeCard(kind)) }
        }
        deck.shuffle(using: &rng)
        for player in players { hands[player.id]! += Array(deck.prefix(7)); deck.removeFirst(7) }
        for _ in 0..<min(2, 6 - players.count) { deck.append(makeCard(.defuse)) }
        for _ in 0..<(players.count - 1) { deck.append(makeCard(.bomb)) }
        deck.shuffle(using: &rng)
        history = ["每人获得 7 张普通牌和 1 张拆弹牌。游戏开始。"]
    }
    // Public identifiers must never expose PRNG output: SplitMix64 outputs are invertible.
    // IDs describe physical components only; shuffling randomness stays exclusively on host.
    mutating func makeCard(_ kind: CardKind) -> Card {
        cardSerial += 1
        return Card(id: "bombs-card-\(cardSerial)", kind: kind)
    }
    func name(_ id: String) -> String { players.first { $0.id == id }?.name ?? "玩家" }
    mutating func record(_ text: String) { history.append(text); if history.count > 40 { history.removeFirst() } }
    func cardChoices(_ cards: [Card]) -> [GameChoice] { cards.map { GameChoice($0.id, $0.kind.title, subtitle: $0.kind.help) } }
    func comboChoices(_ hand: [Card], count: Int) -> [GameChoice] {
        CardKind.allCases.filter { kind in hand.filter { $0.kind == kind }.count >= count }
            .map { GameChoice($0.rawValue, "\(count) 张\($0.title)") }
    }

    public func view(for playerID: String) -> GameView {
        let known = players.contains { $0.id == playerID }
        var sections = [DisplaySection("table", "桌面", items: [
            DisplayItem("deck", "抽牌堆", detail: "\(deck.count) 张", symbol: "rectangle.stack.fill"),
            DisplayItem("turn", isFinished ? "游戏结束" : "\(name(current)) 的回合", detail: isFinished ? "\(name(alive[0])) 获胜" : "还需结束 \(turnsRemaining) 个回合")
        ]), DisplaySection("players", "玩家", items: players.map {
            DisplayItem($0.id, "\($0.avatar) \($0.name)", detail: alive.contains($0.id) ? "\(hands[$0.id, default: []].count) 张手牌" : "已出局")
        }), DisplaySection("discard", "最近弃牌", items: discard.suffix(12).reversed().map { DisplayItem($0.id, $0.kind.title) })]
        if known {
            sections.append(DisplaySection("hand", "我的手牌", items: hands[playerID, default: []].map {
                DisplayItem($0.id, $0.kind.title, detail: $0.kind.help)
            }, isPrivate: true))
        }
        var actions: [ActionPrompt] = []
        var label = "自由出牌"
        var instruction = "可以先出任意张牌，最后抽一张结束回合。"
        let mine = playerID == current && alive.contains(playerID) && !isFinished
        let hand = hands[playerID, default: []]
        if !isFinished {
            switch phase {
            case .turn:
                if mine {
                    actions.append(ActionPrompt("draw", "抽一张牌", help: "抽牌会结束一个回合。"))
                    let singles = hand.filter { $0.kind.playable }
                    if !singles.isEmpty { actions.append(ActionPrompt("play", "打出功能牌", choices: cardChoices(singles), min: 1, max: 1)) }
                    for count in [2, 3] {
                        let choices = comboChoices(hand, count: count)
                        if !choices.isEmpty { actions.append(ActionPrompt(count == 2 ? "pair" : "triple", count == 2 ? "对子：随机拿取" : "三张：指定牌名", choices: choices, min: 1, max: 1)) }
                    }
                }
            case .target:
                label = "选择目标"; instruction = "等待当前玩家选择目标。"
                if mine {
                    actions = [ActionPrompt("target", "选择一位玩家", choices: alive.filter { $0 != current }.map { GameChoice($0, name($0)) }, min: 1, max: 1), ActionPrompt("cancel", "返回")]
                }
            case .request:
                label = "指定牌名"; instruction = "等待当前玩家指定想要的牌。"
                if mine { actions = [ActionPrompt("request", "索要哪种牌？", choices: CardKind.allCases.filter { $0 != .bomb }.map { GameChoice($0.rawValue, $0.title) }, min: 1, max: 1), ActionPrompt("cancel", "返回")] }
            case .response(let effect):
                label = "否决响应"; instruction = "\(name(effect.actor))：\(effect.description)。\(effect.cancelled ? "效果已被否决，可再次否决恢复。" : "等待所有存活玩家确认。")"
                if let target = effect.target { instruction += "目标：\(name(target))。" }
                if let requested = effect.requested { instruction += "索要：\(requested.title)。" }
                sections.append(DisplaySection("responses", "响应进度", items: alive.map { DisplayItem($0, name($0), detail: effect.passed.contains($0) ? "已确认" : "等待响应") }))
                if alive.contains(playerID) {
                    if !effect.passed.contains(playerID) { actions.append(ActionPrompt("pass", "不否决，继续")) }
                    let nopes = hand.filter { $0.kind == .nope }
                    if !nopes.isEmpty { actions.append(ActionPrompt("nope", "打出否决", choices: cardChoices(nopes), min: 1, max: 1)) }
                }
            case .give(let actor, let target):
                label = "交出一张牌"; instruction = "等待 \(name(target)) 选择一张牌交给 \(name(actor))。"
                if playerID == target { actions = [ActionPrompt("give", "选择交出的手牌", choices: cardChoices(hand), min: 1, max: 1)] }
            case .future(let cards):
                label = "查看未来"; instruction = "等待 \(name(current)) 查看牌堆顶。"
                if mine {
                    sections.append(DisplaySection("future", "牌堆顶 · 仅你可见", items: cards.enumerated().map { DisplayItem("future-\($0.offset)", "第 \($0.offset + 1) 张：\($0.element.kind.title)") }, isPrivate: true))
                    actions = [ActionPrompt("done", "看好了，继续出牌")]
                }
            case .bomb:
                label = "抽到炸弹"; instruction = "\(name(current)) 抽到了炸弹。"
                if mine { actions = [ActionPrompt("defuse", "使用拆弹牌"), ActionPrompt("explode", "放弃拆弹，出局")] }
            case .insert:
                label = "秘密放回炸弹"; instruction = "等待 \(name(current)) 秘密放回炸弹。"
                if mine {
                    let positions: [GameChoice] = (0...deck.count).map { index in
                        var title = "第 \(index + 1) 张"
                        if index == 0 { title = "最上面（下一张）" }
                        else if index == deck.count { title = "最底下" }
                        return GameChoice(String(index), title)
                    }
                    actions = [ActionPrompt("insert", "将炸弹放在哪里？", help: "只有你知道位置；数字表示新牌堆中的位置。", choices: positions, min: 1, max: 1)]
                }
            }
        } else { label = "\(name(alive[0])) 获胜"; instruction = "最后一位存活玩家赢得本局。" }
        return GameView(title: kind.title, phase: label, instruction: instruction, sections: sections, actions: actions, log: history, isFinished: isFinished)
    }

    /// Copy/commit gives all errors transaction semantics, including random state.
    public mutating func apply(_ command: GameCommand, by playerID: String) throws {
        var next = self
        try next.perform(command, by: playerID)
        self = next
    }
    mutating func perform(_ command: GameCommand, by playerID: String) throws {
        guard !isFinished, alive.contains(playerID),
              let prompt = view(for: playerID).actions.first(where: { $0.id == command.action }),
              command.values.count >= prompt.min, command.values.count <= prompt.max,
              Set(command.values).count == command.values.count,
              command.values.allSatisfy({ value in prompt.choices.contains { $0.id == value } }) else {
            throw GameError.invalid("当前不能执行此操作，请刷新后重试。")
        }
        switch command.action {
        case "draw":
            guard !deck.isEmpty else { throw GameError.invalid("牌堆为空。") }
            let card = deck.removeFirst()
            if card.kind == .bomb {
                record("\(name(current)) 抽到了炸弹。")
                if hands[current, default: []].contains(where: { $0.kind == .defuse }) { phase = .bomb(card) }
                else { explode(card) }
            } else { hands[current, default: []].append(card); record("\(name(current)) 抽了一张牌。"); endTurn() }
        case "play", "pair", "triple":
            let hand = hands[current, default: []]
            let selected: [Card]
            if command.action == "play" { selected = hand.filter { $0.id == command.values[0] } }
            else { selected = Array(hand.filter { $0.kind.rawValue == command.values[0] }.prefix(command.action == "pair" ? 2 : 3)) }
            if selected.count > 1 || selected[0].kind == .favor { phase = .target(selected) }
            else { beginEffect(Effect(actor: current, cards: selected)) }
        case "target":
            guard case .target(let cards) = phase else { throw GameError.invalid("目标阶段无效。") }
            if cards.count == 3 { phase = .request(cards, command.values[0]) }
            else { beginEffect(Effect(actor: current, cards: cards, target: command.values[0])) }
        case "request":
            guard case .request(let cards, let target) = phase, let requested = CardKind(rawValue: command.values[0]) else { throw GameError.invalid("牌名无效。") }
            beginEffect(Effect(actor: current, cards: cards, target: target, requested: requested))
        case "cancel": phase = .turn
        case "pass":
            guard case .response(var effect) = phase else { throw GameError.invalid("响应阶段无效。") }
            effect.passed.insert(playerID)
            if effect.passed.count == alive.count { resolve(effect) } else { phase = .response(effect) }
        case "nope":
            guard case .response(var effect) = phase, let card = hands[playerID]?.first(where: { $0.id == command.values[0] }) else { throw GameError.invalid("否决无效。") }
            hands[playerID]!.removeAll { $0.id == card.id }; discard.append(card)
            effect.cancelled.toggle(); effect.passed = []; phase = .response(effect)
            record("\(name(playerID)) 使用否决，\(effect.cancelled ? "取消" : "恢复")了效果。")
        case "give":
            guard case .give(let actor, let target) = phase, let index = hands[target]?.firstIndex(where: { $0.id == command.values[0] }) else { throw GameError.invalid("交牌无效。") }
            hands[actor, default: []].append(hands[target]!.remove(at: index))
            record("\(name(target)) 交给 \(name(actor)) 一张牌。"); phase = .turn
        case "done": phase = .turn
        case "defuse":
            guard case .bomb(let bomb) = phase, let index = hands[current]?.firstIndex(where: { $0.kind == .defuse }) else { throw GameError.invalid("没有拆弹牌。") }
            discard.append(hands[current]!.remove(at: index)); phase = .insert(bomb); record("\(name(current)) 使用了拆弹牌。")
        case "explode":
            guard case .bomb(let bomb) = phase else { throw GameError.invalid("当前没有炸弹。") }
            explode(bomb)
        case "insert":
            guard case .insert(let bomb) = phase, let index = Int(command.values[0]), (0...deck.count).contains(index) else { throw GameError.invalid("放回位置无效。") }
            deck.insert(bomb, at: index); record("\(name(current)) 已秘密放回炸弹。"); endTurn()
        default: throw GameError.invalid("未知操作。")
        }
    }
    mutating func beginEffect(_ effect: Effect) {
        let ids = Set(effect.cards.map(\.id))
        hands[effect.actor]!.removeAll { ids.contains($0.id) }; discard += effect.cards
        phase = .response(effect); record("\(name(effect.actor)) 打出\(effect.description)。")
    }
    mutating func resolve(_ effect: Effect) {
        phase = .turn
        if effect.cancelled { record("效果被取消，继续原回合。"); return }
        if effect.cards.count > 1, let target = effect.target {
            let hand = hands[target, default: []]
            let index: Int?
            if let requested = effect.requested { index = hand.firstIndex { $0.kind == requested } }
            else { index = hand.isEmpty ? nil : Int.random(in: 0..<hand.count, using: &rng) }
            if let index { hands[effect.actor, default: []].append(hands[target]!.remove(at: index)); record("\(name(effect.actor)) 从 \(name(target)) 获得一张牌。") }
            else { record("\(name(effect.actor)) 没有取得牌。") }
            return
        }
        switch effect.cards[0].kind {
        case .attack:
            turnsRemaining = attacked ? turnsRemaining + 2 : 2
            attacked = true; current = nextPlayer(after: current)
            record("\(name(current)) 需要完成 \(turnsRemaining) 个回合。")
        case .skip: endTurn()
        case .shuffle: deck.shuffle(using: &rng); record("抽牌堆已洗匀。")
        case .future: phase = .future(Array(deck.prefix(3)))
        case .favor:
            if let target = effect.target, !hands[target, default: []].isEmpty { phase = .give(actor: effect.actor, target: target) }
            else { record("目标没有手牌，索取结束。") }
        default: break
        }
    }
    func nextPlayer(after id: String) -> String {
        let index = players.firstIndex { $0.id == id }!
        for distance in 1...players.count {
            let candidate = players[(index + distance) % players.count].id
            if alive.contains(candidate) { return candidate }
        }
        return id
    }
    mutating func endTurn() {
        turnsRemaining -= 1
        if turnsRemaining == 0 { current = nextPlayer(after: current); turnsRemaining = 1; attacked = false }
        phase = .turn
    }
    mutating func explode(_ bomb: Card) {
        let victim = current
        eliminatedCards += hands[victim, default: []]; eliminatedCards.append(bomb); hands[victim] = []
        alive.removeAll { $0 == victim }; record("\(name(victim)) 爆炸出局。")
        current = nextPlayer(after: victim); turnsRemaining = 1; attacked = false; phase = .turn
        if isFinished { record("\(name(alive[0])) 成为最后的幸存者！") }
    }
}
