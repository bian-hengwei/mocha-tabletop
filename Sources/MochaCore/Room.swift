import Foundation

public enum ProfileCatalog {
    public static let avatars = ["🦊", "🐼", "🐱", "🐻", "🐰", "🐨", "🐯", "🐸", "🦁", "🐧", "🦉", "🐙", "🦋", "🐳", "🌵", "🍄"]
    public static func validated(_ player: Player) throws -> Player {
        let name = player.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (1...16).contains(name.count), !name.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }), avatars.contains(player.avatar), UUID(uuidString: player.id) != nil else {
            throw GameError.invalid("昵称需要 1–16 个字，并选择一个头像。")
        }
        return Player(id: player.id, name: name, avatar: player.avatar)
    }
}

public struct RoomMember: Codable, Equatable, Identifiable, Sendable {
    public var player: Player
    public var ready: Bool
    public var connected: Bool
    public var id: String { player.id }
    public init(player: Player, ready: Bool = false, connected: Bool = true) {
        self.player = player; self.ready = ready; self.connected = connected
    }
}

public struct RoomSnapshot: Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var hostID: String
    public var revision: Int
    /// Recipient-specific epoch for the currently offered actions, independent of other players' submissions.
    public var actionRevision: Int
    public var gameKind: GameKind
    public var members: [RoomMember]
    public var game: GameView?
    public var paused: Bool { game != nil && members.contains { !$0.connected } }
    public var canStart: Bool {
        game == nil && gameKind.playerRange.contains(members.count) && members.allSatisfy { $0.connected && ($0.id == hostID || $0.ready) }
    }
}

public enum RoomAction: Codable, Equatable, Sendable {
    case ready(Bool)
    case selectGame(GameKind)
    case start
    case play(GameCommand)
    case returnToLobby
    case removePlayer(String)
}

public struct RoomRequest: Codable, Equatable, Sendable {
    public var id: String
    public var revision: Int
    public var actionRevision: Int?
    public var action: RoomAction
    public init(id: String = UUID().uuidString, revision: Int, actionRevision: Int? = nil, action: RoomAction) {
        self.id = id; self.revision = revision; self.actionRevision = actionRevision; self.action = action
    }
}

public enum WireMessage: Codable, Sendable {
    public static let version = 2
    case hello(version: Int, roomID: String, player: Player, reconnectToken: String)
    case request(RoomRequest)
    case snapshot(RoomSnapshot)
    case error(String)
    case closed(String)
    case leave
    case ping
    case pong
}

/// Host-owned, single-threaded state. Network connections authenticate once, then are bound to an ID.
/// Game engines must be VALUE TYPES so failed commands can be rolled back by copy-on-write.
public final class RoomHost {
    public typealias Factory = (GameKind, [Player], UInt64) throws -> any GameEngine
    public let id: String
    public let name: String
    public let hostID: String
    public private(set) var revision = 0
    public private(set) var gameKind: GameKind = .gems
    public private(set) var members: [RoomMember]
    public private(set) var engine: (any GameEngine)?
    private var tokens: [String: String] = [:]
    private var processed: Set<String> = []
    private var processedOrder: [String] = []
    private let factory: Factory
    private struct ActionContext: Equatable {
        var phase: String?
        var actions: [ActionPrompt]
        var finished: Bool
        var connected: Bool
        var paused: Bool
    }
    private var actionContexts: [String: ActionContext] = [:]
    // Retain counters for removed IDs so leaving/rejoining cannot reset an epoch (ABA).
    private var actionRevisions: [String: Int] = [:]

    public init(host: Player, factory: @escaping Factory) throws {
        let host = try ProfileCatalog.validated(host)
        id = UUID().uuidString; name = "\(host.name)的桌游局"; hostID = host.id
        members = [RoomMember(player: host, ready: true)]; self.factory = factory
        refreshActionContexts()
    }

    public func join(_ incoming: Player, token: String) throws {
        let player = try ProfileCatalog.validated(incoming)
        guard UUID(uuidString: token) != nil, player.id != hostID else { throw GameError.invalid("身份凭据无效。") }
        if let index = members.firstIndex(where: { $0.id == player.id }) {
            guard tokens[player.id] == token else { throw GameError.invalid("该玩家身份已被占用。") }
            members[index].connected = true
            // Preserve names and avatars during a match.
            if engine == nil { members[index].player = player }
        } else {
            guard engine == nil else { throw GameError.invalid("游戏已开始，本局只允许原玩家重新连接。") }
            guard members.count < 12 else { throw GameError.invalid("房间已满（最多 12 人）。") }
            guard !members.contains(where: { $0.player.name == player.name }) else { throw GameError.invalid("房间里已有同名玩家，请换一个昵称。") }
            members.append(RoomMember(player: player)); tokens[player.id] = token
        }
        revision += 1
        refreshActionContexts()
    }

    public func leave(_ playerID: String) {
        guard playerID != hostID, members.contains(where: { $0.id == playerID }) else { return }
        if engine != nil { disconnect(playerID) }
        else {
            members.removeAll { $0.id == playerID }; tokens[playerID] = nil; revision += 1
            refreshActionContexts()
        }
    }

    public func disconnect(_ playerID: String) {
        guard playerID != hostID, let i = members.firstIndex(where: { $0.id == playerID }) else { return }
        members[i].connected = false; members[i].ready = false; revision += 1
        refreshActionContexts()
    }

