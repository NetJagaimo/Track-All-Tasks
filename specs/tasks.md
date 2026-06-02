## 1. Project Setup and Local Storage

- [x] 1.1 Initialize Tauri 2 project structure with menu bar (LSUIElement) configuration — use Tauri 2 with Rust backend and web-based UI
- [x] 1.2 Set up SQLite for local data persistence with schema versioning and migration system — implement SQLite local database and schema versioning requirements
- [x] 1.3 Create data models and database tables for time records (task name, start time, end time, duration) — support no authentication required

## 2. Time Tracking Core

- [x] 2.1 Implement start and stop time tracking engine in Rust backend with timestamp recording and duration calculation
- [x] 2.2 Implement task naming with recent task list (up to 10 entries) for quick selection
- [x] 2.3 Add live duration calculation updating every second during active sessions
- [x] 2.4 Handle prevent overlapping sessions logic — auto-stop current session before starting new one

## 3. Menu Bar UI

- [x] 3.1 Implement menu bar presence as macOS status bar agent with no Dock icon
- [x] 3.2 Implement menu bar icon state indication — neutral icon when idle, active icon with task name when tracking
- [x] 3.3 Build popover interface — menu bar popover for primary UI with start/stop button, task name input, and recent task suggestions
- [x] 3.4 Implement start and stop from menu bar via popover controls

## 4. Global Hotkeys

- [x] 4.1 Integrate Tauri global shortcut plugin for hotkeys — implement global shortcut for start and stop
- [x] 4.2 Add global shortcut for task input to open popover with focused input field
- [x] 4.3 Build settings UI for customizable key bindings with persistence across restarts

## 5. Record Management

- [x] 5.1 Implement manual time entry form with validation (reject end time before start time)
- [x] 5.2 Implement edit existing records — allow modifying task name, start time, end time with duration recalculation
- [x] 5.3 Implement delete records with confirmation

## 6. Query and Export

- [x] 6.1 Build daily task overview view with per-task totals and date selection
- [x] 6.2 Build weekly overview showing time per day and per task
- [x] 6.3 Implement export to CSV for selected date range
- [x] 6.4 Implement export to JSON for selected date range

## 7. Idle Detection

- [x] 7.1 Implement detect user idle state using IOKit-based idle detection via Rust — monitor mouse/keyboard activity
- [x] 7.2 Add configurable idle threshold setting (default 5 minutes, minimum 1 minute) and option to disable idle detection
- [x] 7.3 Implement idle time disposition prompt — let user choose to keep or trim idle time from record
- [x] 7.4 Handle system sleep/wake events as idle boundaries
