## Context

This is a greenfield macOS menu bar time tracking application. The project directory currently contains a Rust/Tauri-based application structure. The app must run as a menu bar (status bar) agent on macOS, persist data locally, and minimize workflow disruption through global hotkeys and idle detection.

## Goals / Non-Goals

**Goals:**

- Deliver a lightweight, native-feeling macOS menu bar time tracker
- All data stored locally in SQLite — zero cloud dependency
- Global hotkey support for hands-free operation
- Automatic idle detection to prevent inflated time records
- Simple query/export for daily and weekly overviews

**Non-Goals:**

- Cloud sync or multi-device support
- Team/collaboration features
- Detailed analytics dashboards or charts (future consideration)
- iOS/mobile companion app
- Plugin or extension system

## Decisions

### Use Tauri 2 with Rust backend and web-based UI

Tauri provides native macOS integration (menu bar, system tray, global shortcuts) with a small binary size. The Rust backend handles timing, storage, and idle detection while a lightweight HTML/CSS/JS frontend renders the UI. This aligns with the existing project structure.

**Alternatives considered:**
- Pure Swift/AppKit: Better native integration but higher development complexity and no cross-platform potential
- Electron: Much larger binary size, contradicts the "lightweight" requirement

### SQLite for local data persistence

SQLite is embedded, requires no server process, and handles the expected data volume (thousands of time entries) with ease. The database file lives in the app's data directory.

**Alternatives considered:**
- JSON file storage: Simpler but poor query performance and no transactional safety
- Core Data: macOS-only, adds complexity without significant benefit over SQLite in Tauri

### IOKit-based idle detection via Rust

Use `IOHIDGetParameter` / `CGEventSourceSecondsSinceLastEventType` from the Rust backend to monitor system idle time. A background timer checks idle state every 30 seconds and triggers pause logic when the threshold is exceeded.

**Alternatives considered:**
- Accessibility API event monitoring: More granular but requires broader permissions
- NSEvent global monitoring: Only works when the app is active, insufficient for background detection

### Menu bar popover for primary UI

The app presents a popover panel from the menu bar icon rather than a separate window. This keeps the interaction lightweight and non-disruptive. The popover contains: current task status, start/stop button, task name input with recent suggestions, and navigation to record views.

**Alternatives considered:**
- Separate main window: Heavier, contradicts the "non-disruptive" requirement
- Pure menu-based UI (NSMenu): Too limited for task input and record browsing

### Tauri global shortcut plugin for hotkeys

Use `@tauri-apps/plugin-global-shortcut` for registering system-wide keyboard shortcuts. Shortcut bindings are stored in a JSON config file and can be customized through a settings view.

**Alternatives considered:**
- Custom CGEvent tap: Lower-level, more complex to implement and maintain

## Risks / Trade-offs

- [Accessibility permissions] The app needs accessibility permissions for global hotkeys and idle detection. → Prompt the user on first launch with clear instructions; degrade gracefully if denied (disable hotkeys/idle detection but keep manual operation working).
- [Menu bar space] Long task names may not display well in the menu bar. → Truncate to a configurable character limit with full name visible in the popover.
- [Idle detection accuracy] System sleep/wake cycles may produce incorrect idle durations. → Listen for NSWorkspace sleep/wake notifications and handle them as explicit idle boundaries.
- [Data migration] Future schema changes to the SQLite database. → Include a schema version table and migration system from day one.
