"""
FastAPI server for AI scraping service.
"""

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

app = FastAPI(
    title="AI Scraper Service",
    description="Crawl4AI + Claude powered web scraper for Svenska Spel",
    version="1.0.0"
)

scraper = AIScraper()


class ScrapeRequest(BaseModel):
    """Request model for scraping"""
    url: str
    data_type: str  # 'xStats', 'statistics', 'headToHead', 'news'


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
        request: ScrapeRequest with url and data_type

    Returns:
        ScrapeResponse with extracted data (never raises 500, always returns structured response)
    """
    logger.info(f"Scraping {request.data_type} from {request.url}")

    try:
        if request.data_type == "xStats":
            result = await scraper.scrape_xstats(request.url)
        elif request.data_type == "statistics":
            result = await scraper.scrape_statistics(request.url)
        elif request.data_type == "headToHead":
            result = await scraper.scrape_head_to_head(request.url)
        elif request.data_type == "news":
            result = await scraper.scrape_news(request.url)
        else:
            # Invalid data_type - return error response, don't raise
            return ScrapeResponse(
                success=False,
                data=None,
                tokens=None,
                error=f"Invalid data_type: {request.data_type}"
            )

        return result

    except Exception as e:
        # Return error as structured response so client can fall back to DOM
        # Don't raise HTTPException - let the client handle fallback
        logger.exception("Scraping error")
        return ScrapeResponse(
            success=False,
            data=None,
            tokens=None,
            error=str(e)
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

