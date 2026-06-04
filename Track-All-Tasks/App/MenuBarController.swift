import AppKit
import SwiftUI
import Observation

/// 可成為 key 的「非作用中」面板：能接收鍵盤輸入，但不會把 App 叫到前台
/// （＝不會把主視窗拉到最前、也不打斷其他 App），行為貼近原本的 MenuBarExtra。
final class StatusPanel: NSPanel {
    override var canBecomeKey: Bool { true }
}

/// 方案 B：用 AppKit 自管的選單列項目（`NSStatusItem` + 自製面板），取代 SwiftUI 的 `MenuBarExtra`。
/// 好處是可以「程式化」打開面板（快捷鍵聚焦輸入欄用），且不會在開啟時動到主視窗。
/// 選單列圖示沿用 SF Symbol（template image），由 AppKit 自動對齊與配色。
@MainActor
final class MenuBarController: NSObject, NSWindowDelegate {
    private let statusItem: NSStatusItem
    private let controller: TimerController
    private let panel: StatusPanel
    private let hostingView: NSHostingView<AnyView>
    /// 因「點圖示而失焦自動關閉」的時間戳，用來吃掉緊接著的點擊（避免關了又馬上打開）。
    private var lastAutoClose: Date?

    init(controller: TimerController) {
        self.controller = controller
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        let root = PopoverView(controller: controller)
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        hostingView = NSHostingView(rootView: AnyView(root))

        panel = StatusPanel(
            contentRect: NSRect(x: 0, y: 0, width: 300, height: 200),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: true
        )
        super.init()

        configurePanel()
        configureButton()
        render()
        trackChanges()
    }

    // MARK: - 設定

    private func configurePanel() {
        panel.level = .popUpMenu                 // 浮在主視窗之上，但顯示它不會把主視窗排到前面
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = false
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.isMovable = false
        panel.delegate = self
        hostingView.autoresizingMask = [.width, .height]
        panel.contentView = hostingView
    }

    private func configureButton() {
        guard let button = statusItem.button else { return }
        button.action = #selector(togglePanel(_:))
        button.target = self
        button.imagePosition = .imageLeading
        button.font = .monospacedDigitSystemFont(ofSize: NSFont.systemFontSize, weight: .regular)
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

    // MARK: - 面板開關

    @objc private func togglePanel(_ sender: Any?) {
        if panel.isVisible {
            close()
            return
        }
        // 點圖示時若面板剛因失焦被關掉，這次點擊只是「關閉」的副作用，不要又打開。
        if let t = lastAutoClose, Date().timeIntervalSince(t) < 0.25 {
            lastAutoClose = nil
            return
        }
        show()
    }

    /// 打開面板（已開則僅重新成為 key）。不會 activate App，故主視窗不會被叫到前台。
    private func show() {
        guard let button = statusItem.button, let buttonWindow = button.window else { return }

        hostingView.layoutSubtreeIfNeeded()
        let size = hostingView.fittingSize
        panel.setContentSize(size)

        // 定位在選單列圖示正下方，並夾在螢幕可視範圍內。
        let btnRectInScreen = buttonWindow.convertToScreen(button.convert(button.bounds, to: nil))
        var x = btnRectInScreen.midX - size.width / 2
        let y = btnRectInScreen.minY - size.height - 4
        if let vis = (buttonWindow.screen ?? NSScreen.main)?.visibleFrame {
            x = min(max(x, vis.minX + 8), vis.maxX - size.width - 8)
        }
        panel.setFrameOrigin(NSPoint(x: x, y: y))
        panel.makeKeyAndOrderFront(nil)
    }

    /// 快捷鍵「任務輸入」用：打開面板並把游標停在輸入欄。
    func focusInput() {
        show()
        // 重新確保面板是 key（主視窗開著時尤其重要），再聚焦輸入欄。
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
            self?.panel.makeKey()
            NotificationCenter.default.post(name: .focusTaskInputRequested, object: nil)
        }
    }

    /// 開主視窗後關掉面板（讓畫面乾淨）。
    func closePopover() {
        close()
    }

    private func close() {
        panel.orderOut(nil)
    }

    // 點到面板外（面板失去 key）就收起，行為等同 transient popover。
    func windowDidResignKey(_ notification: Notification) {
        guard panel.isVisible else { return }
        close()
        lastAutoClose = Date()
    }
}
