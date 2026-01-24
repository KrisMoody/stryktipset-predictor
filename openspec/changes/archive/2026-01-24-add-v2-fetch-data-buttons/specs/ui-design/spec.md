# ui-design Spec Delta: Add Fetch Data Buttons to V2 UI

## ADDED Requirements

### Requirement: V2 Match Card Fetch Data Button
The V2MatchCard component SHALL provide a button to manually fetch/refresh match data.

#### Scenario: Fetch data button display
- **WHEN** user views a match card on the V2 draw detail page
- **THEN** a "Fetch Data" button SHALL be visible in the header actions area
- **AND** the button SHALL use a download icon (`i-heroicons-arrow-down-tray`)
- **AND** the button SHALL be positioned after the Predict button

#### Scenario: Fetch data button loading state
- **WHEN** user clicks the Fetch Data button
- **THEN** the button SHALL show a loading spinner
- **AND** the button SHALL be disabled while loading
- **AND** other action buttons for the same match SHALL remain functional

#### Scenario: Fetch data button disabled state
- **WHEN** the betting window is not active AND admin override is not enabled
- **THEN** the Fetch Data button SHALL be disabled
- **AND** the button SHALL remain visually present but non-interactive

#### Scenario: Fetch data success
- **WHEN** data fetching completes successfully
- **THEN** a success toast notification SHALL be displayed
- **AND** the match data SHALL be refreshed in the UI
- **AND** the button loading state SHALL be cleared

#### Scenario: Fetch data failure
- **WHEN** data fetching fails
- **THEN** an error toast notification SHALL be displayed
- **AND** the error message SHALL describe the failure
- **AND** the button loading state SHALL be cleared

### Requirement: V2 Draw Detail Fetch All Button
The V2 draw detail page SHALL provide a button to fetch data for all matches in the draw.

#### Scenario: Fetch all button display
- **WHEN** user views the V2 draw detail page
- **THEN** a "Fetch All Data" button SHALL be visible in the header actions area
- **AND** the button SHALL use a download icon
- **AND** the button SHALL be positioned near the "Re-evaluate All" button

#### Scenario: Fetch all button loading state
- **WHEN** user clicks the Fetch All Data button
- **THEN** the button SHALL show a loading spinner
- **AND** the button SHALL be disabled while fetching
- **AND** a progress indication MAY be shown (e.g., "Fetching 3/13...")

#### Scenario: Fetch all button disabled state
- **WHEN** the betting window is not active AND admin override is not enabled
- **THEN** the Fetch All Data button SHALL be disabled

#### Scenario: Fetch all completion
- **WHEN** data fetching completes for all matches
- **THEN** a summary toast SHALL be displayed
- **AND** the toast SHALL indicate success/failure counts
- **AND** the draw data SHALL be refreshed in the UI

### Requirement: V2 Dashboard Draw Card Fetch Action
The V2DrawCard component SHALL provide a quick action to fetch data for the entire draw.

#### Scenario: Draw card fetch button display
- **WHEN** user views a draw card on the V2 dashboard
- **THEN** a "Fetch Data" button SHALL be available in the card footer
- **AND** the button SHALL be positioned after "View Matches"
- **AND** the button SHALL use a soft variant to indicate secondary action

#### Scenario: Draw card fetch button behavior
- **WHEN** user clicks the Fetch Data button on a draw card
- **THEN** data SHALL be fetched for all matches in that draw
- **AND** the button SHALL show a loading state
- **AND** completion SHALL be indicated via toast notification
- **AND** the dashboard data SHALL be refreshed

#### Scenario: Draw card fetch button disabled state
- **WHEN** the betting window is not active AND admin override is not enabled
- **THEN** the draw card Fetch Data button SHALL be disabled
