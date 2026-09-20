import Foundation

public struct Player: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var avatar: String
    public init(id: String = UUID().uuidString, name: String, avatar: String = "🦊") {
        self.id = id; self.name = name; self.avatar = avatar
    }
}

public enum GameKind: String, Codable, CaseIterable, Identifiable, Sendable {
    case gems, bombs, werewolf, avalon
    public var id: String { rawValue }
    public var title: String {
        switch self { case .gems: return "宝石商人"; case .bombs: return "拆弹猫"; case .werewolf: return "狼人杀"; case .avalon: return "阿瓦隆" }
    }
    public var symbol: String {
        switch self { case .gems: return "suit.diamond.fill"; case .bombs: return "flame.fill"; case .werewolf: return "moon.stars.fill"; case .avalon: return "crown.fill" }
    }
    public var playerRange: ClosedRange<Int> {
        switch self { case .gems: return 2...4; case .bombs: return 2...5; case .werewolf: return 12...12; case .avalon: return 5...10 }
    }
    public var subtitle: String {
        switch self { case .gems: return "收集宝石 · 建立你的商业王朝"; case .bombs: return "抽牌、试探，然后活到最后"; case .werewolf: return "12 人预女猎守 · 面对面的推理之夜"; case .avalon: return "隐藏阵营 · 组队执行神圣任务" }
    }
}

public struct GameCommand: Codable, Equatable, Sendable {
    public var action: String
    public var values: [String]
    public init(_ action: String, values: [String] = []) { self.action = action; self.values = values }
}

public struct GameChoice: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var subtitle: String
    public init(_ id: String, _ title: String, subtitle: String = "") {
        self.id = id; self.title = title; self.subtitle = subtitle
    }
}

/// Each prompt represents one action. Selected choice IDs become GameCommand.values.
/// Choices are unique and selected at most once; encode repeated resources as distinct IDs.
public struct ActionPrompt: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var help: String
    public var choices: [GameChoice]
    public var min: Int
    public var max: Int
    public init(_ id: String, _ title: String, help: String = "", choices: [GameChoice] = [], min: Int = 0, max: Int = 0) {
        self.id = id; self.title = title; self.help = help; self.choices = choices; self.min = min; self.max = max
    }
}

public struct DisplayItem: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var detail: String
    public var symbol: String
    public init(_ id: String, _ title: String, detail: String = "", symbol: String = "") {
        self.id = id; self.title = title; self.detail = detail; self.symbol = symbol
    }
}

public struct DisplaySection: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var items: [DisplayItem]
    public var isPrivate: Bool
    public init(_ id: String, _ title: String, items: [DisplayItem], isPrivate: Bool = false) {
        self.id = id; self.title = title; self.items = items; self.isPrivate = isPrivate
    }
}

/// A projection for exactly one player. Never send the engine or other players' projections.
public struct GameView: Codable, Equatable, Sendable {
    public var title: String
    public var phase: String
    public var instruction: String
    public var sections: [DisplaySection]
    public var actions: [ActionPrompt]
    public var log: [String]
    public var isFinished: Bool
    public init(title: String, phase: String, instruction: String = "", sections: [DisplaySection] = [], actions: [ActionPrompt] = [], log: [String] = [], isFinished: Bool = false) {
        self.title = title; self.phase = phase; self.instruction = instruction; self.sections = sections; self.actions = actions; self.log = log; self.isFinished = isFinished
    }
}

public enum GameError: Error, LocalizedError, Equatable {
    case invalid(String)
    public var errorDescription: String? { switch self { case .invalid(let message): return message } }
}

public protocol GameEngine {
    var kind: GameKind { get }
    var players: [Player] { get }
    var isFinished: Bool { get }
    func view(for playerID: String) -> GameView
    /// Must reject invalid/out-of-turn input WITHOUT changing any state.
    mutating func apply(_ command: GameCommand, by playerID: String) throws
}

/// Stable deterministic randomness, used only on the host. Seeds never leave the host.
public struct SeededGenerator: RandomNumberGenerator, Sendable {
    private var state: UInt64
    public init(seed: UInt64) { state = seed }
    public mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}
