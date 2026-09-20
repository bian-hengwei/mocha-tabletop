import Foundation
import Network
import MochaCore

public struct NearbyRoom: Identifiable, Equatable {
    public let id: String
    public let name: String
    public let endpoint: NWEndpoint
    public init(id: String, name: String, endpoint: NWEndpoint) {
        self.id = id; self.name = name; self.endpoint = endpoint
    }
}

/// Call from the main queue. All callbacks run there, alongside the host state machine.
/// TCP has no MultipeerConnectivity eight-peer limit; the application admits 12 players.
public final class LANTransport {
    public static let serviceType = "_mocha-tabletop._tcp"
    public struct Timing {
        public var heartbeatInterval: TimeInterval
        public var idleTimeout: TimeInterval
        public var closeTimeout: TimeInterval
        public init(heartbeatInterval: TimeInterval = 5, idleTimeout: TimeInterval = 25, closeTimeout: TimeInterval = 2) {
            self.heartbeatInterval = max(0.05, heartbeatInterval)
            self.idleTimeout = max(0.1, idleTimeout)
            self.closeTimeout = max(0.1, closeTimeout)
        }
    }
    public var onRooms: (([NearbyRoom]) -> Void)?
    public var onMessage: ((UUID, WireMessage) -> Void)?
    public var onConnected: ((UUID) -> Void)?
    public var onDisconnected: ((UUID) -> Void)?
    public var onError: ((String) -> Void)?
    public var onListening: (() -> Void)?
    private var browser: NWBrowser?
    private var listener: NWListener?
    private var peers: [UUID: Peer] = [:]
    private var heartbeat: DispatchSourceTimer?
    private var advertisedID: String?
    private let timing: Timing
    // Internal diagnostics are used by actual loopback integration tests.
    var listeningPort: NWEndpoint.Port? { listener?.port }
    var connectionCount: Int { peers.values.filter { !$0.closing }.count }

    private final class Peer {
        let connection: NWConnection
        var framer = MessageFramer()
        var lastSeen = ProcessInfo.processInfo.systemUptime
        var connected = false
        var closing = false
        var closeWork: DispatchWorkItem?
        init(_ connection: NWConnection) { self.connection = connection }
    }

    public init(timing: Timing = Timing()) { self.timing = timing }
    deinit {
        heartbeat?.cancel(); browser?.cancel(); listener?.cancel()
        for peer in peers.values { peer.closeWork?.cancel(); peer.connection.cancel() }
    }
    private func parameters() -> NWParameters {
        let tcp = NWProtocolTCP.Options()
        tcp.enableKeepalive = true; tcp.keepaliveIdle = 10; tcp.keepaliveInterval = 5; tcp.keepaliveCount = 3
        let parameters = NWParameters(tls: nil, tcp: tcp)
        parameters.includePeerToPeer = true
        return parameters
    }

    public func browse() {
        browser?.cancel()
        let b = NWBrowser(for: .bonjour(type: Self.serviceType, domain: nil), using: parameters())
        browser = b
        b.browseResultsChangedHandler = { [weak self, weak b] results, _ in
            guard let self, let b, self.browser === b else { return }
            var unique: [String: NearbyRoom] = [:]
            for result in results {
                guard case let .service(name, _, _, _) = result.endpoint else { continue }
                let parts = name.split(separator: "|", maxSplits: 1).map(String.init)
                guard parts.count == 2, UUID(uuidString: parts[0]) != nil, parts[0] != self.advertisedID else { continue }
                unique[parts[0]] = NearbyRoom(id: parts[0], name: parts[1], endpoint: result.endpoint)
            }
            self.onRooms?(unique.values.sorted { $0.name < $1.name })
        }
        b.stateUpdateHandler = { [weak self, weak b] state in
            guard let self, let b, self.browser === b else { return }
            if case .failed(let error) = state { self.onError?(self.readable(error)) }
            if case .waiting(let error) = state { self.onError?(self.readable(error)) }
        }
        b.start(queue: .main)
    }

    public func host(roomID: String, name: String) throws {
        guard UUID(uuidString: roomID) != nil else { throw GameError.invalid("房间标识无效。") }
        stopConnections()
        let l = try NWListener(using: parameters(), on: .any)
        advertisedID = roomID
        var shortName = name.isEmpty ? "桌游局" : name
        while shortName.utf8.count > 25 { shortName.removeLast() }
        l.service = NWListener.Service(name: roomID + "|" + shortName, type: Self.serviceType)
        listener = l
        l.newConnectionHandler = { [weak self, weak l] connection in
            guard let self, let l, self.listener === l, self.connectionCount < 24 else { connection.cancel(); return }
            _ = self.attach(connection)
        }
        l.stateUpdateHandler = { [weak self, weak l] state in
            guard let self, let l, self.listener === l else { return }
            if case .ready = state { self.onListening?() }
            if case .failed(let error) = state { self.onError?(self.readable(error)) }
            if case .waiting(let error) = state { self.onError?(self.readable(error)) }
        }
        l.start(queue: .main); startHeartbeat()
    }

