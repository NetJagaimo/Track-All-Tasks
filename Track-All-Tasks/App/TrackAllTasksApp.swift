import SwiftUI
import AppKit
import KeyboardShortcuts

/// 持有 App 的核心物件（資料層、設定、計時引擎、選單列），並裝上全域快捷鍵。
@MainActor
@Observable
final class AppContainer {
    /// 供 AppKit 端（AppDelegate / popover）取用的單例參照。
    static private(set) var shared: AppContainer?

    let settings: SettingsStore
    let controller: TimerController
    /// 方案 B：自管的選單列項目。延後到 run loop 啟動後才建立
    /// （太早建 NSStatusItem 會在 window server 尚未連上時 assert 崩潰）。
    private(set) var menuBar: MenuBarController?
    /// 由主視窗在出現時填入，讓 AppKit 端能重新打開 SwiftUI 的主視窗。
    var openMainWindow: (() -> Void)?

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
        AppContainer.shared = self
        registerHotkeys()
        // 等 App 啟動完成（window server 已連上）再建立選單列項目。
        DispatchQueue.main.async { [weak self] in
            guard let self, self.menuBar == nil else { return }
            self.menuBar = MenuBarController(controller: self.controller)
        }
    }

    private func registerHotkeys() {
        // 開始 / 停止 切換。
        KeyboardShortcuts.onKeyUp(for: .toggleTimer) { [weak controller] in
            Task { await controller?.toggle() }
        }
        // 停止計時（計時中才有作用）。
        KeyboardShortcuts.onKeyUp(for: .stopTimer) { [weak controller] in
            Task { await controller?.stop(reason: .manual) }
        }
        // 任務輸入：打開選單列 popover 並把游標停在輸入欄。
        KeyboardShortcuts.onKeyUp(for: .focusTaskInput) { [weak self] in
            self?.menuBar?.focusInput()
        }
    }
}

@main
struct TrackAllTasksApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var container = AppContainer()

    var body: some Scene {
        // 主視窗（關閉後 App 仍留在選單列）。選單列本身由 MenuBarController（AppKit）管理。
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
        Self.syncActivationPolicy()
    }

    /// 關掉主視窗（Cmd+W）只是收起視窗，App 續留選單列；要結束請按 Cmd+Q。
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
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
            // 主視窗已被銷毀 → 用 SwiftUI openWindow 重建（本函式只在主執行緒呼叫）。
            MainActor.assumeIsolated {
                AppContainer.shared?.openMainWindow?()
            }
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
