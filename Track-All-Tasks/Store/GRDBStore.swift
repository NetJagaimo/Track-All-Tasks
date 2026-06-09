import Foundation
import GRDB

/// GRDB 實作的資料層（同時實作 `TaskStore` 與 `RecordStore`）。
/// 商業邏輯只透過協定使用它；未來換 Postgres / 遠端時呼叫端不變。
final class GRDBStore: TaskStore, RecordStore, @unchecked Sendable {
    private let dbQueue: DatabaseQueue

    init(queue: DatabaseQueue) {
        self.dbQueue = queue
    }

    /// 預設：開啟 App 資料目錄下的資料庫。
    static func live() throws -> GRDBStore {
        GRDBStore(queue: try AppDatabase.makeQueue())
    }

    // MARK: - TaskStore

    func activeTasks() async throws -> [TaskItem] {
        try await dbQueue.read { db in
            try TaskRow
                .fetchAll(db, sql: "SELECT * FROM task WHERE state='active' ORDER BY sort_order")
                .map { $0.toDomain() }
        }
    }

    func recentlyTrackedTasks(limit: Int) async throws -> [TaskItem] {
        try await dbQueue.read { db in
            // 以「最後一次計時的開始時間」排序，每個任務取一列；排除回收桶與已完成。
            try TaskRow.fetchAll(db, sql: """
                SELECT task.* FROM task
                JOIN record ON record.task_id = task.id
                WHERE task.state NOT IN ('trashed', 'completed')
                GROUP BY task.id
                ORDER BY MAX(record.start_at) DESC
                LIMIT ?
                """, arguments: [limit])
                .map { $0.toDomain() }
        }
    }

    func tasks(state: TaskState) async throws -> [TaskItem] {
        // 各狀態依其時間戳遞減；active 依手動排序。
        let orderBy: String
        switch state {
        case .active:    orderBy = "sort_order ASC"
        case .completed: orderBy = "completed_at DESC"
        case .archived:  orderBy = "archived_at DESC"
        case .trashed:   orderBy = "trashed_at DESC"
        }
        let raw = state.rawValue
        return try await dbQueue.read { db in
            try TaskRow
                .fetchAll(db, sql: "SELECT * FROM task WHERE state=? ORDER BY \(orderBy)", arguments: [raw])
                .map { $0.toDomain() }
        }
    }

    func task(id: UUID) async throws -> TaskItem? {
        let key = id.uuidString
        return try await dbQueue.read { db in
            try TaskRow.fetchOne(db, sql: "SELECT * FROM task WHERE id=?", arguments: [key])?.toDomain()
        }
    }

