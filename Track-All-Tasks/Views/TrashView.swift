import SwiftUI

/// 回收桶（SPEC §4）：可還原、可清空（永久刪除）。任務與其紀錄一起進、一起出。
struct TrashView: View {
    let controller: TimerController

    @State private var items: [TaskItem] = []
    @State private var showEmptyConfirm = false

    var body: some View {
        Group {
            if items.isEmpty {
                ContentUnavailableView("回收桶是空的", systemImage: "trash")
            } else {
                List {
                    ForEach(items) { task in
                        HStack {
                            Image(systemName: "trash").foregroundStyle(.secondary)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(task.name).lineLimit(1)
                                if let t = task.trashedAt {
                                    Text("丟棄於 \(RecordsView.dateText(t))")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Button("還原") {
                                Task { await controller.restore(taskID: task.id); await reload() }
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
                .listStyle(.inset)
            }
        }
        .navigationTitle("回收桶")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("清空回收桶", role: .destructive) { showEmptyConfirm = true }
                    .disabled(items.isEmpty)
            }
        }
        .confirmationDialog(
            "清空回收桶會永久刪除這些任務與其所有計時紀錄，無法復原。",
            isPresented: $showEmptyConfirm,
            titleVisibility: .visible
        ) {
            Button("永久刪除", role: .destructive) {
                Task { await controller.emptyTrash(); await reload() }
            }
            Button("取消", role: .cancel) {}
        }
        .task { await reload() }
    }

    private func reload() async {
        items = await controller.loadTasks(state: .trashed)
    }
}
