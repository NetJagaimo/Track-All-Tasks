import Foundation

/// App 資料目錄與檔案位置（SPEC §7）。
/// 所有本地資料都放在 `~/Library/Application Support/Track-All-Tasks/`。
enum AppPaths {
    static let folderName = "Track-All-Tasks"

    /// App 資料目錄；不存在則建立。
    static func dataDirectory() throws -> URL {
        let base = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let dir = base.appendingPathComponent(folderName, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// SQLite 資料庫位置。
    static func databaseURL() throws -> URL {
        try dataDirectory().appendingPathComponent("tracks.sqlite")
    }

    /// 設定檔位置。
    static func settingsURL() throws -> URL {
        try dataDirectory().appendingPathComponent("settings.json")
    }
}

/// ISO8601 時間 <-> 字串編解碼（SPEC：時間存 ISO8601 字串，秒級精度）。
enum DateCodec {
    nonisolated(unsafe) private static let formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]   // 例：2026-06-02T14:30:00+08:00
        return f
    }()

    static func string(from date: Date) -> String { formatter.string(from: date) }
    static func date(from string: String) -> Date? { formatter.date(from: string) }
}
