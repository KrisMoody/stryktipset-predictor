# Svenska Spel API Integration Guide

## Overview

This guide covers the integration with Svenska Spel's API for fetching Stryktipset draw and match data. The API client includes automatic retries, error handling, multifetch support, and health monitoring.

## Current Configuration

**Base URL**: `https://api.spela.svenskaspel.se/draw/1/stryktipset`  
**Status**: Production-ready (December 1, 2024)  
**Client**: `server/services/svenska-spel-api.ts`

## API Client Setup

### Environment Variable

```env
SVENSKA_SPEL_API_BASE_URL=https://api.spela.svenskaspel.se/draw/1/stryktipset
```

This is configured in `nuxt.config.ts` and used by the API client.

### Client Configuration

The API client uses `ofetch` with enhanced configuration:

```typescript
import { svenskaSpelApi } from '~/server/services/svenska-spel-api'

// Client automatically configured with:
// - 30 second timeout
// - 4 retry attempts
// - Exponential backoff
// - Realistic headers
```

**Features:**
- Automatic retry on timeout (408) and server errors (5xx)
- Rate limit handling (429)
- Compression support (gzip, deflate, br)
- Realistic browser headers
- Detailed error logging

## Available Endpoints

### 1. Fetch Current Draws

Get all current and upcoming Stryktipset draws.

```typescript
const { draws } = await svenskaSpelApi.fetchCurrentDraws()

// Returns: DrawData[]
// Each draw includes matches, draw date, status, etc.
```

**API Endpoint:**
```
GET https://api.spela.svenskaspel.se/draw/1/stryktipset/draws
```

**Response Structure:**
```typescript
{
  draws: [
    {
      drawNumber: 4929,
      drawDate: "2024-12-07T18:00:00Z",
      status: "Open",
      matches: [...],
      product: "stryktipset"
    }
  ]
}
```

### 2. Fetch Single Draw (Multifetch)

Fetch a specific draw with optional jackpot data in one request.

```typescript
// Without jackpot
const { draw } = await svenskaSpelApi.fetchDrawWithMultifetch(4929, false)

// With jackpot
const { draw, jackpot } = await svenskaSpelApi.fetchDrawWithMultifetch(4929, true)
```

**API Endpoint:**
```
GET https://api.spela.svenskaspel.se/multifetch?urls=/draw/1/stryktipset/draws/4929
```

**With Jackpot:**
```
GET https://api.spela.svenskaspel.se/multifetch?urls=/draw/1/stryktipset/draws/4929|%2Fdraw%2F1%2Fjackpot%2Fdraws%3Fproduct%3Dstryktipset%26drawNumber%3D4929
```

**Benefits:**
- Single API call for multiple resources
- Reduced latency
- More efficient than separate requests

### 3. Fetch Multiple Draws (Batch)

Batch fetch multiple draws in a single API call.

```typescript
const results = await svenskaSpelApi.fetchMultipleDraws([4927, 4928, 4929])

// Returns array with draw data or error for each draw number
// [{ draw: DrawData }, { draw: DrawData }, { error: string }]
```

**API Endpoint:**
```
GET https://api.spela.svenskaspel.se/multifetch?urls=/draw/1/stryktipset/draws/4927|/draw/1/stryktipset/draws/4928|/draw/1/stryktipset/draws/4929
```

**Use Cases:**
- Backfilling historical data
- Syncing multiple draws at once
- Reducing API request count

### 4. Fetch Historic Draw

Fetch a specific historic draw (alternative to multifetch).

```typescript
const draw = await svenskaSpelApi.fetchHistoricDraw(4929)
```

**Note**: This now uses multifetch internally for better performance.

### 5. Fetch Draw Result (Prize Distribution)

Get detailed prize distribution and payout information after draw is finalized.

```typescript
const resultData = await svenskaSpelApi.fetchDrawResult(4929)

// Returns: DrawResultData
// {
//   correctRow: "1X2XX1...",
//   distributions: [...],
//   prizePool: 15000000,
//   turnOver: 25000000
// }
```

**API Endpoint:**
```
GET https://api.spela.svenskaspel.se/draw/1/stryktipset/draws/4929/result
```

**Available**: Only after draw is completed and results are official.

### 6. Fetch Available Draws

Discover which draws exist for a given time period.

```typescript
const availableDraws = await svenskaSpelApi.fetchAvailableDraws(2025, 11)

// Returns list of draws in November 2025
// Useful for historic data synchronization
```

**API Endpoint:**
```
GET https://api.spela.svenskaspel.se/draw/1/results/datepicker/?product=stryktipset&year=2025&month=11
```

**Use Cases:**
- Backfilling historical data
- Finding missing draws
- Validating draw completeness

## Error Handling

### Error Categories

The API client categorizes errors for better handling:

