/* eslint-disable @typescript-eslint/no-explicit-any -- Test file with mock data */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the console methods to avoid noisy output
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

// Create a testable version of PredictionService to test private methods
class TestablePredictionService {
  /**
   * Prepare context for Claude - main logic to test
   */
  prepareMatchContext(
    match: any,
    similarMatches: any[],
    teamMatchups: any[],
    userContext?: string
  ): string {
    const parts: string[] = []

    // User-provided context (placed first for emphasis)
    if (userContext && userContext.trim()) {
      parts.push('USER-PROVIDED CONTEXT')
      parts.push('=====================')
      parts.push('The user has provided the following additional context for this match:')
      parts.push('')
      parts.push(userContext.trim())
      parts.push('')
      parts.push('IMPORTANT: Consider this user-provided information carefully in your analysis.')
      parts.push('If it significantly impacts your prediction (e.g., key player injuries,')
      parts.push('tactical changes, recent news), adjust your probabilities accordingly.')
      parts.push('')
      parts.push('')
    }

    // Data interpretation guide
    parts.push('DATA INTERPRETATION GUIDE')
    parts.push('=========================')
    parts.push(
      '- ODDS: Lower odds = higher probability (e.g., 1.50 = ~67%, 5.00 = ~20%). Formula: probability = 1/odds'
    )
    parts.push(
      '- TIO TIDNINGARS TIPS: Count out of 10 newspaper experts picking each outcome (not percentages). If 8/10 pick "1", that outcome is strongly favored by experts.'
    )
    parts.push('- SVENSKA FOLKET: Percentages showing current public betting distribution')
    parts.push(
      '- HOME TEAM is always listed first (1 = home win, X = draw, 2 = away win). Lower home odds = home team favored'
    )
    parts.push(
      '- DATA QUALITY: If odds and expert consensus strongly conflict (e.g., odds suggest 1% chance but 10/10 experts pick that outcome), treat the expert consensus as more reliable - odds data may be corrupted or from a different source.'
    )
    parts.push('')

    // Match information
    parts.push('MATCH INFORMATION')
    parts.push('=================')
    parts.push(`Home Team: ${match.homeTeam.name}`)
    parts.push(`Away Team: ${match.awayTeam.name}`)
    parts.push(`League: ${match.league.name || 'Unknown'}`)
    parts.push(`Country: ${match.league.country?.name || 'Unknown'}`)
    parts.push(`Match Date: ${new Date(match.start_time).toISOString().split('T')[0]}`)
    parts.push('')

    // Odds information
    if (match.match_odds && match.match_odds.length > 0) {
      const odds = match.match_odds[0]
      parts.push('ODDS & MARKET SENTIMENT')
      parts.push('======================')
      parts.push(`Home Win (1): ${odds.home_odds} (${odds.home_probability}%)`)
      parts.push(`Draw (X): ${odds.draw_odds} (${odds.draw_probability}%)`)
      parts.push(`Away Win (2): ${odds.away_odds} (${odds.away_probability}%)`)

      if (odds.svenska_folket_home) {
        parts.push('')
        parts.push('Svenska Folket (Public Betting):')
        parts.push(`  1: ${odds.svenska_folket_home}%`)
        parts.push(`  X: ${odds.svenska_folket_draw}%`)
        parts.push(`  2: ${odds.svenska_folket_away}%`)
      }

      if (odds.tio_tidningars_tips_home) {
        parts.push('')
        parts.push('Tio Tidningars Tips (Expert Consensus):')
        parts.push(`  1: ${odds.tio_tidningars_tips_home}/10 experts`)
        parts.push(`  X: ${odds.tio_tidningars_tips_draw}/10 experts`)
        parts.push(`  2: ${odds.tio_tidningars_tips_away}/10 experts`)
      }
      parts.push('')
    }

    // xStats
    const xStatsData = match.match_scraped_data?.find((d: any) => d.data_type === 'xStats')
    if (xStatsData?.data) {
      parts.push('EXPECTED STATISTICS (xStats)')
      parts.push('============================')
      const xStats = xStatsData.data

      if (xStats.homeTeam?.entireSeason) {
        parts.push(`${match.homeTeam.name} (Home):`)
        parts.push(`  xG: ${xStats.homeTeam.entireSeason.xg || 'N/A'}`)
        parts.push(`  xGA: ${xStats.homeTeam.entireSeason.xga || 'N/A'}`)
        parts.push(`  xGD: ${xStats.homeTeam.entireSeason.xgd || 'N/A'}`)
        parts.push(`  xP: ${xStats.homeTeam.entireSeason.xp || 'N/A'}`)
      }

      if (xStats.awayTeam?.entireSeason) {
        parts.push(`${match.awayTeam.name} (Away):`)
        parts.push(`  xG: ${xStats.awayTeam.entireSeason.xg || 'N/A'}`)
        parts.push(`  xGA: ${xStats.awayTeam.entireSeason.xga || 'N/A'}`)
        parts.push(`  xGD: ${xStats.awayTeam.entireSeason.xgd || 'N/A'}`)
        parts.push(`  xP: ${xStats.awayTeam.entireSeason.xp || 'N/A'}`)
      }

      // Extended xStats: Average goals (if available)
      if (xStats.goalStats?.home) {
        parts.push('')
        parts.push('Goal Statistics:')
        parts.push(
          `  ${match.homeTeam.name}: Avg scored ${xStats.goalStats.home.avgGoalsScored || 'N/A'}, Avg conceded ${xStats.goalStats.home.avgGoalsConceded || 'N/A'}`
        )
        parts.push(
          `  ${match.awayTeam.name}: Avg scored ${xStats.goalStats.away?.avgGoalsScored || 'N/A'}, Avg conceded ${xStats.goalStats.away?.avgGoalsConceded || 'N/A'}`
        )
      }

      // Last 5 games xStats for recent form context
      if (xStats.homeTeam?.last5Games || xStats.awayTeam?.last5Games) {
        parts.push('')
        parts.push('Recent Form (Last 5 Games):')
        if (xStats.homeTeam?.last5Games) {
          parts.push(
            `  ${match.homeTeam.name}: xG ${xStats.homeTeam.last5Games.xg || 'N/A'}, xGA ${xStats.homeTeam.last5Games.xga || 'N/A'}`
          )
        }
        if (xStats.awayTeam?.last5Games) {
          parts.push(
            `  ${match.awayTeam.name}: xG ${xStats.awayTeam.last5Games.xg || 'N/A'}, xGA ${xStats.awayTeam.last5Games.xga || 'N/A'}`
          )
        }
      }
      parts.push('')
    }

    // Team statistics
    const statsData = match.match_scraped_data?.find((d: any) => d.data_type === 'statistics')
    if (statsData?.data) {
      parts.push('TEAM STATISTICS')
      parts.push('===============')
      const stats = statsData.data

      if (stats.homeTeam) {
        parts.push(`${match.homeTeam.name}:`)
        parts.push(`  Position: ${stats.homeTeam.position || 'N/A'}`)
        parts.push(`  Points: ${stats.homeTeam.points || 'N/A'}`)
        parts.push(`  Form: ${stats.homeTeam.form?.join('') || 'N/A'}`)
        parts.push(`  Played: ${stats.homeTeam.played || 'N/A'}`)
        parts.push(
          `  W-D-L: ${stats.homeTeam.won || 0}-${stats.homeTeam.drawn || 0}-${stats.homeTeam.lost || 0}`
        )
        if (stats.homeTeam.goalsFor !== undefined || stats.homeTeam.goalsAgainst !== undefined) {
          parts.push(
            `  Goals: ${stats.homeTeam.goalsFor ?? 'N/A'} scored, ${stats.homeTeam.goalsAgainst ?? 'N/A'} conceded`
          )
        }
      }

      if (stats.awayTeam) {
        parts.push(`${match.awayTeam.name}:`)
        parts.push(`  Position: ${stats.awayTeam.position || 'N/A'}`)
        parts.push(`  Points: ${stats.awayTeam.points || 'N/A'}`)
        parts.push(`  Form: ${stats.awayTeam.form?.join('') || 'N/A'}`)
        parts.push(`  Played: ${stats.awayTeam.played || 'N/A'}`)
        parts.push(
          `  W-D-L: ${stats.awayTeam.won || 0}-${stats.awayTeam.drawn || 0}-${stats.awayTeam.lost || 0}`
        )
        if (stats.awayTeam.goalsFor !== undefined || stats.awayTeam.goalsAgainst !== undefined) {
          parts.push(
            `  Goals: ${stats.awayTeam.goalsFor ?? 'N/A'} scored, ${stats.awayTeam.goalsAgainst ?? 'N/A'} conceded`
          )
        }
      }
      parts.push('')
    }

    // Head-to-head matchups
    if (teamMatchups.length > 0) {
      parts.push('HEAD-TO-HEAD HISTORY')
      parts.push('====================')
      for (const matchup of teamMatchups) {
        const result =
          matchup.result_home !== null
            ? `${matchup.result_home}-${matchup.result_away}`
            : 'Not played'
        const outcome = matchup.outcome || 'N/A'
        parts.push(
          `${matchup.draw_date?.toISOString().split('T')[0] || 'Unknown'}: ${matchup.home_team} vs ${matchup.away_team} - ${result} (${outcome})`
        )
      }
      parts.push('')
    }

    // Similar matches
    if (similarMatches.length > 0) {
      parts.push('SIMILAR HISTORICAL MATCHES')
      parts.push('=========================')
      for (const similar of similarMatches.slice(0, 5)) {
        const result =
          similar.result_home !== null
            ? `${similar.result_home}-${similar.result_away}`
            : 'Not played'
        const similarity = Math.round((similar.similarity || 0) * 100)
        parts.push(
          `[${similarity}% similar] ${similar.home_team} vs ${similar.away_team} - ${result} (${similar.outcome || 'N/A'})`
        )
      }
      parts.push('')
    }

    return parts.join('\n')
  }

