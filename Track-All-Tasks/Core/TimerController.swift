import Foundation
import Observation
import AppKit

extension Notification.Name {
    /// 請求把 popover 打開並聚焦任務輸入欄（全域快捷鍵 focusTaskInput 用）。
    static let focusTaskInputRequested = Notification.Name("TAT.focusTaskInputRequested")
}

/// 停止計時的原因。
enum StopReason {
    case manual   // 使用者手動 / 切換
    case idle     // 閒置自動停止（會發通知）
    case sleep    // 睡眠 / 喚醒收尾
}

/// 計時引擎（SPEC §2）。App 的中央狀態與資料樞紐，UI 透過它觀察與操作。
/// 以 `@Observable` 供 SwiftUI 綁定；秒級時長用手動 `Timer` 更新。
@Observable
@MainActor
final class TimerController {
    // MARK: 對外狀態
    private(set) var isRunning = false
    private(set) var currentTaskID: UUID?
    private(set) var currentTaskName: String = ""
    private(set) var elapsedSeconds: TimeInterval = 0
    /// 進行中清單（popover 快選與主視窗共用）。
    private(set) var activeTasks: [TaskItem] = []

    /// 計時中的時鐘字串（`MM:SS` / `H:MM:SS`）。
    var elapsedClock: String { Formatting.clock(elapsedSeconds) }

    // MARK: 依賴（internal：供 TimerController+Library 擴充使用）
    let taskStore: TaskStore
    let recordStore: RecordStore
    private let settings: SettingsStore
    private let idleMonitor = IdleMonitor()

    // MARK: 計時內部狀態
    private var currentRecordID: UUID?
    private var startedAt: Date?
    private var lastHeartbeat: Date?
    private var lastTaskID: UUID?

    private var uiTimer: Timer?
    private var heartbeatTimer: Timer?
    private let heartbeatInterval: TimeInterval = 60

    init(tasks: TaskStore, records: RecordStore, settings: SettingsStore) {
        self.taskStore = tasks
        self.recordStore = records
        self.settings = settings
        configureIdleMonitor()
    }

    // MARK: - 啟動

    /// App 啟動時呼叫：先收尾當機 / 上次遺留的未結束紀錄，再載入清單、裝睡眠監聽。
    func bootstrap() async {
        do {
            _ = try await recordStore.finalizeOrphans()   // 當機復原：把 end=null 收尾在心跳
        } catch {
            logError("finalizeOrphans 失敗", error)
        }
        await reloadActiveTasks()
        installSleepWakeObservers()
        idleMonitor.start()
    }

    // MARK: - 計時控制

    /// 用任務名稱開始（popover 打字 / 既有名稱）。已在計時則先停舊的。
    func start(taskName: String) async {
        let name = taskName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        if isRunning { await stop(reason: .manual) }
        do {
            let task = try await taskStore.ensureActiveTask(named: name)
            await beginTiming(task: task)
        } catch {
            logError("start(taskName:) 失敗", error)
        }
    }

    /// 用既有任務開始（進行中清單快選）。
    func start(taskID: UUID) async {
        if isRunning { await stop(reason: .manual) }
        do {
            guard let task = try await taskStore.task(id: taskID), task.state == .active else { return }
            await beginTiming(task: task)
        } catch {
            logError("start(taskID:) 失敗", error)
        }
    }

    /// 全域切換鍵：計時中→停止；閒置中→開始（沿用上次或第一個進行中任務，皆無則請求輸入）。
    func toggle() async {
        if isRunning {
            await stop(reason: .manual)
            return
        }
        if let id = lastTaskID, let task = try? await taskStore.task(id: id), task.state == .active {
            await beginTiming(task: task)
        } else if let first = activeTasks.first {
            await beginTiming(task: first)
        } else {
            // 沒有可用任務 → 打開 popover 聚焦輸入欄。
            NotificationCenter.default.post(name: .focusTaskInputRequested, object: nil)
        }
    }

    /// 停止計時。
    func stop(reason: StopReason) async {
        guard isRunning, let recordID = currentRecordID else { return }
        let end = (reason == .sleep) ? (lastHeartbeat ?? Date()) : Date()
        let stoppedName = currentTaskName
        let stoppedDuration = elapsedSeconds
        do {
            try await recordStore.stopRecord(id: recordID, at: end)
        } catch {
            logError("stopRecord 失敗", error)
        }
        resetTimingState()
        await reloadActiveTasks()

        if reason == .idle {
            NotificationManager.notifyIdleStopped(
                taskName: stoppedName,
                duration: Formatting.clock(stoppedDuration)
            )
        }
    }

    // MARK: - 任務操作（轉發資料層，操作後刷新清單）

    func reloadActiveTasks() async {
        do {
            activeTasks = try await taskStore.activeTasks()
        } catch {
            logError("reloadActiveTasks 失敗", error)
        }
    }

    // MARK: - 私有：計時生命週期

    private func beginTiming(task: TaskItem) async {
        let now = Date()
        do {
            let record = try await recordStore.startRecord(taskID: task.id, at: now)
            currentRecordID = record.id
            currentTaskID = task.id
            currentTaskName = task.name
            lastTaskID = task.id
            startedAt = now
            lastHeartbeat = now
            elapsedSeconds = 0
            isRunning = true
            startTimers()
            await reloadActiveTasks()
        } catch {
            logError("beginTiming 失敗", error)
        }
    }

    private func resetTimingState() {
        stopTimers()
        isRunning = false
        currentRecordID = nil
        currentTaskID = nil
        currentTaskName = ""
        startedAt = nil
        lastHeartbeat = nil
        elapsedSeconds = 0
    }

    private func startTimers() {
        stopTimers()
        // 秒級 UI 跳動
        uiTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, let start = self.startedAt else { return }
                self.elapsedSeconds = Date().timeIntervalSince(start)
            }
        }
        // 每分鐘心跳（當機 / 睡眠復原用）
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: heartbeatInterval, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.beat() }
        }
    }

    private func stopTimers() {
        uiTimer?.invalidate(); uiTimer = nil
        heartbeatTimer?.invalidate(); heartbeatTimer = nil
    }

    private func beat() {
        guard isRunning, let recordID = currentRecordID else { return }
        let now = Date()
        lastHeartbeat = now
        Task { [recordStore] in
            try? await recordStore.updateHeartbeat(id: recordID, at: now)
        }
    }

    // MARK: - 閒置 / 睡眠

    private func configureIdleMonitor() {
        idleMonitor.thresholdProvider = { [weak self] in
            guard let self, self.isRunning, self.settings.settings.idleEnabled else { return nil }
            return self.settings.settings.idleThresholdSeconds
        }
        idleMonitor.onExceeded = { [weak self] in
            Task { await self?.stop(reason: .idle) }
        }
    }

    private func installSleepWakeObservers() {
        let nc = NSWorkspace.shared.notificationCenter
        // 喚醒：把計時收尾在最後一次心跳並停止（SPEC：睡眠視同中斷）。
        nc.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, self.isRunning else { return }
                Task { await self.stop(reason: .sleep) }
            }
        }
    }

    func logError(_ message: String, _ error: Error) {
        NSLog("[TimerController] \(message): \(error.localizedDescription)")
    }
}
