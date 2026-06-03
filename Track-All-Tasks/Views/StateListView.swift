import SwiftUI

/// 已完成 / 封存清單（SPEC §4），依各自時間戳遞減。
struct StateListView: View {
    let controller: TimerController
    let state: TaskState   // .completed 或 .archived

    @State private var items: [TaskItem] = []
    @State private var editingTask: TaskItem?
    @State private var recordsTask: TaskItem?

    private var title: String { state == .completed ? "已完成" : "封存" }

    var body: some View {
        Group {
            if items.isEmpty {
                ContentUnavailableView(
                    state == .completed ? "沒有已完成的任務" : "沒有封存的任務",
                    systemImage: state == .completed ? "checkmark.circle" : "archivebox"
                )
            } else {
                List {
                    ForEach(items) { task in
                        row(task)
                    }
                }
                .listStyle(.inset)
            }
        }
        .navigationTitle(title)
        .task { await reload() }
        .sheet(item: $editingTask) { t in
            TaskEditorSheet(controller: controller, task: t) { Task { await reload() } }
        }
        .sheet(item: $recordsTask) { t in
            RecordsView(controller: controller, taskItem: t) { Task { await reload() } }
        }
    }

    private func row(_ task: TaskItem) -> some View {
        HStack {
            Image(systemName: state == .completed ? "checkmark.circle.fill" : "archivebox.fill")
                .foregroundStyle(state == .completed ? .green : .secondary)
            VStack(alignment: .leading, spacing: 1) {
                Text(task.name).lineLimit(1)
                if let stamp = timestamp(task) {
                    Text(stamp).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            Menu {
                if state == .completed {
                    Button("取消完成（回進行中）") {
                        Task { await controller.setCompleted(taskID: task.id, completed: false); await reload() }
                    }
                    Button("封存") {
                        Task { await controller.setArchived(taskID: task.id, archived: true); await reload() }
                    }
                } else {
                    Button("取消封存（回進行中）") {
                        Task { await controller.setArchived(taskID: task.id, archived: false); await reload() }
                    }
                }
                Button("編輯…") { editingTask = task }
                Button("紀錄…") { recordsTask = task }
                Divider()
                Button("丟回收桶", role: .destructive) {
                    Task { await controller.trash(taskID: task.id); await reload() }
                }
            } label: { Image(systemName: "ellipsis.circle") }
            .menuStyle(.borderlessButton)
            .fixedSize()
        }
        .padding(.vertical, 2)
    }

    private func timestamp(_ task: TaskItem) -> String? {
        let date = state == .completed ? task.completedAt : task.archivedAt
        guard let date else { return nil }
        return RecordsView.dateText(date)
    }

    private func reload() async {
        items = await controller.loadTasks(state: state)
    }
}
