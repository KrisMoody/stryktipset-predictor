## 1. Backend API Endpoints

- [x] 1.1 Create `GET /api/admin/draws/lookup` endpoint to lookup draw by number and game type
  - Return draw with matches, teams, odds, predictions if exists locally
  - Return metadata about whether draw exists locally vs. could be fetched
- [x] 1.2 Create `POST /api/admin/draws/[drawNumber]/fetch` endpoint to fetch draw from Svenska Spel API
  - Accepts game type parameter
  - Syncs draw and all matches to database
  - Returns fetched draw details

## 2. Frontend Components

- [x] 2.1 Create `AdminDrawDetailsModal.vue` component
  - Display draw metadata (number, date, status, game type)
  - List all matches with teams, odds, and results
  - Show Svenska Folket and expert tips data when available
  - Actions: refresh, archive, view on main site
- [x] 2.2 Add "Draw Lookup" section to admin page
  - Input field for draw number
  - Game type selector (Stryktipset, Europatipset, Topptipset)
  - "Lookup" button to search
  - "Fetch from API" button when draw not found locally

## 3. Integration

- [x] 3.1 Wire up lookup flow with loading states and error handling
- [x] 3.2 Add navigation link from draw details modal to main draw page (`/draw/[id]`)
- [x] 3.3 Test all three game types end-to-end

## 4. Validation

- [x] 4.1 Test looking up existing local draw
- [x] 4.2 Test fetching missing draw from Svenska Spel API
- [x] 4.3 Test error handling for invalid draw numbers
- [x] 4.4 Test all game types (Stryktipset, Europatipset, Topptipset)
