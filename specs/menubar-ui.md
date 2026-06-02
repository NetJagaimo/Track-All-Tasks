## ADDED Requirements

### Requirement: Menu bar presence

The application SHALL run as a macOS menu bar agent with an icon in the system status bar. The app SHALL NOT appear in the Dock.

#### Scenario: App launches in menu bar

- **WHEN** the application starts
- **THEN** an icon appears in the macOS menu bar and no Dock icon is shown

### Requirement: Menu bar icon state indication

The menu bar icon SHALL visually indicate whether time tracking is active. When tracking, the icon SHALL also display the current task name (truncated if necessary).

#### Scenario: Idle state display

- **WHEN** no timing session is active
- **THEN** the menu bar shows a neutral icon without task name text

#### Scenario: Active tracking display

- **WHEN** a timing session is active
- **THEN** the menu bar shows an active icon and the current task name (truncated to 20 characters)

### Requirement: Popover interface

Clicking the menu bar icon SHALL open a popover panel containing: the current tracking status, a start/stop button, a task name input field with recent suggestions, and navigation to records and settings views.

#### Scenario: Open popover

- **WHEN** user clicks the menu bar icon
- **THEN** a popover panel appears below the icon showing the current state and controls

#### Scenario: Close popover

- **WHEN** user clicks outside the popover or presses Escape
- **THEN** the popover closes

### Requirement: Start and stop from menu bar

The popover SHALL provide a button to start or stop the current timing session.

#### Scenario: Start tracking from popover

- **WHEN** user enters a task name and clicks the start button
- **THEN** the timing session begins and the UI updates to show the active state

#### Scenario: Stop tracking from popover

- **WHEN** user clicks the stop button while tracking is active
- **THEN** the timing session ends and the record is saved
