## ADDED Requirements

### Requirement: Daily task overview

The system SHALL provide a view showing all time records for the current day, grouped by task name, with total time per task and a grand total.

#### Scenario: View today's tasks

- **WHEN** user navigates to the daily overview
- **THEN** the system displays all records for today with per-task totals and a day total

#### Scenario: View a specific date

- **WHEN** user selects a different date in the daily overview
- **THEN** the system displays all records for that date

### Requirement: Weekly overview

The system SHALL provide a weekly summary view showing total time tracked per day and per task across a 7-day period.

#### Scenario: View current week

- **WHEN** user navigates to the weekly overview
- **THEN** the system displays a summary of time per day and per task for the current week

### Requirement: Export to CSV

The system SHALL allow users to export time records for a selected date range as a CSV file containing: task name, start time, end time, and duration.

#### Scenario: Export records as CSV

- **WHEN** user selects a date range and chooses CSV export
- **THEN** the system generates and saves a CSV file with all matching records

### Requirement: Export to JSON

The system SHALL allow users to export time records for a selected date range as a JSON file.

#### Scenario: Export records as JSON

- **WHEN** user selects a date range and chooses JSON export
- **THEN** the system generates and saves a JSON file with all matching records
