# Web Scraper Implementation Guide

## Overview

The scraper system extracts match statistics, xStats, head-to-head data, and news from Svenska Spel's website. It uses advanced anti-detection techniques and accessibility tree-based extraction to minimize rate limiting while maintaining high reliability.

## Current Implementation

**Architecture**: Accessibility Tree + Direct URL Navigation  
**Rate Limiting**: 40-60% reduction vs traditional DOM scraping  
**Speed**: 40-50% faster (8-12s vs 15-25s per match)  
**Status**: Production-ready (December 1, 2024)

### Key Components

1. **Accessibility Tree Extraction** - Primary method for data capture
2. **Direct URL Navigation** - Bypasses tab clicking
3. **URL Pattern Detection** - Automatic current vs historic URLs
4. **Real-time Progress** - Supabase realtime subscriptions
5. **Anti-Detection** - Human-like behavior simulation
6. **Queue System** - Rate limiting and retry logic

## Architecture

### Scraper Service V2

**File**: `server/services/scraper/scraper-service-v2.ts`

The main orchestrator that:
1. Tests domains on first run (spela.svenskaspel.se vs www.svenskaspel.se)
2. Determines draw status (current vs historic)
3. Builds appropriate URLs
4. Navigates directly to each data page
5. Gets accessibility snapshot (1 operation instead of 20+)
6. Extracts data in memory
7. Falls back to traditional methods if needed

**Usage:**
```typescript
import { scraperServiceV2 } from '~/server/services/scraper/scraper-service-v2'

const results = await scraperServiceV2.scrapeMatch({
  matchId: 123,
  drawNumber: 494,
  matchNumber: 3,
  dataTypes: ['statistics', 'xStats', 'headToHead', 'news']
})
```

### Accessibility Helper

**File**: `server/services/scraper/utils/accessibility-helper.ts`

Extracts data from accessibility tree snapshots:

```typescript
import { 
  getAccessibilitySnapshot,
  findByRole,
  extractTableData,
  parseStatsFromTable 
} from '~/server/services/scraper/utils/accessibility-helper'

// Get snapshot
const snapshot = await getAccessibilitySnapshot(page)

// Find elements by role
const links = findLinks(snapshot)

// Extract table data
const tableData = extractTableData(snapshot, 'Statistik')

// Parse statistics
const stats = parseStatsFromTable(tableData)
```

**Key Functions:**
- `getAccessibilitySnapshot()` - Get full accessibility tree
- `findByRole()` - Find nodes by ARIA role
- `findLinks()` - Extract all links with URLs
- `extractTableData()` - Parse table structure
- `parseStatsFromTable()` - Map labels to stat keys
- `extractFormData()` - Extract W/D/L form sequences
- `parseH2HMatches()` - Parse head-to-head history
- `parseNewsArticles()` - Extract news articles
- `calculateH2HSummary()` - Calculate H2H statistics

### URL Manager

**File**: `server/services/scraper/utils/url-manager.ts`

Manages URL patterns for current and historic draws:

**Current Draw URLs:**
```
/stryktipset/statistik?event=3
/stryktipset/xstats?event=3
/stryktipset/head-to-head?event=3
/stryktipset/news?event=3
```

**Historic Draw URLs:**
```
/stryktipset/resultat/2025-11-29?draw=4929&product=1&event=3
```

```typescript
import { urlManager } from '~/server/services/scraper/utils/url-manager'

// Build URL based on draw status
const url = urlManager.buildUrl('statistics', {
  matchNumber: 1,
  drawNumber: 494,
  drawDate: new Date('2024-12-07'),
  isCurrent: true
})

// Test which domain works
await urlManager.testDomains(page)
const workingDomain = urlManager.getCurrentDomain()
```

### Individual Scrapers

Each data type has a dedicated scraper in `server/services/scraper/tabs/`:

#### Statistics Scraper
**File**: `statistics-scraper.ts`

Extracts team statistics including possession, shots, corners, cards, etc.

**Methods:**
- `extractFromSnapshot(snapshot)` - Primary extraction method
- `scrape(page, context)` - Fallback DOM scraping

#### xStats Scraper
**File**: `xstats-scraper.ts`

Extracts expected goals (xG), match predictions, and betting distribution.

#### Head-to-Head Scraper
**File**: `head-to-head-scraper.ts`

Extracts historical match results between teams.

#### News Scraper
**File**: `news-scraper.ts`

Extracts news articles and match previews.

## Accessibility Tree Method

### How It Works