  /**
   * Get predicted outcome from probabilities
   */
  getPredictedOutcome(probabilities: { home_win: number; draw: number; away_win: number }): string {
    const max = Math.max(probabilities.home_win, probabilities.draw, probabilities.away_win)

    if (probabilities.home_win === max) return '1'
    if (probabilities.draw === max) return 'X'
    return '2'
  }

  /**
   * Determine if a match is suitable as a spik (spike bet)
   */
  isSpikSuitable(
    probabilities: { home_win: number; draw: number; away_win: number },
    confidence: string
  ): boolean {
    const max = Math.max(probabilities.home_win, probabilities.draw, probabilities.away_win)
    return max > 0.6 && confidence === 'high'
  }

  /**
   * Calculate expected value for a bet
   */
  calculateExpectedValue(probability: number, crowdProbability: number): number {
    // EV = (our probability * potential return) - (crowd probability)
    // Simplified: If we're more confident than the crowd, it's positive EV
    return probability - crowdProbability
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

const createMinimalMatch = (overrides: Partial<any> = {}): any => ({
  id: 1,
  homeTeam: { name: 'IFK Göteborg' },
  awayTeam: { name: 'AIK' },
  league: { name: 'Allsvenskan', country: { name: 'Sweden' } },
  start_time: new Date('2024-11-02T14:00:00Z'),
  match_odds: [],
  match_scraped_data: [],
  ...overrides,
})

const createMatchWithOdds = (overrides: Partial<any> = {}): any => ({
  ...createMinimalMatch(),
  match_odds: [
    {
      home_odds: 2.5,
      draw_odds: 3.2,
      away_odds: 2.8,
      home_probability: 40,
      draw_probability: 31,
      away_probability: 36,
      svenska_folket_home: 42,
      svenska_folket_draw: 28,
      svenska_folket_away: 30,
      tio_tidningars_tips_home: 5,
      tio_tidningars_tips_draw: 2,
      tio_tidningars_tips_away: 3,
    },
  ],
  ...overrides,
})

const createMatchWithXStats = (): any => ({
  ...createMatchWithOdds(),
  match_scraped_data: [
    {
      data_type: 'xStats',
      data: {
        homeTeam: {
          entireSeason: { xg: 1.8, xga: 1.2, xgd: 0.6, xp: 45 },
          last5Games: { xg: 2.1, xga: 0.9 },
        },
        awayTeam: {
          entireSeason: { xg: 1.5, xga: 1.4, xgd: 0.1, xp: 38 },
          last5Games: { xg: 1.3, xga: 1.5 },
        },
        goalStats: {
          home: { avgGoalsScored: 1.7, avgGoalsConceded: 1.1 },
          away: { avgGoalsScored: 1.4, avgGoalsConceded: 1.3 },
        },
      },
    },
  ],
})

const createMatchWithStatistics = (): any => ({
  ...createMatchWithOdds(),
  match_scraped_data: [
    {
      data_type: 'statistics',
      data: {
        homeTeam: {
          position: 3,
          points: 45,
          form: ['W', 'W', 'D', 'L', 'W'],
          played: 20,
          won: 12,
          drawn: 9,
          lost: 5,
          goalsFor: 38,
          goalsAgainst: 22,
        },
        awayTeam: {
          position: 7,
          points: 32,
          form: ['L', 'D', 'W', 'W', 'L'],
          played: 20,
          won: 8,
          drawn: 8,
          lost: 4,
          goalsFor: 28,
          goalsAgainst: 25,
        },
      },
    },
  ],
})

const createSimilarMatch = (overrides: Partial<any> = {}): any => ({
  home_team: 'Team A',
  away_team: 'Team B',
  result_home: 2,
  result_away: 1,
  outcome: '1',
  similarity: 0.85,
  ...overrides,
})

const createTeamMatchup = (overrides: Partial<any> = {}): any => ({
  home_team: 'IFK Göteborg',
  away_team: 'AIK',
  result_home: 1,
  result_away: 0,
  outcome: '1',
  draw_date: new Date('2024-05-15'),
  ...overrides,
})

// ============================================================================
// PredictionService Tests
// ============================================================================

describe('PredictionService', () => {
  let service: TestablePredictionService

  beforeEach(() => {
    service = new TestablePredictionService()
  })

  // ============================================================================
  // prepareMatchContext Tests
  // ============================================================================

  describe('prepareMatchContext', () => {
    describe('basic structure', () => {
      it('includes data interpretation guide', () => {
        const match = createMinimalMatch()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).toContain('DATA INTERPRETATION GUIDE')
        expect(context).toContain('ODDS: Lower odds = higher probability')
        expect(context).toContain('TIO TIDNINGARS TIPS')
        expect(context).toContain('SVENSKA FOLKET')
      })

      it('includes match information section', () => {
        const match = createMinimalMatch()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).toContain('MATCH INFORMATION')
        expect(context).toContain('Home Team: IFK Göteborg')
        expect(context).toContain('Away Team: AIK')
        expect(context).toContain('League: Allsvenskan')
        expect(context).toContain('Country: Sweden')
      })

      it('formats match date correctly', () => {
        const match = createMinimalMatch({
          start_time: new Date('2024-11-02T14:00:00Z'),
        })
        const context = service.prepareMatchContext(match, [], [])

        expect(context).toContain('Match Date: 2024-11-02')
      })

      it('handles unknown league and country', () => {
        const match = createMinimalMatch({
          league: { name: null, country: null },
        })
        const context = service.prepareMatchContext(match, [], [])

        expect(context).toContain('League: Unknown')
        expect(context).toContain('Country: Unknown')
      })
    })

    describe('user context', () => {
      it('includes user context when provided', () => {
        const match = createMinimalMatch()
        const userContext = 'Key player Zlatan is injured and will miss the match'
        const context = service.prepareMatchContext(match, [], [], userContext)

        expect(context).toContain('USER-PROVIDED CONTEXT')
        expect(context).toContain('Zlatan is injured')
        expect(context).toContain('IMPORTANT: Consider this user-provided information carefully')
      })

      it('places user context at the beginning', () => {
        const match = createMinimalMatch()
        const userContext = 'Manager has been sacked'
        const context = service.prepareMatchContext(match, [], [], userContext)

        // User context should appear before data interpretation guide
        const userContextIndex = context.indexOf('USER-PROVIDED CONTEXT')
        const dataGuideIndex = context.indexOf('DATA INTERPRETATION GUIDE')
        expect(userContextIndex).toBeLessThan(dataGuideIndex)
      })

      it('trims whitespace from user context', () => {
        const match = createMinimalMatch()
        const userContext = '   Important info   '
        const context = service.prepareMatchContext(match, [], [], userContext)

        expect(context).toContain('Important info')
        expect(context).not.toContain('   Important info   ')
      })

      it('ignores empty user context', () => {
        const match = createMinimalMatch()
        const context = service.prepareMatchContext(match, [], [], '   ')

        expect(context).not.toContain('USER-PROVIDED CONTEXT')
      })

      it('ignores undefined user context', () => {
        const match = createMinimalMatch()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).not.toContain('USER-PROVIDED CONTEXT')
      })
    })

    describe('odds information', () => {
      it('includes odds and market sentiment', () => {
        const match = createMatchWithOdds()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).toContain('ODDS & MARKET SENTIMENT')
        expect(context).toContain('Home Win (1): 2.5 (40%)')
        expect(context).toContain('Draw (X): 3.2 (31%)')
        expect(context).toContain('Away Win (2): 2.8 (36%)')
      })

      it('includes Svenska Folket data', () => {
        const match = createMatchWithOdds()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).toContain('Svenska Folket (Public Betting):')
        expect(context).toContain('1: 42%')
        expect(context).toContain('X: 28%')
        expect(context).toContain('2: 30%')
      })

      it('includes Tio Tidningars Tips', () => {
        const match = createMatchWithOdds()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).toContain('Tio Tidningars Tips (Expert Consensus):')
        expect(context).toContain('1: 5/10 experts')
        expect(context).toContain('X: 2/10 experts')
        expect(context).toContain('2: 3/10 experts')
      })

      it('handles missing odds data', () => {
        const match = createMinimalMatch()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).not.toContain('ODDS & MARKET SENTIMENT')
      })

