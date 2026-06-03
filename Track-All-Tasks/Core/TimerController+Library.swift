import Foundation

/// UI 面向的任務 / 紀錄操作（主視窗各清單用）。
/// 集中在 controller，操作後自動刷新進行中清單，讓觀察它的 UI 同步更新。
extension TimerController {
    // MARK: 讀取

    func loadTasks(state: TaskState) async -> [TaskItem] {
        do { return try await taskStore.tasks(state: state) }
        catch { logError("loadTasks(\(state))", error); return [] }
    }

    func records(taskID: UUID) async -> [TimeRecord] {
        do { return try await recordStore.records(taskID: taskID) }
        catch { logError("records(taskID:)", error); return [] }
    }

    func recordsExcludingTrash(from: Date, to: Date) async -> [RecordWithTask] {
        do { return try await recordStore.recordsExcludingTrash(from: from, to: to) }
        catch { logError("recordsExcludingTrash", error); return [] }
    }

    // MARK: 任務狀態

    func setCompleted(taskID: UUID, completed: Bool) async {
        await run("setCompleted") { try await self.taskStore.setCompleted(taskID: taskID, completed: completed) }
    }

    func setArchived(taskID: UUID, archived: Bool) async {
        // 封存正在計時的任務 → 先停止。
        if archived, currentTaskID == taskID { await stop(reason: .manual) }
        await run("setArchived") { try await self.taskStore.setArchived(taskID: taskID, archived: archived) }
    }

    func trash(taskID: UUID) async {
        // 丟棄正在計時的任務 → 先停止。
        if currentTaskID == taskID { await stop(reason: .manual) }
        await run("trash") { try await self.taskStore.trash(taskID: taskID) }
    }

    func restore(taskID: UUID) async {
        await run("restore") { try await self.taskStore.restore(taskID: taskID) }
    }

    func emptyTrash() async {
        await run("emptyTrash") { try await self.taskStore.emptyTrash() }
    }

    func rename(taskID: UUID, to newName: String) async {
        await run("rename") { _ = try await self.taskStore.rename(taskID: taskID, to: newName) }
    }

    func setNotes(taskID: UUID, notes: String) async {
        await run("setNotes") { try await self.taskStore.setNotes(taskID: taskID, notes: notes) }
    }

    func reorderActive(orderedIDs: [UUID]) async {
        await run("reorderActive") { try await self.taskStore.reorderActive(orderedIDs: orderedIDs) }
    }

    // MARK: 紀錄編輯（手動補登 / 修改）

    func addRecord(_ record: TimeRecord) async {
        await run("addRecord") { try await self.recordStore.addRecord(record) }
    }

    func updateRecord(_ record: TimeRecord) async {
        await run("updateRecord") { try await self.recordStore.updateRecord(record) }
    }

    func deleteRecord(id: UUID) async {
        await run("deleteRecord") { try await self.recordStore.deleteRecord(id: id) }
    }

    // MARK: 私有

    private func run(_ label: String, _ body: () async throws -> Void) async {
        do {
            try await body()
            await reloadActiveTasks()
        } catch {
            logError(label, error)
        }
    }
}
