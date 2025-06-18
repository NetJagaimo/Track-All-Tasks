# Track All Tasks (TAT)

簡單的時間追蹤工具，讓你知道每項任務花了多少時間。

## 使用方法
- `tat start <task>`：開始追蹤任務。
- `tat end <task>`：手動結束任務。
- `tat list`：列出所有任務及其累積時間。

## GUI
此專案也包含以 **Tauri** 製作的圖形介面，位於 `gui/` 目錄。
在 macOS 上編譯可執行檔的步驟如下：

```bash
# 安裝 Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 進入專案資料夾
cd Track-All-Tasks/gui/src-tauri

# 安裝前端依賴（若需要）
npm install

# 產生執行檔
cargo tauri build
```

編譯完成後，可在 `src-tauri/target/release/bundle/macos` 找到 `.app` 檔案。
