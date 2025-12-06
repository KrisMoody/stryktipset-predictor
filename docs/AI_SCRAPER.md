# AI Scraper Guide

A hybrid AI web scraper using Crawl4AI + Claude 4.5 Haiku with traditional DOM scraping as fallback.

## Overview

The AI scraper is a Python service that uses Claude AI to extract structured data from Svenska Spel match pages. It provides faster, more adaptable scraping compared to traditional DOM selectors.

### Key Features

- **AI-powered extraction**: Uses Claude 4.5 Haiku for intelligent data extraction
- **Automatic fallback**: Falls back to DOM scraping if AI fails
- **Cost tracking**: Built-in token usage and cost monitoring
- **Circuit breaker**: Prevents rate limiting issues
- **Feature flag**: Easy enable/disable via environment variable

### Architecture

```
┌─────────────────────────────────────┐
│  Node.js Backend (Nuxt)             │
│  ├─ ScraperServiceV3 (Orchestrator) │
│  ├─ Circuit Breaker                 │
│  ├─ Cost Tracking                   │
│  └─ Feature Flag                    │
└─────────────────┬───────────────────┘
                  │
        ┌─────────┴─────────┐
        ↓                   ↓
┌───────────────┐   ┌───────────────┐
│ AI Scraper    │   │ DOM Scrapers  │
│ (Primary)     │   │ (Fallback)    │
│               │   │               │
│ Python/FastAPI│   │ Playwright    │
│ Crawl4AI      │   │ Tab-clicking  │
│ Claude Haiku  │   │ Selectors     │
└───────────────┘   └───────────────┘
```

## Quick Start

### Prerequisites

- Python 3.8+
- Anthropic API key
- Node.js backend running

### Step 1: Set Up AI Scraper Service

```bash
cd services/ai-scraper

# Create virtual environment
python3 -m venv ~/ai-scraper-venv
source ~/ai-scraper-venv/bin/activate

# Install dependencies
pip install -r requirements.txt
crawl4ai-setup

# Create .env file
cat > .env << EOF
ANTHROPIC_API_KEY=your_actual_anthropic_api_key_here
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
BROWSER_HEADLESS=true
SESSION_ID=svenska-spel-scraper
LOG_LEVEL=INFO
EOF

# Start the service
./start.sh
```

The service runs on `http://localhost:8000`

### Step 2: Test Health

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "ai-scraper",
  "version": "1.0.0",
  "anthropic_key_configured": true
}
```

### Step 3: Enable in Node.js

Add to your main `.env` file:

```env
AI_SCRAPER_URL=http://localhost:8000
ENABLE_AI_SCRAPER=true
ENABLE_SCRAPER_V3=true
```

Restart the Nuxt server.

### Step 4: Test Scraping

```bash
# Replace 123 with an actual match ID
curl -X POST http://localhost:3000/api/matches/123/scrape \
  -H "Content-Type: application/json" \
  -d '{"dataTypes": ["xStats", "statistics"]}'
```

## Running Both Services

### Option A: Combined (Recommended)

```bash
npm run dev:all
```

This starts both Nuxt (port 3000) and AI Scraper (port 8000).

### Option B: Separate Terminals

```bash
# Terminal 1: Nuxt
npm run dev

# Terminal 2: AI Scraper
npm run dev:ai
```

## Cost Estimates

Based on Claude 4.5 Haiku pricing ($1/1M input, $5/1M output):

| Usage | Matches/Month | Est. Cost |
|-------|---------------|-----------|
| Light | 50 matches | ~$0.13 |
| Medium | 200 matches | ~$0.50 |
| Heavy | 1000 matches | ~$2.50 |

*Assumes ~2000 input + 500 output tokens per match*

### View Current Costs

```bash
curl http://localhost:3000/api/admin/scraper-metrics
```

## Deployment Options

### Option 1: Same Server (Simplest)

Run the Python service alongside your Node.js app.

1. **Install Python on server**
```bash
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip -y
```

2. **Deploy AI scraper code**
```bash
scp -r services/ai-scraper/ user@yourserver:/app/services/

# On server
cd /app/services/ai-scraper
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
crawl4ai-setup
```

3. **Create systemd service**
```bash
# /etc/systemd/system/ai-scraper.service
[Unit]
Description=AI Scraper Service
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/app/services/ai-scraper
Environment="PATH=/app/services/ai-scraper/venv/bin"
ExecStart=/app/services/ai-scraper/venv/bin/uvicorn api:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

