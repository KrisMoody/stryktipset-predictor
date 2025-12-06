"""
Pydantic schemas for type-safe data extraction from Svenska Spel.

These schemas match the HTML structure on svenskaspel.se/stryktipset:
- Matchinfo page: betting odds, over/under, favorites, expert analysis
- xStats page: Playmaker widgets with xG, xP, spider chart
- Statistics page: League tables
- News page: TT news articles
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Literal


# ============================================================================
# xStats Schemas (from Playmaker widgets)
# ============================================================================

class TeamGoalStats(BaseModel):
    """Goal statistics from the xG widget (.playmaker_widget_xstat__goal_stat_widget)"""
    xg: Optional[str] = Field(None, description="Förväntade mål (xG)")
    xgc: Optional[str] = Field(None, description="Förväntade insläppta mål (xGC)")
    avgGoalsScored: Optional[str] = Field(None, description="Genomsnitt gjorda mål (Hela säsongen)")
    avgGoalsConceded: Optional[str] = Field(None, description="Genomsnitt insläppta mål")
    avgGoalsH2H: Optional[str] = Field(None, description="Genomsnitt gjorda mål inbördes (5 senaste)")
    avgGoalsHomeAway: Optional[str] = Field(None, description="Genomsnitt gjorda mål hemma & borta")


class TeamExpectedPoints(BaseModel):
    """Expected points from the xP widget (.playmaker_widget_xstat__expected_points_widget)"""
    xp: Optional[str] = Field(None, description="Förväntade poäng (xP)")
    points: Optional[str] = Field(None, description="Actual points")
    xpDiff: Optional[str] = Field(None, description="Skillnad i xP/poäng")
    expectedPosition: Optional[str] = Field(None, description="Förväntad tabellplacering")
    position: Optional[str] = Field(None, description="Actual tabellplacering")


class TeamXStats(BaseModel):
    """Combined xStats for a team"""
    name: str
    goalStats: Optional[TeamGoalStats] = None
    expectedPoints: Optional[TeamExpectedPoints] = None
    # Legacy fields for backward compatibility
    xg: Optional[float] = Field(None, description="Expected Goals (legacy)")
    xga: Optional[float] = Field(None, description="Expected Goals Against (legacy)")
    xp: Optional[float] = Field(None, description="Expected Points (legacy)")


class XStatsData(BaseModel):
    """Complete xStats data from the Playmaker widgets

    HTML Structure:
    - .playmaker_widget_xstat - Main container
    - .playmaker_widget_xstat__drop_down select - Period selector
    - .pm-spider-home-team / .pm-spider-away-team - Team names
    - .pm-x-metric-row - Data rows with .pm-x-metric-name (center) and values (left/right)
    """
    homeTeam: TeamXStats
    awayTeam: TeamXStats
    selectedPeriod: Optional[str] = Field(None, description="Selected period from dropdown (e.g., 'Hela säsongen - Hemma & Borta')")
    prediction: Optional[Dict[str, float]] = Field(
        None,
        description="Match outcome probabilities (homeWin, draw, awayWin)"
    )


# ============================================================================
# Matchinfo Schemas (main statistics page)
# ============================================================================

class BettingOdds(BaseModel):
    """Betting odds from a single source (.match-info-product-odds row)"""
    source: str = Field(..., description="Source name (e.g., 'Oddset', 'Stryktipset')")
    subSource: Optional[str] = Field(None, description="Sub-source (e.g., 'Svenska Folket')")
    one: str = Field(..., description="Home win odds/percentage")
    x: str = Field(..., description="Draw odds/percentage")
    two: str = Field(..., description="Away win odds/percentage")


class OverUnderOdds(BaseModel):
    """Over/Under odds (.match-info-over-under-odds)"""
    threshold: str = Field("2.5", description="Goal threshold (e.g., '2,5')")
    over: str = Field(..., description="Over odds")
    under: str = Field(..., description="Under odds")


class FavoritesData(BaseModel):
    """Favorites bar data (.match-info-favorites)"""
    homePercentage: float = Field(..., description="Home win percentage from odds")
    drawPercentage: float = Field(..., description="Draw percentage from odds")
    awayPercentage: float = Field(..., description="Away win percentage from odds")


class GeneralMatchInfo(BaseModel):
    """General match information (.general-match-info-table)"""
    date: Optional[str] = Field(None, description="Match date (e.g., 'Lördag 6 december 2025')")
    time: Optional[str] = Field(None, description="Match time (e.g., '18:30')")
    league: Optional[str] = Field(None, description="League name (e.g., 'Premier League')")
    venue: Optional[str] = Field(None, description="Stadium/venue name")


class ExpertAnalysis(BaseModel):
    """Expert betting analysis (.match-info-match-analysis)"""
    authorName: str = Field(..., description="Expert name from .analysis-author-name")
    authorImage: Optional[str] = Field(None, description="Profile image URL from .analysis-profile-picture")
    recommendation: Optional[Literal['1', 'X', '2', '1X', 'X2', '12', '1X2']] = Field(
        None,
        description="Selected bet from .btn-bet-selected buttons"
    )
    analysis: str = Field(..., description="Analysis text from .analysis-body")


class MatchInfoData(BaseModel):
    """Complete match info from the Matchinfo page

    HTML Structure:
    - .match_info_table.match-info-product-odds - Odds table
    - .match_info_table.match-info-over-under-odds - Over/under table
    - .match-info-favorites - Favorites bar
    - .general-match-info-table - Date, time, venue
    - .match-info-match-analysis - Expert analyses
    """
    bettingOdds: List[BettingOdds] = Field(default_factory=list)
    overUnderOdds: Optional[OverUnderOdds] = None
    favorites: Optional[FavoritesData] = None
    generalInfo: Optional[GeneralMatchInfo] = None
    expertAnalyses: List[ExpertAnalysis] = Field(default_factory=list)


# ============================================================================
# Table Schemas (Tabell tab - Enetpulse widget)
# ============================================================================

class TableEntry(BaseModel):
    """Single team in the Enetpulse standings widget

    HTML Structure:
    - .wff_standings_table_row - Row container
    - .wff_standings_position - Position cell
    - .wff_participant_name - Team name
    - .wff_standings_stats_box - Stats cells (M, V, O, F, +/-, P)
    - .wff_highlight_event_selected_row - Highlighted match team
    - .wff_standing_position_marker_strip.wff_championsleague/wff_uefacup/wff_relegation
    """
    position: int
    team: str
    played: int = Field(..., description="M - Matcher")
    won: int = Field(..., description="V - Vinster")
    drawn: int = Field(..., description="O - Oavgjorda")
    lost: int = Field(..., description="F - Förluster")
    goalDifference: int = Field(..., description="+/- Goal difference")
    points: int = Field(..., description="P - Poäng")
    isHighlighted: Optional[bool] = Field(None, description="True if match team (.wff_highlight_event_selected_row)")
    positionMarker: Optional[str] = Field(None, description="championsleague, uefacup, relegation, etc.")


class TableData(BaseModel):
    """Complete table data from Tabell tab (Enetpulse widget)

    HTML Structure:
    - #enetpulse-container - Widget container
    - .wff_standings_generic_root - Main widget
    - .wff_standings_tabs_container - Totalt/Hemma/Borta tabs
    - .wff_standing_type_tab.wff_selected_tab - Currently selected tab
    - .wff_standings_table_body - Table body with rows
    """
    entries: List[TableEntry] = Field(default_factory=list)
    standingType: Optional[Literal['total', 'home', 'away']] = Field('total', description="Selected tab: Totalt/Hemma/Borta")
    homeTeamPosition: Optional[int] = None
    awayTeamPosition: Optional[int] = None


# ============================================================================
# Statistics Schemas (league table - legacy)
# ============================================================================

class LeagueTableEntry(BaseModel):
    """Single team in the league table (legacy format)"""
    position: int
    team: str
    played: int
    won: int
    drawn: int
    lost: int
    goalsFor: int
    goalsAgainst: int
    goalDifference: int
    points: int


class TeamStatistics(BaseModel):
    """Match statistics for a team (from league table)"""
    name: str
    position: Optional[int] = Field(None, description="League position")
    points: Optional[int] = Field(None, description="Total points")
    played: Optional[int] = Field(None, description="Matches played")
    won: Optional[int] = Field(None, description="Matches won")
    drawn: Optional[int] = Field(None, description="Matches drawn")
    lost: Optional[int] = Field(None, description="Matches lost")
    goalsFor: Optional[int] = Field(None, description="Goals scored")
    goalsAgainst: Optional[int] = Field(None, description="Goals conceded")
    goalDifference: Optional[int] = Field(None, description="Goal difference")
    form: Optional[List[str]] = Field(None, description="Recent form: W/D/L sequence")


class StatisticsData(BaseModel):
    """Complete statistics for a match (from /stryktipset/statistik)"""
    homeTeam: TeamStatistics
    awayTeam: TeamStatistics
    leagueTable: Optional[List[LeagueTableEntry]] = Field(None, description="Full league table if available")


# ============================================================================
# Head-to-Head Schemas
# ============================================================================

class HeadToHeadMatch(BaseModel):
    """Single H2H match"""
    date: str
    homeTeam: str
    awayTeam: str
    score: str
    competition: Optional[str] = None


class HeadToHeadData(BaseModel):
    """Head-to-head history"""
    matches: List[HeadToHeadMatch]
    summary: Optional[Dict[str, int]] = Field(
        None,
        description="Summary: homeWins, draws, awayWins, totalMatches"
    )


# ============================================================================
# News Schemas
# ============================================================================

class NewsArticle(BaseModel):
    """News article from TT or Svenska Spel"""
    title: str
    content: Optional[str] = None
    date: Optional[str] = None
    source: Optional[str] = "Svenska Spel / TT"


class NewsData(BaseModel):
    """News articles and expert analyses for a match"""
    articles: List[NewsArticle] = Field(default_factory=list)
    expertAnalyses: Optional[List[ExpertAnalysis]] = Field(
        None,
        description="Expert analyses from the Spelanalys section (also in MatchInfoData)"
    )


# ============================================================================
# Lineup Schemas (Laguppställning - Enetpulse formation widget)
# ============================================================================

class LineupPlayer(BaseModel):
    """Player in the starting XI

    HTML Structure:
    - .wff_stats_ball_container_wrapper - Player container on pitch
    - .wff_grid_participant - Player name
    - .wff_participant_shirt_number - Jersey number
    - .wff_goalkeeper - Goalkeeper indicator class
    """
    name: str
    number: int
    position: Optional[str] = Field(None, description="goalkeeper, defender, midfielder, forward")


class UnavailablePlayer(BaseModel):
    """Unavailable player (injured, suspended)

    HTML Structure:
    - .wff_lineup_unavailable .wff_formation_lineup_type_participant
    - .icon-injured - Injury indicator
    """
    name: str
    number: int
    reason: Optional[Literal['injured', 'suspended', 'unknown']] = None


class TeamLineup(BaseModel):
    """Team lineup data

    HTML Structure:
    - .wff_team_tabs_container .wff_participant_name - Team name
    - .wff_lineup_confirmation_label - "Trolig laguppställning" or confirmed
    - .wff_team_formation span - Formation (e.g., "5-3-2")
    - .wff_lineup_coach - Coach section
    """
    teamName: str
    formation: Optional[str] = Field(None, description="e.g., '5-3-2', '4-3-3'")
    isConfirmed: bool = Field(False, description="False = 'Trolig laguppställning'")
    startingXI: List[LineupPlayer] = Field(default_factory=list)
    unavailable: List[UnavailablePlayer] = Field(default_factory=list)
    coach: Optional[str] = None


class LineupData(BaseModel):
    """Complete lineup data from Laguppställning tab (Enetpulse widget)

    HTML Structure:
    - #enetpulse-container - Widget container
    - .wff_formation_generic_root - Main formation widget
    - .wff_team_tabs_container - Team selector (home/away)
    - .wff_grid_wrapper - The pitch grid with player positions
    """
    homeTeam: TeamLineup
    awayTeam: TeamLineup
    selectedTeam: Optional[Literal['home', 'away']] = 'home'


# ============================================================================
# Draw Analysis Schemas (Analys/Speltips page)
# ============================================================================

class DrawAnalyst(BaseModel):
    """Expert/analyst information

    HTML Structure:
    - .draw-analysis-author-container
    - .draw-analysis-author img - Profile image
    - .draw-analysis-name - Expert name
    - .draw_analysis_author__presentation span - Description
    """
    name: str
    imageUrl: Optional[str] = None
    description: Optional[str] = None
    isOmbud: Optional[bool] = Field(None, description="True if betting shop (ombud)")


class MatchPrediction(BaseModel):
    """Single match prediction from an analyst

    HTML Structure:
    - .event-analyses - Match prediction item
    - .pg_analyse__event__title - Match number and teams
    - .pg_analyse__event__info__prediction__title - Analyst name
    - .pg_outcome--selected .pg_outcome__sign - Selected outcome
    """
    matchNumber: int
    matchTitle: str = Field(..., description="e.g., 'Leeds - Liverpool'")
    analystName: str
    prediction: Optional[Literal['1', 'X', '2', '1X', 'X2', '12', '1X2']] = None


class DrawAnalysisData(BaseModel):
    """Complete draw analysis from Analys/Speltips page

    HTML Structure:
    - .route-play-draw-analyses - Main container
    - .f-content h2 - Title (e.g., "Stryktipset 6/12")
    - .draw-analysis-author-container - Expert sections
    - .event-analyses - Match predictions list
    """
    title: Optional[str] = Field(None, description="e.g., 'Stryktipset 6/12'")
    introduction: Optional[str] = Field(None, description="Opening analysis text")
    analysts: List[DrawAnalyst] = Field(default_factory=list)
    predictions: List[MatchPrediction] = Field(default_factory=list)
    analysisContent: Optional[str] = Field(None, description="Full analysis (Spikarna, Skrällen, etc.)")


# ============================================================================
# Oddset Schemas (Quick Bets / Live Odds)
# ============================================================================

class BetOutcome(BaseModel):
    """Single betting outcome

    HTML Structure:
    - .outcome-btn - Individual bet button
    - .btn-link-text - Contains "Label\\nOdds" (e.g., "1\\n4,20")
    """
    label: str = Field(..., description="Outcome label (e.g., '1', 'X', '2', 'Över 2.5', 'Ja')")
    odds: float = Field(..., description="Decimal odds (e.g., 4.20)")


class BetMarket(BaseModel):
    """Betting market section

    HTML Structure:
    - .quick-bet-section - Market section container
    - .quick-bet-section__header - Market name
    - .quick-bet-section-offer - Row with outcome buttons
    """
    name: str = Field(..., description="Market name (e.g., 'Fulltid', 'Totala mål', 'Halvtid', 'Båda lagen gör mål')")
    outcomes: List[BetOutcome] = Field(default_factory=list)


class OddsetData(BaseModel):
    """Complete Oddset data from quick bets section

    HTML Structure:
    - .quick-bets - Main container
    - .quick-bet-section - Each betting market
    - .quick-bet-section__header - Market name (e.g., "Fulltid", "Totala mål")
    - .outcome-btn .btn-link-text - "Label\\nOdds" format
    """
    markets: List[BetMarket] = Field(default_factory=list)
    matchTitle: Optional[str] = Field(None, description="Match title if available")

