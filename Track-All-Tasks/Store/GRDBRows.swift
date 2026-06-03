import Foundation
import GRDB

/// `task` 表的 GRDB 列型別。停留在資料層，不外漏；與領域 `TaskItem` 互轉。
struct TaskRow: Codable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "task"

    var id: String
    var name: String
    var notes: String?
    var state: String
    var prevState: String?
    var sortOrder: Double
    var createdAt: String
    var completedAt: String?
    var archivedAt: String?
    var trashedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, notes, state
        case prevState = "prev_state"
        case sortOrder = "sort_order"
        case createdAt = "created_at"
        case completedAt = "completed_at"
        case archivedAt = "archived_at"
        case trashedAt = "trashed_at"
    }

    init(_ t: TaskItem) {
        id = t.id.uuidString
        name = t.name
        notes = t.notes.isEmpty ? nil : t.notes
        state = t.state.rawValue
        prevState = t.prevState?.rawValue
        sortOrder = t.sortOrder
        createdAt = DateCodec.string(from: t.createdAt)
        completedAt = t.completedAt.map(DateCodec.string(from:))
        archivedAt = t.archivedAt.map(DateCodec.string(from:))
        trashedAt = t.trashedAt.map(DateCodec.string(from:))
    }

    /// 轉回領域模型；不可解析的時間以建立時間或現在頂替（理論上不會發生）。
    func toDomain() -> TaskItem {
        TaskItem(
            id: UUID(uuidString: id) ?? UUID(),
            name: name,
            notes: notes ?? "",
            state: TaskState(rawValue: state) ?? .active,
            prevState: prevState.flatMap(TaskState.init(rawValue:)),
            sortOrder: sortOrder,
            createdAt: DateCodec.date(from: createdAt) ?? Date(),
            completedAt: completedAt.flatMap(DateCodec.date(from:)),
            archivedAt: archivedAt.flatMap(DateCodec.date(from:)),
            trashedAt: trashedAt.flatMap(DateCodec.date(from:))
        )
    }
}

/// `record` 表的 GRDB 列型別。
struct RecordRow: Codable, FetchableRecord, PersistableRecord {
    static let databaseTableName = "record"

    var id: String
    var taskID: String
    var startAt: String
    var endAt: String?
    var heartbeatAt: String?
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case taskID = "task_id"
        case startAt = "start_at"
        case endAt = "end_at"
        case heartbeatAt = "heartbeat_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(_ r: TimeRecord) {
        id = r.id.uuidString
        taskID = r.taskID.uuidString
        startAt = DateCodec.string(from: r.startAt)
        endAt = r.endAt.map(DateCodec.string(from:))
        heartbeatAt = r.heartbeatAt.map(DateCodec.string(from:))
        createdAt = DateCodec.string(from: r.createdAt)
        updatedAt = DateCodec.string(from: r.updatedAt)
    }

    func toDomain() -> TimeRecord {
        TimeRecord(
            id: UUID(uuidString: id) ?? UUID(),
            taskID: UUID(uuidString: taskID) ?? UUID(),
            startAt: DateCodec.date(from: startAt) ?? Date(),
            endAt: endAt.flatMap(DateCodec.date(from:)),
            heartbeatAt: heartbeatAt.flatMap(DateCodec.date(from:)),
            createdAt: DateCodec.date(from: createdAt) ?? Date(),
            updatedAt: DateCodec.date(from: updatedAt) ?? Date()
        )
    }
}
