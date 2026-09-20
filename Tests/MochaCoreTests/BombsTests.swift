import Foundation
import Testing
@testable import MochaCore

struct BombsTests {
    func players(_ count: Int = 3) -> [Player] { (0..<count).map { Player(id: "p\($0)", name: "玩家\($0)") } }
    func game(_ count: Int = 3, seed: UInt64 = 42) throws -> BombsEngine { try BombsEngine(players: players(count), seed: seed) }
    func setHand(_ kinds: [BombsEngine.CardKind], for player: String, in engine: inout BombsEngine) {
        engine.hands[player] = kinds.map { engine.makeCard($0) }
    }
    func play(_ kind: BombsEngine.CardKind, in engine: inout BombsEngine) throws {
        let id = engine.hands[engine.current]!.first { $0.kind == kind }!.id
        try engine.apply(GameCommand("play", values: [id]), by: engine.current)
    }
    func passAll(_ engine: inout BombsEngine) throws {
        for id in engine.alive { try engine.apply(GameCommand("pass"), by: id) }
    }
    func snapshot(_ engine: BombsEngine) -> [GameView] { engine.players.map { engine.view(for: $0.id) } }

    @Test func testSafeSetupForEveryPlayerCountAndDeterministicSeed() throws {
        for count in 2...5 {
            let engine = try game(count)
            let duplicate = try game(count)
            #expect((snapshot(engine)) == (snapshot(duplicate)))
            #expect((engine.deck.filter { $0.kind == .bomb }.count) == (count - 1))
            #expect((engine.deck.filter { $0.kind == .defuse }.count) == (min(2, 6 - count)))
            for hand in engine.hands.values {
                #expect((hand.count) == (8))
                #expect((hand.filter { $0.kind == .defuse }.count) == (1))
                #expect(!(hand.contains { $0.kind == .bomb }))
            }
            let cards = engine.deck + engine.hands.values.flatMap { $0 }
            #expect((Set(cards.map(\.id)).count) == (cards.count))
        }
        #expect(throws: (any Error).self) { try game(1) }
        #expect(throws: (any Error).self) { try game(6) }
        #expect(throws: (any Error).self) { try BombsEngine(players: [players()[0], players()[0]], seed: 1) }
    }
    @Test func testAttackStacksIncludingFinalOutstandingTurnAndSkipConsumesOne() throws {
        var engine = try game()
        setHand([.attack], for: "p0", in: &engine)
        setHand([.skip, .attack], for: "p1", in: &engine)
        setHand([.attack], for: "p2", in: &engine)
        try play(.attack, in: &engine); try passAll(&engine)
        #expect((engine.current) == ("p1")); #expect((engine.turnsRemaining) == (2))
        try play(.skip, in: &engine); try passAll(&engine)
        #expect((engine.current) == ("p1")); #expect((engine.turnsRemaining) == (1))
        try play(.attack, in: &engine); try passAll(&engine)
        #expect((engine.current) == ("p2")); #expect((engine.turnsRemaining) == (3))
        try play(.attack, in: &engine); try passAll(&engine)
        #expect((engine.current) == ("p0")); #expect((engine.turnsRemaining) == (5))
    }
    @Test func testNopeBarrierRestartsAndRenopingRestoresEffect() throws {
        var engine = try game()
        setHand([.attack, .nope], for: "p0", in: &engine)
        setHand([.nope], for: "p1", in: &engine)
        try play(.attack, in: &engine)
        try engine.apply(GameCommand("pass"), by: "p2")
        try engine.apply(GameCommand("nope", values: [engine.hands["p1"]![0].id]), by: "p1")
        #expect((engine.view(for: "p2").actions.contains { $0.id == "pass" }))
        try engine.apply(GameCommand("nope", values: [engine.hands["p0"]![0].id]), by: "p0")
        try engine.apply(GameCommand("pass"), by: "p0")
        try engine.apply(GameCommand("pass"), by: "p1")
        #expect((engine.current) == ("p0"))
        try engine.apply(GameCommand("pass"), by: "p2")
        #expect((engine.current) == ("p1")); #expect((engine.turnsRemaining) == (2))
        #expect((engine.discard.count) == (3))
    }
    @Test func testCancelledAttackDoesNotChangeDebtAndInvalidCommandsAreAtomic() throws {
        var engine = try game()
        setHand([.attack], for: "p0", in: &engine)
        setHand([.nope], for: "p1", in: &engine)
        try play(.attack, in: &engine)
        let before = snapshot(engine)
        for command in [GameCommand("draw"), GameCommand("pass", values: ["x"]), GameCommand("nope", values: ["foreign-card"])] {
            #expect(throws: (any Error).self) { try engine.apply(command, by: "p1") }
            #expect((snapshot(engine)) == (before))
        }
        try engine.apply(GameCommand("nope", values: [engine.hands["p1"]![0].id]), by: "p1")
        try passAll(&engine)
        #expect((engine.current) == ("p0")); #expect((engine.turnsRemaining) == (1))
        #expect(!(engine.attacked))
    }
    @Test func testFavorUsesTargetsChoiceAndNeverRevealsTransferredCardToThirdPlayer() throws {
        var engine = try game()
        setHand([.favor], for: "p0", in: &engine)
        setHand([.defuse, .sunCat], for: "p1", in: &engine)
        let secret = engine.hands["p1"]![0]
        try play(.favor, in: &engine)
        try engine.apply(GameCommand("target", values: ["p1"]), by: "p0")
        try passAll(&engine)
        #expect((engine.view(for: "p0").actions.isEmpty))
        #expect((engine.view(for: "p1").actions.first?.id) == ("give"))
        #expect(throws: (any Error).self) { try engine.apply(GameCommand("give", values: [secret.id]), by: "p0") }
        try engine.apply(GameCommand("give", values: [secret.id]), by: "p1")
        #expect((engine.hands["p0"]) == ([secret]))
        let encoded = String(data: try JSONEncoder().encode(engine.view(for: "p2")), encoding: .utf8)!
        #expect(!(encoded.contains(secret.id)))
        #expect(!(engine.history.last!.contains("拆弹")))
    }
    @Test func testFutureAndReinsertArePrivateAndDefuseFinishesOnlyOneAttackTurn() throws {
        var engine = try game()
        setHand([.future, .defuse], for: "p0", in: &engine)
        engine.deck = [.bomb, .starCat, .shuffle].map { engine.makeCard($0) }
        let top = engine.deck
        try play(.future, in: &engine); try passAll(&engine)
        #expect((engine.deck) == (top))
        #expect((engine.view(for: "p0").sections.first { $0.id == "future" }?.items.count) == (3))
        #expect(!(engine.view(for: "p1").sections.contains { $0.id == "future" }))
        try engine.apply(GameCommand("done"), by: "p0")
        engine.attacked = true; engine.turnsRemaining = 2
        try engine.apply(GameCommand("draw"), by: "p0")
        #expect(!(engine.view(for: "p1").actions.contains { $0.id == "nope" }))
        try engine.apply(GameCommand("defuse"), by: "p0")
        #expect((engine.view(for: "p1").actions.isEmpty))
        var otherPosition = engine
        try engine.apply(GameCommand("insert", values: ["0"]), by: "p0")
        try otherPosition.apply(GameCommand("insert", values: ["2"]), by: "p0")
        #expect((engine.view(for: "p1")) == (otherPosition.view(for: "p1")))
        #expect((engine.current) == ("p0")); #expect((engine.turnsRemaining) == (1))
        #expect((engine.deck.first?.kind) == (.bomb))
        try engine.apply(GameCommand("draw"), by: "p0")
        #expect(!(engine.alive.contains("p0")))
        #expect((engine.current) == ("p1")); #expect((engine.turnsRemaining) == (1))
        #expect((engine.hands["p0"]!.isEmpty))
    }
    @Test func testPairsTriplesAndNoMatch() throws {
        var engine = try game()
        setHand([.skip, .skip, .leafCat, .leafCat, .leafCat], for: "p0", in: &engine)
        setHand([.defuse], for: "p1", in: &engine)
        try engine.apply(GameCommand("pair", values: ["skip"]), by: "p0")
        try engine.apply(GameCommand("target", values: ["p1"]), by: "p0"); try passAll(&engine)
        #expect((engine.hands["p0"]!.contains { $0.kind == .defuse }))
        #expect((engine.current) == ("p0"))
        setHand([.nope], for: "p1", in: &engine)
        try engine.apply(GameCommand("triple", values: ["leafCat"]), by: "p0")
        try engine.apply(GameCommand("target", values: ["p1"]), by: "p0")
        try engine.apply(GameCommand("request", values: ["defuse"]), by: "p0"); try passAll(&engine)
        #expect((engine.hands["p0"]!.count) == (1))
        #expect((engine.hands["p1"]!.count) == (1))
        #expect((engine.discard.count) == (5))
    }
    @Test func testTripleCanTakeNamedCardAndComboCanBeNoped() throws {
        var engine = try game()
        setHand([.moonCat, .moonCat, .moonCat, .skip, .skip], for: "p0", in: &engine)
        setHand([.defuse, .nope], for: "p1", in: &engine)
        try engine.apply(GameCommand("triple", values: ["moonCat"]), by: "p0")
        try engine.apply(GameCommand("target", values: ["p1"]), by: "p0")
        try engine.apply(GameCommand("request", values: ["defuse"]), by: "p0"); try passAll(&engine)
        #expect((engine.hands["p0"]!.contains { $0.kind == .defuse }))
        try engine.apply(GameCommand("pair", values: ["skip"]), by: "p0")
        try engine.apply(GameCommand("target", values: ["p1"]), by: "p0")
        try engine.apply(GameCommand("nope", values: [engine.hands["p1"]![0].id]), by: "p1"); try passAll(&engine)
        #expect((engine.hands["p0"]!.count) == (1))
        #expect((engine.discard.count) == (6))
    }
    @Test func testShufflePreservesDeckAndInvalidChoiceDoesNotConsumeCard() throws {
        var engine = try game()
        setHand([.shuffle, .favor], for: "p0", in: &engine)
        let original = Set(engine.deck.map(\.id))
        let originalOrder = engine.deck
        try play(.shuffle, in: &engine); try passAll(&engine)
        #expect((Set(engine.deck.map(\.id))) == (original))
        #expect((engine.deck) != (originalOrder))
        try play(.favor, in: &engine)
        let before = snapshot(engine)
        #expect(throws: (any Error).self) { try engine.apply(GameCommand("target", values: ["p0"]), by: "p0") }
        #expect((snapshot(engine)) == (before))
        try engine.apply(GameCommand("cancel"), by: "p0")
        #expect((engine.hands["p0"]!.count) == (1))
    }
    @Test func testCompleteMatchesViaEveryProjectedAction() throws {
        var coveredActions: Set<String> = []
        for count in 2...5 {
            for seed in 0..<30 {
                var engine = try game(count, seed: UInt64(seed))
                var random = SeededGenerator(seed: UInt64(seed + 100))
                var steps = 0
                while !engine.isFinished && steps < 2000 {
                    var available: [(String, ActionPrompt)] = []
                    for player in engine.players {
                        for action in engine.view(for: player.id).actions {
                            #expect(Set(action.choices.map(\.id)).count == action.choices.count)
                            #expect(action.min <= action.max)
                            #expect(action.max <= action.choices.count)
                            available.append((player.id, action))
                        }
                    }
                    #expect(!(available.isEmpty))
                    let selected = available[Int.random(in: 0..<available.count, using: &random)]
                    let values = selected.1.min == 0 ? [] : [selected.1.choices[Int.random(in: 0..<selected.1.choices.count, using: &random)].id]
                    coveredActions.insert(selected.1.id)
                    try engine.apply(GameCommand(selected.1.id, values: values), by: selected.0)
                    steps += 1
                    // A living game always has one bomb per eventual loser, possibly waiting for insertion.
                    var pendingBomb = 0
                    if case .bomb = engine.phase { pendingBomb = 1 }
                    if case .insert = engine.phase { pendingBomb = 1 }
                    #expect((engine.deck.filter { $0.kind == .bomb }.count + pendingBomb) == (engine.alive.count - 1))
                    #expect((engine.turnsRemaining) > (0))
                }
                #expect((engine.isFinished) , "count \(count), seed \(seed), steps \(steps)")
                #expect((engine.alive.count) == (1))
                #expect((engine.players.allSatisfy { engine.view(for: $0.id).actions.isEmpty }))
            }
        }
        #expect(coveredActions == Set(["draw", "play", "pair", "triple", "target", "request", "cancel", "pass", "nope", "give", "done", "defuse", "explode", "insert"]))
    }
    @Test func testUnknownViewerHasNoPrivateInformation() throws {
        let engine = try game()
        let view = engine.view(for: "stranger")
        #expect(!(view.sections.contains { $0.isPrivate }))
        #expect((view.actions.isEmpty))
    }
}
