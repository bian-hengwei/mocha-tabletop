import AppKit
import SwiftUI
import MochaUI
import MochaCore

// Development harness: renders the SAME SwiftUI views used by iPhone, with a
// macOS window. It is not an iPhone simulator or an iOS release build.
let args = CommandLine.arguments
let capture = args.firstIndex(of: "--capture").flatMap { args.indices.contains($0 + 1) ? args[$0 + 1] : nil }
let mode = args.firstIndex(of: "--screen").flatMap { args.indices.contains($0 + 1) ? args[$0 + 1] : nil } ?? "live"
let defaults = mode == "live" ? UserDefaults.standard : UserDefaults(suiteName: "tabletop.preview.\(UUID().uuidString)")!
let store = TableStore(defaults: defaults)
if mode != "live" && mode != "onboarding" { store.saveProfile(name: "小狐狸", avatar: "🦊") }
if mode == "lobby" || GameKind(rawValue: mode) != nil {
    let kind = GameKind(rawValue: mode) ?? .gems
    let host = try RoomHost(host: store.profile!, factory: GameRegistry.make)
    try host.handle(RoomRequest(revision: host.revision, action: .selectGame(kind)), from: store.profile!.id)
    for i in 1..<kind.playerRange.lowerBound {
        let p = Player(name: ["阿橘", "林间", "小满", "星野", "纸月", "松子", "晨露", "阿蓝", "小七", "北北", "团团"][i - 1], avatar: ProfileCatalog.avatars[i])
        try host.join(p, token: UUID().uuidString)
        try host.handle(RoomRequest(revision: host.revision, action: .ready(true)), from: p.id)
    }
    if mode != "lobby" { try host.handle(RoomRequest(revision: host.revision, action: .start), from: store.profile!.id) }
    store.room = host.snapshot(for: store.profile!.id)
}
let application = NSApplication.shared
application.setActivationPolicy(.regular)
let width = args.contains("--small") ? 375.0 : 430.0
let height = args.contains("--small") ? 812.0 : 932.0
let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: width, height: height), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
window.title = "Mocha 桌游 · 开发预览"
window.contentView = NSHostingView(rootView: MochaRootView(store: store).environment(\.scenePhase, .active))
window.center(); window.makeKeyAndOrderFront(nil); application.activate(ignoringOtherApps: true)
if let capture {
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
        guard let view = window.contentView else { exit(1) }
        view.layoutSubtreeIfNeeded()
        guard let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { exit(2) }
        view.cacheDisplay(in: view.bounds, to: bitmap)
        guard let data = bitmap.representation(using: .png, properties: [:]) else { exit(3) }
        do { try data.write(to: URL(fileURLWithPath: capture)); print(capture); exit(0) }
        catch { print(error); exit(4) }
    }
}
application.run()
