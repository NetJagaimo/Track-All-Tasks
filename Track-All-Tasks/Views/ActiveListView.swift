import SwiftUI

/// 進行中清單（SPEC §4 主畫面）：可開始計時、勾完成、拖曳排序、編輯、看紀錄、丟回收桶。
/// 依 SPEC §3「勾完成後仍留在進行中清單（劃線顯示），之後再手動封存收起」，
/// 本頁同時顯示「已完成但未封存」的任務（劃線），與獨立的「已完成」分頁互補。
struct ActiveListView: View {
    @Bindable var controller: TimerController

    @State private var order: [TaskItem] = []          // 進行中（可排序）本地副本
    @State private var completedInline: [TaskItem] = [] // 已完成待封存（劃線）
    @State private var draft: String = ""
    @FocusState private var inputFocused: Bool
    @State private var editingTask: TaskItem?
    @State private var recordsTask: TaskItem?

    var body: some View {
        VStack(spacing: 0) {
            quickAdd
            Divider()
            list
        }
        .navigationTitle("進行中")
        .task { await reloadAll() }
        .onChange(of: controller.activeTasks) { _, new in order = new }
        .onReceive(NotificationCenter.default.publisher(for: .focusTaskInputRequested)) { _ in
            inputFocused = true
        }
        .sheet(item: $editingTask) { t in
            TaskEditorSheet(controller: controller, task: t) { Task { await reloadAll() } }
        }
        .sheet(item: $recordsTask) { t in
            RecordsView(controller: controller, taskItem: t) { Task { await reloadAll() } }
        }
    }

    // MARK: 快速新增

    private var quickAdd: some View {
        HStack {
            TextField("新增任務並可立即開始…", text: $draft)
                .textFieldStyle(.roundedBorder)
                .focused($inputFocused)
                .onSubmit { addOrStart(start: false) }
            Button("新增") { addOrStart(start: false) }
            Button {
                addOrStart(start: true)
            } label: { Label("開始", systemImage: "play.fill") }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(12)
    }

    // MARK: 清單

    private var list: some View {
        List {
            Section {
                ForEach(order) { task in
                    activeRow(task)
                }
                .onMove(perform: move)
            } header: {
                if order.isEmpty { Text("沒有進行中的任務") }
            }

            if !completedInline.isEmpty {
                Section("已完成（待封存）") {
                    ForEach(completedInline) { task in
                        completedRow(task)
                    }
                }
            }
        }
        .listStyle(.inset)
    }

    private func activeRow(_ task: TaskItem) -> some View {
        let isTiming = controller.currentTaskID == task.id && controller.isRunning
        return HStack(spacing: 10) {
            Button {
                Task {
                    if isTiming { await controller.stop(reason: .manual) }
                    else { await controller.start(taskID: task.id) }
                }
            } label: {
                Image(systemName: isTiming ? "stop.circle.fill" : "play.circle")
                    .foregroundStyle(isTiming ? Color.red : Color.accentColor)
                    .font(.title3)
            }
            .buttonStyle(.plain)

            Button {
                Task { await controller.setCompleted(taskID: task.id, completed: true); await reloadAll() }
            } label: {
                Image(systemName: "circle")
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 1) {
                Text(task.name).lineLimit(1)
                if !task.notes.isEmpty {
                    Text(task.notes).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            Spacer()
            if isTiming {
                Text(controller.elapsedClock).font(.system(.callout, design: .monospaced)).foregroundStyle(.tint)
            }
            rowMenu(task, completed: false)
        }
        .padding(.vertical, 2)
    }

    private func completedRow(_ task: TaskItem) -> some View {
        HStack(spacing: 10) {
            Button {
                Task { await controller.setCompleted(taskID: task.id, completed: false); await reloadAll() }
            } label: {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
            }
            .buttonStyle(.plain)

            Text(task.name).strikethrough().foregroundStyle(.secondary).lineLimit(1)
            Spacer()
            rowMenu(task, completed: true)
        }
        .padding(.vertical, 2)
    }

    private func rowMenu(_ task: TaskItem, completed: Bool) -> some View {
        Menu {
            Button("編輯…") { editingTask = task }
            Button("紀錄…") { recordsTask = task }
            Button("封存") {
                Task { await controller.setArchived(taskID: task.id, archived: true); await reloadAll() }
            }
            Divider()
            Button("丟回收桶", role: .destructive) {
                Task { await controller.trash(taskID: task.id); await reloadAll() }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
    }

    // MARK: 動作

    private func addOrStart(start: Bool) {
        let name = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        draft = ""
        Task {
            if start {
                await controller.start(taskName: name)
            } else {
                _ = try? await controller.taskStore.ensureActiveTask(named: name)
                await controller.reloadActiveTasks()
            }
            await reloadAll()
        }
    }

    private func move(from source: IndexSet, to destination: Int) {
        order.move(fromOffsets: source, toOffset: destination)
        let ids = order.map(\.id)
        Task { await controller.reorderActive(orderedIDs: ids) }
    }

    private func reloadAll() async {
        await controller.reloadActiveTasks()
        order = controller.activeTasks
        completedInline = await controller.loadTasks(state: .completed)
    }
}
