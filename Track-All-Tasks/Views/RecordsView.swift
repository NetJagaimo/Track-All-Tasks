import SwiftUI

/// 某任務的計時紀錄清單：手動補登、編輯時間、刪除（SPEC §6 紀錄管理）。
struct RecordsView: View {
    let controller: TimerController
    let taskItem: TaskItem
    var onChange: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var records: [TimeRecord] = []
    @State private var editing: RecordEditTarget?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("「\(taskItem.name)」的紀錄").font(.headline)
                Spacer()
                Button {
                    let now = Date()
                    editing = RecordEditTarget(record: TimeRecord(taskID: taskItem.id, startAt: now, endAt: now), isNew: true)
                } label: { Label("補登", systemImage: "plus") }
            }

            if records.isEmpty {
                Text("尚無紀錄").foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(records) { record in
                        row(record)
                    }
                }
                .listStyle(.inset)
            }

            HStack {
                Spacer()
                Button("關閉") { dismiss() }.keyboardShortcut(.cancelAction)
            }
        }
        .padding(16)
        .frame(width: 460, height: 420)
        .task { await reload() }
        .sheet(item: $editing) { target in
            RecordEditSheet(controller: controller, target: target) {
                Task { await reload(); onChange() }
            }
        }
    }

    private func row(_ record: TimeRecord) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(Self.dateText(record.startAt)).font(.callout)
                Text(record.endAt.map { "→ \(Self.timeText($0))" } ?? "計時中…")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(Formatting.hm(record.duration()))
                .font(.system(.callout, design: .monospaced))
            Menu {
                Button("編輯") { editing = RecordEditTarget(record: record, isNew: false) }
                Button("刪除", role: .destructive) {
                    Task { await controller.deleteRecord(id: record.id); await reload(); onChange() }
                }
            } label: { Image(systemName: "ellipsis.circle") }
            .menuStyle(.borderlessButton)
            .fixedSize()
        }
    }

    private func reload() async {
        records = await controller.records(taskID: taskItem.id)
    }

    static func dateText(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return f.string(from: date)
    }
    static func timeText(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f.string(from: date)
    }
}

/// 紀錄編輯目標。
struct RecordEditTarget: Identifiable {
    var record: TimeRecord
    var isNew: Bool
    var id: UUID { record.id }
}

/// 手動補登 / 編輯一筆紀錄。結束早於開始會被擋下（SPEC §6）。
struct RecordEditSheet: View {
    let controller: TimerController
    let target: RecordEditTarget
    var onDone: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var start: Date
    @State private var end: Date

    init(controller: TimerController, target: RecordEditTarget, onDone: @escaping () -> Void) {
        self.controller = controller
        self.target = target
        self.onDone = onDone
        _start = State(initialValue: target.record.startAt)
        _end = State(initialValue: target.record.endAt ?? target.record.startAt)
    }

    private var valid: Bool { end > start }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(target.isNew ? "補登紀錄" : "編輯紀錄").font(.headline)

            DatePicker("開始", selection: $start, displayedComponents: [.date, .hourAndMinute])
            DatePicker("結束", selection: $end, displayedComponents: [.date, .hourAndMinute])

            if !valid {
                Label("結束時間必須晚於開始時間", systemImage: "exclamationmark.triangle")
                    .font(.caption).foregroundStyle(.red)
            } else {
                Text("時長：\(Formatting.hm(end.timeIntervalSince(start)))")
                    .font(.caption).foregroundStyle(.secondary)
            }

            HStack {
                Spacer()
                Button("取消") { dismiss() }
                Button("儲存") { save() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(!valid)
            }
        }
        .padding(16)
        .frame(width: 340)
    }

    private func save() {
        guard valid else { return }
        var record = target.record
        record.startAt = start
        record.endAt = end
        Task {
            if target.isNew {
                await controller.addRecord(record)
            } else {
                await controller.updateRecord(record)
            }
            onDone()
            dismiss()
        }
    }
}
