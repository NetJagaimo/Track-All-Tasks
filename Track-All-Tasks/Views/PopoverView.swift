import SwiftUI

/// 選單列點開後的 popover 面板（SPEC §4）。輕量操作：狀態、開始/停止、任務輸入與快選、前往主視窗。
struct PopoverView: View {
    @Bindable var controller: TimerController
    @Environment(\.openWindow) private var openWindow

    @State private var draft: String = ""
    @FocusState private var inputFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            statusLine

            Divider()

            // 任務輸入 + 開始/停止
            HStack(spacing: 8) {
                TextField("任務名稱…", text: $draft)
                    .textFieldStyle(.roundedBorder)
                    .focused($inputFocused)
                    .onSubmit { startFromDraft() }
                Button(controller.isRunning ? "停止" : "開始") {
                    if controller.isRunning {
                        Task { await controller.stop(reason: .manual) }
                    } else {
                        startFromDraft()
                    }
                }
                .keyboardShortcut(.defaultAction)
            }

            // 進行中清單快選
            if !controller.activeTasks.isEmpty {
                Text("進行中")
                    .font(.caption).foregroundStyle(.secondary)
                ScrollView {
                    VStack(spacing: 2) {
                        ForEach(controller.activeTasks) { task in
                            quickRow(task)
                        }
                    }
                }
                .frame(maxHeight: 180)
            }

            Divider()

            Button {
                openWindow(id: "main")
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
        .padding(14)
        .frame(width: 300)
        .task { await controller.reloadActiveTasks() }
        .onReceive(NotificationCenter.default.publisher(for: .focusTaskInputRequested)) { _ in
            inputFocused = true
        }
    }

    // MARK: - 子視圖

    @ViewBuilder
    private var statusLine: some View {
        if controller.isRunning {
            HStack {
                Image(systemName: "stopwatch.fill").foregroundStyle(.tint)
                VStack(alignment: .leading, spacing: 2) {
                    Text(controller.currentTaskName).font(.headline).lineLimit(1)
                    Text(controller.elapsedClock).font(.system(.title3, design: .monospaced))
                }
                Spacer()
            }
        } else {
            HStack {
                Image(systemName: "stopwatch").foregroundStyle(.secondary)
                Text("未在計時").foregroundStyle(.secondary)
                Spacer()
            }
        }
    }

    private func quickRow(_ task: TaskItem) -> some View {
        Button {
            Task { await controller.start(taskID: task.id) }
        } label: {
            HStack {
                Image(systemName: controller.currentTaskID == task.id ? "play.circle.fill" : "play.circle")
                Text(task.name).lineLimit(1)
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.vertical, 3)
        .padding(.horizontal, 6)
        .background(
            controller.currentTaskID == task.id
                ? Color.accentColor.opacity(0.15) : Color.clear,
            in: RoundedRectangle(cornerRadius: 6)
        )
    }

    private func startFromDraft() {
        let name = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        Task { await controller.start(taskName: name) }
        draft = ""
    }
}
