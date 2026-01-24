# UI Design Spec Delta: Clear Cache Button

## ADDED Requirements

### Requirement: Admin Cache Management

The system SHALL provide cache management capabilities in the Admin Control Panel. Admin users MUST be able to view cache statistics and clear the server-side cache.

#### Scenario: Cache statistics display
Given admin user is on the Admin page
Then cache statistics card is visible in Actions section
And displays current cache key count
And displays inflight requests count

#### Scenario: Clear cache button
Given admin user is on the Admin page
When admin clicks "Clear Cache" button
Then button shows loading spinner
And API request is sent to clear cache
And on success, displays cleared key count
And on failure, displays error message

#### Scenario: Clear cache refreshes stats
Given admin user has cleared the cache
When operation completes successfully
Then cache statistics update to show new (lower) key count
And success message shows keys cleared count

#### Scenario: Cache clear available in both UI versions
Given V1 admin page at /admin
And V2 admin page at /v2/admin
Then both pages display identical cache management card
And both use same API endpoints
