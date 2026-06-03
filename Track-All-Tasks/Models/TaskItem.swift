import Foundation

/// 任務狀態：進行中 / 已完成 / 封存 / 回收桶。
/// 對應 SPEC §3 的生命週期，rawValue 與 DB 的 `state` 欄位一致。
enum TaskState: String, Codable, CaseIterable, Sendable {
    case active     // 進行中（todo 清單，唯一可計時）
    case completed  // 已完成（仍留在進行中清單、劃線，之後手動封存）
    case archived   // 封存
    case trashed    // 回收桶
}

/// 任務 = todo item，同時是計時對象（SPEC §3）。
/// 純 Swift struct，不綁任何 DB 型別；資料層才負責持久化。
struct TaskItem: Identifiable, Hashable, Sendable {
    var id: UUID
    var name: String
    var notes: String
    var state: TaskState
    /// 丟回收桶前的狀態，還原時用。
    var prevState: TaskState?
    /// 進行中清單的手動排序位置（僅 active 清單使用）。
    var sortOrder: Double
    var createdAt: Date
    var completedAt: Date?
    var archivedAt: Date?
    var trashedAt: Date?

    init(
        id: UUID = UUID(),
        name: String,
        notes: String = "",
        state: TaskState = .active,
        prevState: TaskState? = nil,
        sortOrder: Double = 0,
        createdAt: Date = Date(),
        completedAt: Date? = nil,
        archivedAt: Date? = nil,
        trashedAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.notes = notes
        self.state = state
        self.prevState = prevState
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.completedAt = completedAt
        self.archivedAt = archivedAt
        self.trashedAt = trashedAt
    }
}
