import Foundation
import Combine
import MochaCore
import MochaLAN

/// Main-queue UI/session coordinator. A connection is bound to a player only after hello.
public final class TableStore: ObservableObject {
    public struct Timing {
        public var helloTimeout: TimeInterval
        public var connectTimeout: TimeInterval
        public var reconnectDelay: TimeInterval
        public init(helloTimeout: TimeInterval = 10, connectTimeout: TimeInterval = 12, reconnectDelay: TimeInterval = 3) {
            self.helloTimeout = max(0.05, helloTimeout)
            self.connectTimeout = max(0.05, connectTimeout)
            self.reconnectDelay = max(0.05, reconnectDelay)
        }
    }
    @Published public var profile: Player?
    @Published public var nearby: [NearbyRoom] = []
    @Published public var room: RoomSnapshot?
    @Published public var error: String?
    @Published public var status = "寻找附近的桌游局…"
    @Published public var reconnecting = false
    @Published public var connecting = false
    @Published public var hostingReady = false
    public var isHost: Bool { room?.hostID == profile?.id }
    private let transport: LANTransport
    private let timing: Timing
    private var host: RoomHost?
    private var bindings: [UUID: String] = [:]
    private var server: UUID?
    private var destination: NearbyRoom?
    private var reconnectWork: DispatchWorkItem?
    private var helloTimeouts: [UUID: DispatchWorkItem] = [:]
    private var deliberateLeave = false
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard, transport: LANTransport = LANTransport(), timing: Timing = Timing()) {
        self.defaults = defaults; self.transport = transport; self.timing = timing
        if let data = defaults.data(forKey: "tabletop.profile"), let stored = try? JSONDecoder().decode(Player.self, from: data) {
            profile = try? ProfileCatalog.validated(stored)
        }
        transport.onRooms = { [weak self] rooms in self?.nearby = rooms }
        transport.onError = { [weak self] error in self?.error = error; self?.status = "检查本地网络权限后重试" }
        transport.onListening = { [weak self] in self?.hostingReady = true }
        transport.onConnected = { [weak self] id in self?.connected(id) }
        transport.onDisconnected = { [weak self] id in self?.disconnected(id) }
        transport.onMessage = { [weak self] id, message in self?.receive(message, from: id) }
    }
    deinit {
        reconnectWork?.cancel()
        for work in helloTimeouts.values { work.cancel() }
    }

    public func saveProfile(name: String, avatar: String) {
        do {
            let next = try ProfileCatalog.validated(Player(id: profile?.id ?? UUID().uuidString, name: name, avatar: avatar))
            defaults.set(try JSONEncoder().encode(next), forKey: "tabletop.profile")
            profile = next
        } catch { self.error = error.localizedDescription }
    }

    public func browse() { transport.browse() }

    public func createRoom(_ kind: GameKind) {
        guard let profile else { return }
        leave(); deliberateLeave = false; error = nil
        do {
            let next = try RoomHost(host: profile, factory: GameRegistry.make)
            host = next
            try next.handle(RoomRequest(revision: next.revision, action: .selectGame(kind)), from: profile.id)
            room = next.snapshot(for: profile.id)
            hostingReady = false
            try transport.host(roomID: next.id, name: next.name)
        } catch { self.error = error.localizedDescription; host = nil; room = nil; transport.stopConnections() }
    }

    public func join(_ nearby: NearbyRoom) {
        guard profile != nil else { return }
        leave(); deliberateLeave = false; destination = nearby; error = nil
        connecting = true; status = "正在加入\(nearby.name)…"
        let id = transport.connect(to: nearby); server = id
        scheduleConnectTimeout(id)
    }

    public func send(_ action: RoomAction) {
        guard let room, let profile else { return }
        let request = RoomRequest(revision: room.revision, action: action)
        if let host {
            do {
                try host.handle(request, from: profile.id)
                if case .removePlayer(let target) = action {
                    for (id, playerID) in Array(bindings) where playerID == target {
                        bindings[id] = nil
                        transport.sendThenClose(.closed("房主已将你移出房间。"), to: id)
                    }
                }
                broadcast()
            } catch { self.error = error.localizedDescription }
        } else if let server, !reconnecting, !connecting { transport.send(.request(request), to: server) }
    }

    public func leave() {
        let finalMessage: WireMessage = host == nil ? .leave : .closed("房主结束了房间。")
        deliberateLeave = true; reconnectWork?.cancel(); reconnectWork = nil
        for work in helloTimeouts.values { work.cancel() }; helloTimeouts.removeAll()
        // Clear identities first: synchronous close callbacks must not mark a departed
        // player offline or schedule reconnection into a replacement room.
        host = nil; room = nil; server = nil; destination = nil; bindings.removeAll()
        connecting = false; reconnecting = false; hostingReady = false
        transport.stopConnections(finalMessage: finalMessage)
        status = "寻找附近的桌游局…"
    }

    public func foreground() {
        browse()
        if reconnecting { attemptReconnect() }
    }

    private func reconnectCredential(for roomID: String) -> String {
        // A host learns this credential. Never reuse it with a different host/room.
        let key = "tabletop.reconnect.room." + roomID
        if let token = defaults.string(forKey: key), UUID(uuidString: token) != nil { return token }
        let token = UUID().uuidString; defaults.set(token, forKey: key); return token
    }

    private func connected(_ id: UUID) {
        if host != nil {
            let work = DispatchWorkItem { [weak self] in
                guard let self, self.bindings[id] == nil else { return }
                self.helloTimeouts[id] = nil
                self.transport.sendThenClose(.error("加入超时，请重新连接。"), to: id)
            }
            helloTimeouts[id] = work; DispatchQueue.main.asyncAfter(deadline: .now() + timing.helloTimeout, execute: work)
        } else if id == server, let destination, let profile {
            transport.send(.hello(version: WireMessage.version, roomID: destination.id, player: profile,
                                  reconnectToken: reconnectCredential(for: destination.id)), to: id)
        } else { transport.close(id) }
    }

    private func receive(_ message: WireMessage, from id: UUID) {
        if let host {
            do {
                switch message {
                case .hello(let version, let roomID, let player, let token):
                    guard bindings[id] == nil else {
                        transport.sendThenClose(.error("连接已绑定身份，不能再次握手。"), to: id); return
                    }
                    guard version == WireMessage.version, roomID == host.id else { throw GameError.invalid("版本或房间不匹配，请升级到相同版本后重试。") }
                    try host.join(player, token: token)
                    for (old, playerID) in Array(bindings) where playerID == player.id && old != id {
                        bindings[old] = nil
                        transport.sendThenClose(.closed("该玩家已在另一条连接上重新加入。"), to: old)
                    }
                    bindings[id] = player.id
                    helloTimeouts.removeValue(forKey: id)?.cancel()
                    broadcast()
                case .request(let request):
                    guard let playerID = bindings[id] else { throw GameError.invalid("请先加入房间。") }
                    try host.handle(request, from: playerID); broadcast()
                case .leave:
                    guard let playerID = bindings.removeValue(forKey: id) else { throw GameError.invalid("请先加入房间。") }
                    host.leave(playerID)
                    transport.sendThenClose(.closed("你已离开房间。"), to: id)
                    broadcast()
                default: throw GameError.invalid("收到不适用的消息。")
                }
            } catch {
                if let playerID = bindings[id] {
                    transport.send(.error(error.localizedDescription), to: id)
                    transport.send(.snapshot(host.snapshot(for: playerID)), to: id)
                } else {
                    helloTimeouts.removeValue(forKey: id)?.cancel()
                    transport.sendThenClose(.error(error.localizedDescription), to: id)
                }
            }
        } else if id == server {
            switch message {
            case .snapshot(let snapshot):
                guard snapshot.id == destination?.id,
                      snapshot.members.contains(where: { $0.id == profile?.id && $0.connected }),
                      snapshot.members.contains(where: { $0.id == snapshot.hostID }),
                      Set(snapshot.members.map(\.id)).count == snapshot.members.count,
                      room == nil || (snapshot.hostID == room?.hostID && snapshot.revision >= room!.revision) else { return }
                room = snapshot; connecting = false; reconnecting = false
                reconnectWork?.cancel(); reconnectWork = nil
                helloTimeouts.removeValue(forKey: id)?.cancel(); status = "已连接"
            case .error(let message):
                error = message
                if connecting || reconnecting { leave() }
            case .closed(let message): leave(); error = message
            default: break
            }
        }
    }

    private func broadcast() {
        guard let host, let profile else { return }
        room = host.snapshot(for: profile.id)
        for (connection, playerID) in bindings { transport.send(.snapshot(host.snapshot(for: playerID)), to: connection) }
    }

    private func disconnected(_ id: UUID) {
        helloTimeouts.removeValue(forKey: id)?.cancel()
        if let playerID = bindings.removeValue(forKey: id), let host {
            host.disconnect(playerID); broadcast()
        } else if id == server, !deliberateLeave {
            server = nil; connecting = false
            guard room != nil else {
                status = "连接失败，请重试"; error = "无法加入房间。请确认房主仍在应用内，并连接同一 Wi-Fi。"; return
            }
            reconnecting = true; status = "连接中断，正在自动重连…"
            scheduleReconnect()
        }
    }

    private func scheduleReconnect() {
        reconnectWork?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.reconnectWork = nil; self?.attemptReconnect() }
        reconnectWork = work; DispatchQueue.main.asyncAfter(deadline: .now() + timing.reconnectDelay, execute: work)
    }

    private func attemptReconnect() {
        guard reconnecting, !deliberateLeave, server == nil, let destination else { return }
        reconnectWork?.cancel(); reconnectWork = nil
        let target = nearby.first(where: { $0.id == destination.id }) ?? destination
        let id = transport.connect(to: target); server = id
        scheduleConnectTimeout(id)
    }

    private func scheduleConnectTimeout(_ id: UUID) {
        let work = DispatchWorkItem { [weak self] in
            guard let self, self.server == id, self.connecting || self.reconnecting else { return }
            self.helloTimeouts[id] = nil; self.transport.close(id)
        }
        helloTimeouts[id] = work; DispatchQueue.main.asyncAfter(deadline: .now() + timing.connectTimeout, execute: work)
    }
}
