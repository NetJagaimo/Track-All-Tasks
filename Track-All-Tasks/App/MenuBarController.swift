import AppKit
import SwiftUI
import Observation

/// 方案 B：用 AppKit 自管的選單列項目（`NSStatusItem` + `NSPopover`），取代 SwiftUI 的 `MenuBarExtra`。
/// 好處是可以「程式化」打開 popover（快捷鍵聚焦輸入欄用），SwiftUI 的 MenuBarExtra 做不到。
/// 選單列圖示沿用 SF Symbol（template image），由 AppKit 自動對齊與配色。
@MainActor
final class MenuBarController: NSObject {
    private let statusItem: NSStatusItem
    private let popover = NSPopover()
    private let controller: TimerController

    init(controller: TimerController) {
        self.controller = controller
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        super.init()
        configureButton()
        configurePopover()
        render()
        trackChanges()
    }

    // MARK: - 設定

    private func configureButton() {
        guard let button = statusItem.button else { return }
        button.action = #selector(togglePopover(_:))
        button.target = self
        button.imagePosition = .imageLeading
        button.font = .monospacedDigitSystemFont(ofSize: NSFont.systemFontSize, weight: .regular)
    }

    private func configurePopover() {
        popover.behavior = .transient
        popover.animates = false
        let host = NSHostingController(rootView: PopoverView(controller: controller))
        host.sizingOptions = [.preferredContentSize]   // 讓 popover 依 SwiftUI 內容自動調整大小
        popover.contentViewController = host
    }

    // MARK: - 顯示選單列標籤

    /// 依計時狀態更新按鈕：計時中＝碼錶實心 + 任務名前 3 字 + 秒級時長；閒置＝單純碼錶。
    private func render() {
        guard let button = statusItem.button else { return }
        let symbol = controller.isRunning ? "stopwatch.fill" : "stopwatch"
        let image = NSImage(systemSymbolName: symbol, accessibilityDescription: "Track All Tasks")
        image?.isTemplate = true
        button.image = image
        button.title = controller.isRunning
            ? " \(Formatting.prefix3(controller.currentTaskName)) \(controller.elapsedClock)"
            : ""
    }

    /// 用 Observation 追蹤 controller，狀態（含每秒跳動的 elapsedSeconds）一變就重繪並重新掛載追蹤。
    private func trackChanges() {
        withObservationTracking {
            _ = controller.isRunning
            _ = controller.currentTaskName
            _ = controller.elapsedSeconds
        } onChange: { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                self.render()
                self.trackChanges()
            }
        }
    }

    // MARK: - popover 開關

    @objc private func togglePopover(_ sender: Any?) {
        if popover.isShown {
            popover.performClose(sender)
        } else {
            showPopover()
        }
    }

    /// 打開 popover（已開則不動作）。
    func showPopover() {
        guard !popover.isShown, let button = statusItem.button else { return }
        NSApp.activate(ignoringOtherApps: true)   // 讓 popover 視窗能成為 key、輸入欄可打字
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        popover.contentViewController?.view.window?.makeKey()
    }

    /// 快捷鍵「任務輸入」用：打開 popover 並把游標停在輸入欄。
    func focusInput() {
        showPopover()
        // 等 popover 內容掛載後再聚焦（performClose→show 後 SwiftUI 視圖要一個 runloop 才就緒）。
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
            NotificationCenter.default.post(name: .focusTaskInputRequested, object: nil)
        }
    }

    /// 開主視窗後關掉 popover（讓畫面乾淨）。
    func closePopover() {
        if popover.isShown { popover.performClose(nil) }
    }
}
