import Foundation
import Network
import Testing
@testable import MochaLAN
@testable import MochaUI
import MochaCore

/// Real Network.framework sockets on loopback and real Bonjour discovery, not transport mocks.
/// These macOS tests do not establish iPhone Wi-Fi/hotspot compatibility.
@Suite(.serialized)
@MainActor
struct LANIntegrationTests {
    struct Timeout: Error { let operation: String }
    func wait(_ operation: String, timeout: TimeInterval = 5, until predicate: () -> Bool) async throws {
        let deadline = ProcessInfo.processInfo.systemUptime + timeout
        while !predicate() {
            if ProcessInfo.processInfo.systemUptime > deadline { throw Timeout(operation: operation) }
            try await Task.sleep(for: .milliseconds(10))
        }
    }
    func session(_ name: String, timing: TableStore.Timing = .init()) -> (TableStore, LANTransport) {
        let defaults = UserDefaults(suiteName: "LANTests." + UUID().uuidString)!
        let transport = LANTransport(timing: .init(closeTimeout: 0.3))
        let store = TableStore(defaults: defaults, transport: transport, timing: timing)
        store.saveProfile(name: name, avatar: "🦊")
        return (store, transport)
    }
    func endpoint(_ host: TableStore, _ transport: LANTransport) throws -> NearbyRoom {
        let room = try #require(host.room)
        let port = try #require(transport.listeningPort)
        return NearbyRoom(id: room.id, name: room.name, endpoint: .hostPort(host: .ipv4(.loopback), port: port))
    }
    func cleanup(_ sessions: [(TableStore, LANTransport)]) {
        for (store, transport) in sessions { store.leave(); transport.stop() }
    }

    @Test func twelvePlayerRoomUsesRealTCPAndPrivateSnapshots() async throws {
        let (host, hostTransport) = session("房主")
        let clients = (1...11).map { session("玩家\($0)") }
        let overflow = session("第十三人")
        defer { cleanup([(host, hostTransport)] + clients + [overflow]) }
        host.createRoom(.werewolf)
        try await wait("listener") { host.hostingReady }
        let target = try endpoint(host, hostTransport)
        for (client, _) in clients { client.join(target) }
        try await wait("all 12 players") { host.room?.members.count == 12 && clients.allSatisfy { $0.0.room?.members.count == 12 } }
        #expect(hostTransport.connectionCount == 11)
        overflow.0.join(target)
        try await wait("full room rejection") { overflow.0.error != nil && !overflow.0.connecting }
        #expect(overflow.0.room == nil)
        #expect(host.room?.members.count == 12)
        for (client, _) in clients {
            try await wait("revision broadcast") { client.room?.revision == host.room?.revision }
            client.send(.ready(true))
            try await wait("ready accepted") { host.room?.members.first(where: { $0.id == client.profile?.id })?.ready == true }
        }
        try await wait("all ready") { host.room?.canStart == true }
        host.send(.start)
        try await wait("private game projections") { clients.allSatisfy { $0.0.room?.game != nil } }
        let all = [host] + clients.map(\.0)
        #expect(all.allSatisfy { $0.room?.game?.sections.filter(\.isPrivate).count == 1 })
        let identities = all.compactMap { $0.room?.game?.sections.first(where: { $0.id == "identity" })?.items.first?.title }
        #expect(identities.count == 12)
        #expect(Set(identities).count > 2)
        #expect(host.room?.members.allSatisfy(\.connected) == true)
    }

    @Test func lobbyLeaveRemovesMemberAndRoomCloseArrivesBeforeEOF() async throws {
        let h = session("房主"), c = session("来宾")
        defer { cleanup([h, c]) }
        h.0.createRoom(.bombs); try await wait("listener") { h.0.hostingReady }
        let target = try endpoint(h.0, h.1)
        c.0.join(target); try await wait("join") { c.0.room != nil }
        c.0.leave()
        try await wait("explicit lobby departure") { h.0.room?.members.count == 1 }
        #expect(!c.0.reconnecting)
        c.0.join(target); try await wait("second join") { c.0.room != nil }
        h.0.leave()
        try await wait("final room closed message") { c.0.room == nil && c.0.error?.contains("房主结束") == true }
        #expect(!c.0.reconnecting)
    }

