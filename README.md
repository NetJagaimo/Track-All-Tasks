# Track All Tasks (TAT)

🎯 現代化的任務時間追蹤應用程式，使用 Tauri + Rust 建構，提供優雅的桌面界面來管理您的任務時間。

## ✨ 功能特色

- 📝 **直觀的任務管理**：簡單易用的界面來開始和結束任務
- ⏱️ **即時計時器**：查看當前任務的即時運行時間
- 📊 **任務歷史**：完整的任務記錄和時間統計
- 💾 **數據持久化**：使用 SQLite 本地存儲，數據安全可靠
- 🎨 **現代化設計**：響應式 UI 設計，支援深色主題
- ⚡ **高性能**：Rust 後端提供卓越的性能和可靠性

## 🛠️ 技術架構

- **前端**：HTML5 + CSS3 + JavaScript
- **後端**：Rust
- **框架**：Tauri 2.x
- **數據庫**：SQLite
- **UI 框架**：原生 Web 技術

## 📋 項目結構

```
Track-All-Tasks/
├── README.md              # 項目說明文件
├── dist/                  # 前端資源
│   ├── index.html         # 主 HTML 檔案
│   ├── styles.css         # 樣式表
│   └── main.js           # JavaScript 前端邏輯
└── tat/                   # Tauri 應用程式
    ├── Cargo.toml         # Rust 依賴配置
    ├── tauri.conf.json    # Tauri 應用程式配置
    ├── build.rs           # 建構腳本
    ├── src/
    │   └── main.rs        # Rust 後端代碼
    └── target/
        └── debug/
            └── tat        # 建構好的應用程式
```

## 🚀 快速開始

### 系統需求

- **Rust** 1.70+
- **Node.js** 16+ (可選，用於開發工具)
- **macOS** 10.13+ / **Windows** 10+ / **Linux**

### 安裝依賴

```bash
# 克隆項目
git clone <your-repo-url>
cd Track-All-Tasks

# 進入 Tauri 應用程式目錄
cd tat

# 安裝 Rust 依賴
cargo build
```

### 開發模式運行

```bash
# 方法 1：使用 Tauri CLI (推薦)
cargo tauri dev

# 方法 2：直接運行建構的二進位檔案
./target/debug/tat
```

### 建構發布版本

```bash
# 建構 debug 版本
cargo build

# 建構 release 版本
cargo build --release

# 建構 Tauri 應用程式包
cargo tauri build
```

## 💻 使用方法

### 桌面應用程式

1. **啟動應用程式**：運行建構好的可執行檔案
2. **開始任務**：
   - 在輸入框中輸入任務名稱
   - 點擊「開始任務」按鈕
   - 計時器會開始顯示已運行時間
3. **結束任務**：
   - 點擊「結束任務」按鈕
   - 任務會被記錄到歷史中
4. **查看歷史**：
   - 在應用程式下方查看所有任務記錄
   - 顯示開始時間、結束時間和持續時間

### 命令行界面 (傳統模式)

```bash
# 開始追蹤任務 (會持續運行直到 Ctrl+C)
tat start "寫程式"

# 手動結束任務
tat end "寫程式"

# 列出所有任務及其累積時間
tat list
```

## 🔧 開發指南

### 添加新功能

1. **後端 Rust 代碼**：編輯 `tat/src/main.rs`
2. **前端界面**：編輯 `dist/` 目錄下的 HTML/CSS/JS 檔案
3. **配置**：修改 `tat/tauri.conf.json`

### 調試

```bash
# 檢查 Rust 代碼
cargo check

# 運行測試
cargo test

# 查看詳細輸出
RUST_LOG=debug ./target/debug/tat
```

## 📦 部署

### 本地安裝

```bash
# 建構 release 版本
cargo build --release

# 複製到系統路徑 (可選)
cp target/release/tat /usr/local/bin/
```

### 打包分發

```bash
# 使用 Tauri 打包
cargo tauri build

# 建構產物將在以下目錄：
# - macOS: target/release/bundle/macos/
# - Windows: target/release/bundle/msi/
# - Linux: target/release/bundle/appimage/
```

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

1. Fork 此項目
2. 創建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打開一個 Pull Request

## 📄 許可證

此項目使用 MIT 許可證 - 查看 [LICENSE](LICENSE) 文件了解詳情。

## 🔗 相關鏈接

- [Tauri 官方文檔](https://tauri.app/)
- [Rust 官方網站](https://rust-lang.org/)
- [SQLite 文檔](https://sqlite.org/docs.html)
