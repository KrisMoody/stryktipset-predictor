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
    # Note: Rely on magic=True and delay for dynamic content, don't hard fail on selector
    "xStats": DataTypeConfig(
        wait_for=None,  # Let magic=True handle dynamic content detection
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL
    ),

    # Statistics page uses Enetpulse widget or standard tables
    # Made selector optional - page may have different table structures
    "statistics": DataTypeConfig(
        wait_for=None,  # Don't wait for specific selector - let delay + magic handle it
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL
    ),

    # Head-to-head data - requires clicking the H2H tab to reveal content
    # The H2H data is on the same page as match info, but in a hidden tab
    # Note: wait_for is None because H2H content may not exist for all matches
    "headToHead": DataTypeConfig(
        wait_for=None,  # Don't hard fail - H2H content may not exist for all matches
        delay=6.0,  # Extra time for tab animation and content load
        timeout=DEFAULT_TIMEOUT,
        js_code="""
(async () => {
    // Try to find and click H2H tab (Svenska Spel uses various selector patterns)
    const h2hSelectors = [
        '[data-tab="head-to-head"]',
        '[data-tab="h2h"]',
        '.tab-h2h',
        '.wff_h2h_tab',
        'button:contains("Inbördes")',
        'button:contains("H2H")',
        '[role="tab"]:contains("Inbördes")',
        '.pg_tabs__item:contains("Inbördes")'
    ];

    for (const selector of h2hSelectors) {
        try {
            // Handle :contains pseudo-selector manually
            if (selector.includes(':contains(')) {
                const match = selector.match(/:contains\\("([^"]+)"\\)/);
                if (match) {
                    const text = match[1];
                    const baseSelector = selector.split(':contains')[0];
                    const elements = document.querySelectorAll(baseSelector || '*');
                    for (const el of elements) {
                        if (el.textContent && el.textContent.includes(text)) {
                            el.click();
                            console.log('[Crawl4AI] Clicked H2H tab via text match:', text);
                            await new Promise(r => setTimeout(r, 1500));
                            return;
                        }
                    }
                }
            } else {
                const tab = document.querySelector(selector);
                if (tab) {
                    tab.click();
                    console.log('[Crawl4AI] Clicked H2H tab:', selector);
                    await new Promise(r => setTimeout(r, 1500));
                    return;
                }
            }
        } catch (e) {
            // Continue to next selector
        }
    }

    // Scroll page to trigger lazy loading if tab not found
    window.scrollTo(0, document.body.scrollHeight / 2);
    await new Promise(r => setTimeout(r, 1000));
    window.scrollTo(0, 0);
})();
"""
    ),

    # News articles
    # Made selector optional - news page structure may vary
    "news": DataTypeConfig(
        wait_for=None,  # Don't wait for specific selector - let delay handle it
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL  # Scroll to load content
    ),

    # Match info (odds, analysis, general info)
    # Made selector optional - page structure may vary
    "matchInfo": DataTypeConfig(
        wait_for=None,  # Don't wait for specific selector - use delay + magic
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL
    ),

    # League table (Enetpulse widget)
    # Note: Keep wait_for but increase timeout for Enetpulse
    "table": DataTypeConfig(
        wait_for=None,  # Enetpulse container may not always be present
        delay=6.0,  # Enetpulse widgets need more time
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL
    ),

    # Team lineups (Enetpulse formation widget)
    "lineup": DataTypeConfig(
        wait_for=None,  # Formation widget may not exist for all matches
        delay=6.0,  # Enetpulse widgets need more time
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL
    ),

    # Draw analysis page
    "analysis": DataTypeConfig(
        wait_for=None,  # Analysis page structure may vary
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL
    ),

    # Oddset quick bets
    "oddset": DataTypeConfig(
        wait_for=None,  # Quick bets may not be present on all pages
        delay=DEFAULT_DELAY,
        timeout=DEFAULT_TIMEOUT,
        js_code=DEFAULT_JS_SCROLL
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
