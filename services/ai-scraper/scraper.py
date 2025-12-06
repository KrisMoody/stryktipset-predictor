"""
AI-powered web scraper using Crawl4AI + Claude for Svenska Spel data extraction.
"""

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode, LLMConfig
from crawl4ai.extraction_strategy import LLMExtractionStrategy
from schemas import XStatsData, StatisticsData, HeadToHeadData, NewsData, MatchInfoData, TableData, LineupData, DrawAnalysisData, OddsetData
from config import get_config, get_retry_config, DataTypeConfig
from typing import Dict, Any
import os
import logging

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
        # Browser configuration (reused across all requests)
        self.browser_config = BrowserConfig(
            headless=os.getenv("BROWSER_HEADLESS", "true") == "true",
            viewport_width=1920,
            viewport_height=1080,
            ignore_https_errors=True,
            use_managed_browser=True,
            browser_type="chromium",  # Explicitly set browser type
            extra_args=["--disable-blink-features=AutomationControlled"]  # Anti-detection
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

    async def _execute_scrape(
        self,
        url: str,
        config: CrawlerRunConfig,
        strategy: LLMExtractionStrategy,
        data_type: str,
        is_retry: bool = False
    ) -> Dict[str, Any]:
        """Execute scrape with error handling and retry logic"""
        crawler = None
        try:
            logger.info(f"[DEBUG] Starting scrape for {data_type}{' (RETRY)' if is_retry else ''}")
            logger.info(f"[DEBUG] Config wait_for: {config.wait_for}")
            logger.info(f"[DEBUG] Config delay: {config.delay_before_return_html}")

            crawler = AsyncWebCrawler(config=self.browser_config)
            async with crawler:
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

                # Extract data before context manager closes
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
            if crawler is not None:
                try:
                    await crawler.crawler_strategy.close()
                except:
                    pass
            return {
                "success": False,
                "data": None,
                "tokens": None,
                "error": str(e)
            }

