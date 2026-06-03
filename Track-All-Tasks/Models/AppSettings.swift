import Foundation

/// App 設定（SPEC §6）。存成 App 資料目錄下的 `settings.json`，不進 SQLite。
/// 快捷鍵與開機啟動由系統機制（KeyboardShortcuts / SMAppService）保管，不在此。
struct AppSettings: Codable, Equatable, Sendable {
    /// 是否啟用閒置自動停止。
    var idleEnabled: Bool
    /// 閒置門檻（分鐘）。最少 1，預設 5。
    var idleThresholdMinutes: Int

    static let `default` = AppSettings(idleEnabled: true, idleThresholdMinutes: 5)

    /// 門檻秒數（已套用「最少 1 分鐘」下限）。
    var idleThresholdSeconds: TimeInterval {
        TimeInterval(max(1, idleThresholdMinutes) * 60)
    }
}
