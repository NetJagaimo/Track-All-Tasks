# Track All Tasks (TAT)

簡單的時間追蹤工具，讓你知道每項任務花了多少時間。

## CLI 使用方法
- `tat start <task>`：開始追蹤任務。
- `tat end <task>`：手動結束任務。
- `tat list`：列出所有任務及其累積時間。

## GUI 編譯方式
此專案使用 [Tauri](https://tauri.app/) 2 製作桌面介面，GUI 程式位於 `tat_gui` 目錄。

在編譯 GUI 前，請先依照 Tauri 官方文件安裝系統套件（例如在 Linux 需安裝 `libwebkit2gtk` 等，macOS 則安裝 Xcode Command Line Tools）。

編譯執行檔（以 macOS 為例）：
```bash
# 安裝 Rust 與前置依賴後執行
cargo build --release -p tat_gui
```
產生的二進位檔位於 `target/release/tat_gui`。

執行後即可看到主要視窗以及狀態列圖示。
