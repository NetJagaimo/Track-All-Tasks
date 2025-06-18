# Track All Tasks (TAT)

簡單的時間追蹤工具，讓你知道每項任務花了多少時間。

## 使用方法
- `tat start <task>`：開始追蹤任務。
- `tat end <task>`：手動結束任務。
- `tat list`：列出所有任務及其累積時間。

## 編譯方式

### CLI 版本
進入 `tat` 目錄後執行：

```bash
cargo build --release
```

完成後可在 `target/release/tat` 找到可執行檔。

### macOS 介面版
macOS 需要 Swift 及 Xcode。使用下列方式產生執行檔：

```bash
xcrun xcodebuild -scheme TATMacApp -configuration Release
```

或直接以 Xcode 開啟 `TATMacApp/Package.swift` 進行建置。此版本在狀態列會顯示目前執行中的任務與經過時間。
