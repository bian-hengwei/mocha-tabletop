import SwiftUI
import MochaCore

struct GemSupplyView: View {
    let section: DisplaySection
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Eyebrow(text: section.title)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 6) {
                ForEach(section.items) { item in
                    VStack(spacing: 8) {
                        Circle().fill(GemColors.color(item.id).gradient).frame(width: 26, height: 26)
                            .overlay(Circle().stroke(.white.opacity(0.3), lineWidth: 2))
                            .overlay(Image(systemName: "suit.diamond.fill").font(.caption).foregroundStyle(.white.opacity(0.75)))
                        Text(item.title.dropFirst(2)).font(.system(size: 10)).foregroundStyle(TableTheme.muted)
                        Text(item.detail).font(.system(.headline, design: .rounded))
                    }.frame(maxWidth: .infinity).padding(.vertical, 11).background(TableTheme.surface, in: RoundedRectangle(cornerRadius: 17))
                }
            }
        }
    }
}

struct GemMarketView: View {
    let section: DisplaySection
    let actions: [ActionPrompt]
    let choose: (GameCommand) -> Void
    @State private var card: DisplayItem?
    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            Eyebrow(text: section.title)
            ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(section.items) { item in
                    Button { card = item } label: {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "suit.diamond.fill").font(.system(size: 25)).foregroundStyle(GemColors.color(item.id))
                                Spacer()
                                Text(item.title.components(separatedBy: " · ").last ?? "").font(.system(.title3, design: .rounded).weight(.bold)).foregroundStyle(TableTheme.cream)
                            }
                            Rectangle().fill(GemColors.color(item.id).opacity(0.15)).frame(height: 2)
                            Text(item.title.components(separatedBy: " · ").first ?? item.title).font(.caption.weight(.semibold)).foregroundStyle(TableTheme.cream)
                            Text(item.detail).font(.caption2).foregroundStyle(TableTheme.muted).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                        }.padding(16).frame(width: 166, height: 170, alignment: .topLeading)
                            .background(TableTheme.surface, in: RoundedRectangle(cornerRadius: 19))
                            .overlay(RoundedRectangle(cornerRadius: 19).stroke(GemColors.color(item.id).opacity(0.3), lineWidth: 1))
                    }.buttonStyle(.plain)
                }
            }
            }
        }
        .confirmationDialog(card?.title ?? "发展牌", isPresented: Binding(get: { card != nil }, set: { if !$0 { card = nil } }), titleVisibility: .visible) {
            if let card {
                ForEach(actions.filter { ["buy", "reserve"].contains($0.id) && $0.choices.contains(where: { $0.id == card.id }) }) { action in
                    Button(action.id == "buy" ? "购买这张牌" : "预留这张牌") { choose(GameCommand(action.id, values: [card.id])); self.card = nil }
                }
                Button("返回", role: .cancel) { self.card = nil }
            }
        } message: { Text(card?.detail ?? "") }
    }
}

private enum GemColors {
    static func color(_ id: String) -> Color {
        if id.hasPrefix("white") { return Color(red: 0.87, green: 0.88, blue: 0.84) }
        if id.hasPrefix("blue") { return Color(red: 0.35, green: 0.60, blue: 0.85) }
        if id.hasPrefix("green") { return Color(red: 0.39, green: 0.74, blue: 0.57) }
        if id.hasPrefix("red") { return Color(red: 0.86, green: 0.42, blue: 0.39) }
        if id.hasPrefix("black") { return Color(red: 0.4, green: 0.43, blue: 0.46) }
        return TableTheme.gold
    }
}
