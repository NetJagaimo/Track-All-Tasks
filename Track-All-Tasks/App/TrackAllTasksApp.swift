import SwiftUI
import AppKit
import KeyboardShortcuts

extension Notification.Name {
    /// AppDelegate 找不到主視窗時發出，由常駐的 popover 接住、用 openWindow 重建。
    static let openMainWindowRequested = Notification.Name("TAT.openMainWindowRequested")
}

/// 持有 App 的核心物件（資料層、設定、計時引擎），並裝上全域快捷鍵。
@MainActor
@Observable
final class AppContainer {
    let settings: SettingsStore
    let controller: TimerController

    init() {
        let settings = SettingsStore()
        // 資料庫開不起來屬於不可恢復狀態（磁碟 / 權限問題），直接中止並留訊息。
        let store: GRDBStore
        do {
            store = try GRDBStore.live()
        } catch {
            fatalError("無法開啟資料庫：\(error)")
        }
        let controller = TimerController(tasks: store, records: store, settings: settings)
        self.settings = settings
        self.controller = controller
        registerHotkeys()
    }

    private func registerHotkeys() {
        // 開始 / 停止 切換。
        KeyboardShortcuts.onKeyUp(for: .toggleTimer) { [weak controller] in
            Task { await controller?.toggle() }
        }
        // 任務輸入：請求聚焦輸入欄（popover 開著時生效；否則由主視窗快速新增接手）。
        KeyboardShortcuts.onKeyUp(for: .focusTaskInput) {
            NotificationCenter.default.post(name: .focusTaskInputRequested, object: nil)
            NotificationCenter.default.post(name: .openMainWindowRequested, object: nil)
        }
    }
}

@main
struct TrackAllTasksApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var container = AppContainer()

    var body: some Scene {
        // 選單列圖示 + popover 面板（SPEC §4）。
        MenuBarExtra {
            PopoverView(controller: container.controller)
        } label: {
            MenuBarLabel(controller: container.controller)
        }
        .menuBarExtraStyle(.window)

        // 主視窗（關閉後 App 仍留在選單列）。
        Window("任務工時", id: "main") {
            MainWindowView(container: container)
                .task { await container.controller.bootstrap() }
        }
        .defaultSize(width: 920, height: 640)
        .windowResizability(.contentMinSize)
    }
}

/// 依主視窗可見與否切換 Dock 顯示（沿用 JimiJam 作法）：
/// 有 titled 視窗可見 → `.regular`；全關 → `.accessory`（純選單列）。
/// 並在正常關閉時同步收尾計時紀錄（SPEC §2）。
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        let nc = NotificationCenter.default
        nc.addObserver(forName: NSWindow.didBecomeKeyNotification, object: nil, queue: .main) { _ in
            Self.syncActivationPolicy()
        }
        nc.addObserver(forName: NSWindow.willCloseNotification, object: nil, queue: .main) { _ in
            DispatchQueue.main.async { Self.syncActivationPolicy() }
        }
        nc.addObserver(forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
            Self.bringMainWindowsForward()
        }
        Self.syncActivationPolicy()
    }

    /// 正常關閉：把計時紀錄收尾在「當下」（SPEC §2）。
    func applicationWillTerminate(_ notification: Notification) {
        AppDatabase.closeRunningRecordsNow()
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        Self.bringMainWindowsForward()
        return false
    }

    static func bringMainWindowsForward() {
        var found = false
        for win in NSApp.windows where win.styleMask.contains(.titled) {
            found = true
            if win.isMiniaturized { win.deminiaturize(nil) }
            win.makeKeyAndOrderFront(nil)
        }
        NSApp.activate(ignoringOtherApps: true)
        if !found {
            NotificationCenter.default.post(name: .openMainWindowRequested, object: nil)
        }
    }

    static func syncActivationPolicy() {
        let hasContentWindow = NSApp.windows.contains { $0.isVisible && $0.styleMask.contains(.titled) }
        let target: NSApplication.ActivationPolicy = hasContentWindow ? .regular : .accessory
        if NSApp.activationPolicy() != target {
            NSApp.setActivationPolicy(target)
        }
    }
}