    func liveTask(named name: String) async throws -> TaskItem? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return try await dbQueue.read { db in
            try Self.fetchLiveTask(db, named: trimmed)?.toDomain()
        }
    }

    func ensureActiveTask(named name: String) async throws -> TaskItem {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw StoreError.emptyName }
        let nowStr = DateCodec.string(from: Date())
        return try await dbQueue.write { db in
            if var existing = try Self.fetchLiveTask(db, named: trimmed) {
                if existing.state != TaskState.active.rawValue {
                    // 打既有（已完成/封存）任務名 → 重新拉回進行中，排到最後。
                    let maxOrder = try Self.maxActiveSortOrder(db)
                    existing.state = TaskState.active.rawValue
                    existing.completedAt = nil
                    existing.archivedAt = nil
                    existing.sortOrder = maxOrder + 1
                    try db.execute(
                        sql: "UPDATE task SET state='active', completed_at=NULL, archived_at=NULL, sort_order=? WHERE id=?",
                        arguments: [existing.sortOrder, existing.id]
                    )
                }
                return existing.toDomain()
            } else {
                let maxOrder = try Self.maxActiveSortOrder(db)
                let task = TaskItem(name: trimmed, sortOrder: maxOrder + 1)
                var row = TaskRow(task)
                row.createdAt = nowStr
                try row.insert(db)
                return task
            }
        }
    }

    @discardableResult
    func rename(taskID: UUID, to newName: String) async throws -> UUID {
        let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw StoreError.emptyName }
        let key = taskID.uuidString
        let nowStr = DateCodec.string(from: Date())
        return try await dbQueue.write { db in
            guard try TaskRow.fetchOne(db, sql: "SELECT * FROM task WHERE id=?", arguments: [key]) != nil else {
                throw StoreError.taskNotFound
            }
            // 是否撞到另一個 live 任務名 → 合併。
            if let keeper = try TaskRow.fetchOne(
                db,
                sql: "SELECT * FROM task WHERE name=? COLLATE NOCASE AND state<>'trashed' AND id<>? LIMIT 1",
                arguments: [trimmed, key]
            ) {
                try db.execute(
                    sql: "UPDATE record SET task_id=?, updated_at=? WHERE task_id=?",
                    arguments: [keeper.id, nowStr, key]
                )
                try db.execute(sql: "DELETE FROM task WHERE id=?", arguments: [key])
                return UUID(uuidString: keeper.id) ?? taskID
            } else {
                try db.execute(sql: "UPDATE task SET name=? WHERE id=?", arguments: [trimmed, key])
                return taskID
            }
        }
    }

    func setNotes(taskID: UUID, notes: String) async throws {
        let key = taskID.uuidString
        let value = notes.isEmpty ? nil : notes
        try await dbQueue.write { db in
            try db.execute(sql: "UPDATE task SET notes=? WHERE id=?", arguments: [value, key])
        }
    }

    func setCompleted(taskID: UUID, completed: Bool) async throws {
        let key = taskID.uuidString
        let nowStr = DateCodec.string(from: Date())
        try await dbQueue.write { db in
            if completed {
                try db.execute(
                    sql: "UPDATE task SET state='completed', completed_at=? WHERE id=?",
                    arguments: [nowStr, key]
                )
            } else {
                try db.execute(
                    sql: "UPDATE task SET state='active', completed_at=NULL WHERE id=?",
                    arguments: [key]
                )
            }
        }
    }

    func setArchived(taskID: UUID, archived: Bool) async throws {
        let key = taskID.uuidString
        let nowStr = DateCodec.string(from: Date())
        try await dbQueue.write { db in
            if archived {
                try db.execute(
                    sql: "UPDATE task SET state='archived', archived_at=? WHERE id=?",
                    arguments: [nowStr, key]
                )
            } else {
                // 取消封存 → 回到進行中。
                try db.execute(
                    sql: "UPDATE task SET state='active', archived_at=NULL WHERE id=?",
                    arguments: [key]
                )
            }
        }
    }

    func trash(taskID: UUID) async throws {
        let key = taskID.uuidString
        let nowStr = DateCodec.string(from: Date())
        try await dbQueue.write { db in
            try db.execute(
                sql: "UPDATE task SET prev_state=state, state='trashed', trashed_at=? WHERE id=?",
                arguments: [nowStr, key]
            )
        }
    }

    func restore(taskID: UUID) async throws {
        let key = taskID.uuidString
        try await dbQueue.write { db in
            // 還原回原狀態；若還原後撞到同名 live 任務（清空前曾建同名），這裡會被唯一索引擋下。
            try db.execute(
                sql: "UPDATE task SET state=COALESCE(prev_state,'active'), prev_state=NULL, trashed_at=NULL WHERE id=?",
                arguments: [key]
            )
        }
    }

    func emptyTrash() async throws {
        try await dbQueue.write { db in
            // 紀錄靠 ON DELETE CASCADE 一起刪。
            try db.execute(sql: "DELETE FROM task WHERE state='trashed'")
        }
    }

    func reorderActive(orderedIDs: [UUID]) async throws {
        let keys = orderedIDs.map { $0.uuidString }
        try await dbQueue.write { db in
            for (index, key) in keys.enumerated() {
                try db.execute(
                    sql: "UPDATE task SET sort_order=? WHERE id=?",
                    arguments: [Double(index), key]
                )
            }
        }
    }

    // MARK: - RecordStore

    func runningRecord() async throws -> TimeRecord? {
        try await dbQueue.read { db in
            try RecordRow.fetchOne(
                db,
                sql: "SELECT * FROM record WHERE end_at IS NULL ORDER BY start_at DESC LIMIT 1"
            )?.toDomain()
        }
    }

    @discardableResult
    func startRecord(taskID: UUID, at start: Date) async throws -> TimeRecord {
        let record = TimeRecord(taskID: taskID, startAt: start, heartbeatAt: start, createdAt: start, updatedAt: start)
        let row = RecordRow(record)
        try await dbQueue.write { db in
            try row.insert(db)
        }
        return record
    }

    func stopRecord(id: UUID, at end: Date) async throws {
        let key = id.uuidString
        let endStr = DateCodec.string(from: end)
        try await dbQueue.write { db in
            try db.execute(
                sql: "UPDATE record SET end_at=?, updated_at=? WHERE id=?",
                arguments: [endStr, endStr, key]
            )
        }
    }

    func updateHeartbeat(id: UUID, at time: Date) async throws {
        let key = id.uuidString
        let str = DateCodec.string(from: time)
        try await dbQueue.write { db in
            try db.execute(
                sql: "UPDATE record SET heartbeat_at=?, updated_at=? WHERE id=?",
                arguments: [str, str, key]
            )
        }
    }

    @discardableResult
    func finalizeOrphans() async throws -> Int {
        let nowStr = DateCodec.string(from: Date())
        return try await dbQueue.write { db in
            try db.execute(
                sql: "UPDATE record SET end_at=COALESCE(heartbeat_at, start_at), updated_at=? WHERE end_at IS NULL",
                arguments: [nowStr]
            )
            return db.changesCount
        }
    }

    func records(taskID: UUID) async throws -> [TimeRecord] {
        let key = taskID.uuidString
        return try await dbQueue.read { db in
            try RecordRow
                .fetchAll(db, sql: "SELECT * FROM record WHERE task_id=? ORDER BY start_at DESC", arguments: [key])
                .map { $0.toDomain() }
        }
    }

    func recordsExcludingTrash(from: Date, to: Date) async throws -> [RecordWithTask] {
        let fromStr = DateCodec.string(from: from)
        let toStr = DateCodec.string(from: to)
        let nowStr = DateCodec.string(from: Date())
        return try await dbQueue.read { db in
            // 抓與區間「重疊」的紀錄（含跨夜）：start < to 且 (end 或 now) > from。
            let rows = try Row.fetchAll(db, sql: """
                SELECT record.*, task.name AS task_name
                FROM record JOIN task ON task.id = record.task_id
                WHERE task.state <> 'trashed'
                  AND record.start_at < ?
                  AND COALESCE(record.end_at, ?) > ?
                ORDER BY record.start_at
                """, arguments: [toStr, nowStr, fromStr])
            return rows.compactMap { row -> RecordWithTask? in
                guard let recordRow = try? RecordRow(row: row) else { return nil }
                let name: String = row["task_name"] ?? ""
                return RecordWithTask(record: recordRow.toDomain(), taskName: name)
            }
        }
    }

    func addRecord(_ record: TimeRecord) async throws {
        let row = RecordRow(record)
        try await dbQueue.write { db in
            try row.insert(db)
        }
    }

    func updateRecord(_ record: TimeRecord) async throws {
        var updated = record
        updated.updatedAt = Date()
        let row = RecordRow(updated)
        try await dbQueue.write { db in
            try row.update(db)
        }
    }

    func deleteRecord(id: UUID) async throws {
        let key = id.uuidString
        try await dbQueue.write { db in
            try db.execute(sql: "DELETE FROM record WHERE id=?", arguments: [key])
        }
    }

    // MARK: - 私有輔助

    /// 依名稱抓「非回收桶」任務（大小寫不敏感）。
    private static func fetchLiveTask(_ db: Database, named name: String) throws -> TaskRow? {
        try TaskRow.fetchOne(
            db,
            sql: "SELECT * FROM task WHERE name=? COLLATE NOCASE AND state<>'trashed' LIMIT 1",
            arguments: [name]
        )
    }

    /// 進行中清單目前最大的 sort_order（無則 0）。
    private static func maxActiveSortOrder(_ db: Database) throws -> Double {
        try Double.fetchOne(db, sql: "SELECT COALESCE(MAX(sort_order), 0) FROM task WHERE state='active'") ?? 0
    }
}

/// 資料層錯誤。
enum StoreError: Error, LocalizedError {
    case emptyName
    case taskNotFound

    var errorDescription: String? {
        switch self {
        case .emptyName:    return "任務名稱不可空白"
        case .taskNotFound: return "找不到任務"
        }
    }
}