    @discardableResult public func connect(to room: NearbyRoom) -> UUID {
        stopConnections()
        let id = attach(NWConnection(to: room.endpoint, using: parameters()))
        startHeartbeat(); return id
    }

    public func send(_ message: WireMessage, to id: UUID) {
        guard let peer = peers[id], !peer.closing else { return }
        do {
            let bytes = try MessageFramer.encode(message)
            peer.connection.send(content: bytes, completion: .contentProcessed { [weak self, weak peer] error in
                guard let self, let peer, self.peers[id] === peer else { return }
                if error != nil { self.close(id) }
            })
        } catch { onError?(error.localizedDescription) }
    }

    /// Flushes the final application message and a TCP write-side FIN. Keep reading until
    /// the remote side closes, with a bounded fallback; immediate cancel can lose the message.
    public func sendThenClose(_ message: WireMessage, to id: UUID) {
        guard let peer = peers[id], !peer.closing else { return }
        do {
            let bytes = try MessageFramer.encode(message)
            peer.closing = true
            let work = DispatchWorkItem { [weak self] in self?.close(id) }
            peer.closeWork = work
            DispatchQueue.main.asyncAfter(deadline: .now() + timing.closeTimeout, execute: work)
            peer.connection.send(content: bytes, contentContext: .finalMessage, isComplete: true,
                                 completion: .contentProcessed { [weak self, weak peer] error in
                guard let self, let peer, self.peers[id] === peer else { return }
                if error != nil { self.close(id) }
            })
        } catch { onError?(error.localizedDescription); close(id) }
    }

    public func close(_ id: UUID) {
        guard let peer = peers.removeValue(forKey: id) else { return }
        peer.closeWork?.cancel(); peer.connection.stateUpdateHandler = nil
        peer.connection.cancel(); onDisconnected?(id)
    }

    public func stop() {
        browser?.cancel(); browser = nil; onRooms?([])
        stopConnections()
        // A full stop also cancels any earlier graceful shutdown still draining.
        for id in Array(peers.keys) { close(id) }
    }

    /// Draining old connections may coexist briefly with the next room's connections.
    /// They cannot deliver application callbacks into the new room.
    public func stopConnections(finalMessage: WireMessage? = nil) {
        heartbeat?.cancel(); heartbeat = nil
        listener?.cancel(); listener = nil; advertisedID = nil
        for (id, peer) in Array(peers) where !peer.closing {
            if let finalMessage, peer.connected { sendThenClose(finalMessage, to: id) }
            else { close(id) }
        }
    }

    private func attach(_ connection: NWConnection) -> UUID {
        let id = UUID(); let peer = Peer(connection); peers[id] = peer
        connection.stateUpdateHandler = { [weak self, weak peer] state in
            guard let self, let peer, self.peers[id] === peer else { return }
            switch state {
            case .ready:
                guard !peer.connected else { return }
                peer.connected = true; peer.lastSeen = ProcessInfo.processInfo.systemUptime
                self.onConnected?(id); self.receive(id)
            case .failed, .cancelled: self.close(id)
            default: break
            }
        }
        connection.start(queue: .main)
        return id
    }

    private func receive(_ id: UUID) {
        guard let peer = peers[id] else { return }
        peer.connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self, weak peer] data, _, complete, error in
            guard let self, let peer, self.peers[id] === peer else { return }
            if let data, !data.isEmpty, !peer.closing {
                do {
                    let messages = try peer.framer.append(data)
                    // Partial byte drips cannot keep a stalled frame alive indefinitely.
                    if !messages.isEmpty { peer.lastSeen = ProcessInfo.processInfo.systemUptime }
                    for message in messages {
                        guard self.peers[id] === peer, !peer.closing else { break }
                        switch message {
                        case .ping: self.send(.pong, to: id)
                        case .pong: break
                        default: self.onMessage?(id, message)
                        }
                    }
                } catch { self.close(id); return }
            }
            if complete || error != nil { self.close(id) }
            else { self.receive(id) }
        }
    }

    private func startHeartbeat() {
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now() + timing.heartbeatInterval, repeating: timing.heartbeatInterval)
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            for (id, peer) in Array(self.peers) where !peer.closing {
                if ProcessInfo.processInfo.systemUptime - peer.lastSeen > self.timing.idleTimeout { self.close(id) }
                else if peer.connected { self.send(.ping, to: id) }
            }
        }
        heartbeat = timer; timer.resume()
    }

    private func readable(_ error: NWError) -> String {
        "局域网连接暂不可用。请允许“本地网络”权限，确认大家连接同一 Wi-Fi 或热点，然后重试。\n\(error.localizedDescription)"
    }
}
