import Testing
@testable import MochaCore

struct SocialTests {
    func players(_ count: Int) -> [Player] { (0..<count).map { Player(id:"p\($0)",name:"玩家\($0)") } }
    func role<E: GameEngine>(_ e: E, _ p: Player) -> String { e.view(for:p.id).sections.first { $0.id == "identity" }!.items.first!.title }
    func act<E: GameEngine>(_ e: inout E, _ p: Player, _ value: String? = nil) throws {
        let a = try #require(e.view(for:p.id).actions.first)
        try e.apply(GameCommand(a.id,values: value.map { [$0] } ?? []),by:p.id)
    }
    @Test func testAvalonCompositionAndPrivateKnowledge() throws {
        for n in 5...10 {
            let ps = players(n), e = try AvalonEngine(players:ps,seed:42)
            let evil = ps.filter { ["莫甘娜","刺客","爪牙"].contains(role(e,$0)) }
            #expect((evil.count) == ([5:2,6:2,7:3,8:3,9:3,10:4][n]))
            for p in ps {
                let v = e.view(for:p.id)
                #expect(!(v.sections.filter { !$0.isPrivate }.flatMap(\.items).contains { ["梅林","莫甘娜","刺客"].contains($0.detail) }))
            }
            #expect(e.view(for:"stranger").sections.isEmpty)
        }
    }
    @Test func testAvalonRejectFiveAndAtomicValidation() throws {
        let ps = players(6); var e = try AvalonEngine(players:ps,seed:9)
        for round in 0..<5 {
            let leader = try #require(ps.first { !e.view(for:$0.id).actions.isEmpty })
            let before = ps.map { e.view(for:$0.id) }
            #expect(throws: (any Error).self) { try e.apply(GameCommand("propose",values:[ps[0].id,ps[0].id]),by:leader.id) }
            #expect((before) == (ps.map { e.view(for:$0.id) }))
            try e.apply(GameCommand("propose",values:Array(ps.prefix(2)).map(\.id)),by:leader.id)
            for p in ps.dropLast() { try act(&e,p,"no") }
            #expect(e.view(for:ps[0].id).log.last?.contains("表决") != true || round > 0)
            #expect(e.view(for:ps[0].id).phase.contains("表决"))
            try act(&e,ps.last!,"no")
        }
        #expect(e.isFinished); #expect(e.view(for:ps[0].id).phase.contains("五次"))
    }
    @Test func testAvalonMissionsAndAssassination() throws {
        let ps = players(5); var e = try AvalonEngine(players:ps,seed:3)
        for _ in 0..<3 {
            let leader = ps.first { !e.view(for:$0.id).actions.isEmpty }!
            let count = e.view(for:leader.id).actions[0].min
            let team = Array(ps.prefix(count))
            try e.apply(GameCommand("propose",values:team.map(\.id)),by:leader.id)
            for p in ps { try act(&e,p,"yes") }
            for p in team { try act(&e,p,"success") }
        }
        #expect(!(e.isFinished))
        let assassin = ps.first { role(e,$0) == "刺客" }!, merlin = ps.first { role(e,$0) == "梅林" }!
        try act(&e,assassin,merlin.id)
        #expect(e.isFinished); #expect(e.view(for:merlin.id).phase.contains("邪恶获胜"))
    }
    func skipElection(_ e: inout WerewolfEngine, _ ps: [Player]) throws { for p in ps { try act(&e,p,"no") } }
    func nightFirst(_ e: inout WerewolfEngine, _ ps: [Player], knife: String, guardID: String = "skip") throws {
        for p in ps {
            guard let a = e.view(for:p.id).actions.first else { continue }
            switch a.id {
            case "wolf": try act(&e,p,knife)
            case "guard": try act(&e,p,guardID)
            case "inspect": try act(&e,p,"skip")
            default: try act(&e,p)
            }
        }
    }
    func nightSecond(_ e: inout WerewolfEngine, _ ps: [Player], potion: String = "skip", sheriff: String? = nil, completeElection: Bool = true) throws {
        for p in ps { guard let a = e.view(for:p.id).actions.first else { continue }; try act(&e,p,a.id == "potion" ? potion : nil) }
        if completeElection && e.view(for:ps[0].id).phase.contains("上警") {
            for p in ps { try e.apply(GameCommand("signup",values:[p.id == sheriff ? "yes" : "no"]),by:p.id) }
        }
    }
    @Test func testWerewolfNightPrivacyGuardAndWitch() throws {
        let ps = players(12); var e = try WerewolfEngine(players:ps,seed:1)
        #expect((ps.filter { role(e,$0) == "狼人" }.count) == (4))
        #expect((ps.filter { role(e,$0) == "平民" }.count) == (4))
        let civilian = ps.first { role(e,$0) == "平民" }!, witch = ps.first { role(e,$0) == "女巫" }!
        let before = e.view(for:civilian.id)
        try nightFirst(&e,ps,knife:civilian.id,guardID:civilian.id)
        let after = e.view(for:civilian.id)
        #expect((before.phase) == (after.phase)); #expect((before.log) == (after.log))
        #expect((before.sections.filter { !$0.isPrivate }) == (after.sections.filter { !$0.isPrivate }))
        #expect(e.view(for:witch.id).actions[0].help.contains(civilian.name))
        try nightSecond(&e,ps,potion:"save")
        #expect(e.view(for:civilian.id).sections.first { $0.id == "players" }!.items.first { $0.id == civilian.id }!.detail.contains("出局"))
        #expect(e.view(for:witch.id).sections[0].items.last!.detail.contains("解药：无"))
    }
    @Test func testWerewolfPoisonHunterCannotShootAndInvalidAtomicity() throws {
        let ps = players(12); var e = try WerewolfEngine(players:ps,seed:4)
        let hunter = ps.first { role(e,$0) == "猎人" }!
        try nightFirst(&e,ps,knife:"skip")
        let witch = ps.first { role(e,$0) == "女巫" }!
        let before = ps.map { e.view(for:$0.id) }
        #expect(throws: (any Error).self) { try e.apply(GameCommand("potion",values:["save","poison:" + hunter.id]),by:witch.id) }
        #expect((before) == (ps.map { e.view(for:$0.id) }))
        try nightSecond(&e,ps,potion:"poison:" + hunter.id)
        #expect(e.view(for:hunter.id).actions.isEmpty)
        #expect(e.view(for:witch.id).phase.contains("自由讨论"))
    }
    @Test func testWerewolfFullGoodVictoryByVotingAndSheriff() throws {
        let ps = players(12); var e = try WerewolfEngine(players:ps,seed:12)
        let sheriff = ps.first { role(e,$0) == "平民" }!
        let wolves = ps.filter { role(e,$0) == "狼人" }
        for wolf in wolves {
            try nightFirst(&e,ps,knife:"skip")
            try nightSecond(&e,ps,sheriff:sheriff.id)
            #expect(e.view(for:sheriff.id).sections[1].items.first { $0.id == sheriff.id }!.detail.contains("警长"))
            for p in ps where e.view(for:p.id).actions.contains(where: { $0.id == "ready" }) { try e.apply(GameCommand("ready"),by:p.id) }
            for p in ps where e.view(for:p.id).actions.contains(where: { $0.id == "vote" }) { try e.apply(GameCommand("vote",values:[wolf.id]),by:p.id) }
        }
        #expect(e.isFinished); #expect(e.view(for:sheriff.id).phase.contains("好人获胜"))
    }
    @Test func testAvalonFourthQuestRequiresTwoFailures() throws {
        let ps = players(7); var e = try AvalonEngine(players:ps,seed:55)
        let evil = ps.filter { ["莫甘娜","刺客","爪牙"].contains(role(e,$0)) }
        let good = ps.filter { !evil.contains($0) }
        for round in 0..<4 {
            let leader = try #require(ps.first { !e.view(for:$0.id).actions.isEmpty })
            let count = e.view(for:leader.id).actions[0].min
            let team = [evil[0]] + Array(good.prefix(count - 1))
            try e.apply(GameCommand("propose",values:team.map(\.id)),by:leader.id)
            for p in ps { try act(&e,p,"yes") }
            let before = ps.map { e.view(for:$0.id) }
            #expect(throws: (any Error).self) { try e.apply(GameCommand("mission",values:["fail"]),by:good[0].id) }
            #expect(before == ps.map { e.view(for:$0.id) })
            for p in team { try act(&e,p,p == evil[0] && round >= 2 ? "fail" : "success") }
        }
        #expect(e.view(for:good[0].id).phase == "刺杀梅林")
        #expect(e.view(for:good[0].id).log.last!.contains("第 4 次任务成功，1 张失败牌"))
    }
    @Test func testWerewolfHunterAndBadgeTransfer() throws {
        let ps = players(12); var e = try WerewolfEngine(players:ps,seed:71)
        let hunter = try #require(ps.first { role(e,$0) == "猎人" })
        let civilian = try #require(ps.first { role(e,$0) == "平民" })
        let seer = try #require(ps.first { role(e,$0) == "预言家" })
        try nightFirst(&e,ps,knife:hunter.id)
        try nightSecond(&e,ps,sheriff:hunter.id)
        #expect(e.view(for:hunter.id).actions.first?.id == "shoot")
        try act(&e,hunter,civilian.id)
        #expect(e.view(for:hunter.id).actions.first?.id == "badge")
        try act(&e,hunter,seer.id)
        #expect(e.view(for:seer.id).phase.contains("自由讨论"))
        #expect(e.view(for:seer.id).sections[1].items.first { $0.id == seer.id }!.detail.contains("警长"))
    }
    @Test func testWerewolfGuardCannotRepeatAndDayTiePK() throws {
        let ps = players(12); var e = try WerewolfEngine(players:ps,seed:84)
        let guardPlayer = try #require(ps.first { role(e,$0) == "守卫" })
        try nightFirst(&e,ps,knife:"skip",guardID:guardPlayer.id)
        try nightSecond(&e,ps)
        for p in ps { try act(&e,p) }
        for (i,p) in ps.enumerated() { try act(&e,p,ps[i < 6 ? 0 : 1].id) }
        #expect(e.view(for:ps[0].id).phase.contains("平票 PK"))
        for p in ps { try act(&e,p) }
        for p in ps { try act(&e,p,"skip") }
        let action = try #require(e.view(for:guardPlayer.id).actions.first)
        #expect(action.id == "guard")
        #expect(!action.choices.contains { $0.id == guardPlayer.id })
        let before = ps.map { e.view(for:$0.id) }
        #expect(throws: (any Error).self) { try e.apply(GameCommand("guard",values:[guardPlayer.id]),by:guardPlayer.id) }
        #expect(before == ps.map { e.view(for:$0.id) })
    }

