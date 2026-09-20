import Foundation

/// Add a GameKind and a value-type GameEngine here to extend the collection.
public enum GameRegistry {
    public static func make(_ kind: GameKind, players: [Player], seed: UInt64) throws -> any GameEngine {
        switch kind {
        case .gems: return try GemsEngine(players: players, seed: seed)
        case .bombs: return try BombsEngine(players: players, seed: seed)
        case .werewolf: return try WerewolfEngine(players: players, seed: seed)
        case .avalon: return try AvalonEngine(players: players, seed: seed)
        }
    }
}
