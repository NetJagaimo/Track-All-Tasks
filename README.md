# Track All Tasks (TAT)

簡單的時間追蹤工具，讓你知道每項任務花了多少時間。

## 使用方法
- `tat start <task>`：開始追蹤任務。
- `tat end <task>`：手動結束任務。
- `tat list`：列出所有任務及其累積時間。

## GUI 版
本倉庫也提供 macOS 上可運行的 Tauri 介面，目錄位於 `tat-gui/`。

### 編譯步驟
1. 安裝 Rust 與 Node.js
2. 進入 `tat-gui` 目錄執行 `cargo build --release`
3. 編譯完成後的執行檔位於 `tat-gui/target/release/tat-gui`

啟動後會在狀態列看到目前執行中的任務與經過時間。