    public func snapshot(for playerID: String) -> RoomSnapshot {
        RoomSnapshot(id: id, name: name, hostID: hostID, revision: revision, actionRevision: actionRevisions[playerID] ?? 0, gameKind: gameKind, members: members,
                     game: members.contains(where: { $0.id == playerID }) ? engine?.view(for: playerID) : nil)
    }

    public func handle(_ request: RoomRequest, from playerID: String) throws {
        guard let actor = members.first(where: { $0.id == playerID }), actor.connected else { throw GameError.invalid("你尚未加入房间。") }
        let key = playerID + ":" + request.id
        guard !processed.contains(key) else { return } // A retry never executes twice.
        let currentGlobalRevision = request.revision == revision
        let validConcurrentAction: Bool
        if case .play = request.action, let epoch = request.actionRevision {
            validConcurrentAction = request.revision >= 0 && request.revision < revision && epoch == actionRevisions[playerID]
        } else { validConcurrentAction = false }
        guard currentGlobalRevision || validConcurrentAction else { throw GameError.invalid("桌面刚刚更新，请根据最新状态重试。") }
        var consumedActor: String?
        var renewGameEpoch = false
        switch request.action {
        case .ready(let ready):
            guard engine == nil, playerID != hostID else { throw GameError.invalid("当前不能更改准备状态。") }
            members[members.firstIndex(where: { $0.id == playerID })!].ready = ready
        case .selectGame(let kind):
            try requireHost(playerID)
            guard engine == nil else { throw GameError.invalid("请先结束本局。") }
            gameKind = kind
            for i in members.indices { members[i].ready = members[i].id == hostID }
        case .start:
            try requireHost(playerID)
            guard snapshot(for: playerID).canStart else { throw GameError.invalid("请确认人数符合要求，且所有人已准备。") }
            engine = try factory(gameKind, members.map(\.player), UInt64.random(in: .min ... .max))
            renewGameEpoch = true
        case .play(let command):
            guard members.allSatisfy(\.connected) else { throw GameError.invalid("有人掉线了，等待重新连接后继续。") }
            guard var candidate = engine else { throw GameError.invalid("游戏尚未开始。") }
            guard !candidate.isFinished else { throw GameError.invalid("本局已经结束。") }
            try candidate.apply(command, by: playerID)
            engine = candidate
            consumedActor = playerID
        case .returnToLobby:
            try requireHost(playerID)
            engine = nil
            renewGameEpoch = true
            for i in members.indices { members[i].ready = members[i].id == hostID }
        case .removePlayer(let target):
            try requireHost(playerID)
            guard engine == nil, target != hostID, members.contains(where: { $0.id == target }) else { throw GameError.invalid("只能在大厅移除其他玩家。") }
            members.removeAll { $0.id == target }; tokens[target] = nil
        }
        processed.insert(key); processedOrder.append(key)
        if processedOrder.count > 2048 { processed.remove(processedOrder.removeFirst()) }
        revision += 1
        refreshActionContexts(consuming: consumedActor, forceAll: renewGameEpoch)
    }

    /// Refresh after every successful transition, rather than comparing only when a request arrives.
    /// This remembers A→B→A changes. Consuming the actor also protects A→A actions (e.g. another
    /// draw while under attack, or a sleep button spanning two private night stages).
    private func refreshActionContexts(consuming actor: String? = nil, forceAll: Bool = false) {
        let paused = engine != nil && members.contains { !$0.connected }
        let memberIDs = Set(members.map(\.id))
        actionContexts = actionContexts.filter { memberIDs.contains($0.key) }
        for member in members {
            let view = engine?.view(for: member.id)
            let context = ActionContext(phase: view?.phase, actions: view?.actions ?? [], finished: view?.isFinished ?? false,
                                        connected: member.connected, paused: paused)
            if forceAll || actor == member.id || actionContexts[member.id] != context {
                actionRevisions[member.id, default: 0] += 1
            }
            actionContexts[member.id] = context
        }
    }

    private func requireHost(_ playerID: String) throws {
        guard playerID == hostID else { throw GameError.invalid("只有房主可以进行这个操作。") }
    }
}

/// Streaming TCP framing: 4-byte network-order length followed by JSON, capped at 1 MiB.
public struct MessageFramer {
    public static let maxSize = 1_048_576
    private var buffer = Data()
    public init() {}
    public static func encode(_ message: WireMessage) throws -> Data {
        let payload = try JSONEncoder().encode(message)
        guard payload.count <= maxSize else { throw GameError.invalid("消息太大。") }
        var size = UInt32(payload.count).bigEndian
        var result = Data(bytes: &size, count: 4); result.append(payload); return result
    }
    public mutating func append(_ data: Data) throws -> [WireMessage] {
        buffer.append(data)
        var messages: [WireMessage] = []
        while buffer.count >= 4 {
            let size = buffer.prefix(4).reduce(0) { ($0 << 8) | Int($1) }
            guard size > 0, size <= Self.maxSize else { buffer.removeAll(); throw GameError.invalid("连接收到无效消息。") }
            guard buffer.count >= size + 4 else { break }
            let payload = Data(buffer.dropFirst(4).prefix(size))
            messages.append(try JSONDecoder().decode(WireMessage.self, from: payload))
            buffer = Data(buffer.dropFirst(size + 4))
        }
        guard buffer.count <= Self.maxSize + 4 else { throw GameError.invalid("连接消息超出限制。") }
        return messages
    }
}
