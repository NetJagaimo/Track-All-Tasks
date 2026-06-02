## ADDED Requirements

### Requirement: Global shortcut for start and stop

The system SHALL support a global keyboard shortcut to toggle time tracking (start if idle, stop if active). This shortcut SHALL work regardless of which application has focus.

#### Scenario: Toggle tracking via hotkey when idle

- **WHEN** user presses the start/stop hotkey and no session is active
- **THEN** the system opens the task input or starts tracking the last used task

#### Scenario: Toggle tracking via hotkey when active

- **WHEN** user presses the start/stop hotkey and a session is active
- **THEN** the system stops the current timing session

### Requirement: Global shortcut for task input

The system SHALL support a global keyboard shortcut to open the task name input field, allowing the user to quickly start a new task without clicking the menu bar icon.

#### Scenario: Open task input via hotkey

- **WHEN** user presses the task input hotkey
- **THEN** the popover opens with the task name input field focused

### Requirement: Customizable key bindings

Users SHALL be able to customize the keyboard shortcuts for all global hotkey actions through a settings interface. The system SHALL persist custom bindings across restarts.

#### Scenario: Change a hotkey binding

- **WHEN** user opens settings and records a new key combination for an action
- **THEN** the old binding is unregistered and the new binding becomes active immediately

#### Scenario: Bindings persist across restarts

- **WHEN** the application restarts after hotkey customization
- **THEN** the custom bindings are restored from configuration