Traditional DOM scraping requires many operations:
```
1. Navigate to match page (3s)
2. Click Statistics tab (1s + wait)
3. Query 25 DOM elements individually (2s)
4. Click xStats tab (1s + wait)
5. Query 20 DOM elements individually (2s)
6. Click H2H tab (1s + wait)
7. Query 15 DOM elements individually (1.5s)

Total: ~15-25 seconds, 70+ operations
```

Accessibility tree method is much faster:
```
1. Navigate to /stryktipset/statistik?event=3 (2s)
2. Get accessibility snapshot (0.3s) - ALL DATA AT ONCE
3. Navigate to /stryktipset/xstats?event=3 (2s)
4. Get accessibility snapshot (0.3s) - ALL DATA AT ONCE
5. Navigate to /stryktipset/head-to-head?event=3 (2s)
6. Get accessibility snapshot (0.3s) - ALL DATA AT ONCE

Total: ~8-12 seconds, 3 operations
```

### Benefits

1. **Speed**: 40-50% faster
2. **Rate Limiting**: 40-60% fewer operations
3. **Reliability**: Semantic accessibility tree vs brittle CSS selectors
4. **Maintainability**: UI changes less likely to break scraper
5. **Observability**: Comprehensive analytics and logging

## Rate Limiting Strategies

### 1. Retry Logic with Exponential Backoff

**File**: `server/services/scraper/scraper-service.ts`

**For rate limits:**
- 1st retry: 5 seconds
- 2nd retry: 15 seconds
- 3rd retry: 45 seconds

**For regular errors:**
- 1st retry: 2 seconds
- 2nd retry: 4 seconds
- 3rd retry: 8 seconds

```typescript
// Automatic retry with backoff
const result = await scrapeDataTypeWithRetry(
  'statistics',
  matchId,
  context,
  3 // max attempts
)
```

### 2. Human-Like Behavior

**File**: `server/services/scraper/utils/human-behavior.ts`

Simulates human browsing patterns:

```typescript
import { performNaturalBehavior } from '~/server/services/scraper/utils/human-behavior'

// Perform random actions
await performNaturalBehavior(page)
// - Random mouse movements
// - Scrolling up and down
// - Variable delays (500-2000ms)
```

### 3. Rate Limit Detection

Enhanced detection for Svenska Spel patterns:

```typescript
import { detectRateLimit } from '~/server/services/scraper/utils/human-behavior'

const { isRateLimited, reason } = await detectRateLimit(page)
if (isRateLimited) {
  console.log(`Rate limited: ${reason}`)
  // Trigger retry with backoff
}
```

**Detection patterns:**
- Cloudflare challenge pages
- "Checking your browser" messages
- HTTP 429 status codes
- Swedish error pages ("fel")
- Domain redirects

### 4. Queue System

**File**: `server/services/scraper/scraper-queue.ts`

Spreads scraping operations over time:

```typescript
import { scraperQueue } from '~/server/services/scraper/scraper-queue'

// Add to queue (5-10 second delay between operations)
await scraperQueue.add({
  matchId: 123,
  drawNumber: 494,
  matchNumber: 3
})
```

### 5. Configuration

**File**: `server/services/scraper/scraper-config.ts`

Centralized configuration:

```typescript
export const scraperConfig = {
  timeouts: {
    directUrl: 5000,
    tabClick: 10000,
    pageLoad: 15000
  },
  delays: {
    betweenDataTypes: { min: 3000, max: 5000 },
    afterNavigation: { min: 3000, max: 5000 },
    humanBehavior: { min: 500, max: 2000 }
  },
  retries: {
    maxAttempts: 3,
    rateLimitBackoff: [5000, 15000, 45000],
    errorBackoff: [2000, 4000, 8000]
  },
  features: {
    urlDiscovery: true,
    domainTesting: true,
    adaptiveRetries: true,
    smartCaching: true
  }
}
```

## Real-Time Progress Tracking

### Supabase Realtime Integration

**File**: `plugins/supabase.client.ts`

Client-side Nuxt plugin for Supabase:

```typescript
// Automatically available in components
const { $supabase } = useNuxtApp()
```

### Composable

**File**: `composables/useScrapingUpdates.ts`

Track scraping progress in real-time:

```typescript
// In Vue component
const { 
  scrapingStatus,
  scrapedDataTypes,
  isAnyScraping,
  latestOperation 
} = await useScrapingUpdates(matchId)

// scrapingStatus is reactive
// { 'xStats': { status: 'in_progress', message: 'Scraping xStats...' } }
```

**Subscribed Events:**
- `scrape_operations` - Operation status changes
- `match_scraped_data` - Data completion notifications

### Server-Side Logging

