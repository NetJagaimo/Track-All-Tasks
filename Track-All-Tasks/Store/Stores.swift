import Foundation

/// 一筆紀錄 + 其任務名稱（總覽 / 匯出用，避免呼叫端各自 join）。
struct RecordWithTask: Identifiable, Hashable, Sendable {
    var record: TimeRecord
    var taskName: String
    var id: UUID { record.id }
}

/// 任務資料層協定（SPEC §1）。商業邏輯只認得本協定，不直接碰 GRDB。
/// 所有方法 `async`：本地同步實作即可，未來換遠端時呼叫端不動。
protocol TaskStore: Sendable {
    /// 進行中清單（state=active，依 sortOrder）。
    func activeTasks() async throws -> [TaskItem]
    /// 某狀態的任務清單，依該狀態的時間戳遞減（completed/archived/trashed）。
    func tasks(state: TaskState) async throws -> [TaskItem]
    func task(id: UUID) async throws -> TaskItem?
    /// 依名稱找「非回收桶」任務（名稱大小寫不敏感）。
    func liveTask(named name: String) async throws -> TaskItem?

    /// 找既有 live 任務或建立一個新的進行中任務（popover 打名字即開始用）。
    func ensureActiveTask(named name: String) async throws -> TaskItem

    /// 改名；若撞到既有 live 任務名 → 自動合併（紀錄轉移、空任務移除），回傳保留的任務 id。
    @discardableResult
    func rename(taskID: UUID, to newName: String) async throws -> UUID

    func setNotes(taskID: UUID, notes: String) async throws

    /// 勾完成 / 取消完成（仍留在進行中清單）。
    func setCompleted(taskID: UUID, completed: Bool) async throws
    /// 封存 / 取消封存（回到進行中）。
    func setArchived(taskID: UUID, archived: Bool) async throws

    /// 丟回收桶（記住前狀態）。
    func trash(taskID: UUID) async throws
    /// 從回收桶還原回原狀態。
    func restore(taskID: UUID) async throws
    /// 清空回收桶（永久刪除任務與其紀錄）。
    func emptyTrash() async throws

    /// 套用進行中清單的新順序（依陣列順序重寫 sortOrder）。
    func reorderActive(orderedIDs: [UUID]) async throws
}

/// 計時紀錄資料層協定（SPEC §2、§5）。
protocol RecordStore: Sendable {
    /// 目前計時中的紀錄（end_at IS NULL），無則 nil。
    func runningRecord() async throws -> TimeRecord?

    /// 開始一段計時：寫入 end_at=null 的紀錄（供當機復原）。
    @discardableResult
    func startRecord(taskID: UUID, at start: Date) async throws -> TimeRecord
    /// 停止計時：寫 end_at。
    func stopRecord(id: UUID, at end: Date) async throws
    /// 更新心跳時間戳。
    func updateHeartbeat(id: UUID, at time: Date) async throws

    /// 收尾所有未結束紀錄（當機 / 睡眠復原）：end = coalesce(heartbeat, start)。
    /// 回傳被收尾的筆數。
    @discardableResult
    func finalizeOrphans() async throws -> Int

    /// 某任務的所有紀錄（起始遞減）。
    func records(taskID: UUID) async throws -> [TimeRecord]

    /// 區間內、排除回收桶任務的紀錄（含任務名）。總覽用。
    func recordsExcludingTrash(from: Date, to: Date) async throws -> [RecordWithTask]

    func addRecord(_ record: TimeRecord) async throws
    func updateRecord(_ record: TimeRecord) async throws
    /// 單筆永久刪除（不進回收桶）。
    func deleteRecord(id: UUID) async throws
}