4. **Start service**
```bash
sudo systemctl daemon-reload
sudo systemctl enable ai-scraper
sudo systemctl start ai-scraper
```

### Option 2: Docker (Recommended)

Create `services/ai-scraper/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    wget gnupg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN crawl4ai-setup

COPY . .
EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:

```bash
cd services/ai-scraper
docker build -t ai-scraper:latest .

docker run -d \
  --name ai-scraper \
  --restart unless-stopped \
  -p 8000:8000 \
  -e ANTHROPIC_API_KEY=your_key \
  -e BROWSER_HEADLESS=true \
  ai-scraper:latest
```

### Option 3: Google Cloud Run

```bash
gcloud config set project YOUR_PROJECT_ID

cd services/ai-scraper
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/ai-scraper

gcloud run deploy ai-scraper \
  --image gcr.io/YOUR_PROJECT_ID/ai-scraper \
  --platform managed \
  --region europe-north1 \
  --allow-unauthenticated \
  --set-env-vars ANTHROPIC_API_KEY=your_key,BROWSER_HEADLESS=true \
  --memory 2Gi \
  --timeout 60s
```

Update your `.env`:
```env
AI_SCRAPER_URL=https://ai-scraper-xxxx-ew.a.run.app
```

## Environment Variables

### AI Scraper Service (`services/ai-scraper/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | - | Your Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-haiku-4-5-20251001` | Claude model to use |
| `BROWSER_HEADLESS` | No | `true` | Run browser in headless mode |
| `SESSION_ID` | No | `svenska-spel-scraper` | Session identifier |
| `LOG_LEVEL` | No | `INFO` | Logging level |

### Node.js Backend (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_SCRAPER_URL` | Yes* | - | URL to AI scraper service |
| `ENABLE_AI_SCRAPER` | No | `false` | Enable AI scraping |
| `ENABLE_SCRAPER_V3` | No | `false` | Use V3 hybrid scraper |

*Required if `ENABLE_AI_SCRAPER=true`

## Monitoring

### Check Service Health

```bash
curl http://localhost:8000/health
```

### View Metrics

```bash
curl http://localhost:3000/api/admin/scraper-metrics | jq
```

### View Logs

```bash
# Systemd
sudo journalctl -u ai-scraper -f

# Docker
docker logs -f ai-scraper
```

### Database Queries

```sql
-- Recent AI usage
SELECT
  DATE(timestamp) as date,
  data_type,
  COUNT(*) as calls,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  SUM(cost_usd)::float as cost
FROM ai_usage
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp), data_type
ORDER BY date DESC;
```

## Troubleshooting

### AI Service Not Starting

```bash
cd services/ai-scraper
source venv/bin/activate

# Check Python version
python --version  # Should be 3.8+

# Reinstall if needed
pip install -r requirements.txt
crawl4ai-setup
crawl4ai-doctor
```

### Port Already in Use

```bash
lsof -ti:8000 | xargs kill -9
```

### API Key Issues

```bash
cat services/ai-scraper/.env | grep ANTHROPIC_API_KEY
curl http://localhost:8000/health
```

### High Memory Usage

Playwright browsers use significant memory. Solutions:
- Increase memory allocation
- Restart service periodically
- Optimize `excluded_tags` in scraper config

### Costs Too High

- Review token usage per scrape
- Add more tags to `excluded_tags`
- Increase use of DOM fallback for simple pages

## Rollback

If issues arise, disable V3 to fall back to DOM-only scraping:

```env
ENABLE_SCRAPER_V3=false
```

Restart the Node.js app. The system will use V2 (DOM scraping) automatically.

## Key Files

```
services/ai-scraper/
├── venv/                  # Python virtual environment
├── requirements.txt       # Python dependencies
├── config.env.example     # Environment template
├── schemas.py             # Pydantic schemas
├── scraper.py             # AI scraper core
├── hooks.py               # Cookie consent handler
├── api.py                 # FastAPI server
├── start.sh               # Startup script
└── README.md              # Service documentation

server/services/scraper/
├── ai-scraper-client.ts   # Node.js client
├── scraper-service-v3.ts  # Hybrid orchestrator
└── scraper-service-v2.ts  # DOM-only fallback
```