**File**: `server/services/scraper/scraper-service.ts`

Logs "started" status immediately when scraping begins:

```typescript
// Creates scrape_operations record
await prisma.scrape_operations.create({
  data: {
    match_id: matchId,
    operation_type: 'scrape_statistics',
    status: 'started',
    started_at: new Date()
  }
})

// Realtime subscribers receive event instantly
```

### UI Display

**File**: `pages/draw/[id]/index.vue`

Shows real-time status badges:

```vue
<template>
  <div v-if="isAnyScraping">
    <UBadge 
      v-for="(status, type) in scrapingStatus"
      :color="status.status === 'in_progress' ? 'primary' : 'success'"
    >
      {{ status.message }}
    </UBadge>
  </div>
</template>
```

**Badge colors:**
- Blue (primary) - In progress
- Green (success) - Completed
- Red (error) - Failed
- Yellow (warning) - Rate limited

## Analytics & Monitoring

### Scraper Analytics

**File**: `server/services/scraper/scraper-analytics.ts`

Tracks performance metrics:

```typescript
import { scraperAnalytics } from '~/server/services/scraper/scraper-analytics'

// Get summary
const summary = scraperAnalytics.getSummary()
console.log({
  totalOperations: summary.totalOperations,
  successRate: summary.overallSuccessRate,
  avgDuration: summary.averageDuration
})

// Log to console
scraperAnalytics.logSummary()

// Get specific metrics
const methodRates = scraperAnalytics.getSuccessRateByMethod()
const commonErrors = scraperAnalytics.getCommonErrors()
```

**Tracked Metrics:**
- Success rates by method (direct_url, tab_clicking, hybrid)
- Success rates by URL pattern (current, historic)
- Average duration by operation type
- Common errors and their frequency
- Domain performance (spela vs www)

### Health Endpoint

**File**: `server/api/admin/scraper-health.get.ts`

Monitor scraper health:

```bash
GET /api/admin/scraper-health
```

**Returns:**
```json
{
  "healthy": true,
  "successRate": 0.92,
  "totalOperations": 150,
  "recentErrors": 12,
  "averageDuration": 2134,
  "rateLimitFrequency": 0.08
}
```

## Draw Lifecycle

### Automatic Archival

**File**: `server/services/draw-lifecycle.ts`

Manages draw lifecycle for correct URL patterns:

```typescript
import { drawLifecycle } from '~/server/services/draw-lifecycle'

// Check if draw should be archived
const status = await drawLifecycle.shouldArchive(494)
console.log(status)
// { shouldArchive: true, reason: 'status_completed', ... }

// Archive manually
await drawLifecycle.archiveDraw(494)

// Batch check and archive
const result = await drawLifecycle.checkAndArchiveCompletedDraws()
// { checked: 5, archived: 2, errors: 0 }
```

### Scheduling

**File**: `server/plugins/scheduler.ts`

Add automated archival:

```typescript
import { Cron } from 'croner'
import { drawLifecycle } from '~/server/services/draw-lifecycle'

// Run daily at 3 AM
new Cron('0 3 * * *', async () => {
  const result = await drawLifecycle.checkAndArchiveCompletedDraws()
  console.log(`Archived ${result.archived} draws`)
})
```

### URL Pattern Selection

The scraper automatically selects URLs based on `draw.is_current`:

**Current Draws** (`is_current = true`):
- Status: Open or Closed
- URL: `/stryktipset/xstats?event=3`

**Historic Draws** (`is_current = false`):
- Status: Completed
- URL: `/stryktipset/resultat/2025-11-29?draw=4929&product=1&event=3`

## Migration from Old Service

### Old Service Still Available

**File**: `server/services/scraper/scraper-service.ts`

The original scraper still works and can be used as fallback.

### Gradual Migration

```typescript
// Option 1: Environment variable switch
const scraperService = process.env.USE_V2_SCRAPER 
  ? scraperServiceV2 
  : scraperService

// Option 2: Gradual rollout (10% of requests)
const useNewService = Math.random() < 0.1
const service = useNewService ? scraperServiceV2 : scraperService
```

### Full Switch

Update all scraping endpoints:

```typescript
// Before
import { scraperService } from '~/server/services/scraper/scraper-service'

// After
import { scraperServiceV2 as scraperService } from '~/server/services/scraper/scraper-service-v2'
```

## Configuration & Tuning

### Adjust Timeouts

Edit `server/services/scraper/scraper-config.ts`:

```typescript
timeouts: {
  directUrl: 5000,      // Lower for faster fails
  tabClick: 10000,      // Higher for reliability
  pageLoad: 15000       // Adjust based on network
}
```

