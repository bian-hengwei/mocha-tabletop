import Foundation
import Testing
@testable import MochaCore

struct RoomTests {
    func player(_ name: String) -> Player { Player(name: name) }
    func setup(_ kind: GameKind = .gems, count: Int = 2) throws -> (RoomHost, [Player], [String]) {
        let players = (0..<count).map { player("玩家\($0 + 1)") }
        let tokens = players.map { _ in UUID().uuidString }
        let host = try RoomHost(host: players[0], factory: GameRegistry.make)
        try host.handle(RoomRequest(revision: host.revision, action: .selectGame(kind)), from: players[0].id)
        for i in 1..<count { try host.join(players[i], token: tokens[i]) }
        return (host, players, tokens)
    }
    func request(_ action: RoomAction, _ host: RoomHost, _ player: Player) throws {
        try host.handle(RoomRequest(revision: host.revision, action: action), from: player.id)
    }
    func rejected(_ body: () throws -> Void) {
        do { try body(); Issue.record("Expected rejection") } catch {}
    }

    @Test func identityValidation() throws {
        let p = player("  森林  ")
        #expect(try ProfileCatalog.validated(p).name == "森林")
        rejected { _ = try ProfileCatalog.validated(Player(name: "\n")) }
        rejected { _ = try ProfileCatalog.validated(Player(name: String(repeating: "A", count: 17))) }
        rejected { _ = try ProfileCatalog.validated(Player(id: "not-a-uuid", name: "a")) }
        rejected { _ = try ProfileCatalog.validated(Player(name: "a", avatar: "<script>")) }
    }

    @Test func readyStartAndAuthority() throws {
        let (host, players, _) = try setup()
        rejected { try request(.start, host, players[0]) }
        rejected { try request(.selectGame(.bombs), host, players[1]) }
        try request(.ready(true), host, players[1])
        rejected { try request(.start, host, players[1]) }
        #expect(host.snapshot(for: players[0].id).canStart)
        try request(.start, host, players[0])
        #expect(host.engine?.kind == .gems)
        rejected { try request(.ready(false), host, players[1]) }
        rejected { try request(.removePlayer(players[1].id), host, players[0]) }
        rejected { try host.join(player("访客"), token: UUID().uuidString) }
        rejected { try request(.returnToLobby, host, players[1]) }
        try request(.returnToLobby, host, players[0])
        #expect(host.engine == nil)
        #expect(!host.members[1].ready)
    }

    @Test func twelveSeatsReconnectAndPause() throws {
        let (host, players, tokens) = try setup(.werewolf, count: 12)
        rejected { try host.join(player("第13位"), token: UUID().uuidString) }
        for player in players.dropFirst() { try request(.ready(true), host, player) }
        try request(.start, host, players[0])
        #expect(host.snapshot(for: players[0].id).members.count == 12)
        let beforeGame = host.snapshot(for: players[0].id).game
        host.disconnect(players[3].id)
        #expect(host.snapshot(for: players[0].id).paused)
        rejected { try request(.play(GameCommand("anything")), host, players[0]) }
        rejected { try host.join(players[3], token: UUID().uuidString) }
        #expect(host.snapshot(for: players[0].id).paused)
        try host.join(Player(id: players[3].id, name: "假新名字"), token: tokens[3])
        #expect(!host.snapshot(for: players[0].id).paused)
        #expect(host.members[3].player.name == players[3].name)
        #expect(host.snapshot(for: players[0].id).game == beforeGame)
    }

