## ADDED Requirements

### Requirement: Manual time entry

The system SHALL allow users to manually create a time record by specifying a task name, start time, and end time for a past period.

#### Scenario: Add a manual entry

- **WHEN** user fills in task name, start time, and end time in the manual entry form
- **THEN** the system creates a time record with the provided values and calculates the duration

#### Scenario: Reject invalid manual entry

- **WHEN** user submits a manual entry where end time is before start time
- **THEN** the system rejects the entry and displays a validation error

### Requirement: Edit existing records

The system SHALL allow users to edit the task name, start time, and end time of any existing time record.

#### Scenario: Edit task name

- **WHEN** user modifies the task name of an existing record and saves
- **THEN** the record is updated with the new task name

#### Scenario: Edit time range

- **WHEN** user modifies the start or end time of an existing record and saves
- **THEN** the record is updated and the duration is recalculated

### Requirement: Delete records

The system SHALL allow users to delete existing time records.

#### Scenario: Delete a record

- **WHEN** user selects a record and confirms deletion
- **THEN** the record is permanently removed from storage
