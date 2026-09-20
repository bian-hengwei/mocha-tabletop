import Foundation
import Testing
@testable import MochaCore

struct ProjectionTests {
    func players(_ count: Int) -> [Player] {
        (0..<count).map { Player(id: UUID().uuidString, name: "投影玩家\($0)") }
    }
    func role(_ game: any GameEngine, _ id: String) -> String? {
        game.view(for: id).sections.first { $0.id == "identity" }?.items.first { $0.id == "role" }?.title
    }
    /// Mirrors ActionSheet: selections are a Set; transmitted values follow choice display order.
    func uiCommand(_ prompt: ActionPrompt, selected: [String]) throws -> GameCommand {
        let selection = Set(selected)
        #expect(selection.count == selected.count)
        #expect((prompt.min...prompt.max).contains(selection.count))
        let values = prompt.choices.filter { selection.contains($0.id) }.map(\.id)
        #expect(values.count == selected.count)
        return GameCommand(prompt.id, values: values)
    }
    func validate(_ view: GameView) throws {
        #expect(Set(view.actions.map(\.id)).count == view.actions.count)
        #expect(Set(view.sections.map(\.id)).count == view.sections.count)
        for action in view.actions {
            #expect(action.min >= 0)
            #expect(action.max >= action.min)
            #expect(action.max <= action.choices.count)
            #expect(Set(action.choices.map(\.id)).count == action.choices.count)
        }
        for section in view.sections { #expect(Set(section.items.map(\.id)).count == section.items.count) }
        let encoded = try JSONEncoder().encode(view)
        #expect(try JSONDecoder().decode(GameView.self, from: encoded) == view)
    }
    @Test func allInitialViewsAndRoomWireRoundTripAreRecipientSpecific() throws {
        for kind in GameKind.allCases {
            let ps = players(kind.playerRange.lowerBound)
            let host = try RoomHost(host: ps[0], factory: { kind, players, _ in try GameRegistry.make(kind, players: players, seed: 17) })
            try host.handle(RoomRequest(revision: host.revision, action: .selectGame(kind)), from: ps[0].id)
            for player in ps.dropFirst() {
                try host.join(player, token: UUID().uuidString)
                try host.handle(RoomRequest(revision: host.revision, action: .ready(true)), from: player.id)
            }
            try host.handle(RoomRequest(revision: host.revision, action: .start), from: ps[0].id)
            let engine = try #require(host.engine)
            #expect(host.snapshot(for: "not-a-player").game == nil)
            for player in ps {
                let snapshot = host.snapshot(for: player.id)
                let view = try #require(snapshot.game)
                #expect(view == engine.view(for: player.id))
                try validate(view)
                let frame = try MessageFramer.encode(.snapshot(snapshot))
                var decoder = MessageFramer()
                let messages = try decoder.append(frame)
                #expect(messages.count == 1)
                guard case .snapshot(let received) = try #require(messages.first) else { Issue.record("Expected a snapshot"); continue }
                #expect(received == snapshot)
                if kind == .bombs {
                    let ownIDs = Set(view.sections.first { $0.id == "hand" }!.items.map(\.id))
                    let wire = String(decoding: frame.dropFirst(4), as: UTF8.self)
                    for other in ps where other.id != player.id {
                        for secret in engine.view(for: other.id).sections.first(where: { $0.id == "hand" })!.items {
                            #expect(!ownIDs.contains(secret.id))
                            // Search complete JSON string values, not substrings of numeric IDs.
                            #expect(!wire.contains("\"" + secret.id + "\""))
                        }
                    }
                } else if kind == .werewolf || kind == .avalon {
                    let identities = view.sections.filter { $0.id == "identity" }
                    #expect(identities.count == 1 && identities[0].isPrivate)
                    #expect(identities[0].items.first { $0.id == "role" }?.title == role(engine, player.id))
                    #expect(!view.sections.filter { !$0.isPrivate }.flatMap(\.items).contains { $0.id == "role" })
                }
            }
        }
    }
    @Test func bombsPublicCardIDsCannotRevealOrConsumeShuffleRandomness() throws {
        let ps = players(3)
        var game = try BombsEngine(players: ps, seed: 17)
        let otherSeed = try BombsEngine(players: ps, seed: 123456)
        // All players' initial defuse cards have seed-independent IDs.
        for player in ps {
            #expect(game.hands[player.id]!.first!.id == otherSeed.hands[player.id]!.first!.id)
            #expect(game.hands[player.id]!.first!.id.hasPrefix("bombs-card-"))
        }
        var expected = game.rng
        let first = game.makeCard(.nope)
        let second = game.makeCard(.skip)
        #expect(first.id != second.id)
        #expect(game.rng.next() == expected.next())
    }
    @Test func werewolfNightSubmissionsDoNotChangeOtherPlayersPublicViews() throws {
        let ps = players(12)
        var game = try WerewolfEngine(players: ps, seed: 41)
        for player in ps where game.view(for: player.id).actions.contains(where: { $0.id == "signup" }) { try game.apply(GameCommand("signup", values: ["no"]), by: player.id) }
        let seer = try #require(ps.first { role(game, $0.id) == "预言家" })
        let observer = try #require(ps.first { role(game, $0.id) == "平民" })
        let target = try #require(ps.first { role(game, $0.id) == "狼人" })
        let before = game.view(for: observer.id)
        try game.apply(GameCommand("inspect", values: [target.id]), by: seer.id)
        #expect(game.view(for: observer.id) == before)
        #expect(game.view(for: seer.id).sections.first { $0.id == "identity" }!.items.contains { $0.id == "check:" + target.id && $0.detail == "狼人" })
        for player in ps where player.id != seer.id {
            #expect(!game.view(for: player.id).sections.flatMap(\.items).contains { $0.id == "check:" + target.id })
        }
        for player in ps where player.id != seer.id {
            let action = try #require(game.view(for: player.id).actions.first)
            let values: [String] = action.id == "wolf" ? [observer.id] : action.min == 0 ? [] : ["skip"]
            try game.apply(try uiCommand(action, selected: values), by: player.id)
        }
        let witch = try #require(ps.first { role(game, $0.id) == "女巫" })
        for player in ps {
            let view = game.view(for: player.id)
            try validate(view)
            if player.id == witch.id {
                #expect(view.actions.first?.help.contains("今晚刀口：" + observer.name) == true)
            } else {
                let wire = String(decoding: try JSONEncoder().encode(view), as: UTF8.self)
                #expect(!wire.contains("今晚刀口"))
                #expect(!view.actions.contains { $0.id == "potion" })
            }
        }
    }
    @Test func avalonVotesAndMissionsRemainPrivateUntilEveryoneSubmits() throws {
        let ps = players(5)
        var game = try AvalonEngine(players: ps, seed: 9)
        let leader = try #require(ps.first { !game.view(for: $0.id).actions.isEmpty })
        let propose = game.view(for: leader.id).actions[0]
        let team = Array(ps.prefix(propose.min))
        try game.apply(try uiCommand(propose, selected: team.reversed().map(\.id)), by: leader.id)
        let observer = ps.last!
        let beforeVote = game.view(for: observer.id)
        try game.apply(GameCommand("approve", values: ["yes"]), by: ps[0].id)
        #expect(game.view(for: observer.id) == beforeVote)
        for player in ps.dropFirst() { try game.apply(GameCommand("approve", values: ["yes"]), by: player.id) }
        let beforeMission = game.view(for: observer.id)
        let action = try #require(game.view(for: team[0].id).actions.first)
        try game.apply(try uiCommand(action, selected: ["success"]), by: team[0].id)
        #expect(game.view(for: observer.id) == beforeMission)
        for player in team.dropFirst() { try game.apply(GameCommand("mission", values: ["success"]), by: player.id) }
        #expect(game.view(for: observer.id).log.last?.contains("任务成功") == true)
        for player in ps { try validate(game.view(for: player.id)) }
    }
    @Test func bombsFutureAndGiveChoicesOnlyReachCorrectPlayer() throws {
        let ps = players(3)
        var game = try BombsEngine(players: ps, seed: 9)
        let actor = ps[0], target = ps[1], observer = ps[2]
        game.phase = .future(Array(game.deck.prefix(3)))
        for player in ps {
            let view = game.view(for: player.id)
            try validate(view)
            #expect(view.sections.contains { $0.id == "future" } == (player.id == actor.id))
            #expect(view.actions.contains { $0.id == "done" } == (player.id == actor.id))
        }
        game.phase = .give(actor: actor.id, target: target.id)
        let prompt = try #require(game.view(for: target.id).actions.first)
        #expect(Set(prompt.choices.map(\.id)) == Set(game.hands[target.id]!.map(\.id)))
        #expect(game.view(for: actor.id).actions.isEmpty)
        #expect(game.view(for: observer.id).actions.isEmpty)
        let targetIDs = game.hands[target.id]!.map(\.id)
        for player in [actor, observer] {
            let json = String(decoding: try JSONEncoder().encode(game.view(for: player.id)), as: UTF8.self)
            #expect(targetIDs.allSatisfy { !json.contains("\"" + $0 + "\"") })
        }
        try game.apply(try uiCommand(prompt, selected: [targetIDs[0]]), by: target.id)
    }
    @Test func gemsUIOrderSupportsCustomPaymentAndMultipleSameColorDiscard() throws {
        let ps = players(2)
        var game = try GemsEngine(players: ps, seed: 9)
        let card = GemsEngine.Card(id: "fixture", tier: 1, bonus: 0, points: 0, cost: [1,1,0,0,0])
        game.merchants[0].reserved = [card]
        game.merchants[0].tokens = [2,1,0,0,0,1]
        try game.apply(GameCommand("buy", values: [card.id]), by: ps[0].id)
        let payment = try #require(game.view(for: ps[0].id).actions.first { $0.id == "pay_custom" })
        let command = try uiCommand(payment, selected: ["gold:0", "blue:0"])
        #expect(command.values == ["blue:0", "gold:0"])
        try game.apply(command, by: ps[0].id)
        #expect(game.merchants[0].tokens == [2,0,0,0,0,0])
        game.current = 0
        game.merchants[0].tokens = [3,3,2,2,2,0]
        game.phase = .discard
        let discard = try #require(game.view(for: ps[0].id).actions.first)
        try game.apply(try uiCommand(discard, selected: ["white:2", "white:0"]), by: ps[0].id)
        #expect(game.merchants[0].tokens.reduce(0,+) == 10)
        #expect(game.merchants[0].tokens[0] == 1)
    }
}
