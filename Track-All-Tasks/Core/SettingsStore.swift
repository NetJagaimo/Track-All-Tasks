import Foundation
import Observation

/// 設定的讀寫與持久化（SPEC §6）。存成 App 資料目錄的 `settings.json`。
/// 以 `@Observable` 供 UI 綁定；任何變更立即寫回磁碟。
@Observable
@MainActor
final class SettingsStore {
    var settings: AppSettings {
        didSet {
            guard settings != oldValue else { return }
            persist()
        }
    }

    init() {
        self.settings = Self.load()
    }

    /// 從磁碟載入；失敗（首次啟動 / 損毀）回預設值。
    private static func load() -> AppSettings {
        guard
            let url = try? AppPaths.settingsURL(),
            let data = try? Data(contentsOf: url),
            let decoded = try? JSONDecoder().decode(AppSettings.self, from: data)
        else {
            return .default
        }
        return decoded
    }

    private func persist() {
        guard let url = try? AppPaths.settingsURL() else { return }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(settings) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
