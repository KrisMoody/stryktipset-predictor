"""
Centralized configuration for AI scraper crawling.

This module provides a consistent pattern for all Crawl4AI configurations,
ensuring each data type has appropriate wait times and selectors.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class DataTypeConfig:
    """Configuration for a specific data type."""
    wait_for: Optional[str]  # CSS selector to wait for (None to skip)
    delay: float  # Delay before capturing HTML (seconds)
    timeout: int  # Page timeout in ms
    js_code: Optional[str] = None  # Optional JS to execute before capture


# Default configuration values
DEFAULT_DELAY = 5.0  # seconds - increased from 3.0 for dynamic content
DEFAULT_TIMEOUT = 45000  # 45 seconds - increased from 30000

# JavaScript to scroll page and trigger lazy loading
DEFAULT_JS_SCROLL = """
(async () => {
    // Scroll to middle to trigger lazy loading
    window.scrollTo(0, document.body.scrollHeight / 2);
    await new Promise(r => setTimeout(r, 1000));
    // Scroll back to top
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 500));
})();
"""


# Per-data-type configurations
# Each data type has specific selectors to wait for based on the page structure
DATA_TYPE_CONFIGS: dict[str, DataTypeConfig] = {
    # xStats page uses Playmaker widgets
    "xStats": DataTypeConfig(
        wait_for="css:.playmaker_widget_xstat",
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL
    ),

    # Statistics page uses Enetpulse widget or standard tables
    "statistics": DataTypeConfig(
        wait_for="css:.wff_standings_table_row",
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL
    ),

    # Note: headToHead has no dedicated URL on svenskaspel.se
    # It's skipped in AI scraping and handled by DOM fallback only

    # News articles
    "news": DataTypeConfig(
        wait_for="css:.route-statistics-news-article",
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT,
        js_code=None  # News typically loads without scroll
    ),

    # Match info (odds, analysis, general info)
    "matchInfo": DataTypeConfig(
        wait_for="css:.match-info-product-odds",
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL
    ),

    # League table (Enetpulse widget)
    "table": DataTypeConfig(
        wait_for="css:#enetpulse-container",
        delay=6.0,  # Enetpulse widgets need more time
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL
    ),

    # Team lineups (Enetpulse formation widget)
    "lineup": DataTypeConfig(
        wait_for="css:.wff_formation_generic_root",
        delay=6.0,  # Enetpulse widgets need more time
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL
    ),

    # Draw analysis page
    "analysis": DataTypeConfig(
        wait_for="css:.route-play-draw-analyses",
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT,
        js_code=None
    ),

    # Oddset quick bets
    "oddset": DataTypeConfig(
        wait_for="css:.quick-bets",
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT,
        js_code=None
    ),
}


def get_config(data_type: str) -> DataTypeConfig:
    """
    Get configuration for a data type.

    Args:
        data_type: The type of data being scraped (e.g., 'xStats', 'statistics')

    Returns:
        DataTypeConfig with appropriate settings, or defaults if unknown type
    """
    return DATA_TYPE_CONFIGS.get(data_type, DataTypeConfig(
        wait_for=None,  # No specific selector for unknown types
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT
    ))


def get_retry_config(data_type: str, multiplier: float = 1.5) -> DataTypeConfig:
    """
    Get configuration with extended delays for retry attempts.

    Args:
        data_type: The type of data being scraped
        multiplier: How much to increase the delay (default 1.5x)

    Returns:
        DataTypeConfig with increased delay
    """
    cfg = get_config(data_type)
    return DataTypeConfig(
        wait_for=cfg.wait_for,
        delay=cfg.delay * multiplier,
        timeout=cfg.timeout,
        js_code=cfg.js_code
    )
