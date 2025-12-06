# AI Usage Tracking

This document explains how AI usage tracking works in the application, how to troubleshoot issues, and how to monitor AI costs.

## Overview

The application tracks all AI API usage (Claude, OpenAI) for cost monitoring and analytics. Usage data is stored in the `ai_usage` table in the database.

### Tracked Services

1. **Prediction Service** - Claude 3.5 Sonnet for match predictions
2. **Embeddings Service** - OpenAI text-embedding-3-small for vector embeddings
3. **Scraper Service V3** - Claude Haiku 4.5 for AI-powered web scraping

## Architecture

### Core Components

#### 1. AI Usage Recorder (`server/utils/ai-usage-recorder.ts`)
Central component for recording AI usage. Features:
- Input validation before database writes
- Automatic retry logic (3 attempts with exponential backoff)
- Detailed error logging
- Failed writes queue for recovery
- Metrics tracking

#### 2. Validator (`server/utils/ai-usage-validator.ts`)
Validates all data before writing to database:
- Model name ≤ 50 characters
- Data type ≤ 50 characters
- Operation ID ≤ 100 characters
- Cost within Decimal(10,6) limits
- Required fields not null/undefined

#### 3. Metrics Tracker (`server/utils/ai-usage-metrics.ts`)
In-memory tracking of write operations:
- Total attempts
- Successful writes
- Failed writes by error type
- Retry attempts
- Validation failures

#### 4. Failed Writes Queue (`server/utils/failed-writes-queue.ts`)
Recovery mechanism for failed writes:
- Stores up to 1000 failed writes
- Periodic retry every 5 minutes
- Manual retry via API endpoint
- Prevents data loss

#### 5. Logger (`server/utils/logger.ts`)
Structured logging for debugging:
- Different log levels (debug, info, warn, error)
- Contextual information
- Timestamps

## Database Schema

```sql
CREATE TABLE ai_usage (
  id            SERIAL PRIMARY KEY,
  model         VARCHAR(50) NOT NULL,
  input_tokens  INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd      DECIMAL(10, 6) NOT NULL,
  data_type     VARCHAR(50),
  operation_id  VARCHAR(100),
  endpoint      VARCHAR(100),
  duration_ms   INTEGER,
  success       BOOLEAN NOT NULL,
  timestamp     TIMESTAMP(6) DEFAULT NOW()
);

-- Indexes
CREATE INDEX ai_usage_timestamp_idx ON ai_usage(timestamp);
CREATE INDEX ai_usage_data_type_idx ON ai_usage(data_type);
CREATE INDEX ai_usage_model_idx ON ai_usage(model);
CREATE INDEX ai_usage_operation_id_idx ON ai_usage(operation_id);
```

## API Endpoints

### Health Check
```bash
GET /api/health
```
Returns overall health including AI usage tracking status.

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy" },
    "aiUsageTable": { "status": "healthy" },
    "aiUsageTracking": {
      "status": "healthy",
      "details": {
        "successRate": "100%",
        "totalAttempts": 150,
        "failedWrites": 0,
        "queueSize": 0
      }
    }
  }
}
```

### Test AI Usage Write
```bash
POST /api/admin/test-ai-usage
```
Tests database write capability.

**Response:**
```json
{
  "success": true,
  "message": "All tests passed",
  "details": {
    "testRecordId": 123,
    "testData": {...}
  }
}
```

### AI Usage Metrics
```bash
GET /api/admin/ai-usage-metrics
```
Returns current metrics.

**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalAttempts": 150,
    "successfulWrites": 148,
    "failedWrites": 2,
    "retryAttempts": 5,
    "validationFailures": 1,
    "successRate": "98.67%",
    "errorsByType": {
      "DatabaseError": 2
    },
    "recentErrors": [...]
  }
}
```

### Failed Writes Queue
```bash
# View queue
GET /api/admin/failed-writes

# Retry failed writes
GET /api/admin/failed-writes?action=retry

# Clear queue
GET /api/admin/failed-writes?action=clear
```

**Response:**
```json
{
  "success": true,
  "queueStatus": {
    "queueSize": 3,
    "maxQueueSize": 1000,
    "entries": [...]
  }
}
```

## Verification Script

Run the verification script to test the entire AI usage tracking system:

```bash
tsx scripts/verify-ai-usage-table.ts
```

**What it checks:**
1. Database connection
2. ai_usage table exists
3. All required indexes exist
4. Write permissions
5. Read permissions

## Troubleshooting

### Problem: No data in ai_usage table

