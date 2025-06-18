import SwiftUI
import Combine
import SQLite

struct TaskRecord: Identifiable {
    let id: Int64
    let taskName: String
    let datetime: Date
    let action: String
}

struct TaskSummary: Identifiable {
    let id = UUID()
    let name: String
    let total: TimeInterval
}

class TaskViewModel: ObservableObject {
    @Published var summaries: [TaskSummary] = []
    @Published var records: [TaskRecord] = []
    @Published var isRunning: Bool = false
    @Published var currentTaskName: String = ""
    @Published var elapsedTime: TimeInterval = 0

    private var timer: Timer?
    private var startDate: Date?

    let db: Connection
    let tasksTable = Table("tasks")
    let idExp = Expression<Int64>("id")
    let datetimeExp = Expression<String>("datetime")
    let nameExp = Expression<String>("task_name")
    let actionExp = Expression<String>("action")

    let dateFormatter: DateFormatter = {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return fmt
    }()

    init() {
        let url = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("tasks.db")
        db = try! Connection(url.path)
        try? db.run(tasksTable.create(ifNotExists: true) { t in
            t.column(idExp, primaryKey: .autoincrement)
            t.column(datetimeExp)
            t.column(nameExp)
            t.column(actionExp)
        })
        refreshSummaries()
    }

    func startTask(name: String) {
        currentTaskName = name
        startDate = Date()
        isRunning = true
        elapsedTime = 0
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            self.elapsedTime += 1
        }
        log(action: "start")
    }

    func stopCurrentTask() {
        isRunning = false
        timer?.invalidate()
        timer = nil
        log(action: "end")
        refreshSummaries()
    }

    private func log(action: String) {
        guard let startDate else { return }
        let dt = dateFormatter.string(from: Date())
        try? db.run(tasksTable.insert(datetimeExp <- dt, nameExp <- currentTaskName, actionExp <- action))
    }

    func refreshSummaries() {
        var startTimes: [String: Date] = [:]
        var totals: [String: TimeInterval] = [:]
        records.removeAll()
        for row in try! db.prepare(tasksTable.order(datetimeExp.asc)) {
            let dt = dateFormatter.date(from: row[datetimeExp]) ?? Date()
            let name = row[nameExp]
            let act = row[actionExp]
            records.append(TaskRecord(id: row[idExp], taskName: name, datetime: dt, action: act))
            if act == "start" {
                startTimes[name] = dt
            } else if act == "end" {
                if let s = startTimes.removeValue(forKey: name) {
                    let diff = dt.timeIntervalSince(s)
                    totals[name, default: 0] += diff
                }
            }
        }
        summaries = totals.map { TaskSummary(name: $0.key, total: $0.value) }
    }

    func refreshRecords(for name: String) {
        records = records.filter { $0.taskName == name }
    }

    func deleteRecord(_ rec: TaskRecord) {
        let row = tasksTable.filter(idExp == rec.id)
        try? db.run(row.delete())
        refreshSummaries()
    }

    func format(duration: TimeInterval) -> String {
        let seconds = Int(duration)
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    var elapsedTimeString: String {
        format(duration: elapsedTime)
    }
}
