import Foundation

/// 計時紀錄（SPEC §2、附錄 `record` 表）。
/// 時長由 start/end 即時計算，不落地（見 `duration`）。
struct TimeRecord: Identifiable, Hashable, Sendable {
    var id: UUID
    var taskID: UUID
    var startAt: Date
    /// nil = 計時中（尚未結束）。
    var endAt: Date?
    /// 計時中每分鐘更新，當機 / 睡眠復原時收尾用。
    var heartbeatAt: Date?
    var createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        taskID: UUID,
        startAt: Date,
        endAt: Date? = nil,
        heartbeatAt: Date? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.taskID = taskID
        self.startAt = startAt
        self.endAt = endAt
        self.heartbeatAt = heartbeatAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    /// 是否計時中。
    var isRunning: Bool { endAt == nil }

    /// 即時計算的時長（秒）；計時中以 `now` 為結束點。
    func duration(now: Date = Date()) -> TimeInterval {
        (endAt ?? now).timeIntervalSince(startAt)
    }
}
