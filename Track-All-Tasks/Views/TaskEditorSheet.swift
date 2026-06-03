import SwiftUI

/// 編輯任務：改名（撞名會自動合併）與備註（SPEC §3）。
struct TaskEditorSheet: View {
    let controller: TimerController
    let taskItem: TaskItem
    var onDone: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var notes: String

    init(controller: TimerController, task: TaskItem, onDone: @escaping () -> Void) {
        self.controller = controller
        self.taskItem = task
        self.onDone = onDone
        _name = State(initialValue: task.name)
        _notes = State(initialValue: task.notes)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("編輯任務").font(.headline)

            Form {
                TextField("名稱", text: $name)
                Text("若改成既有任務名，會自動合併到那個任務。")
                    .font(.caption).foregroundStyle(.secondary)
                VStack(alignment: .leading) {
                    Text("備註").font(.caption).foregroundStyle(.secondary)
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(.quaternary))
                }
            }

            HStack {
                Spacer()
                Button("取消") { dismiss() }
                Button("儲存") { save() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(16)
        .frame(width: 380)
    }

    private func save() {
        let newName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            if newName != taskItem.name {
                await controller.rename(taskID: taskItem.id, to: newName)
            }
            await controller.setNotes(taskID: taskItem.id, notes: notes)
            onDone()
            dismiss()
        }
    }
}
