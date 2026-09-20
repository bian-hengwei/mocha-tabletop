import SwiftUI
import UIKit
import MochaUI

@main
struct MochaTabletopApp: App {
    @StateObject private var store = TableStore()
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            MochaRootView(store: store)
                .onChange(of: store.room != nil) { _, inRoom in UIApplication.shared.isIdleTimerDisabled = inRoom }
                .onChange(of: phase) { _, phase in
                    UIApplication.shared.isIdleTimerDisabled = phase == .active && store.room != nil
                }
        }
    }
}
