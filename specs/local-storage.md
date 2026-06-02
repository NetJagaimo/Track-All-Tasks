## ADDED Requirements

### Requirement: SQLite local database

The system SHALL store all time records and configuration in a local SQLite database file within the application's data directory. No network connection SHALL be required for any functionality.

#### Scenario: Data persists across restarts

- **WHEN** the application is quit and relaunched
- **THEN** all previously saved records and settings are available

#### Scenario: No network dependency

- **WHEN** the device has no internet connection
- **THEN** all application features function normally

### Requirement: No authentication required

The system SHALL NOT require any user login, account creation, or authentication to use any feature.

#### Scenario: First launch experience

- **WHEN** the application is launched for the first time
- **THEN** the user can immediately start tracking time without any sign-up or login

### Requirement: Schema versioning

The system SHALL track database schema versions and apply migrations automatically when the application is updated to a version with schema changes.

#### Scenario: Automatic migration on update

- **WHEN** the application starts with a database from an older schema version
- **THEN** the system applies pending migrations and updates the schema version
