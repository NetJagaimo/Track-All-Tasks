import SwiftUI
import AppKit

/// 選單列點開後的 popover 面板（SPEC §4，方案 B 版）。
/// 版面：最上面輸入框 + 開始/停止切換鈕；底下列出最近 5 個執行過的任務。
/// 計時中：所有任務列 disabled（同時只能有一個任務計時）、輸入框帶入當前任務名、按鈕轉為紅色「停止」。
struct PopoverView: View {
    @Bindable var controller: TimerController

    @State private var draft: String = ""
    @FocusState private var inputFocused: Bool

    private var trimmedDraft: String {
        draft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            inputRow

            Divider()

            recentList

            Divider()

            footer
        }
        .padding(14)
        .frame(width: 300)
        .task {
            await controller.reloadRecentTasks()
            syncDraftWithRunning()
        }
        .onChange(of: controller.isRunning) { _, _ in syncDraftWithRunning() }
        .onReceive(NotificationCenter.default.publisher(for: .focusTaskInputRequested)) { _ in
            inputFocused = true
        }
    }

    // MARK: - 輸入框 + 開始/停止

    private var inputRow: some View {
        HStack(spacing: 8) {
            TextField("任務名稱…", text: $draft)
                .textFieldStyle(.roundedBorder)
                .focused($inputFocused)
                .disabled(controller.isRunning)          // 計時中不可換任務，先停止
                .onSubmit { if !controller.isRunning { startFromDraft() } }

            Button(action: toggleMain) {
                Text(controller.isRunning ? "停止" : "開始")
                    .frame(minWidth: 40)
            }
            .buttonStyle(.borderedProminent)
            .tint(controller.isRunning ? .red : .green)
            .disabled(!controller.isRunning && trimmedDraft.isEmpty)
        }
    }

    // MARK: - 最近清單

    private var recentList: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("最近").font(.caption).foregroundStyle(.secondary)
            if controller.recentTasks.isEmpty {
                Text("尚無計時紀錄").font(.caption).foregroundStyle(.secondary)
                    .padding(.vertical, 4)
            } else {
                ForEach(controller.recentTasks) { task in
                    recentRow(task)
                }
            }
        }
    }

    private func recentRow(_ task: TaskItem) -> some View {
        let isCurrent = controller.currentTaskID == task.id && controller.isRunning
        return Button {
            draft = task.name                            // 帶入輸入框
            Task { await controller.start(taskName: task.name) }
        } label: {
            HStack {
                Image(systemName: isCurrent ? "stopwatch.fill" : "play.circle")
                    .foregroundStyle(isCurrent ? Color.red : Color.accentColor)
                Text(task.name).lineLimit(1)
                Spacer()
                if isCurrent {
                    Text(controller.elapsedClock)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(controller.isRunning)                  // 計時中：全部 disabled
        .padding(.vertical, 3)
        .padding(.horizontal, 6)
        .background(
            isCurrent ? Color.accentColor.opacity(0.15) : Color.clear,
            in: RoundedRectangle(cornerRadius: 6)
        )
    }

    // MARK: - 底部

    private var footer: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                AppContainer.shared?.menuBar?.closePopover()
                AppContainer.shared?.openMainWindow?()
                NSApp.activate(ignoringOtherApps: true)
            } label: {
                Label("紀錄 / 總覽 / 設定", systemImage: "list.bullet.rectangle")
            }
            .buttonStyle(.plain)

            Button("結束 App") { NSApplication.shared.terminate(nil) }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .font(.caption)
        }
    }

    // MARK: - 動作

    private func toggleMain() {
        if controller.isRunning {
            Task { await controller.stop(reason: .manual) }
        } else {
            startFromDraft()
        }
    }

    private func startFromDraft() {
        let name = trimmedDraft
        guard !name.isEmpty else { return }
        Task { await controller.start(taskName: name) }
    }

    /// 計時中→輸入框顯示當前任務名；閒置時不動（保留使用者輸入）。
    private func syncDraftWithRunning() {
        if controller.isRunning {
            draft = controller.currentTaskName
        }
    }
}
