## ADDED Requirements

### Requirement: Admin Draw List Navigation
The admin page draw lists SHALL support direct navigation to draw detail pages.

#### Scenario: Click draw in Draw Management section
- **WHEN** admin clicks on a draw item in the "Draw Management" section
- **THEN** the browser SHALL navigate to `/draw/{drawId}` for that draw
- **AND** the navigation SHALL open in the same tab

#### Scenario: Click draw in Pending Completion section
- **WHEN** admin clicks on a draw item in the "Pending Completion" section
- **THEN** the browser SHALL navigate to `/draw/{drawId}` for that draw
- **AND** the navigation SHALL open in the same tab

#### Scenario: Visual affordance for clickable draws
- **WHEN** admin hovers over a draw item
- **THEN** the cursor SHALL change to pointer
- **AND** the item SHALL have a subtle hover state indicating clickability

## MODIFIED Requirements

### Requirement: Fetch Results Modal
The Fetch Results modal SHALL display all content without truncation.

#### Scenario: Modal content display
- **WHEN** admin opens the Fetch Results modal
- **THEN** the modal SHALL display the full summary section
- **AND** the results table SHALL be fully visible with horizontal scroll if needed
- **AND** the footer buttons SHALL be visible without scrolling
- **AND** the modal SHALL not have a fixed width that causes content cutoff