      it('handles missing Svenska Folket data', () => {
        const match = createMatchWithOdds({
          match_odds: [
            {
              home_odds: 2.5,
              draw_odds: 3.2,
              away_odds: 2.8,
              home_probability: 40,
              draw_probability: 31,
              away_probability: 36,
              // No svenska_folket data
            },
          ],
        })
        const context = service.prepareMatchContext(match, [], [])

        expect(context).not.toContain('Svenska Folket')
      })
    })

    describe('xStats information', () => {
      it('includes xStats data', () => {
        const match = createMatchWithXStats()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).toContain('EXPECTED STATISTICS (xStats)')
        expect(context).toContain('IFK Göteborg (Home):')
        expect(context).toContain('xG: 1.8')
        expect(context).toContain('xGA: 1.2')
        expect(context).toContain('xGD: 0.6')
        expect(context).toContain('xP: 45')
      })

      it('includes goal statistics', () => {
        const match = createMatchWithXStats()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).toContain('Goal Statistics:')
        expect(context).toContain('Avg scored 1.7')
        expect(context).toContain('Avg conceded 1.1')
      })

      it('includes recent form (last 5 games)', () => {
        const match = createMatchWithXStats()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).toContain('Recent Form (Last 5 Games):')
        expect(context).toContain('xG 2.1')
        expect(context).toContain('xGA 0.9')
      })

      it('handles missing xStats data', () => {
        const match = createMinimalMatch()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).not.toContain('EXPECTED STATISTICS')
      })
    })

    describe('team statistics', () => {
      it('includes team statistics', () => {
        const match = createMatchWithStatistics()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).toContain('TEAM STATISTICS')
        expect(context).toContain('Position: 3')
        expect(context).toContain('Points: 45')
        expect(context).toContain('Form: WWDLW')
        expect(context).toContain('Played: 20')
        expect(context).toContain('W-D-L: 12-9-5')
        expect(context).toContain('Goals: 38 scored, 22 conceded')
      })

      it('handles missing team statistics', () => {
        const match = createMinimalMatch()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).not.toContain('TEAM STATISTICS')
      })
    })

    describe('head-to-head matchups', () => {
      it('includes head-to-head history', () => {
        const match = createMinimalMatch()
        const matchups = [
          createTeamMatchup({ result_home: 2, result_away: 1, outcome: '1' }),
          createTeamMatchup({
            result_home: 0,
            result_away: 0,
            outcome: 'X',
            draw_date: new Date('2024-03-10'),
          }),
        ]
        const context = service.prepareMatchContext(match, [], matchups)

        expect(context).toContain('HEAD-TO-HEAD HISTORY')
        expect(context).toContain('IFK Göteborg vs AIK')
        expect(context).toContain('2-1 (1)')
        expect(context).toContain('0-0 (X)')
      })

      it('handles matches without results', () => {
        const match = createMinimalMatch()
        const matchups = [createTeamMatchup({ result_home: null, result_away: null })]
        const context = service.prepareMatchContext(match, [], matchups)

        expect(context).toContain('Not played')
      })

      it('excludes section when no matchups', () => {
        const match = createMinimalMatch()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).not.toContain('HEAD-TO-HEAD HISTORY')
      })
    })

    describe('similar historical matches', () => {
      it('includes similar matches', () => {
        const match = createMinimalMatch()
        const similar = [
          createSimilarMatch({ similarity: 0.92 }),
          createSimilarMatch({ similarity: 0.85, home_team: 'Team C', away_team: 'Team D' }),
        ]
        const context = service.prepareMatchContext(match, similar, [])

        expect(context).toContain('SIMILAR HISTORICAL MATCHES')
        expect(context).toContain('[92% similar]')
        expect(context).toContain('[85% similar]')
        expect(context).toContain('Team A vs Team B')
        expect(context).toContain('Team C vs Team D')
      })

      it('limits to 5 similar matches', () => {
        const match = createMinimalMatch()
        const similar = Array.from({ length: 10 }, (_, i) =>
          createSimilarMatch({ similarity: 0.9 - i * 0.01, home_team: `Team ${i}` })
        )
        const context = service.prepareMatchContext(match, similar, [])

        // Should only show first 5
        expect(context).toContain('Team 0')
        expect(context).toContain('Team 4')
        expect(context).not.toContain('Team 5')
      })

      it('handles matches without results', () => {
        const match = createMinimalMatch()
        const similar = [createSimilarMatch({ result_home: null, result_away: null })]
        const context = service.prepareMatchContext(match, similar, [])

        expect(context).toContain('Not played')
      })

      it('excludes section when no similar matches', () => {
        const match = createMinimalMatch()
        const context = service.prepareMatchContext(match, [], [])

        expect(context).not.toContain('SIMILAR HISTORICAL MATCHES')
      })
    })
  })

  // ============================================================================
  // getPredictedOutcome Tests
  // ============================================================================

  describe('getPredictedOutcome', () => {
    it('returns "1" when home_win is highest', () => {
      const probabilities = { home_win: 0.5, draw: 0.3, away_win: 0.2 }
      expect(service.getPredictedOutcome(probabilities)).toBe('1')
    })

    it('returns "X" when draw is highest', () => {
      const probabilities = { home_win: 0.25, draw: 0.5, away_win: 0.25 }
      expect(service.getPredictedOutcome(probabilities)).toBe('X')
    })

    it('returns "2" when away_win is highest', () => {
      const probabilities = { home_win: 0.2, draw: 0.3, away_win: 0.5 }
      expect(service.getPredictedOutcome(probabilities)).toBe('2')
    })

    it('returns "1" when home_win ties with draw', () => {
      const probabilities = { home_win: 0.4, draw: 0.4, away_win: 0.2 }
      expect(service.getPredictedOutcome(probabilities)).toBe('1')
    })

    it('returns "1" when all probabilities are equal', () => {
      const probabilities = { home_win: 0.33, draw: 0.33, away_win: 0.33 }
      expect(service.getPredictedOutcome(probabilities)).toBe('1')
    })

    it('handles very small probability differences', () => {
      const probabilities = { home_win: 0.333, draw: 0.334, away_win: 0.333 }
      expect(service.getPredictedOutcome(probabilities)).toBe('X')
    })

    it('handles edge case with all zeros', () => {
      const probabilities = { home_win: 0, draw: 0, away_win: 0 }
      // When all are 0, home_win === max (0), so returns '1'
      expect(service.getPredictedOutcome(probabilities)).toBe('1')
    })
  })

  // ============================================================================
  // isSpikSuitable Tests
  // ============================================================================

  describe('isSpikSuitable', () => {
    it('returns true when probability > 60% and confidence is high', () => {
      const probabilities = { home_win: 0.65, draw: 0.2, away_win: 0.15 }
      expect(service.isSpikSuitable(probabilities, 'high')).toBe(true)
    })

    it('returns false when probability > 60% but confidence is medium', () => {
      const probabilities = { home_win: 0.65, draw: 0.2, away_win: 0.15 }
      expect(service.isSpikSuitable(probabilities, 'medium')).toBe(false)
    })

    it('returns false when probability > 60% but confidence is low', () => {
      const probabilities = { home_win: 0.65, draw: 0.2, away_win: 0.15 }
      expect(service.isSpikSuitable(probabilities, 'low')).toBe(false)
    })

    it('returns false when confidence is high but probability < 60%', () => {
      const probabilities = { home_win: 0.55, draw: 0.25, away_win: 0.2 }
      expect(service.isSpikSuitable(probabilities, 'high')).toBe(false)
    })

    it('returns false when probability is exactly 60%', () => {
      const probabilities = { home_win: 0.6, draw: 0.25, away_win: 0.15 }
      expect(service.isSpikSuitable(probabilities, 'high')).toBe(false)
    })

    it('returns true when draw probability > 60%', () => {
      const probabilities = { home_win: 0.15, draw: 0.65, away_win: 0.2 }
      expect(service.isSpikSuitable(probabilities, 'high')).toBe(true)
    })

    it('returns true when away probability > 60%', () => {
      const probabilities = { home_win: 0.15, draw: 0.2, away_win: 0.65 }
      expect(service.isSpikSuitable(probabilities, 'high')).toBe(true)
    })
  })

  // ============================================================================
  // calculateExpectedValue Tests
  // ============================================================================

  describe('calculateExpectedValue', () => {
    it('returns positive EV when our probability > crowd', () => {
      const ev = service.calculateExpectedValue(0.5, 0.4)
      expect(ev).toBeGreaterThan(0)
      expect(ev).toBeCloseTo(0.1)
    })

    it('returns negative EV when our probability < crowd', () => {
      const ev = service.calculateExpectedValue(0.3, 0.4)
      expect(ev).toBeLessThan(0)
      expect(ev).toBeCloseTo(-0.1)
    })

    it('returns zero EV when probabilities match', () => {
      const ev = service.calculateExpectedValue(0.33, 0.33)
      expect(ev).toBe(0)
    })

    it('handles edge case with 100% probability', () => {
      const ev = service.calculateExpectedValue(1.0, 0.5)
      expect(ev).toBeCloseTo(0.5)
    })

    it('handles edge case with 0% crowd probability', () => {
      const ev = service.calculateExpectedValue(0.5, 0)
      expect(ev).toBeCloseTo(0.5)
    })
  })

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration', () => {
    it('generates complete context with all data types', () => {
      const match = {
        ...createMinimalMatch(),
        match_odds: [
          {
            home_odds: 2.1,
            draw_odds: 3.4,
            away_odds: 3.3,
            home_probability: 48,
            draw_probability: 29,
            away_probability: 30,
            svenska_folket_home: 50,
            svenska_folket_draw: 25,
            svenska_folket_away: 25,
            tio_tidningars_tips_home: 6,
            tio_tidningars_tips_draw: 2,
            tio_tidningars_tips_away: 2,
          },
        ],
        match_scraped_data: [
          {
            data_type: 'xStats',
            data: {
              homeTeam: { entireSeason: { xg: 2.0, xga: 1.0, xgd: 1.0, xp: 50 } },
              awayTeam: { entireSeason: { xg: 1.2, xga: 1.5, xgd: -0.3, xp: 35 } },
            },
          },
          {
            data_type: 'statistics',
            data: {
              homeTeam: {
                position: 1,
                points: 50,
                form: ['W', 'W', 'W', 'W', 'W'],
                played: 22,
                won: 15,
                drawn: 5,
                lost: 2,
              },
              awayTeam: {
                position: 10,
                points: 28,
                form: ['L', 'L', 'D', 'W', 'L'],
                played: 22,
                won: 7,
                drawn: 7,
                lost: 8,
              },
            },
          },
        ],
      }

      const similarMatches = [
        createSimilarMatch({ similarity: 0.88 }),
        createSimilarMatch({ similarity: 0.82, result_home: 3, result_away: 0 }),
      ]

      const teamMatchups = [createTeamMatchup({ result_home: 2, result_away: 0 })]

      const userContext = 'Star striker is back from injury'

      const context = service.prepareMatchContext(match, similarMatches, teamMatchups, userContext)

      // Verify all sections are present
      expect(context).toContain('USER-PROVIDED CONTEXT')
      expect(context).toContain('DATA INTERPRETATION GUIDE')
      expect(context).toContain('MATCH INFORMATION')
      expect(context).toContain('ODDS & MARKET SENTIMENT')
      expect(context).toContain('EXPECTED STATISTICS')
      expect(context).toContain('TEAM STATISTICS')
      expect(context).toContain('HEAD-TO-HEAD HISTORY')
      expect(context).toContain('SIMILAR HISTORICAL MATCHES')

      // Verify ordering
      const userIndex = context.indexOf('USER-PROVIDED CONTEXT')
      const guideIndex = context.indexOf('DATA INTERPRETATION GUIDE')
      const matchIndex = context.indexOf('MATCH INFORMATION')
      const oddsIndex = context.indexOf('ODDS & MARKET SENTIMENT')

      expect(userIndex).toBeLessThan(guideIndex)
      expect(guideIndex).toBeLessThan(matchIndex)
      expect(matchIndex).toBeLessThan(oddsIndex)
    })

    it('handles minimal match data gracefully', () => {
      const match = createMinimalMatch()
      const context = service.prepareMatchContext(match, [], [])

      // Should still have required sections
      expect(context).toContain('DATA INTERPRETATION GUIDE')
      expect(context).toContain('MATCH INFORMATION')

      // Should not have optional sections
      expect(context).not.toContain('ODDS & MARKET SENTIMENT')
      expect(context).not.toContain('EXPECTED STATISTICS')
      expect(context).not.toContain('TEAM STATISTICS')
      expect(context).not.toContain('HEAD-TO-HEAD HISTORY')
      expect(context).not.toContain('SIMILAR HISTORICAL MATCHES')
    })
  })
})
