# Tasks: Add Historic Draw Results Page

## Phase 1: API Fixes (Foundation)

### 1.1 Add missing fields to admin draws endpoint
- [x] **File**: `server/api/admin/draws/current.get.ts`
- [x] **Action**: Add `id: true` and `game_type: true` to the Prisma select clause
- [x] **Verification**: API response includes `id` and `game_type` for each draw

### 1.2 Update admin page navigation logic
- [x] **File**: `pages/admin.vue`
- [x] **Action**:
  - Modify `navigateToDraw()` to accept full draw object
  - Route based on `is_current` flag (current → work page, archived → results)
  - Include `gameType` query parameter
- [x] **Verification**: Clicking draws navigates to correct destination with proper query params

## Phase 2: Error Handling

### 2.1 Add error state to draw detail page
- [x] **File**: `pages/draw/[id]/index.vue`
- [x] **Action**: Add `v-else` block after `v-else-if="draw"` to show error alert
- [x] **Verification**: Navigate to non-existent draw shows error message instead of blank page

## Phase 3: Results Page Implementation

### 3.1 Create results page scaffold
- [x] **File**: `pages/draw/[id]/results.vue` (enhanced existing)
- [x] **Action**: Enhanced page with:
  - Template with loading, content, and error states
  - useFetch to `/api/draws/{drawNumber}/results`
  - gameType from query parameter
- [x] **Verification**: Page loads and shows loading state, then data or error

### 3.2 Implement header section
- [x] **File**: `pages/draw/[id]/results.vue`
- [x] **Action**: Add header displaying:
  - Draw number and game type
  - "Completed" status badge
  - Game display name
- [x] **Verification**: Header displays all draw metadata correctly

### 3.3 Implement match results table
- [x] **File**: `components/optimize/CompletedDrawResults.vue` (existing component)
- [x] **Action**: Existing component provides:
  - Match number, teams, score, outcome
  - Outcome badges (1/X/2) with appropriate colors
  - Responsive table design
- [x] **Verification**: All matches display with correct results and formatting

### 3.4 Implement performance summary cards
- [x] **File**: `components/optimize/CompletedDrawResults.vue` (existing component)
- [x] **Action**: Existing component provides:
  - Best score achieved
  - Coupon rows with expandable details
  - ROI calculations
- [x] **Verification**: Summary shows metrics from systems

### 3.5 Implement system performance breakdown
- [x] **File**: `components/optimize/CompletedDrawResults.vue` (existing component)
- [x] **Action**: Existing component provides:
  - System ID, type
  - Best score, winning rows
  - Score distribution
  - ROI
- [x] **Verification**: Each system displays with accurate performance data

### 3.6 Implement payout information section
- [x] **File**: `components/optimize/CompletedDrawResults.vue`
- [x] **Action**: Payout/ROI shown per system
- [x] **Verification**: Payout section shows when data available

### 3.7 Add empty state handling
- [x] **File**: `components/optimize/CompletedDrawResults.vue`
- [x] **Action**: Existing component handles case where no systems were generated
- [x] **Verification**: Appropriate message displays when no performance data exists

## Phase 4: Polish

### 4.1 Add breadcrumb navigation
- [x] **File**: `pages/draw/[id]/results.vue`
- [x] **Action**: Include AppBreadcrumb component for navigation context
- [x] **Verification**: Breadcrumb shows correct path

### 4.2 Add back navigation
- [x] **File**: `pages/draw/[id]/results.vue`
- [x] **Action**: Add "Back to Admin" button
- [x] **Verification**: User can navigate away from results page easily

## Dependencies
- Task 1.1 must complete before 1.2 (API must return data before navigation can use it) ✓
- Tasks 2.1 can run in parallel with Phase 1 ✓
- Phase 3 depends on Phase 1 completion ✓
- Tasks 3.2-3.7 leveraged existing CompletedDrawResults component ✓

## Implementation Notes
- The results page (`pages/draw/[id]/results.vue`) already existed but needed enhancement
- The `OptimizeCompletedDrawResults` component (auto-resolved from `components/optimize/CompletedDrawResults.vue`) provides the core results display functionality
- Added gameType support via query parameter for multi-game compatibility
- Navigation now routes current draws to work page, archived draws to results page
