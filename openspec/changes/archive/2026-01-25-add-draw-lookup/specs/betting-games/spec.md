## ADDED Requirements

### Requirement: Admin Draw Lookup

The system SHALL provide administrators with the ability to look up any draw by its draw number and game type.

**Lookup Flow:**
1. Administrator enters draw number and selects game type
2. System checks if draw exists in local database
3. If exists: Display full draw details including matches, odds, teams, and results
4. If not exists: Offer option to fetch from Svenska Spel API

**Display Information:**
- Draw metadata: number, date, close time, status, game type
- Match list: all matches with home/away teams, league, odds, and results (if available)
- Betting data: Svenska Folket distribution, expert tips, current/start odds
- Predictions: AI predictions if generated

#### Scenario: Lookup existing local draw
- **WHEN** administrator enters draw number 1234 with game type "stryktipset"
- **AND** the draw exists in the local database
- **THEN** the system SHALL display the full draw details
- **AND** SHALL show all 13 matches with teams, odds, and results

#### Scenario: Lookup draw not in local database
- **WHEN** administrator enters draw number 5678 with game type "europatipset"
- **AND** the draw does not exist in the local database
- **THEN** the system SHALL indicate the draw is not found locally
- **AND** SHALL offer a "Fetch from API" action

#### Scenario: Fetch draw from Svenska Spel API
- **WHEN** administrator clicks "Fetch from API" for draw number 5678
- **AND** game type is "topptipset"
- **THEN** the system SHALL call Svenska Spel API to fetch the draw
- **AND** SHALL sync the draw and all matches to the database
- **AND** SHALL display the newly fetched draw details

#### Scenario: Invalid draw number
- **WHEN** administrator enters a draw number that does not exist
- **AND** Svenska Spel API returns an error or 404
- **THEN** the system SHALL display an appropriate error message
- **AND** SHALL NOT create any database records

---

### Requirement: Draw Details View

The admin draw details view SHALL display comprehensive information about a draw including all data available in the system.

**Required Display Fields:**
| Section | Fields |
|---------|--------|
| Header | Draw number, game type, draw date, close time, status |
| Matches | Match number, home team, away team, league, start time |
| Odds | Current odds (1/X/2), start odds, favourite odds |
| Results | Score, outcome (1/X/2), match status |
| Betting Data | Svenska Folket %, expert tips |
| Actions | Refresh from API, Archive, View on site |

#### Scenario: View draw with all data available
- **WHEN** viewing a draw that has been fully synced
- **THEN** all sections SHALL be populated
- **AND** matches SHALL be ordered by match number (1-13 or 1-8)

#### Scenario: View draw with partial data
- **WHEN** viewing a historic draw with limited data
- **THEN** available fields SHALL be displayed
- **AND** missing fields SHALL show "N/A" or be hidden
- **AND** a "Refresh from API" action SHALL be available

#### Scenario: View draw with results
- **WHEN** viewing a completed draw
- **THEN** results SHALL be displayed for each match
- **AND** outcomes SHALL be highlighted (1/X/2)
- **AND** draw status SHALL show "Completed"
