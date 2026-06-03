import Foundation
import CoreGraphics

/// 閒置偵測（SPEC §2 閒置偵測）。每約 10 秒輪詢系統最後輸入事件距今秒數
/// （`CGEventSource`，免權限）。超過門檻就回呼 `onExceeded`。
@MainActor
final class IdleMonitor {
    /// 回傳目前的閒置門檻秒數；回 nil 表示「此刻不該偵測」（未計時或已關閉）。
    var thresholdProvider: () -> TimeInterval? = { nil }
    /// 閒置超過門檻時呼叫（在 main）。
    var onExceeded: () -> Void = {}

    private var timer: Timer?
    private let pollInterval: TimeInterval = 10

    func start() {
        stop()
        timer = Timer.scheduledTimer(withTimeInterval: pollInterval, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    private func tick() {
        guard let threshold = thresholdProvider() else { return }
        if currentIdleSeconds() >= threshold {
            onExceeded()
        }
    }

    /// 系統最後一次任何輸入事件距今的秒數。
    private func currentIdleSeconds() -> TimeInterval {
        let anyInput = CGEventType(rawValue: ~0) ?? .null
        return CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: anyInput)
    }
}
