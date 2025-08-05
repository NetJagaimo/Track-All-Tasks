# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Track All Tasks is a Tauri-based desktop application for task tracking. It combines a Rust backend with a JavaScript/HTML/CSS frontend, utilizing Tauri's architecture for cross-platform desktop development.

## Architecture

### Frontend (JavaScript/Vite)
- **Technology Stack**: Vanilla JavaScript with Vite as the build tool
- **Entry Point**: `src/main.js` - handles DOM interactions and Tauri API calls
- **UI**: `index.html` with styling in `src/style.css`
- **Language**: UI text is in Traditional Chinese (歡迎使用 Track All Tasks!)

### Backend (Rust/Tauri)
- **Main Application**: `src-tauri/src/main.rs`
- **Features**:
  - System tray integration with menu and click handlers
  - Tauri commands for frontend-backend communication
  - Shell plugin integration

### Key Components

#### Tauri Backend (`src-tauri/src/main.rs`)
- **System Tray**: Configured with quit menu and left-click to show/focus window
- **Commands**: `greet` command demonstrates frontend-backend communication
- **Window Management**: Single main window (800x600, resizable)

#### Frontend Communication
- Uses `@tauri-apps/api/core` for `invoke()` calls to Rust backend
- Current implementation has basic greeting functionality as a foundation

## Development Commands

### Development Server
```bash
npm run tauri dev
```
This starts both the Vite dev server (http://localhost:5173) and the Tauri development build.

### Build Commands
```bash
npm run dev        # Start Vite dev server only
npm run build      # Build frontend for production
npm run preview    # Preview production build
npm run tauri      # Run Tauri CLI commands
```

### Production Build
```bash
npm run tauri build
```

## Configuration Files

- **`package.json`**: Node.js dependencies and npm scripts
- **`src-tauri/Cargo.toml`**: Rust dependencies including Tauri core, shell plugin, and serde
- **`src-tauri/tauri.conf.json`**: Tauri application configuration
- **`vite.config.js`**: Vite configuration optimized for Tauri development

## Development Setup

The project uses:
- **Frontend**: Vite development server on port 5173 (fixed port for Tauri)
- **Backend**: Cargo for Rust compilation and dependency management
- **Integration**: Tauri handles the bridge between frontend and backend

## Project Structure Notes

- Frontend code resides in `src/` directory
- Backend Rust code in `src-tauri/src/`
- Tauri configuration and build artifacts in `src-tauri/`
- Application uses system tray functionality for background operation
- UI currently supports both light and dark color schemes via CSS media queries

## 專案需求與目標

### ✅ 功能需求

#### 1. 基本計時功能
- 可記錄一個任務（activity）的「開始時間」與「結束時間」
- 每個紀錄包含：
  - 任務名稱／標籤
  - 開始時間
  - 結束時間
  - 總花費時間（自動計算）
- 任務名稱可手動輸入，或從最近任務快速選取

#### 2. 狀態列操作
- 程式常駐 macOS 狀態列（menu bar）
- 可從狀態列啟動／停止計時
- 狀態列圖示顯示目前是否正在計時與任務名稱

#### 3. 快捷鍵控制
- 支援全域快捷鍵操作：
  - 開始／停止計時
  - 快速開啟任務輸入
- 快捷鍵可自訂

#### 4. 任務記錄查詢與匯出
- 提供簡易查詢界面（如今日任務、週次概覽）
- 支援匯出記錄為 CSV / JSON 格式

#### 5. 可補登／編輯
- 支援手動補登過去的任務
- 可編輯既有任務的名稱與時間區段

#### 6. 自動偵測閒置狀態
- 系統自動偵測使用者是否有操作（如滑鼠移動或鍵盤輸入）
- 若連續超過設定時間未偵測到動作，則自動停止目前的計時任務
- 可自訂閒置偵測時間門檻（如 5 分鐘、10 分鐘）
- 停止後可提示使用者是否要保留該段時間的紀錄或略過

### 🔧 非功能需求

#### 1. 輕量簡潔
- 軟體體積小、載入快速、效能佳
- 界面清晰、操作直觀，避免複雜設定

#### 2. 隱私優先
- 所有資料儲存在本機，不依賴雲端
- 無需登入即可使用

#### 3. 不干擾工作流程
- 不主動彈出通知，不打擾使用者
- 多數操作可透過快捷鍵完成，避免視窗切換

#### 4. 易於擴充
- 可考慮日後擴充功能，如：
  - 類別／標籤系統
  - 自動備份機制
  - 簡易統計圖表（每日、每週、每月時間分布）