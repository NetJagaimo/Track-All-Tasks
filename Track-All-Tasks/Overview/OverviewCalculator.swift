import Foundation

/// 單一任務在某範圍內的小計。
struct TaskDuration: Identifiable, Hashable {
    var name: String
    var seconds: TimeInterval
    var id: String { name }
}

/// 單日總覽：各任務小計（遞減）與全天總計。
struct DayOverview: Identifiable {
    var date: Date
    var tasks: [TaskDuration]
    var total: TimeInterval
    var id: Date { date }
}

/// 單週總覽：7 天（週一起算）+ 整週各任務小計。
struct WeekOverview {
    var weekStart: Date
    var days: [DayOverview]
    var weeklyTasks: [TaskDuration]
    var total: TimeInterval
}

/// 總覽計算（SPEC §5）。跨夜紀錄在半夜切開分攤到各日（精準計算），原始紀錄不拆。
enum OverviewCalculator {
    /// 週一起算的 Calendar。
    static func mondayCalendar(_ base: Calendar = .current) -> Calendar {
        var cal = base
        cal.firstWeekday = 2   // 2 = 星期一
        return cal
    }

    /// 一筆紀錄與區間 [start, end) 重疊的秒數（end 為 nil 的計時中紀錄以 now 為結束）。
    static func overlap(_ record: TimeRecord, start: Date, end: Date, now: Date) -> TimeInterval {
        let recStart = record.startAt
        let recEnd = record.endAt ?? now
        let lo = max(recStart, start)
        let hi = min(recEnd, end)
        return max(0, hi.timeIntervalSince(lo))
    }

    /// 某一天的總覽。
    static func day(
        for date: Date,
        records: [RecordWithTask],
        calendar: Calendar = .current,
        now: Date = Date()
    ) -> DayOverview {
        let dayStart = calendar.startOfDay(for: date)
        let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart) ?? dayStart.addingTimeInterval(86400)

        var byTask: [String: TimeInterval] = [:]
        for item in records {
            let secs = overlap(item.record, start: dayStart, end: dayEnd, now: now)
            if secs > 0 {
                byTask[item.taskName, default: 0] += secs
            }
        }
        let tasks = byTask
            .map { TaskDuration(name: $0.key, seconds: $0.value) }
            .sorted { $0.seconds > $1.seconds }
        let total = tasks.reduce(0) { $0 + $1.seconds }
        return DayOverview(date: dayStart, tasks: tasks, total: total)
    }

    /// 全部時間：各任務累計（遞減）與總計。每筆紀錄計全長（計時中以 now 為結束）。
    static func allTime(
        records: [RecordWithTask],
        now: Date = Date()
    ) -> (tasks: [TaskDuration], total: TimeInterval) {
        var byTask: [String: TimeInterval] = [:]
        for item in records {
            byTask[item.taskName, default: 0] += item.record.duration(now: now)
        }
        let tasks = byTask
            .map { TaskDuration(name: $0.key, seconds: $0.value) }
            .sorted { $0.seconds > $1.seconds }
        let total = tasks.reduce(0) { $0 + $1.seconds }
        return (tasks, total)
    }

    /// 包含某日期那一週（週一～週日）的總覽。
    static func week(
        containing date: Date,
        records: [RecordWithTask],
        calendar baseCalendar: Calendar = .current,
        now: Date = Date()
    ) -> WeekOverview {
        let cal = mondayCalendar(baseCalendar)
        let comps = cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        let weekStart = cal.date(from: comps) ?? cal.startOfDay(for: date)

        var days: [DayOverview] = []
        var weeklyByTask: [String: TimeInterval] = [:]
        for offset in 0..<7 {
            guard let d = cal.date(byAdding: .day, value: offset, to: weekStart) else { continue }
            let dayOverview = day(for: d, records: records, calendar: cal, now: now)
            for t in dayOverview.tasks {
                weeklyByTask[t.name, default: 0] += t.seconds
            }
            days.append(dayOverview)
        }
        let weeklyTasks = weeklyByTask
            .map { TaskDuration(name: $0.key, seconds: $0.value) }
            .sorted { $0.seconds > $1.seconds }
        let total = weeklyTasks.reduce(0) { $0 + $1.seconds }
        return WeekOverview(weekStart: weekStart, days: days, weeklyTasks: weeklyTasks, total: total)
    }
}
