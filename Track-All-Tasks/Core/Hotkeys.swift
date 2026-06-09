import Foundation
import KeyboardShortcuts

/// 全域快捷鍵名稱（SPEC §3、§6）。實際綁定與持久化由 KeyboardShortcuts 套件處理（存 UserDefaults）。
extension KeyboardShortcuts.Name {
    /// 開始 / 停止 切換鍵：閒置時開始、計時中停止。
    static let toggleTimer = Self("toggleTimer")
    /// 停止鍵：計時中停止；閒置時不動作。
    static let stopTimer = Self("stopTimer")
    /// 任務輸入鍵：彈出 popover 並把游標停在輸入欄。
    static let focusTaskInput = Self("focusTaskInput")
}
