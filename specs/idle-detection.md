## ADDED Requirements

### Requirement: Detect user idle state

The system SHALL monitor user activity (mouse movement, keyboard input) and detect when the user has been idle for longer than a configured threshold.

#### Scenario: User goes idle during active tracking

- **WHEN** a timing session is active and no user input is detected for the configured threshold duration
- **THEN** the system SHALL automatically stop the timing session

#### Scenario: No action when not tracking

- **WHEN** no timing session is active and the user goes idle
- **THEN** the system takes no action

### Requirement: Configurable idle threshold

The system SHALL allow users to configure the idle detection threshold in minutes. The default threshold SHALL be 5 minutes. The minimum allowed value SHALL be 1 minute.

#### Scenario: Change idle threshold

- **WHEN** user sets the idle threshold to 10 minutes in settings
- **THEN** idle detection uses 10 minutes as the inactivity threshold

### Requirement: Idle time disposition prompt

When a timing session is stopped due to idle detection, the system SHALL prompt the user (upon their return) to choose whether to keep the idle period in the record or trim the record to the moment idle was detected.

#### Scenario: User keeps idle time

- **WHEN** the idle prompt appears and user chooses "Keep"
- **THEN** the record end time remains as the moment of auto-stop

#### Scenario: User trims idle time

- **WHEN** the idle prompt appears and user chooses "Trim"
- **THEN** the record end time is adjusted to the last detected user activity before idle

### Requirement: Disable idle detection

The system SHALL allow users to disable idle detection entirely.

#### Scenario: Disable idle detection

- **WHEN** user disables idle detection in settings
- **THEN** the system does not monitor idle state or auto-stop sessions
