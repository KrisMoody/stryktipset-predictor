## ADDED Requirements

### Requirement: Failed Games Retry with Race Condition Handling
The admin retry endpoint SHALL handle race conditions gracefully when a failed game record has been deleted by a concurrent background sync.

#### Scenario: Record deleted before retry starts
- **WHEN** admin clicks retry on a failed game
- **AND** the record was already deleted by a background sync
- **THEN** the system SHALL return `success: true` with `alreadyResolved: true`
- **AND** the message SHALL indicate the game was already processed

#### Scenario: Record deleted during retry operation
- **WHEN** admin clicks retry on a failed game
- **AND** the record exists when fetched but is deleted before status update
- **THEN** the system SHALL catch the P2025 error gracefully
- **AND** the system SHALL check if the match was created concurrently
- **AND** return `success: true` with `alreadyResolved: true`

#### Scenario: Match already exists in database
- **WHEN** admin clicks retry on a failed game
- **AND** the match already exists in the database (created by concurrent sync)
- **THEN** the system SHALL return `success: true` with `alreadyResolved: true`
- **AND** the failed game record SHALL be marked as resolved (if still exists)

#### Scenario: Normal retry success
- **WHEN** admin clicks retry on a failed game
- **AND** the record exists and no concurrent sync is running
- **THEN** the system SHALL fetch match data from API
- **AND** process the match normally
- **AND** return `success: true` with the created match ID

### Requirement: Admin UI Retry Feedback
The admin interface SHALL provide clear feedback when retrying failed games.

#### Scenario: Already resolved notification
- **WHEN** retry returns `alreadyResolved: true`
- **THEN** the UI SHALL show an info-colored toast
- **AND** the title SHALL be "Already Resolved"
- **AND** the failed games list SHALL refresh

#### Scenario: Success notification
- **WHEN** retry returns success without `alreadyResolved`
- **THEN** the UI SHALL show a success-colored toast
- **AND** the title SHALL be "Retry Successful"
- **AND** the failed games list SHALL refresh

#### Scenario: Error notification
- **WHEN** retry returns an error
- **THEN** the UI SHALL show an error-colored toast
- **AND** the title SHALL be "Retry Failed"
- **AND** the error message SHALL be displayed

### Requirement: Failed Games Auto-refresh
The failed games list SHALL automatically refresh to prevent stale data.

#### Scenario: Periodic refresh while visible
- **GIVEN** the admin page is open and visible
- **WHEN** 30 seconds have passed since the last refresh
- **THEN** the failed games list SHALL automatically refresh
- **AND** the staleness indicator SHALL update

#### Scenario: Pause refresh when hidden
- **GIVEN** auto-refresh is active
- **WHEN** the browser tab becomes hidden
- **THEN** auto-refresh SHALL pause
- **AND** resume when the tab becomes visible again

#### Scenario: Pause refresh during retry
- **GIVEN** a retry operation is in progress
- **WHEN** auto-refresh interval triggers
- **THEN** the refresh SHALL be skipped until retry completes

### Requirement: Failed Games Staleness Indicator
The admin interface SHALL display how recently the failed games data was updated.

#### Scenario: Show time since last update
- **GIVEN** the failed games list has been loaded
- **WHEN** viewing the Failed Games card
- **THEN** the header SHALL display "Updated X seconds/minutes ago"

#### Scenario: Update timestamp on refresh
- **GIVEN** the failed games list is displayed
- **WHEN** the list is refreshed (manually or automatically)
- **THEN** the staleness indicator SHALL reset to "Updated just now"