**Step 1: Verify AI services are running**
```bash
# Check if any AI operations are being performed
# Look for these logs in your application:
# - [Prediction Service]
# - [Embeddings]
# - [Scraper Service V3]
```

**Step 2: Run verification script**
```bash
tsx scripts/verify-ai-usage-table.ts
```

**Step 3: Test database write**
```bash
curl -X POST http://localhost:3000/api/admin/test-ai-usage
```

**Step 4: Check metrics**
```bash
curl http://localhost:3000/api/admin/ai-usage-metrics
```

**Step 5: Check failed writes queue**
```bash
curl http://localhost:3000/api/admin/failed-writes
```

**Step 6: Review application logs**
Look for these log patterns:
- `[AIUsageRecorder]` - Recording operations
- `[AIUsageRecorder] Error recording AI usage` - Write failures
- `AI usage data validation failed` - Validation errors

### Problem: Some writes failing

**Check validation errors:**
Look in logs for validation failure messages. Common issues:
- Model name too long (>50 chars)
- Cost exceeds maximum (>9999.999999)
- Required fields null/undefined

**Check database connection:**
```bash
# Test database connection
curl http://localhost:3000/api/health
```

**Retry failed writes:**
```bash
curl http://localhost:3000/api/admin/failed-writes?action=retry
```

### Problem: High failure rate

**Check DATABASE_URL:**
Ensure your database connection string is correct:
```bash
# .env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

**Check connection pooling:**
If using pgbouncer, ensure parameters are compatible. Some pooling parameters may cause issues.

**Check database permissions:**
Ensure the database user has INSERT, SELECT, UPDATE, DELETE permissions on the `ai_usage` table.

**Check for database locks:**
```sql
SELECT * FROM pg_stat_activity WHERE state = 'active';
```

## Cost Tracking

### Current Pricing (as of implementation)

**Claude Haiku 4.5:**
- Input: $1 per 1M tokens
- Output: $5 per 1M tokens

**Claude Sonnet 3.5:**
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens

**OpenAI text-embedding-3-small:**
- Input: $0.02 per 1M tokens
- Output: $0 (no output tokens)

### Query Total Cost

```sql
SELECT
  SUM(cost_usd) as total_cost,
  COUNT(*) as operations,
  model
FROM ai_usage
WHERE success = true
GROUP BY model;
```

### Query Cost by Time Period

```sql
SELECT
  DATE(timestamp) as date,
  SUM(cost_usd) as daily_cost,
  COUNT(*) as operations
FROM ai_usage
WHERE success = true
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

### Query Cost by Operation Type

```sql
SELECT
  data_type,
  COUNT(*) as operations,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cost_usd) as total_cost
FROM ai_usage
WHERE success = true
GROUP BY data_type;
```

## Monitoring

### Key Metrics to Monitor

1. **Success Rate** - Should be >95%
2. **Queue Size** - Should be <10
3. **Failed Writes** - Should be low (<5% of attempts)
4. **Cost Trend** - Monitor for unexpected spikes

### Setting Up Alerts

Consider setting up alerts for:
- Success rate drops below 90%
- Queue size exceeds 50
- Daily cost exceeds budget threshold
- Multiple consecutive write failures

### Log Monitoring

Important log patterns to monitor:
```
[AIUsageRecorder] AI usage data validation failed
[AIUsageRecorder] All retry attempts exhausted
[FailedWritesQueue] Failed writes queue is full
```

## Performance

### Write Performance

- Writes are non-blocking (use `.catch()` to handle errors)
- Retries use exponential backoff (1s, 2s, 4s)
- Failed writes queued for later retry

### Query Performance

The `ai_usage` table has indexes on:
- `timestamp` - For time-based queries
- `data_type` - For operation type queries
- `model` - For model-specific queries
- `operation_id` - For linking to specific operations

## Best Practices

1. **Don't block on writes** - Use `.catch()` to handle errors asynchronously
2. **Monitor regularly** - Check metrics endpoint daily
3. **Review queue** - Check failed writes queue weekly
4. **Validate before recording** - Use the validator to catch issues early
5. **Log context** - Include operation_id for traceability
6. **Set budgets** - Monitor costs against budget thresholds

## Migration Notes

If you previously had AI usage recording issues:

1. All three AI services now use the centralized recorder
2. Old `recordAIUsage()` methods have been removed
3. Validation happens before every write
4. Retries are automatic
5. Failed writes are queued for recovery

No database schema changes are required - the table structure remains the same.
