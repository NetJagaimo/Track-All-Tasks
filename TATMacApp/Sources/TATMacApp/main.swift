import SwiftUI

@main
struct TATMacApp: App {
    @StateObject private var viewModel = TaskViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(viewModel)
        }
        MenuBarExtra("TAT", systemImage: "stopwatch") {
            StatusBarView()
                .environmentObject(viewModel)
        }
        .menuBarExtraStyle(.window)
    }
}