    @Test func reconnectPreservesSeatAndGameWithOneReplacementConnection() async throws {
        let h = session("房主"), c = session("来宾", timing: .init(reconnectDelay: 0.2))
        defer { cleanup([h, c]) }
        h.0.createRoom(.bombs); try await wait("listener") { h.0.hostingReady }
        c.0.join(try endpoint(h.0, h.1)); try await wait("join") { c.0.room != nil }
        c.0.send(.ready(true)); try await wait("ready") { h.0.room?.canStart == true }
        h.0.send(.start); try await wait("game") { c.0.room?.game != nil }
        let before = try #require(h.0.room?.revision)
        let hand = c.0.room?.game?.sections.first { $0.id == "hand" }
        c.1.stopConnections()
        try await wait("paused") { h.0.room?.paused == true && c.0.reconnecting }
        c.0.foreground(); c.0.foreground() // Must not race multiple outgoing reconnects.
        try await wait("reconnected") { !c.0.reconnecting && h.0.room?.paused == false }
        #expect(h.0.room?.revision == before + 2)
        #expect(h.0.room?.members.count == 2)
        #expect(h.1.connectionCount == 1)
        #expect(c.0.room?.game?.sections.first { $0.id == "hand" } == hand)
    }

    @Test func handshakeRejectsUnboundRequestsWrongRoomAndIdentityTheft() async throws {
        let h = session("房主")
        let attacker = LANTransport(timing: .init(closeTimeout: 0.2))
        let legitimate = LANTransport(timing: .init(closeTimeout: 0.2))
        defer { cleanup([h]); attacker.stop(); legitimate.stop() }
        h.0.createRoom(.bombs); try await wait("listener") { h.0.hostingReady }
        let target = try endpoint(h.0, h.1)
        let guest = Player(name: "来宾"), token = UUID().uuidString
        var errors: [String] = []
        var legitimateSnapshot: RoomSnapshot?
        attacker.onMessage = { _, message in if case .error(let text) = message { errors.append(text) } }
        attacker.onConnected = { id in attacker.send(.request(RoomRequest(revision: 1, action: .selectGame(.avalon))), to: id) }
        attacker.connect(to: target)
        try await wait("unbound request rejection") { errors.count == 1 }
        #expect(h.0.room?.gameKind == .bombs)
        attacker.onConnected = { id in attacker.send(.hello(version: WireMessage.version, roomID: UUID().uuidString, player: guest, reconnectToken: token), to: id) }
        attacker.connect(to: target)
        try await wait("wrong room rejection") { errors.count == 2 }
        legitimate.onConnected = { id in legitimate.send(.hello(version: WireMessage.version, roomID: target.id, player: guest, reconnectToken: token), to: id) }
        legitimate.onMessage = { _, message in if case .snapshot(let snapshot) = message { legitimateSnapshot = snapshot } }
        legitimate.connect(to: target)
        try await wait("legitimate hello") { legitimateSnapshot != nil }
        attacker.onConnected = { id in attacker.send(.hello(version: WireMessage.version, roomID: target.id, player: guest, reconnectToken: UUID().uuidString), to: id) }
        attacker.connect(to: target)
        try await wait("credential mismatch rejection") { errors.count == 3 }
        #expect(h.0.room?.members.count == 2)
        #expect(h.0.room?.members.first { $0.id == guest.id }?.connected == true)
        #expect(h.0.room?.revision == legitimateSnapshot?.revision)
    }

