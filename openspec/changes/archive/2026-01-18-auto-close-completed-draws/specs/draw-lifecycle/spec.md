# draw-lifecycle Specification Delta

## Purpose
Defines how draws transition through their lifecycle from active to archived, with focus on automatic completion detection.

## ADDED Requirements

### Requirement: Draw Completion Detection

The system SHALL determine draw completion based on match results rather than external API status.

A draw SHALL be considered complete when ALL of the following are true:
- Every match in the draw has `result_home` set (not null)
- Every match in the draw has `result_away` set (not null)
- Every match in the draw has `outcome` set (1, X, or 2)

The draw's `status` field from the Svenska Spel API SHALL NOT be a prerequisite for completion detection.

#### Scenario: Draw with all match results is detected as complete
- **GIVEN** a draw with 13 matches
- **WHEN** all 13 matches have `result_home`, `result_away`, and `outcome` values
- **THEN** the draw SHALL be detected as complete
- **AND** the draw SHALL be eligible for archiving
- **REGARDLESS** of the value in the draw's `status` field

#### Scenario: Draw with missing results is not complete
- **GIVEN** a draw with 13 matches
- **WHEN** 12 matches have results but 1 match has `result_home = null`
- **THEN** the draw SHALL NOT be detected as complete
- **AND** the draw SHALL NOT be eligible for archiving

#### Scenario: Draw with partial outcome is not complete
- **GIVEN** a draw with 8 matches (Topptipset)
- **WHEN** all matches have `result_home` and `result_away` values
- **BUT** one match has `outcome = null`
- **THEN** the draw SHALL NOT be detected as complete

---

### Requirement: Real-Time Draw Archival

The system SHALL archive draws immediately when completion is detected, not only at scheduled intervals.

#### Scenario: Draw archives when last match finishes
- **GIVEN** a draw where 12 of 13 matches have results
- **WHEN** the final match result is synced from the API
- **AND** the match has `status = "FT"` with valid scores
- **THEN** the system SHALL immediately check if the draw is complete
- **AND** if complete, SHALL archive the draw within the same sync operation
- **AND** SHALL invalidate the draw cache

#### Scenario: Scheduled job remains as backup
- **GIVEN** a draw that was completed but not archived in real-time (edge case)
- **WHEN** the daily 4 AM archive job runs
- **THEN** the job SHALL detect the completed draw
- **AND** SHALL archive it

---

### Requirement: Draw Status Synchronization

When a draw is detected as complete internally, the system SHALL update the draw status to "Completed" to maintain data consistency.

#### Scenario: Status updated on internal completion
- **GIVEN** a draw with `status = "Closed"` (API hasn't updated yet)
- **WHEN** all matches in the draw have final results
- **AND** the system archives the draw
- **THEN** the system SHALL set `draw.status = "Completed"`
- **AND** SHALL set `draw.is_current = false`
- **AND** SHALL set `draw.archived_at` to the current timestamp

---

## MODIFIED Requirements

### Requirement: Archive Eligibility Criteria

The system SHALL consider a draw eligible for archiving based solely on match completion status.

A draw SHALL be eligible for archiving when ALL matches have `result_home`, `result_away`, and `outcome` values set. The `draw.status` field from the external API SHALL NOT be a prerequisite.

When archiving a draw that does not have `status = "Completed"`, the system SHALL update the status to "Completed" as part of the archive operation.

#### Scenario: Archive with non-Completed API status
- **GIVEN** a draw with `status = "Open"` (stale API data)
- **WHEN** all matches have `result_home`, `result_away`, and `outcome` values
- **THEN** the draw SHALL be eligible for archiving
- **AND** `status` SHALL be updated to "Completed" during archival

#### Scenario: Already Completed draw archives normally
- **GIVEN** a draw with `status = "Completed"` (API updated)
- **WHEN** all matches have results
- **THEN** the draw SHALL be archived
- **AND** `status` SHALL remain "Completed"