```typescript
import { drawSyncService } from '~/server/services/draw-sync'

try {
  await drawSyncService.syncCurrentDraws()
} catch (error) {
  const category = categorizeError(error)
  // Returns: 'TIMEOUT' | 'CONNECTION' | 'AUTH' | 'NOT_FOUND' | 
  //          'RATE_LIMIT' | 'SERVER_ERROR' | 'UNKNOWN'
}
```

**Error Types:**

1. **TIMEOUT** - Request took too long (>30s)
2. **CONNECTION** - Network connection failed
3. **AUTH** - Authentication/authorization issue
4. **NOT_FOUND** - Resource doesn't exist (404)
5. **RATE_LIMIT** - Too many requests (429)
6. **SERVER_ERROR** - Server-side error (500-504)
7. **UNKNOWN** - Other errors

### Retry Strategy

The client automatically retries on specific status codes:

**Retry Status Codes:**
- 408 - Request Timeout
- 429 - Too Many Requests
- 500 - Internal Server Error
- 502 - Bad Gateway
- 503 - Service Unavailable
- 504 - Gateway Timeout

**Retry Configuration:**
- Maximum 4 attempts
- Exponential backoff
- Detailed logging on each attempt

### Partial Success

The draw sync service supports partial success:

```typescript
const result = await drawSyncService.syncCurrentDraws()

// Even if some draws fail, successful ones are processed
// result.success = true if at least one draw synced
// result.errors = [...] // Array of individual errors
```

## Health Monitoring

### Health Check Endpoint

**File**: `server/api/admin/svenska-spel-health.get.ts`

Monitor API connectivity and performance:

```bash
GET /api/admin/svenska-spel-health
```

**Response:**
```json
{
  "healthy": true,
  "responseTime": 234,
  "drawsAvailable": 3,
  "endpoint": "https://api.spela.svenskaspel.se/draw/1/stryktipset",
  "timestamp": "2024-12-01T12:00:00Z"
}
```

**Unhealthy Response:**
```json
{
  "healthy": false,
  "error": "Connection timeout after 30000ms",
  "errorCategory": "TIMEOUT",
  "endpoint": "https://api.spela.svenskaspel.se/draw/1/stryktipset",
  "timestamp": "2024-12-01T12:00:00Z"
}
```

### Usage in Monitoring

```typescript
// Check health before syncing
const health = await $fetch('/api/admin/svenska-spel-health')
if (health.healthy) {
  await syncDraws()
} else {
  console.error('API unhealthy:', health.errorCategory)
  // Skip sync or alert
}
```

## Draw Sync Service

### Automatic Syncing

**File**: `server/plugins/scheduler.ts`

Configured to sync automatically:

```typescript
// Initial sync: 30 seconds after startup
// Scheduled sync: Every 6 hours

cron.schedule('0 */6 * * *', async () => {
  await drawSyncService.syncCurrentDraws()
})
```

### Manual Sync

**File**: `server/api/admin/sync.post.ts`

Trigger manual sync:

```bash
POST /api/admin/sync
```

```typescript
// In code
await $fetch('/api/admin/sync', { method: 'POST' })
```

### Sync Process

The sync service:

1. Fetches current draws from API
2. Creates/updates teams, leagues, countries (normalized)
3. Upserts draws in database
4. Creates/updates matches with foreign key references
5. Upserts match odds (current, start, favourite)
6. Returns summary with counts and errors

```typescript
const result = await drawSyncService.syncCurrentDraws()

// result = {
//   success: true,
//   drawsProcessed: 3,
//   matchesCreated: 39,
//   errors: []
// }
```

## Type Definitions

### Core Types

```typescript
// Draw data from API
interface DrawData {
  drawNumber: number
  drawDate: string
  status: 'Open' | 'Closed' | 'Completed'
  matches: MatchData[]
  product: string
}

// Match data
interface MatchData {
  matchNumber: number
  homeTeam: string
  awayTeam: string
  startTime: string
  league: string
  country: string
  odds?: {
    home: number
    draw: number
    away: number
  }
}

// Multifetch response
interface MultifetchResponse {
  responses: MultifetchResponseItem[]
}

interface MultifetchResponseItem {
  status: number
  body: any
  url: string
}

// Jackpot data
interface JackpotData {
  amount: number
  currency: string
  drawNumber: number
}

// Draw result (prize distribution)
interface DrawResultData {
  correctRow: string
  distributions: DistributionData[]
  prizePool: number
  turnOver: number
  drawNumber: number
}

interface DistributionData {
  correctCount: number
  winners: number
  prizePerWinner: number
}

// Available draws
interface AvailableDrawsData {
  year: number
  month: number
  draws: Array<{
    drawNumber: number
    drawDate: string
  }>
}
```

## Best Practices

### 1. Use Multifetch for Efficiency

