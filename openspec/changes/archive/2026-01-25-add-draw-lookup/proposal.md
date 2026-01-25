# Change: Add Draw Lookup to Admin Page

## Why

Currently, the admin page only displays current draws (is_current = true) and completed draws pending finalization. When administrators need to work with a specific draw by its number, they cannot easily access it - entering a draw number manually provides no context about what matches, teams, or data the draw contains. This makes troubleshooting, backfilling, and manual interventions difficult.

## What Changes

- **Admin Draw Lookup UI**: New section in admin page allowing lookup of any draw by number and game type
- **Draw Details Modal**: Comprehensive view showing all draw data (matches, teams, odds, status, results)
- **API Fetch Integration**: Option to fetch draw from Svenska Spel API if not present locally
- **Sync Existing Draw**: Option to refresh/re-sync an existing draw with latest API data

## Impact

- Affected specs: `betting-games`
- Affected code:
  - `pages/admin.vue` - New lookup section and modal
  - `server/api/admin/draws/lookup.get.ts` - New API endpoint for draw lookup
  - `server/api/admin/draws/[drawNumber]/fetch.post.ts` - New API endpoint to fetch from Svenska Spel
  - `components/admin/DrawDetailsModal.vue` - New component for displaying draw details
