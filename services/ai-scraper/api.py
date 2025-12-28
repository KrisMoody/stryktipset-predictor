"""
FastAPI server for AI scraping service.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from scraper import AIScraper
from dotenv import load_dotenv
import logging
import os

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create scraper instance (browser is lazy-initialized on first request)
scraper = AIScraper()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    logger.info("AI Scraper starting up...")
    yield
    # Cleanup browser on shutdown
    logger.info("AI Scraper shutting down, cleaning up browser...")
    await scraper.cleanup()


app = FastAPI(
    title="AI Scraper Service",
    description="Crawl4AI + Claude powered web scraper for Svenska Spel",
    version="1.0.0",
    lifespan=lifespan
)


class ScrapeRequest(BaseModel):
    """Request model for scraping"""
    url: str
    data_type: str  # 'xStats', 'statistics', 'headToHead', 'news', 'matchInfo', 'table', 'lineup', 'analysis', 'oddset'
    game_type: str | None = None  # Optional: 'stryktipset', 'europatipset', 'topptipset'


class ScrapeResponse(BaseModel):
    """Response model for scraping"""
    success: bool
    data: dict | None
    tokens: dict | None
    error: str | None


@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_endpoint(request: ScrapeRequest):
    """
    Scrape data from Svenska Spel using AI extraction.

    Args:
        request: ScrapeRequest with url, data_type, and optional game_type

    Returns:
        ScrapeResponse with extracted data (never raises 500, always returns structured response)
    """
    game_info = f" (game: {request.game_type})" if request.game_type else ""
    logger.info(f"Scraping {request.data_type} from {request.url}{game_info}")

    try:
        # Route to appropriate scrape method
        scrape_methods = {
            "xStats": scraper.scrape_xstats,
            "statistics": scraper.scrape_statistics,
            "headToHead": scraper.scrape_head_to_head,
            "news": scraper.scrape_news,
            "matchInfo": scraper.scrape_matchinfo,
            "table": scraper.scrape_table,
            "lineup": scraper.scrape_lineup,
            "analysis": scraper.scrape_analysis,
            "oddset": scraper.scrape_oddset,
        }

        method = scrape_methods.get(request.data_type)
        if not method:
            return ScrapeResponse(
                success=False,
                data=None,
                tokens=None,
                error=f"Invalid data_type: {request.data_type}. Valid types: {', '.join(scrape_methods.keys())}"
            )

        result = await method(request.url)
        return result

    except Exception:
        # Return error as structured response so client can fall back to DOM
        # Don't raise HTTPException - let the client handle fallback
        # Note: logger.exception logs the full stack trace server-side
        logger.exception("Scraping error")
        return ScrapeResponse(
            success=False,
            data=None,
            tokens=None,
            error="Scraping failed. Check server logs for details."
        )


class RawScrapeRequest(BaseModel):
    """Request model for raw JS variable extraction"""
    url: str
    js_expression: str  # JavaScript expression to evaluate, e.g., "window._svs?.draw?.data?.draws"


class RawScrapeResponse(BaseModel):
    """Response model for raw scraping"""
    success: bool
    data: dict | list | None
    error: str | None


class BatchScrapeItem(BaseModel):
    """Single item in a batch scrape request"""
    url: str
    data_type: str  # 'xStats', 'statistics', 'headToHead', 'news', 'matchInfo', 'table', 'lineup', 'analysis', 'oddset'
    game_type: str | None = None  # Optional: 'stryktipset', 'europatipset', 'topptipset'


class BatchScrapeRequest(BaseModel):
    """Request model for batch scraping multiple URLs"""
    requests: list[BatchScrapeItem]
    max_concurrent: int = 3  # Maximum concurrent requests (default 3 for rate limiting)


class BatchScrapeResultItem(BaseModel):
    """Single result in a batch scrape response"""
    success: bool
    data: dict | None
    error: str | None
    url: str
    data_type: str


class BatchScrapeResponse(BaseModel):
    """Response model for batch scraping"""
    results: list[BatchScrapeResultItem]
    total: int
    succeeded: int
    failed: int


@app.post("/scrape-raw", response_model=RawScrapeResponse)
async def scrape_raw_endpoint(request: RawScrapeRequest):
    """
    Scrape raw JavaScript data from a page using Crawl4AI.

    This endpoint extracts JavaScript variables from the page context
    without using AI/LLM extraction. Useful for embedded JSON data.

    Args:
        request: RawScrapeRequest with url and js_expression

    Returns:
        RawScrapeResponse with extracted data
    """
    logger.info(f"Raw scraping {request.url}, expression: {request.js_expression}")

    try:
        result = await scraper.scrape_raw_js(request.url, request.js_expression)
        return result
    except Exception:
        logger.exception("Raw scraping error")
        return RawScrapeResponse(
            success=False,
            data=None,
            error="Raw scraping failed. Check server logs for details."
        )


@app.post("/scrape-batch", response_model=BatchScrapeResponse)
async def scrape_batch_endpoint(request: BatchScrapeRequest):
    """
    Scrape multiple URLs in parallel using Crawl4AI.

    This endpoint is more efficient than making sequential /scrape requests
    as it reuses the browser instance and runs requests concurrently.

    Args:
        request: BatchScrapeRequest with list of urls and data_types

    Returns:
        BatchScrapeResponse with results for each request
    """
    logger.info(f"Batch scraping {len(request.requests)} URLs (max_concurrent={request.max_concurrent})")

    try:
        # Convert BatchScrapeItem to dict for scraper
        requests_list = [{"url": item.url, "data_type": item.data_type} for item in request.requests]

        results = await scraper.scrape_batch(requests_list, max_concurrent=request.max_concurrent)

        # Convert results to response model
        result_items = []
        for r in results:
            result_items.append(BatchScrapeResultItem(
                success=r.get("success", False),
                data=r.get("data"),
                error=r.get("error"),
                url=r.get("url", ""),
                data_type=r.get("data_type", "")
            ))

        succeeded = sum(1 for r in results if r.get("success"))
        failed = len(results) - succeeded

        return BatchScrapeResponse(
            results=result_items,
            total=len(results),
            succeeded=succeeded,
            failed=failed
        )

    except Exception:
        logger.exception("Batch scraping error")
        # Return error for all requests
        result_items = [
            BatchScrapeResultItem(
                success=False,
                data=None,
                error="Batch scraping failed. Check server logs for details.",
                url=item.url,
                data_type=item.data_type
            ) for item in request.requests
        ]
        return BatchScrapeResponse(
            results=result_items,
            total=len(request.requests),
            succeeded=0,
            failed=len(request.requests)
        )


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "ai-scraper",
        "version": "1.0.0",
        "anthropic_key_configured": bool(os.getenv("ANTHROPIC_API_KEY"))
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

