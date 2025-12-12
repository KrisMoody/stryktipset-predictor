"""
AI-powered web scraper using Crawl4AI + Claude for Svenska Spel data extraction.
"""

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode, LLMConfig
from crawl4ai.extraction_strategy import LLMExtractionStrategy
from crawl4ai.async_dispatcher import MemoryAdaptiveDispatcher
from schemas import XStatsData, StatisticsData, HeadToHeadData, NewsData, MatchInfoData, TableData, LineupData, DrawAnalysisData, OddsetData
from config import get_config, get_retry_config, DataTypeConfig
from typing import Dict, Any, List, Optional
import os
import logging
import asyncio

logger = logging.getLogger(__name__)

# Prompt prefix to help LLM understand markdown format
MARKDOWN_PROMPT_PREFIX = """
IMPORTANT: The content is provided as markdown converted from HTML.
CSS class names are NOT present in the markdown - look for the actual TEXT content and data values.
If data appears in a table format, it will show as markdown tables.
If data appears as text, look for labels followed by values.

"""


class AIScraper:
    """AI-powered web scraper using Crawl4AI + Claude"""

    def __init__(self):
        # Browser configuration with full anti-detection (reused across all requests)
        # See: https://docs.crawl4ai.com/core/browser-config
        self.browser_config = BrowserConfig(
            headless=os.getenv("BROWSER_HEADLESS", "true") == "true",
            viewport_width=1920,
            viewport_height=1080,
            ignore_https_errors=True,
            use_managed_browser=True,
            browser_type="chromium",
            # Anti-detection features from Crawl4AI
            text_mode=False,  # Keep full rendering for JS-heavy pages
            light_mode=False,  # Full browser features needed
            extra_args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-site-isolation-trials",
            ]
        )
        
        # Base crawler configuration
        self.base_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,  # Always fresh data
            delay_before_return_html=2.0,  # Wait for JS
            magic=True,  # ✨ Auto-wait for dynamic content
            session_id=os.getenv("SESSION_ID", "svenska-spel"),  # 🔑 Cookie persistence
            excluded_tags=['script', 'style', 'nav', 'header', 'footer'],  # Note: NEVER exclude 'aside' - statistics sidebar lives there!
            screenshot=False,
            pdf=False
        )
        
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5")
        self.api_key = os.getenv("ANTHROPIC_API_KEY")

        # Shared browser instance (lazy-initialized)
        self._crawler: Optional[AsyncWebCrawler] = None
        self._crawler_lock = asyncio.Lock()

    async def _get_crawler(self) -> AsyncWebCrawler:
        """Get or create a shared browser instance."""
        async with self._crawler_lock:
            if self._crawler is None:
                logger.info("[BROWSER] Creating shared browser instance")
                self._crawler = AsyncWebCrawler(config=self.browser_config)
                await self._crawler.__aenter__()
            return self._crawler

    async def cleanup(self):
        """Cleanup browser resources on shutdown."""
        async with self._crawler_lock:
            if self._crawler is not None:
                logger.info("[BROWSER] Closing shared browser instance")
                try:
                    await self._crawler.__aexit__(None, None, None)
                except Exception as e:
                    logger.warning(f"[BROWSER] Error during cleanup: {e}")
                self._crawler = None

    def _build_crawler_config(self, data_type: str) -> CrawlerRunConfig:
        """
        Build consistent crawler config for any data type.
        Uses centralized configuration from config.py.
        """
        cfg = get_config(data_type)

        return CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            delay_before_return_html=cfg.delay,
            wait_for=cfg.wait_for,
            page_timeout=cfg.timeout,
            js_code=cfg.js_code,
            magic=True,
            excluded_tags=self.base_config.excluded_tags,
            screenshot=False,
            pdf=False
        )

    def _build_retry_config(self, data_type: str) -> CrawlerRunConfig:
        """Build config with extended delays for retry attempts."""
        cfg = get_retry_config(data_type)

        return CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            delay_before_return_html=cfg.delay,
            wait_for=cfg.wait_for,
            page_timeout=cfg.timeout,
            js_code=cfg.js_code,
            magic=True,
            excluded_tags=self.base_config.excluded_tags,
            screenshot=False,
            pdf=False
        )

    def _is_empty_result(self, data: Any) -> bool:
        """Check if extraction result is effectively empty (all None values)."""
        if data is None:
            return True
        if isinstance(data, list):
            if len(data) == 0:
                return True
            # Check first item if list
            return self._is_empty_result(data[0]) if len(data) == 1 else False
        if isinstance(data, dict):
            # Check if all nested values are None
            def all_none(d: dict) -> bool:
                for v in d.values():
                    if isinstance(v, dict):
                        if not all_none(v):
                            return False
                    elif isinstance(v, list):
                        if len(v) > 0:
                            return False
                    elif v is not None:
                        return False
                return True
            return all_none(data)
        return False

    def _create_extraction_strategy(self, instruction: str, schema: dict) -> LLMExtractionStrategy:
        """Create LLM extraction strategy"""
        # Create LLMConfig with correct parameters
        llm_cfg = LLMConfig(
            provider=f"anthropic/{self.model}",
            api_token=self.api_key,
            # Add any other config params if needed
        )
        
        logger.info(f"[DEBUG] Creating LLMExtractionStrategy with llm_config: {llm_cfg}")
        logger.info(f"[DEBUG] Provider: {llm_cfg.provider}")
        logger.info(f"[DEBUG] Has API token: {bool(llm_cfg.api_token)}")
        
        return LLMExtractionStrategy(
            llm_config=llm_cfg,
            instruction=instruction,
            schema=schema,
            extraction_type="schema",
            verbose=True
        )
    
    async def scrape_xstats(self, url: str) -> Dict[str, Any]:
        """Extract xStats data from Playmaker widgets"""
        instruction = MARKDOWN_PROMPT_PREFIX + """
        Extract xStats (expected goals statistics) from this Svenska Spel Stryktipset page.

        Look for data related to:
        - Team names (home team and away team)
        - xG (Förväntade mål / Expected Goals) - decimal values like 1.45, 2.31
        - xGC (Förväntade insläppta mål) - expected goals against
        - xP (Förväntade poäng / Expected Points)
        - Average goals scored/conceded statistics
        - Period selection (e.g., "Hela säsongen", "Hemma & Borta")

        The data typically appears in a comparison format with home team on one side
        and away team on the other, with metric names in between.

        Extract for BOTH homeTeam and awayTeam:
        - name: Team name (e.g., "Leeds", "Liverpool")
        - goalStats: { xg, xgc, avgGoalsScored, avgGoalsConceded, avgGoalsH2H, avgGoalsHomeAway }
        - expectedPoints: { xp, points, xpDiff, expectedPosition, position }

        Also extract:
        - selectedPeriod: The time period shown (e.g., "Hela säsongen - Hemma & Borta")
        - prediction: Match outcome probabilities if shown (homeWin, draw, awayWin as percentages)

        Return null for any missing data fields.
        """

        strategy = self._create_extraction_strategy(
            instruction=instruction,
            schema=XStatsData.model_json_schema()
        )

        config = self._build_crawler_config("xStats")
        return await self._execute_scrape(url, config, strategy, "xStats")
    
    async def scrape_statistics(self, url: str) -> Dict[str, Any]:
        """Extract match statistics and league table"""
        instruction = MARKDOWN_PROMPT_PREFIX + """
        Extract league table statistics from this Svenska Spel Stryktipset page.

        Look for a league table with columns like:
        - # or Position (1, 2, 3...)
        - Team name
        - M or S (Matcher/Spelade - Played)
        - V (Vinster - Won)
        - O (Oavgjorda - Drawn)
        - F (Förluster - Lost)
        - GM (Gjorda mål - Goals For)
        - IM (Insläppta mål - Goals Against)
        - +/- (Goal Difference)
        - P (Poäng - Points)

        The table may show in markdown format like:
        | # | Lag | M | V | O | F | +/- | P |
        |---|-----|---|---|---|---|-----|---|
        | 1 | Liverpool | 14 | 11 | 2 | 1 | +19 | 35 |

        Extract for homeTeam and awayTeam:
        - name: Team name
        - position: League position
        - points: Total points
        - played: Matches played
        - won, drawn, lost: Match results
        - goalsFor, goalsAgainst, goalDifference: Goal stats
        - form: Recent form if available (W/D/L or V/O/F sequence)

        Also extract the full leagueTable as an array of LeagueTableEntry objects.

        Return null for any missing data fields.
        """

        strategy = self._create_extraction_strategy(
            instruction=instruction,
            schema=StatisticsData.model_json_schema()
        )

        config = self._build_crawler_config("statistics")
        return await self._execute_scrape(url, config, strategy, "statistics")
    
    async def scrape_head_to_head(self, url: str) -> Dict[str, Any]:
        """Extract head-to-head history"""
        instruction = MARKDOWN_PROMPT_PREFIX + """
        Extract head-to-head (H2H / Inbördes) match history from this Svenska Spel page.

        Look for a section showing previous meetings between the two teams.
        This may appear as a table or list with:
        - Match dates
        - Team names
        - Scores (e.g., "2-1", "0-0")
        - Competition/league name

        For each historical match, extract:
        - date: Match date
        - homeTeam: Home team name
        - awayTeam: Away team name
        - score: Final score (e.g., "2-1")
        - competition: League/cup name if shown

        Also calculate/extract summary statistics:
        - homeWins: Number of home team victories
        - draws: Number of drawn matches
        - awayWins: Number of away team victories
        - totalMatches: Total number of H2H matches

        Return empty array for matches and null for summary if no H2H data is found.
        """

        strategy = self._create_extraction_strategy(
            instruction=instruction,
            schema=HeadToHeadData.model_json_schema()
        )

        config = self._build_crawler_config("headToHead")
        return await self._execute_scrape(url, config, strategy, "headToHead")
    
    async def scrape_news(self, url: str) -> Dict[str, Any]:
        """Extract news articles and expert analyses"""
        instruction = MARKDOWN_PROMPT_PREFIX + """
        Extract news articles AND expert analyses from this Svenska Spel Stryktipset page.

        NEWS ARTICLES:
        Look for news content with:
        - Article headlines/titles
        - Article body text (paragraphs)
        - Publication dates
        - Source attribution (e.g., "Everysport.com", "TT")

        For each article extract:
        - title: The article headline
        - content: The article body text
        - date: Publication date
        - source: News source name

        EXPERT ANALYSES (Spelanalys):
        Look for expert betting tips/analysis with:
        - Expert/analyst name
        - Their recommendation: "1" (home win), "X" (draw), "2" (away win)
        - Combo recommendations like "1X", "X2", "12"
        - Analysis text explaining their reasoning

        Extract:
        - articles: Array of { title, content, date, source }
        - expertAnalyses: Array of { authorName, authorImage, recommendation, analysis }

        The recommendation field should be one of: "1", "X", "2", "1X", "X2", "12", "1X2", or null.

        Return empty arrays if no data is found.
        """

        strategy = self._create_extraction_strategy(
            instruction=instruction,
            schema=NewsData.model_json_schema()
        )

        config = self._build_crawler_config("news")
        return await self._execute_scrape(url, config, strategy, "news")

    async def scrape_matchinfo(self, url: str) -> Dict[str, Any]:
        """Extract match info: betting odds, over/under, favorites, general info, expert analyses"""
        instruction = MARKDOWN_PROMPT_PREFIX + """
        Extract match information from this Svenska Spel Stryktipset page.

        BETTING ODDS:
        Look for odds from various sources like "Oddset", "Stryktipset", "Svenska Folket":
        - 1 = Home win odds/percentage
        - X = Draw odds/percentage
        - 2 = Away win odds/percentage

        OVER/UNDER ODDS:
        Look for total goals betting like "Över/Under 2,5 mål":
        - Over (Över) odds
        - Under odds

        FAVORITES / PERCENTAGES:
        Look for percentage distribution showing public betting:
        - Home win percentage
        - Draw percentage
        - Away win percentage

        GENERAL MATCH INFO:
        - Date (Datum)
        - Time (Tid)
        - League (Liga)
        - Venue (Arena)

        EXPERT ANALYSES:
        Same as news - expert names, recommendations (1/X/2), analysis text.

        Extract:
        - bettingOdds: Array of { source, subSource, one, x, two }
        - overUnderOdds: { threshold, over, under }
        - favorites: { homePercentage, drawPercentage, awayPercentage }
        - generalInfo: { date, time, league, venue }
        - expertAnalyses: Array of { authorName, authorImage, recommendation, analysis }

        Return null for any missing sections, empty arrays for missing lists.
        """

        strategy = self._create_extraction_strategy(
            instruction=instruction,
            schema=MatchInfoData.model_json_schema()
        )

        config = self._build_crawler_config("matchInfo")
        return await self._execute_scrape(url, config, strategy, "matchInfo")

    async def scrape_table(self, url: str) -> Dict[str, Any]:
        """Extract league standings from Tabell tab (Enetpulse widget)"""
        instruction = MARKDOWN_PROMPT_PREFIX + """
        Extract league standings from this Svenska Spel Stryktipset page.

        Look for a league table showing team standings with columns:
        - Position (1, 2, 3...)
        - Team name
        - M (Matcher/Played)
        - V (Vinster/Won)
        - O (Oavgjorda/Drawn)
        - F (Förluster/Lost)
        - +/- (Goal Difference - may have + or - prefix)
        - P (Poäng/Points)

        The table may have tabs for "Totalt" (Total), "Hemma" (Home), "Borta" (Away).

        Extract:
        - entries: Array of { position, team, played, won, drawn, lost, goalDifference, points, isHighlighted, positionMarker }
        - standingType: "total", "home", or "away" based on which view is shown
        - homeTeamPosition: Position of the home team if highlighted
        - awayTeamPosition: Position of the away team if highlighted

        IMPORTANT: Goal difference may have + or - prefix. Parse "+19" as 19, "-5" as -5.

        Return empty entries array if no table found.
        """

        strategy = self._create_extraction_strategy(
            instruction=instruction,
            schema=TableData.model_json_schema()
        )

        config = self._build_crawler_config("table")
        return await self._execute_scrape(url, config, strategy, "table")

    async def scrape_lineup(self, url: str) -> Dict[str, Any]:
        """Extract team lineups from Laguppställning tab (Enetpulse formation widget)"""
        instruction = MARKDOWN_PROMPT_PREFIX + """
        Extract team lineup information from this Svenska Spel Stryktipset page.

        Look for team lineup/formation data:
        - Team names (home and away)
        - Formation (e.g., "4-3-3", "5-3-2", "4-4-2")
        - Whether lineup is confirmed or probable ("Trolig laguppställning")
        - Player names and jersey numbers
        - Positions (goalkeeper, defender, midfielder, forward)
        - Unavailable players (injured, suspended)
        - Coach name

        Extract for BOTH homeTeam and awayTeam:
        - teamName: Team name
        - formation: Formation string (e.g., "5-3-2")
        - isConfirmed: false if "Trolig" (probable), true if confirmed
        - startingXI: Array of { name, number, position }
        - unavailable: Array of { name, number, reason }
        - coach: Coach name

        Also extract selectedTeam: "home" or "away" based on which team is shown.

        Return empty arrays if no lineup data found.
        """

        strategy = self._create_extraction_strategy(
            instruction=instruction,
            schema=LineupData.model_json_schema()
        )

        config = self._build_crawler_config("lineup")
        return await self._execute_scrape(url, config, strategy, "lineup")

    async def scrape_analysis(self, url: str) -> Dict[str, Any]:
        """Extract draw analysis from Analys/Speltips page"""
        instruction = MARKDOWN_PROMPT_PREFIX + """
        Extract expert analysis and predictions from this Svenska Spel Stryktipset page.

        Look for:
        - Page title (e.g., "Stryktipset 6/12")
        - Introduction/overview text
        - Expert/analyst information (names, bios)
        - Match predictions with recommendations

        ANALYSTS:
        Look for expert names and their descriptions/bios.

        MATCH PREDICTIONS:
        Each prediction has:
        - Match number (1-13)
        - Match title (e.g., "Leeds - Liverpool")
        - Analyst name
        - Prediction: "1" (home), "X" (draw), "2" (away), or combos like "1X", "X2"

        ANALYSIS CONTENT:
        Look for sections like "Spikarna" (the locks), "Skrällen" (the upset), etc.

        Extract:
        - title: Page title
        - introduction: Opening paragraph
        - analysts: Array of { name, imageUrl, description, isOmbud }
        - predictions: Array of { matchNumber, matchTitle, analystName, prediction }
        - analysisContent: Full text of analysis sections

        For predictions: Parse "1 Leeds - Liverpool" as matchNumber=1, matchTitle="Leeds - Liverpool"
        Multiple selected outcomes should combine: 1+X = "1X", X+2 = "X2", etc.

        Return empty arrays if no data found.
        """

        strategy = self._create_extraction_strategy(
            instruction=instruction,
            schema=DrawAnalysisData.model_json_schema()
        )

        config = self._build_crawler_config("analysis")
        return await self._execute_scrape(url, config, strategy, "analysis")

    async def scrape_oddset(self, url: str) -> Dict[str, Any]:
        """Extract Oddset quick bets / live odds"""
        instruction = MARKDOWN_PROMPT_PREFIX + """
        Extract Oddset betting odds from this Svenska Spel Stryktipset page.

        Look for betting markets with odds:

        COMMON MARKETS:
        1. Fulltid - Full time result: 1 (home win), X (draw), 2 (away win)
        2. Totala mål - Total goals: Över 2.5 (over), Under 2.5 (under)
        3. Halvtid - Half time result: 1, X, 2
        4. Båda lagen gör mål - Both teams to score: Ja (yes), Nej (no)

        Extract:
        - markets: Array of betting markets
          - name: Market name (e.g., "Fulltid", "Totala mål")
          - outcomes: Array of { label, odds }
            - label: Outcome label (e.g., "1", "X", "2", "Över 2.5", "Ja")
            - odds: Decimal odds as float (e.g., 4.20)

        IMPORTANT:
        - Swedish format uses comma as decimal separator (4,20 = 4.20)
        - Parse "4,20" as 4.20, "1,79" as 1.79, etc.

        - matchTitle: Match title if visible on the page

        Return empty markets array if no betting odds found.
        """

        strategy = self._create_extraction_strategy(
            instruction=instruction,
            schema=OddsetData.model_json_schema()
        )

        config = self._build_crawler_config("oddset")
        return await self._execute_scrape(url, config, strategy, "oddset")

    async def scrape_raw_js(self, url: str, js_expression: str) -> Dict[str, Any]:
        """
        Scrape raw JavaScript data from a page without AI extraction.

        Uses Crawl4AI's browser to load the page and execute a JS expression
        to extract embedded data (like window._svs.draw.data.draws).

        Args:
            url: Page URL to scrape
            js_expression: JavaScript expression to evaluate

        Returns:
            Dict with success, data, and error fields
        """
        import re
        import json

        try:
            logger.info(f"[RawJS] Scraping {url}")
            logger.info(f"[RawJS] Expression: {js_expression}")

            # Config with longer wait for SPAs like Svenska Spel
            # The page loads a shell first, then fetches data via API
            config = CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
                delay_before_return_html=5.0,  # Wait for initial render
                magic=True,
                page_timeout=60000,
                screenshot=False,
                pdf=False,
                js_code=f"""
                    (async () => {{
                        // Wait for SPA to fully load (Svenska Spel loads data via API)
                        // Poll for data with exponential backoff
                        const maxWait = 15000;
                        const startTime = Date.now();

                        while (Date.now() - startTime < maxWait) {{
                            try {{
                                const data = {js_expression};

                                // For Topptipset, the _svs.draw.data.draws object may not have Topptipset data
                                // Instead, extract draw numbers from the draw selector links in the DOM
                                const url = window.location.pathname;
                                if (url.includes('topptipset') && (!data || Object.keys(data).length === 0 || !Object.keys(data).some(k => k.startsWith('25_') || k.startsWith('23_') || k.startsWith('24_')))) {{
                                    // Try to extract draw numbers from the draw selector links
                                    const drawLinks = document.querySelectorAll('a[href*="/topptipset/?draw="]');
                                    if (drawLinks.length > 0) {{
                                        const draws = {{}};
                                        drawLinks.forEach(link => {{
                                            const href = link.getAttribute('href');
                                            const drawMatch = href.match(/draw=(\d+)/);
                                            const productMatch = href.match(/product=(\d+)/);
                                            if (drawMatch && productMatch) {{
                                                const drawNum = drawMatch[1];
                                                const productId = productMatch[1];
                                                // Topptipset product IDs: 23, 24, 25 (variants)
                                                if (['23', '24', '25'].includes(productId)) {{
                                                    draws[productId + '_' + drawNum] = {{ model: {{ productId: parseInt(productId), drawNumber: parseInt(drawNum) }} }};
                                                }}
                                            }}
                                        }});

                                        // Also check for the currently selected draw (doesn't have a link)
                                        const selectedCard = document.querySelector('.pg_draw_card--selected');
                                        if (selectedCard) {{
                                            // The current draw doesn't have URL params, need to find it another way
                                            // Look for the draw info in the page state or extract from coupon
                                            const currentDrawInfo = window._svs?.tipsen?.getState?.()?.draw;
                                            if (currentDrawInfo) {{
                                                const productId = currentDrawInfo.productId || currentDrawInfo.currentProductId;
                                                const drawNumber = currentDrawInfo.drawNumber || currentDrawInfo.currentDrawNumber;
                                                if (productId && drawNumber) {{
                                                    draws[productId + '_' + drawNumber] = {{ model: {{ productId, drawNumber }} }};
                                                }}
                                            }}
                                        }}

                                        if (Object.keys(draws).length > 0) {{
                                            document.body.setAttribute('data-extracted', JSON.stringify(draws));
                                            console.log('[Crawl4AI] Extracted Topptipset draws from DOM links');
                                            return;
                                        }}
                                    }}
                                }}

                                if (data && Object.keys(data).length > 0) {{
                                    // Check if the URL matches expected product
                                    const isTopptipset = url.includes('topptipset');
                                    const isEuropatipset = url.includes('europatipset');
                                    const isStryktipset = url.includes('stryktipset');

                                    // For Topptipset, accept any of the variant product IDs (23, 24, 25)
                                    // For Europatipset, wait for productId 2
                                    // For Stryktipset, wait for productId 1
                                    let hasExpectedProduct = false;
                                    const keys = Object.keys(data);

                                    if (isTopptipset) {{
                                        hasExpectedProduct = keys.some(k => k.startsWith('25_') || k.startsWith('24_') || k.startsWith('23_'));
                                    }} else if (isEuropatipset) {{
                                        hasExpectedProduct = keys.some(k => k.startsWith('2_'));
                                    }} else if (isStryktipset) {{
                                        hasExpectedProduct = keys.some(k => k.startsWith('1_'));
                                    }} else {{
                                        hasExpectedProduct = true; // Unknown product, accept any data
                                    }}

                                    if (hasExpectedProduct) {{
                                        document.body.setAttribute('data-extracted', JSON.stringify(data));
                                        console.log('[Crawl4AI] Found expected product data');
                                        return;
                                    }}
                                }}
                            }} catch (e) {{
                                console.log('[Crawl4AI] Waiting for data...', e.message);
                            }}
                            await new Promise(r => setTimeout(r, 500));
                        }}

                        // Timeout - extract whatever we have
                        try {{
                            const data = {js_expression};
                            if (data) {{
                                document.body.setAttribute('data-extracted', JSON.stringify(data));
                                console.log('[Crawl4AI] Timeout - extracted available data');
                            }}
                        }} catch (e) {{
                            console.error('[Crawl4AI] Extraction error:', e);
                        }}
                    }})();
                """
            )

            # Use shared browser instance
            crawler = await self._get_crawler()
            result = await crawler.arun(url=url, config=config)

            if not result.success:
                return {
                    "success": False,
                    "data": None,
                    "error": result.error_message or "Failed to load page"
                }

            html = result.html if hasattr(result, 'html') else ""

            # Look for our extracted data in the HTML
            match = re.search(r'data-extracted="([^"]*)"', html)
            if match:
                try:
                    raw_data = match.group(1).replace('&quot;', '"')
                    data = json.loads(raw_data)
                    logger.info(f"[RawJS] Successfully extracted data from data attribute")
                    return {
                        "success": True,
                        "data": data,
                        "error": None
                    }
                except json.JSONDecodeError as e:
                    logger.error(f"[RawJS] JSON decode error: {e}")

            # Fallback: Try to find _svs data in the HTML source
            svs_match = re.search(r'_svs\.draw\.data\.draws\s*=\s*(\{[^;]+\})', html)
            if svs_match:
                try:
                    data = json.loads(svs_match.group(1))
                    logger.info(f"[RawJS] Extracted data from inline script")
                    return {
                        "success": True,
                        "data": data,
                        "error": None
                    }
                except json.JSONDecodeError:
                    pass

            logger.warning(f"[RawJS] Could not find data in page (html length: {len(html)})")
            return {
                "success": False,
                "data": None,
                "error": "Could not extract data from page"
            }

        except Exception as e:
            logger.exception(f"[RawJS] Exception during scrape")
            # Don't close the shared crawler on error - just log and return
            return {
                "success": False,
                "data": None,
                "error": str(e)
            }

    async def scrape_batch(
        self,
        requests: List[Dict[str, str]],
        max_concurrent: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Scrape multiple URLs in parallel.

        Uses the shared browser instance and runs requests concurrently
        with semaphore-based rate limiting.

        Args:
            requests: List of dicts with 'url' and 'data_type' keys
            max_concurrent: Maximum concurrent requests (default 3 for rate limiting)

        Returns:
            List of scrape results in the same order as requests
        """
        if not requests:
            return []

        logger.info(f"[Batch] Starting batch scrape of {len(requests)} URLs (max_concurrent={max_concurrent})")

        results: List[Dict[str, Any]] = [None] * len(requests)  # type: ignore

        try:
            # Ensure shared browser is initialized
            await self._get_crawler()

            # Use semaphore for concurrency control
            semaphore = asyncio.Semaphore(max_concurrent)

            async def scrape_single(idx: int, req: Dict[str, str]) -> None:
                async with semaphore:
                    url = req.get("url", "")
                    data_type = req.get("data_type", "")

                    if not url or not data_type:
                        results[idx] = {
                            "success": False,
                            "data": None,
                            "error": "Missing url or data_type",
                            "url": url,
                            "data_type": data_type
                        }
                        return

                    try:
                        # Call the appropriate scrape method (uses shared crawler)
                        result = await self._scrape_by_type(url, data_type)
                        result["url"] = url
                        result["data_type"] = data_type
                        results[idx] = result
                    except Exception as e:
                        logger.error(f"[Batch] Error scraping {url}: {e}")
                        results[idx] = {
                            "success": False,
                            "data": None,
                            "error": str(e),
                            "url": url,
                            "data_type": data_type
                        }

            # Launch all scrapes concurrently (semaphore controls actual parallelism)
            await asyncio.gather(*[
                scrape_single(i, req) for i, req in enumerate(requests)
            ])

            logger.info(f"[Batch] Completed batch scrape: {sum(1 for r in results if r and r.get('success'))} succeeded, {sum(1 for r in results if r and not r.get('success'))} failed")
            return results

        except Exception as e:
            logger.exception(f"[Batch] Exception during batch scrape")
            # Don't close the shared crawler on error
            return [{
                "success": False,
                "data": None,
                "error": str(e),
                "url": req.get("url", ""),
                "data_type": req.get("data_type", "")
            } for req in requests]

    async def _scrape_by_type(self, url: str, data_type: str) -> Dict[str, Any]:
        """Route to appropriate scrape method based on data_type."""
        method_map = {
            "xStats": self.scrape_xstats,
            "statistics": self.scrape_statistics,
            "headToHead": self.scrape_head_to_head,
            "news": self.scrape_news,
            "matchInfo": self.scrape_matchinfo,
            "table": self.scrape_table,
            "lineup": self.scrape_lineup,
            "analysis": self.scrape_analysis,
            "oddset": self.scrape_oddset,
        }

        method = method_map.get(data_type)
        if not method:
            return {
                "success": False,
                "data": None,
                "error": f"Unknown data_type: {data_type}"
            }

        return await method(url)

    async def _execute_scrape(
        self,
        url: str,
        config: CrawlerRunConfig,
        strategy: LLMExtractionStrategy,
        data_type: str,
        is_retry: bool = False
    ) -> Dict[str, Any]:
        """Execute scrape with error handling and retry logic"""
        try:
            logger.info(f"[DEBUG] Starting scrape for {data_type}{' (RETRY)' if is_retry else ''}")
            logger.info(f"[DEBUG] Config wait_for: {config.wait_for}")
            logger.info(f"[DEBUG] Config delay: {config.delay_before_return_html}")

            # Use shared browser instance
            crawler = await self._get_crawler()
            result = await crawler.arun(
                url=url,
                config=config,
                extraction_strategy=strategy
            )

            # Diagnostic logging for markdown content
            markdown_length = len(result.markdown) if hasattr(result, 'markdown') and result.markdown else 0
            logger.info(f"[DEBUG] Result markdown length: {markdown_length}")

            if hasattr(result, 'markdown') and result.markdown:
                # Log preview of markdown content
                preview = result.markdown[:1000] if len(result.markdown) > 1000 else result.markdown
                logger.info(f"[DEBUG] Markdown preview:\n{preview}")

                # Check for expected content based on data type
                cfg = get_config(data_type)
                if cfg.wait_for:
                    # Extract selector names to check in content
                    selectors = cfg.wait_for.replace("css:", "").split(", ")
                    for sel in selectors:
                        # Clean selector to get class name
                        class_name = sel.replace(".", "").replace("[class*='", "").replace("']", "").replace("#", "")
                        found = class_name.lower() in result.markdown.lower()
                        logger.info(f"[DEBUG] Contains '{class_name}': {found}")

            # Extract data
            success = result.success
            extracted_content = result.extracted_content if hasattr(result, 'extracted_content') else None
            error_message = None if success else result.error_message
            token_usage = result.token_usage if hasattr(result, 'token_usage') else None

            # If extracted_content is None but we have markdown, try manual extraction
            if success and extracted_content is None and hasattr(result, 'markdown') and result.markdown:
                logger.info(f"[DEBUG] Extracted content is None, trying manual extraction with strategy.run()")
                try:
                    sections = [result.markdown]
                    manual_result = strategy.run(url, sections)
                    if manual_result:
                        extracted_content = manual_result
                        logger.info(f"[DEBUG] Manual extraction succeeded!")
                    else:
                        logger.warning(f"[DEBUG] Manual result was empty or falsy")
                except Exception as e:
                    logger.error(f"[DEBUG] Manual extraction failed: {e}")

            # Log extraction result
            logger.info(f"[DEBUG] Extracted content type: {type(extracted_content)}")
            logger.info(f"[DEBUG] Extracted content: {extracted_content}")

            # Process result
            final_data = extracted_content
            if isinstance(extracted_content, list) and len(extracted_content) == 1:
                final_data = extracted_content[0]
            elif isinstance(extracted_content, list) and len(extracted_content) > 1:
                final_data = {"results": extracted_content}

            # Check if result is empty and retry if this is the first attempt
            if success and self._is_empty_result(final_data) and not is_retry:
                logger.warning(f"[{data_type}] Empty result detected, retrying with extended wait...")
                retry_config = self._build_retry_config(data_type)
                return await self._execute_scrape(url, retry_config, strategy, data_type, is_retry=True)

            if success:
                if self._is_empty_result(final_data):
                    logger.warning(f"⚠️ Scraped {data_type} but result is empty (all nulls)")
                else:
                    logger.info(f"✅ Successfully scraped {data_type} from {url}")

                return {
                    "success": True,
                    "data": final_data,
                    "tokens": token_usage,
                    "error": None
                }
            else:
                logger.error(f"❌ Failed to scrape {data_type}: {error_message}")
                return {
                    "success": False,
                    "data": None,
                    "tokens": None,
                    "error": error_message
                }

        except Exception as e:
            logger.exception(f"💥 Exception scraping {data_type}")
            # Don't close the shared crawler on error - just log and return
            return {
                "success": False,
                "data": None,
                "tokens": None,
                "error": str(e)
            }

