## ADDED Requirements

### Requirement: Start and stop time tracking

The system SHALL allow users to start a timing session for a task and stop it to complete the record. When a session is started, the system SHALL record the current timestamp as the start time. When stopped, the system SHALL record the current timestamp as the end time and calculate the total duration.

#### Scenario: Start a new timing session

- **WHEN** user initiates a start action with a task name
- **THEN** the system records the current time as the session start time and enters the "tracking" state

#### Scenario: Stop an active timing session

- **WHEN** user initiates a stop action while a session is active
- **THEN** the system records the current time as the session end time, calculates the duration, and persists the completed record

#### Scenario: Prevent overlapping sessions

- **WHEN** user attempts to start a new session while one is already active
- **THEN** the system SHALL stop the current session first, then start the new one

### Requirement: Task naming

The system SHALL require each timing session to have a task name. Users SHALL be able to type a custom name or select from a list of recently used task names.

#### Scenario: Enter custom task name

- **WHEN** user types a task name that does not match any recent task
- **THEN** the system accepts the name and associates it with the timing session

#### Scenario: Select from recent tasks

- **WHEN** user views the task input field
- **THEN** the system SHALL display up to 10 most recently used task names for quick selection

### Requirement: Duration calculation

The system SHALL automatically calculate the total time spent on a task as the difference between end time and start time, displayed in hours and minutes.

#### Scenario: Duration is calculated on stop

- **WHEN** a timing session is stopped
- **THEN** the system calculates and stores the duration as end_time minus start_time

#### Scenario: Live duration display during tracking

- **WHEN** a timing session is active
- **THEN** the system SHALL display the elapsed time updating at least every second
