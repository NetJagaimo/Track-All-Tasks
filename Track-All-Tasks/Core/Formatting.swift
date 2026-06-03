import Foundation

/// 時長 / 時間的顯示格式（SPEC §4、§5）。
enum Formatting {
    /// 總覽用：`1h 23m`（時 / 分，捨去秒）。0 分鐘顯示 `0m`。
    static func hm(_ seconds: TimeInterval) -> String {
        let total = Int(seconds.rounded())
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        return "\(minutes)m"
    }

    /// 計時中 / 選單列用：`HH:MM:SS` 或 `MM:SS`（秒級跳動）。
    static func clock(_ seconds: TimeInterval) -> String {
        let total = max(0, Int(seconds))
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%02d:%02d", m, s)
    }

    /// 任務名稱前 3 個字（選單列顯示用，避免截斷 UTF-8 字元）。
    static func prefix3(_ name: String) -> String {
        String(name.prefix(3))
    }
}
