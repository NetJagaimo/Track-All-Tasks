import SwiftUI
import ServiceManagement
import KeyboardShortcuts

/// 設定（SPEC §6）：閒置門檻 / 開關、全域快捷鍵、開機自動啟動。
struct SettingsView: View {
    @Bindable var settings: SettingsStore
    @State private var launchAtLogin = (SMAppService.mainApp.status == .enabled)

    var body: some View {
        Form {
            Section("閒置自動停止") {
                Toggle("啟用閒置偵測", isOn: $settings.settings.idleEnabled)
                Stepper(
                    value: $settings.settings.idleThresholdMinutes, in: 1...120
                ) {
                    Text("門檻：\(settings.settings.idleThresholdMinutes) 分鐘")
                }
                .disabled(!settings.settings.idleEnabled)
                Text("離座超過門檻沒有鍵鼠動作，會在當下自動停止計時並發通知。")
                    .font(.caption).foregroundStyle(.secondary)
            }

            Section("全域快捷鍵") {
                KeyboardShortcuts.Recorder("開始 / 停止：", name: .toggleTimer)
                KeyboardShortcuts.Recorder("停止：", name: .stopTimer)
                KeyboardShortcuts.Recorder("任務輸入：", name: .focusTaskInput)
            }

            Section("系統") {
                Toggle("開機時自動啟動", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { _, enabled in
                        setLaunchAtLogin(enabled)
                    }
            }
        }
        .formStyle(.grouped)
        .navigationTitle("設定")
    }

    private func setLaunchAtLogin(_ enabled: Bool) {
        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
        } catch {
            NSLog("[Settings] 開機啟動設定失敗：\(error.localizedDescription)")
            // 設定失敗 → 還原開關以反映真實狀態。
            launchAtLogin = (SMAppService.mainApp.status == .enabled)
        }
    }
}
