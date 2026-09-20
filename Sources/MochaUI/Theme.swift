import SwiftUI
import MochaCore

enum TableTheme {
    static let background = Color(red: 0.047, green: 0.075, blue: 0.071)
    static let surface = Color(red: 0.086, green: 0.122, blue: 0.114)
    static let elevated = Color(red: 0.125, green: 0.169, blue: 0.153)
    static let cream = Color(red: 0.95, green: 0.93, blue: 0.86)
    static let muted = Color(red: 0.61, green: 0.68, blue: 0.62)
    static let gold = Color(red: 0.88, green: 0.74, blue: 0.46)
    static func accent(_ game: GameKind) -> Color {
        switch game {
        case .gems: return Color(red: 0.52, green: 0.81, blue: 0.69)
        case .bombs: return Color(red: 0.94, green: 0.57, blue: 0.41)
        case .werewolf: return Color(red: 0.69, green: 0.63, blue: 0.89)
        case .avalon: return gold
        }
    }
}

struct PrimaryButton: ButtonStyle {
    var color: Color = TableTheme.gold
    @Environment(\.isEnabled) var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.system(.body, design: .rounded).weight(.bold))
            .frame(maxWidth: .infinity).padding(.vertical, 17)
            .foregroundStyle(TableTheme.background)
            .background(color.opacity(enabled ? (configuration.isPressed ? 0.7 : 1) : 0.25), in: RoundedRectangle(cornerRadius: 17))
            .opacity(enabled ? 1 : 0.7)
    }
}

struct Panel<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content.padding(18).frame(maxWidth: .infinity, alignment: .leading)
            .background(TableTheme.surface, in: RoundedRectangle(cornerRadius: 23))
            .overlay(RoundedRectangle(cornerRadius: 23).stroke(.white.opacity(0.055), lineWidth: 1))
    }
}

struct Eyebrow: View {
    let text: String
    var body: some View { Text(text).font(.system(.caption2, design: .monospaced).weight(.semibold)).tracking(2).foregroundStyle(TableTheme.muted) }
}

struct AvatarView: View {
    let value: String
    var size: CGFloat = 44
    var body: some View {
        Text(value).font(.system(size: size * 0.55)).frame(width: size, height: size)
            .background(TableTheme.elevated, in: RoundedRectangle(cornerRadius: size * 0.34))
            .accessibilityLabel("头像 \(value)")
    }
}

#if canImport(UIKit)
import UIKit
#else
import AppKit
#endif

enum Artwork {
    static var eveningTable: Image {
        guard let url = Bundle.module.url(forResource: "evening-table", withExtension: "png") else { return Image(systemName: "suit.diamond.fill") }
        #if canImport(UIKit)
        return Image(uiImage: UIImage(contentsOfFile: url.path) ?? UIImage())
        #else
        return Image(nsImage: NSImage(contentsOf: url) ?? NSImage())
        #endif
    }
}
