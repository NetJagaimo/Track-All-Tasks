# Track All Tasks - 工作時間記錄器

專為 macOS 設計的工作時間記錄軟體，使用 Tauri 2.0 開發。

![Platform](https://img.shields.io/badge/platform-macOS-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)

## ✨ 主要功能

- **工作計時** - 準確記錄每項工作的時間
- **項目分類統計** - 相同工作項目會自動合併計算總時數
- **選單列整合** - 縮小到選單列，隨時查看計時狀態
- **全域快速鍵** - 用快速鍵隨時開始或停止計時
- **智慧輸入** - 支援選取最近的工作項目，還有鍵盤操作

## 🚀 開始使用

### 系統需求
- macOS 10.15 以上版本
- 大約 50MB 硬碟空間

### 安裝方式
```bash
# 下載程式碼
git clone https://github.com/yourusername/track-all-tasks.git
cd track-all-tasks

# 安裝相關套件
npm install

# 執行程式
npm run tauri dev
```

## 📖 操作說明

### 基本使用
1. 在輸入框打上工作項目名稱
2. 按「開始」按鈕或 Enter 鍵開始計時
3. 工作完成後按「停止」按鈕結束計時
4. 切換到統計頁面查看工作時間分析

### 鍵盤操作
| 按鍵 | 功能 |
|------|------|
| `Enter` | 開始計時 |
| `Tab` | 快速選取建議的工作項目 |
| `↑/↓` | 瀏覽工作項目清單 |
| `ESC` | 取消選取 |

### 全域快速鍵
| 按鍵組合 | 功能 |
|----------|------|
| `⌘+Shift+T` | 開始/停止計時 |
| `⌘+Shift+S` | 顯示主視窗 |
| `⌘+Shift+Q` | 快速開始新工作 |

### 統計報表
- **今日統計** - 查看今天各工作項目的時間分配
- **全部統計** - 查看所有工作項目的累計時間
- **詳細記錄** - 點選工作項目可以看到每次計時的詳細資料

## 🛠️ 編譯執行檔

```bash
npm run tauri build
```

編譯好的 `.app` 檔案會放在 `src-tauri/target/release/bundle/macos/` 資料夾

## 📝 資料存放

所有工作記錄都會存在 `~/.track-all-tasks/tasks.json` 檔案裡，包括：
- 工作項目記錄
- 計時歷程
- 最近使用的工作項目名稱

---

使用 Tauri + Rust + JavaScript 開發