```typescript
// ❌ Bad - Multiple requests
const draw1 = await svenskaSpelApi.fetchHistoricDraw(4927)
const draw2 = await svenskaSpelApi.fetchHistoricDraw(4928)
const draw3 = await svenskaSpelApi.fetchHistoricDraw(4929)

// ✅ Good - Single request
const draws = await svenskaSpelApi.fetchMultipleDraws([4927, 4928, 4929])
```

### 2. Handle Errors Gracefully

```typescript
try {
  const result = await svenskaSpelApi.fetchCurrentDraws()
  // Process draws
} catch (error) {
  const category = categorizeError(error)
  
  if (category === 'TIMEOUT') {
    // Retry later
  } else if (category === 'RATE_LIMIT') {
    // Wait and retry
  } else {
    // Log and alert
  }
}
```

### 3. Check Health Before Bulk Operations

```typescript
const health = await $fetch('/api/admin/svenska-spel-health')

if (health.healthy && health.responseTime < 1000) {
  // API is fast and available
  await bulkSync()
} else {
  // Skip or delay
}
```

### 4. Use Partial Success Pattern

```typescript
const result = await drawSyncService.syncCurrentDraws()

if (result.success) {
  console.log(`Synced ${result.drawsProcessed} draws`)
  
  if (result.errors.length > 0) {
    console.warn('Some draws failed:', result.errors)
    // Continue with successful data
  }
} else {
  console.error('Sync completely failed')
}
```

### 5. Monitor Response Times

```typescript
const before = Date.now()
const draws = await svenskaSpelApi.fetchCurrentDraws()
const duration = Date.now() - before

if (duration > 5000) {
  console.warn('API slow:', duration, 'ms')
  // Consider alerting or scaling back requests
}
```

## Troubleshooting

### Connection Timeout Errors

**Symptom**: Error: "fetch failed" or timeout after 30s

**Solutions:**
1. Check environment variable is correct
2. Verify Supabase/server has internet access
3. Check Svenska Spel API status
4. Try health check endpoint

```bash
curl https://api.spela.svenskaspel.se/draw/1/stryktipset/draws
```

### Rate Limiting (429)

**Symptom**: "Too Many Requests" errors

**Solutions:**
1. Reduce sync frequency
2. Use multifetch to batch requests
3. Add delays between requests
4. Check retry configuration

### Missing Draws

**Symptom**: Draws expected but not returned

**Solutions:**
1. Check draw date/time
2. Verify draw number is correct
3. Use `fetchAvailableDraws()` to discover draws
4. Check if draw is historic (use different endpoint)

### Invalid Data Structure

**Symptom**: TypeScript errors or unexpected data

**Solutions:**
1. Check API response format hasn't changed
2. Validate types match actual API responses
3. Add logging to see raw API responses
4. Update type definitions if API changed

## API Endpoint Reference

### Quick Reference Table

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/draw/1/stryktipset/draws` | GET | Get current draws |
| `/multifetch?urls=...` | GET | Batch fetch multiple resources |
| `/draw/1/stryktipset/draws/{num}` | GET | Get specific draw |
| `/draw/1/stryktipset/draws/{num}/result` | GET | Get prize distribution |
| `/draw/1/jackpot/draws?product=stryktipset&drawNumber={num}` | GET | Get jackpot info |
| `/draw/1/results/datepicker/?product=stryktipset&year={y}&month={m}` | GET | List available draws |

### Base URL

**Production**: `https://api.spela.svenskaspel.se/draw/1/stryktipset`

**Alternative**: `https://api.svenskaspel.se/draw/1/stryktipset` (may have different availability)

## Advanced Usage

### Custom Headers

The client includes realistic headers:

```typescript
{
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
  'Accept': 'application/json',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
  'Referer': 'https://spela.svenskaspel.se/',
  'Origin': 'https://spela.svenskaspel.se'
}
```

These mimic browser requests to avoid API blocks.

### Request/Response Logging

The client includes automatic logging:

```typescript
// Logged on every request
console.log('[Svenska Spel API] Request:', url, options)

// Logged on errors
console.error('[Svenska Spel API] Error:', error, { url, attempt })

// Logged on retries
console.log('[Svenska Spel API] Retry attempt', attempt, 'of', maxRetries)
```

### Timeout Configuration

Default: 30 seconds

To modify, edit `server/services/svenska-spel-api.ts`:

```typescript
const api = $fetch.create({
  baseURL: this.baseUrl,
  timeout: 30000, // Change this value
  // ...
})
```

## Related Documentation

- [Database Changes](DATABASE_CHANGES.md) - Schema for storing API data
- [Setup Guide](SETUP.md) - Environment variable configuration
- [Deployment Guide](DEPLOYMENT.md) - Production deployment

## Need Help?

If you encounter API issues:

1. Check [Svenska Spel API health endpoint](#health-check-endpoint)
2. Verify environment variables in `.env`
3. Test API directly with `curl` commands
4. Check logs for detailed error messages
5. Review [error handling](#error-handling) section