    @Test func silentHandshakeTimesOutEvenWithTransportHeartbeats() async throws {
        let h = session("房主", timing: .init(helloTimeout: 0.15))
        let silent = LANTransport(timing: .init(heartbeatInterval: 0.05, idleTimeout: 2))
        defer { cleanup([h]); silent.stop() }
        h.0.createRoom(.bombs); try await wait("listener") { h.0.hostingReady }
        var timedOut = false, closed = false
        silent.onMessage = { _, message in if case .error(let message) = message { timedOut = message.contains("超时") } }
        silent.onDisconnected = { _ in closed = true }
        silent.connect(to: try endpoint(h.0, h.1))
        try await wait("hello timeout") { timedOut && closed }
        #expect(h.0.room?.members.count == 1)
        #expect(h.1.connectionCount == 0)
    }

    @Test func incompleteByteDripsDoNotExtendTransportDeadline() async throws {
        let transport = LANTransport(timing: .init(heartbeatInterval: 0.05, idleTimeout: 0.2))
        defer { transport.stop() }
        var listening = false, connected = false, disconnected = false
        transport.onListening = { listening = true }
        transport.onConnected = { _ in connected = true }
        transport.onDisconnected = { _ in disconnected = true }
        try transport.host(roomID: UUID().uuidString, name: "超时测试")
        try await wait("listener") { listening }
        let raw = NWConnection(host: .ipv4(.loopback), port: try #require(transport.listeningPort), using: .tcp)
        defer { raw.cancel() }
        raw.start(queue: .main)
        try await wait("raw connection") { connected }
        raw.send(content: Data([0, 0, 1, 0]), completion: .contentProcessed { _ in })
        let drip = Task { @MainActor in
            for _ in 0..<30 {
                try await Task.sleep(for: .milliseconds(30))
                raw.send(content: Data([32]), completion: .contentProcessed { _ in })
            }
        }
        defer { drip.cancel() }
        try await wait("partial-frame deadline", timeout: 1) { disconnected }
        #expect(transport.connectionCount == 0)
    }

    @Test func realBonjourFindsPublishedRoomAndConnectsByServiceEndpoint() async throws {
        let host = LANTransport(), browser = LANTransport()
        defer { host.stop(); browser.stop() }
        let roomID = UUID().uuidString
        var found: NearbyRoom?, replied = false
        browser.onRooms = { rooms in found = rooms.first { $0.id == roomID } }
        host.onMessage = { id, message in if case .error(let text) = message { host.send(.error("reply:" + text), to: id) } }
        browser.onConnected = { id in browser.send(.error("probe"), to: id) }
        browser.onMessage = { _, message in if case .error(let text) = message { replied = text == "reply:probe" } }
        browser.browse(); try host.host(roomID: roomID, name: "桌游发现测试")
        try await wait("Bonjour service discovery", timeout: 8) { found != nil }
        browser.connect(to: try #require(found))
        try await wait("Bonjour endpoint roundtrip") { replied }
    }

    @Test func credentialsAreStableWithinRoomButNeverSharedAcrossRooms() async throws {
        let c = session("来宾")
        let hostA = LANTransport(), hostB = LANTransport()
        defer { cleanup([c]); hostA.stop(); hostB.stop() }
        let a = UUID().uuidString, b = UUID().uuidString
        var tokensA: [String] = [], tokensB: [String] = []
        var listeningA = false, listeningB = false
        hostA.onListening = { listeningA = true }; hostB.onListening = { listeningB = true }
        hostA.onMessage = { _, message in if case .hello(_, _, _, let token) = message { tokensA.append(token) } }
        hostB.onMessage = { _, message in if case .hello(_, _, _, let token) = message { tokensB.append(token) } }
        try hostA.host(roomID: a, name: "A"); try hostB.host(roomID: b, name: "B")
        try await wait("listeners") { listeningA && listeningB }
        let roomA = NearbyRoom(id: a, name: "A", endpoint: .hostPort(host: .ipv4(.loopback), port: try #require(hostA.listeningPort)))
        let roomB = NearbyRoom(id: b, name: "B", endpoint: .hostPort(host: .ipv4(.loopback), port: try #require(hostB.listeningPort)))
        c.0.join(roomA); try await wait("credential A") { tokensA.count == 1 }
        c.0.join(roomB); try await wait("credential B") { tokensB.count == 1 }
        c.0.join(roomA); try await wait("reused room credential") { tokensA.count == 2 }
        #expect(tokensA[0] == tokensA[1])
        #expect(tokensA[0] != tokensB[0])
    }
    @Test func authenticatedReplacementDoesNotMarkSeatOffline() async throws {
        let h = session("房主")
        let original = LANTransport(), replacement = LANTransport()
        defer { cleanup([h]); original.stop(); replacement.stop() }
        h.0.createRoom(.bombs); try await wait("listener") { h.0.hostingReady }
        let target = try endpoint(h.0, h.1), guest = Player(name: "来宾"), token = UUID().uuidString
        var originalSnapshot: RoomSnapshot?, replacementSnapshot: RoomSnapshot?, retired = false
        original.onConnected = { id in original.send(.hello(version: WireMessage.version, roomID: target.id, player: guest, reconnectToken: token), to: id) }
        original.onMessage = { _, message in
            if case .snapshot(let snapshot) = message { originalSnapshot = snapshot }
            if case .closed = message { retired = true }
        }
        original.connect(to: target); try await wait("first connection") { originalSnapshot != nil }
        let before = try #require(h.0.room?.revision)
        replacement.onConnected = { id in replacement.send(.hello(version: WireMessage.version, roomID: target.id, player: guest, reconnectToken: token), to: id) }
        replacement.onMessage = { _, message in if case .snapshot(let snapshot) = message { replacementSnapshot = snapshot } }
        replacement.connect(to: target)
        try await wait("authenticated takeover") { replacementSnapshot != nil && retired }
        #expect(h.0.room?.revision == before + 1)
        #expect(h.0.room?.members.count == 2)
        #expect(h.0.room?.members.first { $0.id == guest.id }?.connected == true)
        #expect(h.1.connectionCount == 1)
    }

    @Test func establishedConnectionWithoutSnapshotHitsClientHandshakeDeadline() async throws {
        let server = LANTransport(), c = session("来宾", timing: .init(connectTimeout: 0.15))
        defer { cleanup([c]); server.stop() }
        var ready = false, hello = false
        let roomID = UUID().uuidString
        server.onListening = { ready = true }
        server.onMessage = { _, message in if case .hello = message { hello = true } }
        try server.host(roomID: roomID, name: "不响应的房主")
        try await wait("listener") { ready }
        c.0.join(NearbyRoom(id: roomID, name: "不响应的房主", endpoint: .hostPort(host: .ipv4(.loopback), port: try #require(server.listeningPort))))
        try await wait("outgoing hello") { hello }
        try await wait("client handshake timeout") { !c.0.connecting && c.0.error != nil }
        #expect(c.0.room == nil)
        #expect(!c.0.reconnecting)
    }

    @Test func gracefulFinalMessageFollowsAllQueuedMessages() async throws {
        let host = LANTransport(), client = LANTransport()
        defer { host.stop(); client.stop() }
        var ready = false, received: [String] = [], closed = false
        host.onListening = { ready = true }
        host.onConnected = { id in
            for number in 0..<32 { host.send(.error(String(number)), to: id) }
            host.sendThenClose(.closed("done"), to: id)
        }
        client.onMessage = { _, message in
            if case .error(let value) = message { received.append(value) }
            if case .closed(let value) = message { received.append(value) }
        }
        client.onDisconnected = { _ in closed = true }
        let roomID = UUID().uuidString
        try host.host(roomID: roomID, name: "消息排空")
        try await wait("listener") { ready }
        client.connect(to: NearbyRoom(id: roomID, name: "消息排空", endpoint: .hostPort(host: .ipv4(.loopback), port: try #require(host.listeningPort))))
        try await wait("all messages then EOF") { closed }
        let expected = (0..<32).map { String($0) } + ["done"]
        #expect(received == expected)
    }

}
