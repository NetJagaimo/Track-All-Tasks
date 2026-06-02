## Why

A lightweight, privacy-first macOS menu bar time tracking application is needed to help users track how they spend their working hours without disrupting their workflow. Existing solutions are often cloud-dependent, bloated, or require complex setup. This app will live in the macOS status bar, be controllable via global hotkeys, and store all data locally.

## What Changes

- Introduce a native macOS menu bar application for time tracking
- Support start/stop timing with task name/label assignment
- Provide global hotkey support for hands-free operation
- Auto-detect idle state and pause tracking accordingly
- Enable manual entry and editing of past time records
- Offer daily/weekly query views and CSV/JSON export
- Store all data locally with no cloud dependency

## Capabilities

### New Capabilities

- `time-tracking-core`: Core timing engine — start/stop recording, task naming, duration calculation, and recent task quick-select
- `menubar-ui`: macOS status bar integration — menu bar icon, current task display, start/stop controls, and task input interface
- `global-hotkeys`: System-wide keyboard shortcuts — start/stop timing, open task input, customizable key bindings
- `record-management`: Task record CRUD — manual entry of past tasks, editing existing records (name, time range), and record persistence
- `query-and-export`: Record querying and export — daily/weekly overview, CSV and JSON export formats
- `idle-detection`: Automatic idle state detection — monitor user activity (mouse/keyboard), configurable idle threshold, prompt to keep or discard idle time
- `local-storage`: Local-only data persistence — on-device SQLite storage, no cloud sync, no login required

### Modified Capabilities

(none)

## Impact

- Affected code: New macOS application (Swift/AppKit or Tauri-based), menu bar integration, global hotkey registration, idle detection via IOKit/CGEvent, local SQLite database
- Dependencies: macOS accessibility permissions (for global hotkeys and idle detection)
- Systems: macOS 13+ (Ventura and later)