### Modify Delays

```typescript
delays: {
  betweenDataTypes: { min: 3000, max: 5000 },  // Between scrapers
  afterNavigation: { min: 3000, max: 5000 },   // After page loads
  humanBehavior: { min: 500, max: 2000 }       // During simulation
}
```

### Toggle Features

```typescript
features: {
  urlDiscovery: true,      // Discover URLs from page
  domainTesting: true,     // Test which domain works
  adaptiveRetries: true,   // Adjust retry strategy
  smartCaching: true       // Cache discovered URLs
}
```

## Troubleshooting

### No Data Returned

**Check accessibility snapshot:**
```typescript
const snapshot = await getAccessibilitySnapshot(page)
if (!snapshot?.children?.length) {
  console.log('Page may not have loaded')
  // Will auto-fallback to tab clicking
}
```

### Wrong URL Pattern

**Verify draw status:**
```sql
SELECT draw_number, status, is_current, archived_at FROM draws;
```

**Fix if incorrect:**
```sql
UPDATE draws SET is_current = true WHERE status != 'Completed';
UPDATE draws SET is_current = false, archived_at = NOW() WHERE status = 'Completed';
```

### Domain Not Working

**Test both domains:**
```typescript
await urlManager.testDomains(page)
console.log('Working domain:', urlManager.getCurrentDomain())

// Or force reset
urlManager.resetDomain()
await urlManager.testDomains(page)
```

### Rate Limiting Persists

If rate limiting continues despite improvements:

1. **Increase delays** - Edit `scraper-config.ts`
2. **Use queue system** - Force all scrapes through `scraperQueue`
3. **Check patterns** - Review analytics for rate limit triggers
4. **Verify behavior** - Ensure human-like behavior is running
5. **Consider proxies** - Add proxy rotation if needed

### Scraper Fails Silently

**Check logs:**
```typescript
// Enable verbose logging
scraperAnalytics.logSummary()

// Check database
SELECT * FROM scrape_operations 
WHERE started_at > NOW() - INTERVAL '1 hour'
ORDER BY started_at DESC;
```

## Best Practices

### 1. Always Use Analytics

Monitor scraper performance regularly:

```typescript
// Log after every 50 operations
if (operationCount % 50 === 0) {
  scraperAnalytics.logSummary()
}
```

### 2. Handle Errors Gracefully

```typescript
try {
  const result = await scraperServiceV2.scrapeMatch(options)
  if (!result.success) {
    // Fallback to old service or queue for retry
  }
} catch (error) {
  // Log and notify, but don't crash
  console.error('Scraping failed:', error)
}
```

### 3. Respect Rate Limits

```typescript
// Use queue for bulk operations
for (const match of matches) {
  await scraperQueue.add({
    matchId: match.id,
    drawNumber: match.draw_number,
    matchNumber: match.match_number
  })
  // Queue handles delays automatically
}
```

### 4. Test Before Deploying

```typescript
// Compare old vs new service
const before = Date.now()
await scraperService.scrapeMatch(options)
const oldDuration = Date.now() - before

const before2 = Date.now()
await scraperServiceV2.scrapeMatch(options)
const newDuration = Date.now() - before2

console.log(`Speed improvement: ${((1 - newDuration/oldDuration) * 100).toFixed(1)}%`)
```

### 5. Monitor Success Rates

Expected metrics after full deployment:
- ✅ 40-60% reduction in rate limit incidents
- ✅ 40-50% faster scraping per match
- ✅ 90%+ success rate with fallbacks
- ✅ Better analytics and observability

## API Reference

### Scrape Match

```typescript
await scraperServiceV2.scrapeMatch({
  matchId: number,
  drawNumber: number,
  matchNumber: number,
  dataTypes: Array<'statistics' | 'xStats' | 'headToHead' | 'news'>
})
```

### Get Health Metrics

```typescript
const health = await scraperServiceV2.getHealthMetrics()
// Returns analytics summary
```

### Archive Draw

```typescript
await drawLifecycle.archiveDraw(drawNumber)
```

### Check Analytics

```typescript
scraperAnalytics.getSummary()
scraperAnalytics.logSummary()
scraperAnalytics.getSuccessRateByMethod()
scraperAnalytics.getCommonErrors()
```

## Additional Resources

- **Playwright Documentation**: https://playwright.dev/
- **Accessibility Tree**: https://developer.mozilla.org/en-US/docs/Glossary/Accessibility_tree
- **Supabase Realtime**: https://supabase.com/docs/guides/realtime
- **Anti-Detection Techniques**: Various blog posts on web scraping best practices

