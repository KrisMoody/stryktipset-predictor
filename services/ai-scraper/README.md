# AI Scraper Service

AI-powered web scraping using **Crawl4AI** + **Claude 4.5 Haiku**.

## Setup

**IMPORTANT:** The Python venv MUST be kept outside the project directory to avoid conflicts with Vite/esbuild in the main Nuxt app.

1. Create venv outside project:
```bash
# Create venv in home directory
python3 -m venv ~/ai-scraper-venv
source ~/ai-scraper-venv/bin/activate
```

2. Install dependencies:
```bash
cd services/ai-scraper
pip install -r requirements.txt
crawl4ai-setup
```

3. Create `.env` file:
```bash
cp config.env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

4. Verify installation:
```bash
crawl4ai-doctor
```

## Running

```bash
cd services/ai-scraper
source ~/ai-scraper-venv/bin/activate
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

Or use the start script (update it to use ~/ai-scraper-venv):
```bash
./start.sh
```

## API

### POST /scrape
Scrape data using AI extraction.

**Request:**
```json
{
  "url": "https://www.svenskaspel.se/stryktipset/1/1",
  "data_type": "xStats"
}
```

**Response:**
```json
{
  "success": true,
  "data": {...},
  "tokens": {"input": 2000, "output": 500},
  "error": null
}
```

### GET /health
Health check.

**Response:**
```json
{
  "status": "ok",
  "service": "ai-scraper",
  "version": "1.0.0",
  "anthropic_key_configured": true
}
```

## Supported Data Types

- `xStats` - Expected goals statistics
- `statistics` - Match statistics (possession, shots, etc.)
- `headToHead` - Historical matches between teams
- `news` - Match news articles

## Architecture

- **Crawl4AI**: Async web crawling with Playwright
- **Claude 4.5 Haiku**: LLM-powered extraction with $1/1M input, $5/1M output
- **Pydantic**: Type-safe schemas for validation
- **FastAPI**: REST API server

## Cost Estimates

With `excluded_tags` filtering:
- Input: ~2000 tokens per match
- Output: ~500 tokens per match  
- **Cost per match**: ~$0.0025
- **Per draw** (13 matches): ~$0.032
- **Monthly** (4 draws): **~$0.13**