    @Test func replayAndStaleCommandsCannotChangeState() throws {
        let (host, players, _) = try setup()
        let ready = RoomRequest(revision: host.revision, action: .ready(true))
        try host.handle(ready, from: players[1].id)
        let after = host.snapshot(for: players[1].id)
        try host.handle(ready, from: players[1].id)
        #expect(host.snapshot(for: players[1].id) == after)
        rejected { try host.handle(RoomRequest(revision: 0, action: .ready(false)), from: players[1].id) }
        #expect(host.snapshot(for: players[1].id) == after)
        try request(.start, host, players[0])
        let snapshot = host.snapshot(for: players[0].id)
        rejected { try request(.play(GameCommand("malicious", values: ["x", "x"])), host, players[0]) }
        #expect(host.snapshot(for: players[0].id) == snapshot)
        #expect(host.snapshot(for: UUID().uuidString).game == nil)
    }

    @Test func lobbyChangesResetReadyAndRemovedCredentials() throws {
        let (host, players, tokens) = try setup()
        try request(.ready(true), host, players[1])
        try request(.selectGame(.bombs), host, players[0])
        #expect(!host.members[1].ready)
        rejected { try host.join(Player(id: UUID().uuidString, name: players[0].name), token: UUID().uuidString) }
        rejected { try host.join(players[0], token: tokens[0]) }
        try request(.removePlayer(players[1].id), host, players[0])
        #expect(host.members.count == 1)
        try host.join(players[1], token: UUID().uuidString)
        #expect(!host.members[1].ready)
    }

    @Test func intentionalLeaveRemovesLobbySeatButPreservesMatch() throws {
        let (host, players, tokens) = try setup()
        host.leave(players[1].id)
        #expect(host.members.count == 1)
        try host.join(players[1], token: tokens[1])
        try request(.ready(true), host, players[1])
        try request(.start, host, players[0])
        host.leave(players[1].id)
        #expect(host.members.count == 2)
        #expect(host.snapshot(for: players[0].id).paused)
        try host.join(players[1], token: tokens[1])
        #expect(!host.snapshot(for: players[0].id).paused)
    }

    func start(_ host: RoomHost, _ players: [Player]) throws {
        for player in players.dropFirst() { try request(.ready(true), host, player) }
        try request(.start, host, players[0])
    }
    func playRequest(_ command: GameCommand, snapshot: RoomSnapshot, id: String = UUID().uuidString) -> RoomRequest {
        RoomRequest(id: id, revision: snapshot.revision, actionRevision: snapshot.actionRevision, action: .play(command))
    }