    @Test func testProjectionDrivenAvalonGamesTerminate() throws {
        for seed in 0..<80 {
            let ps = players(5 + seed % 6)
            var e = try AvalonEngine(players:ps,seed:UInt64(seed))
            var rng = SeededGenerator(seed:UInt64(seed + 917))
            for _ in 0..<350 {
                if e.isFinished { break }
                let actor = try #require(ps.first { !e.view(for:$0.id).actions.isEmpty })
                let action = e.view(for:actor.id).actions[0]
                var values = action.choices.shuffled(using:&rng).prefix(action.min).map(\.id)
                if action.id == "approve" { values = [Int.random(in:0..<4,using:&rng) == 0 ? "no" : "yes"] }
                try e.apply(GameCommand(action.id,values:values),by:actor.id)
            }
            #expect(e.isFinished,"Avalon seed \(seed) must terminate")
        }
    }
    @Test func testProjectionDrivenWerewolfGamesTerminateAndStayPrivate() throws {
        for seed in 0..<60 {
            let ps = players(12)
            var e = try WerewolfEngine(players:ps,seed:UInt64(seed))
            var rng = SeededGenerator(seed:UInt64(seed + 127))
            for step in 0..<1600 {
                if e.isFinished { break }
                let before = ps.map { e.view(for:$0.id) }
                let actor = try #require(ps.first { !e.view(for:$0.id).actions.isEmpty })
                let action = e.view(for:actor.id).actions.randomElement(using:&rng)!
                var values = action.choices.shuffled(using:&rng).prefix(action.min).map(\.id)
                // Keep a majority of players aligned so random games don't endlessly tie.
                if ["vote","elect","wolf"].contains(action.id), Int.random(in:0..<5,using:&rng) != 0 {
                    values = [action.choices[0].id]
                }
                if step % 23 == 0 {
                    #expect(throws: (any Error).self) { try e.apply(GameCommand("invalid",values:["invalid"]),by:actor.id) }
                    #expect(before == ps.map { e.view(for:$0.id) })
                    #expect(throws: (any Error).self) { try e.apply(GameCommand(action.id,values:values),by:"stranger") }
                    #expect(before == ps.map { e.view(for:$0.id) })
                }
                try e.apply(GameCommand(action.id,values:values),by:actor.id)
                let after = ps.map { e.view(for:$0.id) }
                if before[0].phase.contains("请闭眼"), before[0].phase == after[0].phase {
                    for (a,b) in zip(before,after) {
                        #expect(a.sections.filter { !$0.isPrivate } == b.sections.filter { !$0.isPrivate })
                        #expect(a.log == b.log)
                        #expect(a.isFinished == b.isFinished)
                    }
                }
                for p in ps { #expect(e.view(for:p.id).sections.filter { !$0.isPrivate }.allSatisfy { $0.id != "identity" }) }
            }
            #expect(e.isFinished,"Werewolf seed \(seed) must terminate")
            #expect(e.view(for:ps[0].id).sections.contains { $0.id == "reveal" })
        }
    }

    @Test func testFirstNightDeathHiddenUntilElectionAndWithdrawal() throws {
        let ps = players(12); var e = try WerewolfEngine(players:ps,seed:103)
        #expect(e.view(for:ps[0].id).phase.contains("第 1 夜"))
        let victim = try #require(ps.first { role(e,$0) == "平民" })
        let rival = try #require(ps.first { role(e,$0) == "预言家" })
        try nightFirst(&e,ps,knife:victim.id)
        try nightSecond(&e,ps,completeElection:false)
        #expect(e.view(for:ps[0].id).phase.contains("上警"))
        #expect(e.view(for:ps[0].id).sections[1].items.allSatisfy { !$0.detail.contains("出局") })
        #expect(!e.view(for:ps[0].id).log.contains { $0.contains("天出局") })
        for p in ps { try e.apply(GameCommand("signup",values:[p == victim || p == rival ? "yes" : "no"]),by:p.id) }
        #expect(e.view(for:rival.id).actions.contains { $0.id == "withdraw" })
        try e.apply(GameCommand("withdraw"),by:rival.id)
        #expect(e.view(for:victim.id).actions.first?.id == "badge")
        #expect(e.view(for:rival.id).log.contains { $0.contains("天出局") && $0.contains(victim.name) })
        try e.apply(GameCommand("badge",values:[rival.id]),by:victim.id)
        #expect(e.view(for:rival.id).phase.contains("自由讨论"))
    }
    @Test func testWolfSheriffExplosionSerializesBadgeAndNight() throws {
        let ps = players(12); var e = try WerewolfEngine(players:ps,seed:104)
        let wolves = ps.filter { role(e,$0) == "狼人" }
        let nextSheriff = try #require(ps.first { role(e,$0) == "预言家" })
        try nightFirst(&e,ps,knife:"skip")
        try nightSecond(&e,ps,sheriff:wolves[0].id)
        try e.apply(GameCommand("explode"),by:wolves[0].id)
        #expect(e.view(for:wolves[0].id).actions.first?.id == "badge")
        let before = ps.map { e.view(for:$0.id) }
        #expect(throws: (any Error).self) { try e.apply(GameCommand("explode"),by:wolves[1].id) }
        #expect(before == ps.map { e.view(for:$0.id) })
        try e.apply(GameCommand("badge",values:[nextSheriff.id]),by:wolves[0].id)
        #expect(e.view(for:nextSheriff.id).phase.contains("第 2 夜"))
        #expect(e.view(for:nextSheriff.id).sections[1].items.first { $0.id == nextSheriff.id }!.detail.contains("警长"))
    }
    @Test func testDoubleElectionExplosionSwallowsBadgeAndKeepsNightDeaths() throws {
        let ps = players(12); var e = try WerewolfEngine(players:ps,seed:105)
        let wolves = ps.filter { role(e,$0) == "狼人" }
        let victim = try #require(ps.first { role(e,$0) == "平民" })
        let seer = try #require(ps.first { role(e,$0) == "预言家" })
        try nightFirst(&e,ps,knife:victim.id)
        try nightSecond(&e,ps,completeElection:false)
        for p in ps { try e.apply(GameCommand("signup",values:[p == wolves[0] || p == wolves[1] || p == seer ? "yes" : "no"]),by:p.id) }
        try e.apply(GameCommand("explode"),by:wolves[0].id)
        #expect(e.view(for:seer.id).phase.contains("第 2 夜"))
        #expect(e.view(for:seer.id).sections[1].items.first { $0.id == victim.id }!.detail.contains("出局"))
        try nightFirst(&e,ps,knife:"skip")
        try nightSecond(&e,ps,completeElection:false)
        #expect(e.view(for:seer.id).phase.contains("竞选"))
        #expect(!e.view(for:seer.id).actions.contains { $0.id == "signup" })
        #expect(e.view(for:seer.id).sections.first { $0.id == "candidates" }!.items.map(\.id) == [wolves[1].id,seer.id].sorted { a,b in ps.firstIndex { $0.id == a }! < ps.firstIndex { $0.id == b }! })
        try e.apply(GameCommand("explode"),by:wolves[1].id)
        #expect(e.view(for:seer.id).phase.contains("第 3 夜"))
        try nightFirst(&e,ps,knife:"skip")
        try nightSecond(&e,ps)
        #expect(e.view(for:seer.id).phase.contains("自由讨论"))
        #expect(e.view(for:seer.id).sections[1].items.allSatisfy { !$0.detail.contains("警长") })
    }
    @Test func testExplosionNotAllowedDuringVoting() throws {
        let ps = players(12); var e = try WerewolfEngine(players:ps,seed:107)
        let wolf = try #require(ps.first { role(e,$0) == "狼人" })
        try nightFirst(&e,ps,knife:"skip")
        try nightSecond(&e,ps)
        for p in ps { try e.apply(GameCommand("ready"),by:p.id) }
        let before = ps.map { e.view(for:$0.id) }
        #expect(throws: (any Error).self) { try e.apply(GameCommand("explode"),by:wolf.id) }
        #expect(before == ps.map { e.view(for:$0.id) })
    }

}
