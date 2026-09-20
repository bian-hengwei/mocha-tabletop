import Foundation
import Testing
@testable import MochaCore

struct GemsTests {
    func game(_ count: Int = 2, seed: UInt64 = 1) throws -> GemsEngine {
        try GemsEngine(players: (0..<count).map { Player(id: "p\($0)", name: "玩家\($0)") }, seed: seed)
    }
    func apply(_ game: inout GemsEngine, _ action: String, _ values: [String] = []) throws {
        try game.apply(GameCommand(action, values: values), by: game.players[game.current].id)
    }
    func card(_ id: String = "fixture", bonus: Int = 0, points: Int = 0, cost: [Int] = [0,0,0,0,0]) -> GemsEngine.Card {
        GemsEngine.Card(id: id, tier: 1, bonus: bonus, points: points, cost: cost)
    }
    @Test func testCatalogAndSetup() throws {
        expectEqual(GemsEngine.catalog.count, 90)
        expectEqual(Set(GemsEngine.catalog.map(\.id)).count, 90)
        expectEqual((1...3).map { tier in GemsEngine.catalog.filter { $0.tier == tier }.count }, [40,30,20])
        expectEqual(GemsEngine.nobleCatalog.count, 10)
        for count in 2...4 {
            let g = try game(count)
            expectEqual(g.bank, Array(repeating: [2:4,3:5,4:7][count]!, count: 5) + [5])
            expectEqual(g.market.map(\.count), [4,4,4])
            expectEqual(g.decks.map(\.count), [36,26,16])
            expectEqual(g.nobles.count, count + 1)
            expectEqual(g.view(for: "p0"), try game(count).view(for: "p0"))
        }
        expectError(try game(1))
        expectError(try GemsEngine(players: [Player(id: "x", name: "A"), Player(id: "x", name: "B")], seed: 1))
    }
    @Test func testInvalidCommandsAreAtomic() throws {
        var g = try game()
        let before = g.view(for: "p0")
        for cmd in [GameCommand("take_distinct", values: ["white","white","blue"]), GameCommand("take_distinct", values: ["white"]), GameCommand("take_pair", values: ["gold"]), GameCommand("reserve", values: ["deck:4"]), GameCommand("buy", values: ["garbage"])] {
            expectError(try g.apply(cmd, by: "p0"))
            expectEqual(g.view(for: "p0"), before)
        }
        expectError(try g.apply(GameCommand("take_pair", values: ["blue"]), by: "p1"))
        expectEqual(g.view(for: "p0"), before)
    }
    @Test func testPairThresholdAndDepletedColors() throws {
        var g = try game()
        try apply(&g, "take_pair", ["blue"])
        expectEqual(g.bank[1], 2)
        expectError(try apply(&g, "take_pair", ["blue"]))
        g.bank = [1,0,2,0,0,5]
        expectError(try apply(&g, "take_distinct", ["white"]))
        try apply(&g, "take_distinct", ["white","green"])
        expectEqual(g.merchants[1].tokens, [1,0,1,0,0,0])
    }
    @Test func testReserveLimitBlindPrivacyAndNoGold() throws {
        var g = try game()
        let hidden = g.decks[2].last!
        try apply(&g, "reserve", ["deck:3"])
        expectEqual(g.merchants[0].reserved, [hidden])
        expectEqual(g.merchants[0].tokens[5], 1)
        let outsider = try String(data: JSONEncoder().encode(g.view(for: "p1")), encoding: .utf8)!
        expectFalse(outsider.contains(hidden.id))
        expectTrue(g.view(for: "p0").sections.first { $0.id == "reserved" }!.items.contains { $0.id == hidden.id })
        expectTrue(g.view(for: "intruder").sections.isEmpty)
        g.current = 0
        g.bank[5] = 0
        try apply(&g, "reserve", ["deck:1"])
        expectEqual(g.merchants[0].tokens[5], 1)
        g.current = 0
        try apply(&g, "reserve", ["deck:2"])
        g.current = 0
        expectError(try apply(&g, "reserve", ["deck:1"]))
        expectEqual(g.merchants[0].reserved.count, 3)
    }
    @Test func testFaceUpReplacementAndEmptyDeck() throws {
        var g = try game()
        let first = g.market[0][0]
        let top = g.decks[0].last!
        try apply(&g, "reserve", [first.id])
        expectEqual(g.market[0][0], top)
        expectEqual(g.market[0].count, 4)
        expectEqual(g.decks[0].count, 35)
        g.decks[0] = []
        try apply(&g, "reserve", [g.market[0][0].id])
        expectEqual(g.market[0].count, 3)
        expectFalse(g.actionPrompts().flatMap(\.choices).contains { $0.id == "deck:1" })
    }
    @Test func testTokenOverflowMustDiscardAndDuplicateCannotReturnSameTokenTwice() throws {
        var g = try game()
        g.merchants[0].tokens = [2,2,2,2,1,0]
        try apply(&g, "take_distinct", ["white","blue","green"])
        expectEqual(g.current, 0)
        expectEqual(g.phase, .discard)
        let before = g.view(for: "p0")
        expectError(try apply(&g, "discard", ["white:0","white:0"]))
        expectEqual(g.view(for: "p0"), before)
        expectError(try apply(&g, "take_pair", ["red"]))
        try apply(&g, "discard", ["white:0","white:1"])
        expectEqual(g.merchants[0].tokens.reduce(0,+), 10)
        expectEqual(g.current, 1)
    }
    @Test func testPurchaseDiscountsAndAutomaticGold() throws {
        var g = try game()
        g.merchants[0].bought = [card("bonus")]
        let target = card("purchase", points: 1, cost: [3,1,0,0,0])
        g.market[0][0] = target
        g.merchants[0].tokens = [1,1,0,0,0,1]
        try apply(&g, "buy", [target.id])
        expectEqual(g.current, 0)
        expectEqual(g.merchants[0].bought.count, 1)
        try apply(&g, "pay_auto")
        expectEqual(g.merchants[0].tokens, [0,0,0,0,0,0])
        expectEqual(g.merchants[0].bought.last, target)
        expectEqual(g.current, 1)
    }
    @Test func testCustomGoldCanReplaceOwnedGemAndRejectOverpay() throws {
        var g = try game()
        let target = card(cost: [1,1,0,0,0])
        g.merchants[0].reserved = [target]
        g.merchants[0].tokens = [2,1,0,0,0,1]
        try apply(&g, "buy", [target.id])
        let before = g.view(for: "p0")
        expectError(try apply(&g, "pay_custom", ["white:0","white:1"]))
        expectEqual(g.view(for: "p0"), before)
        try apply(&g, "pay_custom", ["blue:0","gold:0"])
        expectEqual(g.merchants[0].tokens, [2,0,0,0,0,0])
        expectTrue(g.merchants[0].reserved.isEmpty)
    }
    @Test func testCancelPurchaseAndFreePurchase() throws {
        var g = try game()
        let target = card()
        g.market[0][0] = target
        try apply(&g, "buy", [target.id]); try apply(&g, "cancel_buy")
        expectEqual(g.current, 0)
        expectTrue(g.merchants[0].bought.isEmpty)
        try apply(&g, "buy", [target.id]); try apply(&g, "pay_custom")
        expectEqual(g.merchants[0].bought, [target])
    }
    @Test func testNobleChoiceMandatoryOnePerTurn() throws {
        var g = try game()
        g.nobles = [.init(id: "one", cost: [1,0,0,0,0]), .init(id: "two", cost: [1,0,0,0,0])]
        g.market[0][0] = card()
        try apply(&g, "buy", ["fixture"]); try apply(&g, "pay_auto")
        expectEqual(g.phase, .noble)
        expectEqual(g.current, 0)
        expectError(try apply(&g, "noble", ["one","two"]))
        try apply(&g, "noble", ["two"])
        expectEqual(g.merchants[0].score, 3)
        expectEqual(g.nobles.map(\.id), ["one"])
        expectEqual(g.current, 1)
    }
    @Test func testFinalRoundEqualTurnsAndTieBreaker() throws {
        var g = try game(3)
        g.merchants[0].bought = [card("a", points: 14), card("b", points: 1)]
        g.merchants[1].bought = [card("c", points: 15)]
        g.merchants[2].bought = [card("d", points: 14)]
        try apply(&g, "take_distinct", ["white","blue","green"])
        expectTrue(g.finalRound); expectFalse(g.isFinished)
        try apply(&g, "take_distinct", ["white","blue","green"])
        expectFalse(g.isFinished)
        try apply(&g, "take_distinct", ["white","blue","green"])
        expectTrue(g.isFinished)
        expectEqual(g.winners, ["p1"])
        expectTrue(g.view(for: "p1").actions.isEmpty)
        expectError(try apply(&g, "take_pair", ["red"]))
    }
    @Test func testSharedVictoryAndLastSeatThreshold() throws {
        var g = try game()
        g.current = 1
        g.merchants[0].bought = [card("a", points: 15)]
        g.merchants[1].bought = [card("b", points: 15)]
        try apply(&g, "take_pair", ["white"])
        expectTrue(g.isFinished)
        expectEqual(g.winners, ["p0","p1"])
    }
    @Test func testAutomatedGamesConserveComponentsAndFinish() throws {
        for playerCount in 2...4 {
            var g = try game(playerCount, seed: UInt64(playerCount))
            let supply = g.bank
            var rng = SeededGenerator(seed: 100)
            for _ in 0..<1500 {
                if g.isFinished { break }
                let prompts = g.actionPrompts()
                let prompt: ActionPrompt
                if let p = prompts.first(where: { $0.id == "pay_auto" || $0.id == "buy" }) { prompt = p }
                else if let p = prompts.first(where: { $0.id == "discard" || $0.id == "noble" || $0.id == "take_distinct" }) { prompt = p }
                else { prompt = prompts[0] }
                var choices = prompt.choices.shuffled(using: &rng)
                if prompt.id == "buy" {
                    choices.sort { left, right in
                        let a = g.availableCards().first { $0.id == left.id }!
                        let b = g.availableCards().first { $0.id == right.id }!
                        return a.points > b.points
                    }
                }
                try apply(&g, prompt.id, Array(choices.prefix(prompt.min)).map(\.id))
                for c in 0..<6 {
                    expectEqual(g.bank[c] + g.merchants.reduce(0) { $0 + $1.tokens[c] }, supply[c])
                    expectAtLeast(g.bank[c], 0)
                }
                let cards = g.decks.flatMap { $0 } + g.market.flatMap { $0 } + g.merchants.flatMap { $0.bought + $0.reserved }
                expectEqual(cards.count, 90)
                expectEqual(Set(cards.map(\.id)).count, 90)
                expectTrue(g.merchants.allSatisfy { $0.reserved.count <= 3 })
            }
            expectTrue(g.isFinished, "\(playerCount) players should complete a legal full game")
        }
    }
}

private func expectEqual<T: Equatable>(_ lhs: T, _ rhs: T, sourceLocation: SourceLocation = #_sourceLocation) { #expect(lhs == rhs, sourceLocation: sourceLocation) }
private func expectTrue(_ value: Bool, _ message: String = "", sourceLocation: SourceLocation = #_sourceLocation) { #expect(value, Comment(rawValue: message), sourceLocation: sourceLocation) }
private func expectFalse(_ value: Bool, sourceLocation: SourceLocation = #_sourceLocation) { #expect(!value, sourceLocation: sourceLocation) }
private func expectAtLeast<T: Comparable>(_ lhs: T, _ rhs: T, sourceLocation: SourceLocation = #_sourceLocation) { #expect(lhs >= rhs, sourceLocation: sourceLocation) }
private func expectError<T>(_ body: @autoclosure () throws -> T, sourceLocation: SourceLocation = #_sourceLocation) { #expect(throws: (any Error).self, sourceLocation: sourceLocation) { _ = try body() } }