    @Test func allTwelveSimultaneousNightActionsAreAcceptedFromOneGlobalRevision() throws {
        let (host, players, _) = try setup(.werewolf, count: 12)
        try start(host, players)
        let snapshots = players.map { host.snapshot(for: $0.id) }
        let queued = try snapshots.map { snapshot -> RoomRequest in
            let action = try #require(snapshot.game?.actions.first)
            let values = action.min == 0 ? [] : [try #require(action.choices.first { $0.id == "skip" }).id]
            return playRequest(GameCommand(action.id, values: values), snapshot: snapshot)
        }
        let initialRevision = host.revision
        // All requests were formed before any player submitted. Role knowledge / private logs
        // may update, but an unsubmitted player's own available action remains valid.
        for i in players.indices.reversed() {
            #expect(host.snapshot(for: players[i].id).actionRevision == snapshots[i].actionRevision)
            try host.handle(queued[i], from: players[i].id)
        }
        #expect(host.revision == initialRevision + 12)
        for i in players.indices {
            #expect(host.snapshot(for: players[i].id).actionRevision > snapshots[i].actionRevision)
            #expect(host.snapshot(for: players[i].id).game?.actions.isEmpty == false)
        }
        let after = players.map { host.snapshot(for: $0.id) }
        // Network retries are still exactly-once, including after a phase transition.
        try host.handle(queued[0], from: players[0].id)
        #expect(players.map { host.snapshot(for: $0.id) } == after)
        let replay = RoomRequest(revision: queued[0].revision, actionRevision: queued[0].actionRevision, action: queued[0].action)
        rejected { try host.handle(replay, from: players[0].id) }
        #expect(players.map { host.snapshot(for: $0.id) } == after)
    }

    @Test func actionEpochRejectsABAWhenBuyingThenCancellingRestoresIdenticalPrompt() throws {
        let players = [player("先手"), player("后手")]
        let host = try RoomHost(host: players[0], factory: { _, ps, _ in
            var engine = try GemsEngine(players: ps, seed: 42)
            engine.market[0][0] = GemsEngine.Card(id: "free", tier: 1, bonus: 0, points: 0, cost: [0,0,0,0,0])
            return engine
        })
        try host.join(players[1], token: UUID().uuidString)
        try start(host, players)
        let original = host.snapshot(for: players[0].id)
        let delayed = playRequest(GameCommand("take_distinct", values: ["white", "blue", "green"]), snapshot: original)
        try request(.play(GameCommand("buy", values: ["free"])), host, players[0])
        try request(.play(GameCommand("cancel_buy")), host, players[0])
        let restored = host.snapshot(for: players[0].id)
        #expect(restored.game == original.game)
        #expect(restored.actionRevision > original.actionRevision)
        rejected { try host.handle(delayed, from: players[0].id) }
        #expect(host.snapshot(for: players[0].id) == restored)
    }

    @Test func successfulActionConsumesEpochEvenIfPhaseAndPromptsStayIdentical() throws {
        let players = [player("先手"), player("后手")]
        let host = try RoomHost(host: players[0], factory: { _, ps, _ in
            var engine = try BombsEngine(players: ps, seed: 42)
            engine.hands[ps[0].id] = [engine.makeCard(.defuse)]
            engine.deck[0] = engine.makeCard(.moonCat)
            engine.attacked = true; engine.turnsRemaining = 2
            return engine
        })
        try host.join(players[1], token: UUID().uuidString)
        try start(host, players)
        let initial = host.snapshot(for: players[0].id)
        let first = playRequest(GameCommand("draw"), snapshot: initial)
        let delayed = playRequest(GameCommand("draw"), snapshot: initial)
        try host.handle(first, from: players[0].id)
        let after = host.snapshot(for: players[0].id)
        #expect(after.game?.phase == initial.game?.phase)
        #expect(after.game?.actions == initial.game?.actions)
        #expect(after.actionRevision > initial.actionRevision)
        rejected { try host.handle(delayed, from: players[0].id) }
        try host.handle(first, from: players[0].id)
        #expect(host.snapshot(for: players[0].id) == after)
        try host.handle(playRequest(GameCommand("draw"), snapshot: after), from: players[0].id)
    }

    @Test func newMatchAndPauseResumeInvalidateOutstandingActions() throws {
        let (host, players, tokens) = try setup()
        try start(host, players)
        let initial = host.snapshot(for: players[0].id)
        let delayed = playRequest(GameCommand("take_pair", values: ["white"]), snapshot: initial)
        host.disconnect(players[1].id)
        rejected { try host.handle(delayed, from: players[0].id) }
        let paused = host.snapshot(for: players[0].id)
        #expect(paused.actionRevision > initial.actionRevision)
        try host.join(players[1], token: tokens[1])
        let resumed = host.snapshot(for: players[0].id)
        #expect(resumed.game == initial.game)
        #expect(resumed.actionRevision > paused.actionRevision)
        rejected { try host.handle(delayed, from: players[0].id) }
        let previousGameRequest = playRequest(GameCommand("take_pair", values: ["white"]), snapshot: resumed)
        try request(.returnToLobby, host, players[0])
        try start(host, players)
        let restarted = host.snapshot(for: players[0].id)
        #expect(restarted.actionRevision > resumed.actionRevision)
        rejected { try host.handle(previousGameRequest, from: players[0].id) }
        #expect(host.snapshot(for: players[0].id) == restarted)
        try host.handle(playRequest(GameCommand("take_pair", values: ["white"]), snapshot: restarted), from: players[0].id)
    }

    @Test func concurrentTokenNeverBypassesEngineValidationOrLobbyRevision() throws {
        let (host, players, _) = try setup(.werewolf, count: 12)
        let lobby = host.snapshot(for: players[1].id)
        try request(.ready(true), host, players[2])
        rejected { try host.handle(RoomRequest(revision: lobby.revision, actionRevision: lobby.actionRevision, action: .ready(true)), from: players[1].id) }
        try start(host, players)
        let initial = host.snapshot(for: players[0].id)
        let other = try #require(host.snapshot(for: players[1].id).game?.actions.first)
        let values = other.min == 0 ? [] : ["skip"]
        try request(.play(GameCommand(other.id, values: values)), host, players[1])
        #expect(host.snapshot(for: players[0].id).actionRevision == initial.actionRevision)
        let before = host.snapshot(for: players[0].id)
        rejected { try host.handle(playRequest(GameCommand("not-a-legal-action"), snapshot: initial), from: players[0].id) }
        rejected { try host.handle(RoomRequest(revision: host.revision + 1, actionRevision: before.actionRevision, action: .play(GameCommand("sleep"))), from: players[0].id) }
        rejected { try host.handle(RoomRequest(revision: initial.revision, action: .play(GameCommand("sleep"))), from: players[0].id) }
        #expect(host.snapshot(for: players[0].id) == before)
    }

    @Test func actionRevisionsRoundTripAndOptionalRequestRemainsDecodable() throws {
        #expect(WireMessage.version == 2)
        let modern = RoomRequest(revision: 20, actionRevision: 7, action: .play(GameCommand("sleep")))
        #expect(try JSONDecoder().decode(RoomRequest.self, from: JSONEncoder().encode(modern)) == modern)
        let legacy = RoomRequest(revision: 20, action: .play(GameCommand("sleep")))
        #expect(try JSONDecoder().decode(RoomRequest.self, from: JSONEncoder().encode(legacy)).actionRevision == nil)
        let (host, players, _) = try setup()
        let snapshot = host.snapshot(for: players[0].id)
        #expect(snapshot.actionRevision > 0)
        #expect(try JSONDecoder().decode(RoomSnapshot.self, from: JSONEncoder().encode(snapshot)) == snapshot)
    }

    @Test func everyWireCaseRoundTripsAcrossFragmentedTCP() throws {
        let (host, players, _) = try setup()
        let snapshot = host.snapshot(for: players[0].id)
        let messages: [WireMessage] = [
            .hello(version: WireMessage.version, roomID: host.id, player: players[1], reconnectToken: UUID().uuidString),
            .request(RoomRequest(revision: 3, action: .play(GameCommand("buy", values: ["a"])) )),
            .snapshot(snapshot), .error("中文提示💎"), .closed("房间关闭"), .leave, .ping, .pong
        ]
        var payload = Data()
        for message in messages { payload.append(try MessageFramer.encode(message)) }
        var framer = MessageFramer(), decoded: [WireMessage] = []
        for byte in payload { decoded += try framer.append(Data([byte])) }
        #expect(decoded.count == messages.count)
        let encoder = JSONEncoder(); encoder.outputFormatting = .sortedKeys
        for i in messages.indices { #expect(try encoder.encode(decoded[i]) == encoder.encode(messages[i])) }
        var coalesced = MessageFramer()
        #expect(try coalesced.append(payload).count == messages.count)
    }

    @Test func malformedAndOversizedPacketsAreRejected() throws {
        var zero = MessageFramer()
        rejected { _ = try zero.append(Data([0, 0, 0, 0])) }
        var oversized = MessageFramer()
        rejected { _ = try oversized.append(Data([255, 255, 255, 255])) }
        var invalidJSON = MessageFramer()
        rejected { _ = try invalidJSON.append(Data([0, 0, 0, 1, 33])) }
        var partial = MessageFramer()
        #expect(try partial.append(Data([0, 0, 1])).isEmpty)
        #expect(try partial.append(Data([0])).isEmpty)
    }
}
