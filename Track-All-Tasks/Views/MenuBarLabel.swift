import SwiftUI

/// 選單列上的標籤（SPEC §4）。
/// 計時中：圖示 + 任務名稱前 3 字 + 秒級時長；閒置：單純圖示。
/// 秒級更新靠 controller.elapsedSeconds（手動 Timer 驅動），不使用 TimelineView。
struct MenuBarLabel: View {
    let controller: TimerController
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        content
            // 標籤是選單列上唯一「永遠掛載」的視圖，由它接住重建主視窗的請求
            // （AppDelegate 在 reopen 卻找不到視窗時、或 focusTaskInput 快捷鍵會發出）。
            .onReceive(NotificationCenter.default.publisher(for: .openMainWindowRequested)) { _ in
                openWindow(id: "main")
                NSApp.activate(ignoringOtherApps: true)
            }
    }

    @ViewBuilder
    private var content: some View {
        if controller.isRunning {
            // 用 systemImage label，讓選單列同時顯示圖示與文字。
            Label("\(Formatting.prefix3(controller.currentTaskName)) \(controller.elapsedClock)",
                  systemImage: "stopwatch.fill")
        } else {
            Image(systemName: "stopwatch")
        }
    }
}
