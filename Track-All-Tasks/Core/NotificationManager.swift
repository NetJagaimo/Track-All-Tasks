import Foundation
import UserNotifications

/// 系統通知（SPEC §6）。唯一會跳授權的地方：第一次閒置自動停止時才請求。
enum NotificationManager {
    /// 閒置自動停止後發通知。第一次需要時才請求授權。
    static func notifyIdleStopped(taskName: String, duration: String) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .notDetermined:
                center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
                    if granted { post(taskName: taskName, duration: duration) }
                }
            case .authorized, .provisional:
                post(taskName: taskName, duration: duration)
            default:
                break   // 使用者關閉通知，不再打擾。
            }
        }
    }

    private static func post(taskName: String, duration: String) {
        let content = UNMutableNotificationContent()
        content.title = "因閒置已停止計時"
        content.body = "「\(taskName)」已計時 \(duration)"
        content.sound = .default
        // 是否「停留在畫面上不自動消失」取決於系統設定裡本 App 的「提醒樣式」要選「提醒」而非「橫幅」，
        // App 無法用程式強制覆寫這個選項。（time-sensitive 等級需開發者憑證 entitlement，本機 ad-hoc 簽章不便加。）
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil   // 立即送出
        )
        UNUserNotificationCenter.current().add(request)
    }
}
