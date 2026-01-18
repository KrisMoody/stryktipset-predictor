import { describe, it, expect } from 'vitest'

/**
 * Integration tests for statistical calculations pipeline
 * Tests the full flow of calculations without database mocking
 * by using only the pure calculation functions
 */

import {
  calculateExpected,
  getActualScore,
  getConfidence,
} from '../../../server/services/statistical-calculations/elo-rating'

import {
  poissonProbability,
  calculateProbabilitiesFromLambda,
} from '../../../server/services/statistical-calculations/dixon-coles'

import {
  calculateFairProbabilities,
  calculateExpectedValues,
} from '../../../server/services/statistical-calculations/value-calculator'

import {
  calculateEMAForm,
  calculateFormMetrics,
  type RecentMatch,
} from '../../../server/services/statistical-calculations/form-calculator'

import { DEFAULT_CONFIG } from '../../../server/services/statistical-calculations/types'

// ============================================================================
// Integration Tests - Full Calculation Pipeline
// ============================================================================

describe('Statistical Calculations Integration', () => {
  describe('Full Calculation Pipeline', () => {
    it('calculates match statistics with all data available', () => {
      // Simulate the full pipeline without database
      const homeRating = 1600 // Strong team
      const awayRating = 1450 // Weaker team
      const homeAttack = 1.2
      const homeDefense = 0.9
      const awayAttack = 1.0
      const awayDefense = 1.1

      // Step 1: Calculate expected score (Elo)
      const homeExpected = calculateExpected(homeRating, awayRating)
      expect(homeExpected).toBeGreaterThan(0.6) // Home team favored

      // Step 2: Calculate expected goals (Dixon-Coles)
      const homeAdvantage = DEFAULT_CONFIG.homeAdvantage
      const lambdaHome = homeAttack * (1 / awayDefense) * homeAdvantage
      const lambdaAway = awayAttack * (1 / homeDefense)

      expect(lambdaHome).toBeGreaterThan(lambdaAway) // Home should score more

      // Step 3: Calculate outcome probabilities
      const probs = calculateProbabilitiesFromLambda(lambdaHome, lambdaAway)
      expect(probs.homeWinProb + probs.drawProb + probs.awayWinProb).toBeCloseTo(1, 3)
      expect(probs.homeWinProb).toBeGreaterThan(probs.awayWinProb) // Home favored

      // Step 4: Calculate fair probabilities from odds
      const odds = { homeOdds: 1.8, drawOdds: 3.5, awayOdds: 4.5 }
      const fairProbs = calculateFairProbabilities(odds)
      expect(
        fairProbs.homeProbability + fairProbs.drawProbability + fairProbs.awayProbability
      ).toBeCloseTo(1, 5)
      expect(fairProbs.margin).toBeGreaterThan(0) // Bookmaker has margin

      // Step 5: Calculate Expected Values
      const modelProbs = {
        homeProb: probs.homeWinProb,
        drawProb: probs.drawProb,
        awayProb: probs.awayWinProb,
      }
      const evs = calculateExpectedValues(modelProbs, odds, DEFAULT_CONFIG)

      // Verify EV calculation: EV = prob * odds - 1
      expect(evs.evHome).toBeCloseTo(modelProbs.homeProb * odds.homeOdds - 1, 3)
      expect(evs.evDraw).toBeCloseTo(modelProbs.drawProb * odds.drawOdds - 1, 3)
      expect(evs.evAway).toBeCloseTo(modelProbs.awayProb * odds.awayOdds - 1, 3)
    })

    it('handles partial data gracefully', () => {
      // Only have Elo ratings, no attack/defense
      const homeRating = 1550
      const awayRating = 1480

      // Can still calculate expected score
      const homeExpected = calculateExpected(homeRating, awayRating)
      expect(homeExpected).toBeGreaterThan(0.5)
      expect(homeExpected).toBeLessThan(0.7)

      // Use default attack/defense (1.0)
      const lambdaHome = 1.0 * DEFAULT_CONFIG.homeAdvantage
      const lambdaAway = 1.0

      const probs = calculateProbabilitiesFromLambda(lambdaHome, lambdaAway)
      expect(probs.homeWinProb).toBeGreaterThan(probs.awayWinProb) // Home advantage shows
    })

    it('identifies value betting opportunities', () => {
      // Model thinks home win is 55%, market offers 2.20 (45% implied)
      const modelProbs = { homeProb: 0.55, drawProb: 0.25, awayProb: 0.2 }
      const odds = { homeOdds: 2.2, drawOdds: 3.5, awayOdds: 4.0 }

      const evs = calculateExpectedValues(modelProbs, odds, {
        ...DEFAULT_CONFIG,
        evThreshold: 0.03,
      })

      // Home EV = 0.55 * 2.20 - 1 = 0.21 = 21% edge
      expect(evs.evHome).toBeCloseTo(0.21, 2)
      expect(evs.bestValueOutcome).toBe('1') // Home is value
    })

    it('detects no value when market is efficient', () => {
      // Model and market roughly agree
      const modelProbs = { homeProb: 0.5, drawProb: 0.25, awayProb: 0.25 }
      const odds = { homeOdds: 2.0, drawOdds: 4.0, awayOdds: 4.0 }

      const evs = calculateExpectedValues(modelProbs, odds, {
        ...DEFAULT_CONFIG,
        evThreshold: 0.05,
      })

      // All EVs near zero
      expect(Math.abs(evs.evHome)).toBeLessThan(0.02)
      expect(evs.bestValueOutcome).toBeNull() // No value above threshold
    })
  })

  describe('Form Calculation Pipeline', () => {
    it('calculates form metrics from match history', () => {
      const recentMatches: RecentMatch[] = [
        {
          teamId: 1,
          opponentId: 2,
          matchDate: new Date('2024-12-10'),
          outcome: 'W',
          goalsFor: 3,
          goalsAgainst: 1,
          xgFor: null,
          xgAgainst: null,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 3,
          matchDate: new Date('2024-12-07'),
          outcome: 'W',
          goalsFor: 2,
          goalsAgainst: 0,
          xgFor: null,
          xgAgainst: null,
          isHome: false,
        },
        {
          teamId: 1,
          opponentId: 4,
          matchDate: new Date('2024-12-03'),
          outcome: 'D',
          goalsFor: 1,
          goalsAgainst: 1,
          xgFor: null,
          xgAgainst: null,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 5,
          matchDate: new Date('2024-11-30'),
          outcome: 'W',
          goalsFor: 2,
          goalsAgainst: 1,
          xgFor: null,
          xgAgainst: null,
          isHome: false,
        },
        {
          teamId: 1,
          opponentId: 6,
          matchDate: new Date('2024-11-26'),
          outcome: 'L',
          goalsFor: 0,
          goalsAgainst: 2,
          xgFor: null,
          xgAgainst: null,
          isHome: true,
        },
      ]

      const form = calculateEMAForm(recentMatches)

      // 3 wins, 1 draw, 1 loss - should be good form (> 0.5)
      expect(form).toBeGreaterThan(0.5)
      expect(form).toBeLessThan(1.0)
    })

    it('detects regression candidates with xG data', () => {
      // Team winning more than xG suggests (overperforming)
      const recentMatches: RecentMatch[] = [
        {
          teamId: 1,
          opponentId: 2,
          matchDate: new Date('2024-12-10'),
          outcome: 'W',
          goalsFor: 2,
          goalsAgainst: 0,
          xgFor: 0.8,
          xgAgainst: 1.2,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 3,
          matchDate: new Date('2024-12-07'),
          outcome: 'W',
          goalsFor: 1,
          goalsAgainst: 0,
          xgFor: 0.6,
          xgAgainst: 1.5,
          isHome: false,
        },
        {
          teamId: 1,
          opponentId: 4,
          matchDate: new Date('2024-12-03'),
          outcome: 'W',
          goalsFor: 3,
          goalsAgainst: 1,
          xgFor: 1.0,
          xgAgainst: 1.8,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 5,
          matchDate: new Date('2024-11-30'),
          outcome: 'D',
          goalsFor: 1,
          goalsAgainst: 1,
          xgFor: 0.5,
          xgAgainst: 2.0,
          isHome: false,
        },
      ]

      const metrics = calculateFormMetrics(recentMatches)

      // High EMA form (lots of wins)
      expect(metrics.emaForm).toBeGreaterThan(0.7)

      // Negative xG trend (being outperformed on xG)
      expect(metrics.xgTrend).toBeLessThan(0)

      // Should flag as overperforming (results better than xG)
      expect(metrics.regressionFlag).toBe('overperforming')
    })

    it('identifies underperforming teams', () => {
      // Team losing despite good xG (underperforming)
      const recentMatches: RecentMatch[] = [
        {
          teamId: 1,
          opponentId: 2,
          matchDate: new Date('2024-12-10'),
          outcome: 'L',
          goalsFor: 0,
          goalsAgainst: 1,
          xgFor: 2.5,
          xgAgainst: 0.5,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 3,
          matchDate: new Date('2024-12-07'),
          outcome: 'L',
          goalsFor: 1,
          goalsAgainst: 2,
          xgFor: 2.0,
          xgAgainst: 0.8,
          isHome: false,
        },
        {
          teamId: 1,
          opponentId: 4,
          matchDate: new Date('2024-12-03'),
          outcome: 'D',
          goalsFor: 0,
          goalsAgainst: 0,
          xgFor: 1.8,
          xgAgainst: 0.3,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 5,
          matchDate: new Date('2024-11-30'),
          outcome: 'L',
          goalsFor: 0,
          goalsAgainst: 1,
          xgFor: 2.2,
          xgAgainst: 0.6,
          isHome: false,
        },
      ]

      const metrics = calculateFormMetrics(recentMatches)

      // Low EMA form (lots of losses)
      expect(metrics.emaForm).toBeLessThan(0.3)

      // Positive xG trend (dominating on xG)
      expect(metrics.xgTrend).toBeGreaterThan(1.0)

      // Should flag as underperforming
      expect(metrics.regressionFlag).toBe('underperforming')
    })
  })

  describe('Elo Rating Updates', () => {
    it('updates ratings correctly after match result', () => {
      const homeRating = 1500
      const awayRating = 1500

      // Expected scores are 0.5 each when ratings equal
      const homeExpected = calculateExpected(homeRating, awayRating)
      const awayExpected = calculateExpected(awayRating, homeRating)
      expect(homeExpected).toBeCloseTo(0.5, 2)
      expect(awayExpected).toBeCloseTo(0.5, 2)

      // Simulate home win (actual = 1 for home, 0 for away)
      const K = 20
      const newHomeRating = homeRating + K * (1 - homeExpected)
      const newAwayRating = awayRating + K * (0 - awayExpected)

      expect(newHomeRating).toBeGreaterThan(homeRating)
      expect(newAwayRating).toBeLessThan(awayRating)

      // Rating change should be symmetric
      expect(newHomeRating - homeRating).toBeCloseTo(-(newAwayRating - awayRating), 5)
    })

    it('adjusts ratings more for upsets', () => {
      const strongTeam = 1700
      const weakTeam = 1300
      const K = 20

      // Strong team should win with high expected score
      const strongExpected = calculateExpected(strongTeam, weakTeam)
      expect(strongExpected).toBeGreaterThan(0.9)

      // If weak team wins (upset)
      const strongNewRating = strongTeam + K * (0 - strongExpected) // Lost
      const weakNewRating = weakTeam + K * (1 - (1 - strongExpected)) // Won

      // Large rating changes for upset
      expect(strongTeam - strongNewRating).toBeGreaterThan(15) // Big drop
      expect(weakNewRating - weakTeam).toBeGreaterThan(15) // Big gain
    })

    it('confidence increases with matches played', () => {
      expect(getConfidence(0)).toBe('low')
      expect(getConfidence(4)).toBe('low')
      expect(getConfidence(5)).toBe('medium')
      expect(getConfidence(14)).toBe('medium')
      expect(getConfidence(15)).toBe('high')
      expect(getConfidence(100)).toBe('high')
    })

    it('converts match result to actual score', () => {
      expect(getActualScore(3, 1)).toBe(1) // Win
      expect(getActualScore(1, 1)).toBe(0.5) // Draw
      expect(getActualScore(0, 2)).toBe(0) // Loss
    })
  })

  describe('Dixon-Coles Model Validation', () => {
    it('probabilities are calibrated for typical matches', () => {
      // Average match: both teams score ~1.3 goals
      const probs = calculateProbabilitiesFromLambda(1.5, 1.2)

      // Home should be favored but not overwhelmingly
      expect(probs.homeWinProb).toBeGreaterThan(0.35)
      expect(probs.homeWinProb).toBeLessThan(0.55)

      // Draws should be ~25-30% for even matches
      expect(probs.drawProb).toBeGreaterThan(0.2)
      expect(probs.drawProb).toBeLessThan(0.35)
    })

    it('handles extreme cases', () => {
      // Very one-sided match
      const probs = calculateProbabilitiesFromLambda(3.0, 0.5)

      expect(probs.homeWinProb).toBeGreaterThan(0.8)
      expect(probs.awayWinProb).toBeLessThan(0.05)

      // Still sums to 1
      expect(probs.homeWinProb + probs.drawProb + probs.awayWinProb).toBeCloseTo(1, 3)
    })

    it('Poisson probabilities are valid', () => {
      const lambda = 1.5

      // P(0 goals) should be reasonable
      const p0 = poissonProbability(0, lambda)
      expect(p0).toBeGreaterThan(0.15)
      expect(p0).toBeLessThan(0.3)

      // Probabilities should decrease for very high goals
      const p5 = poissonProbability(5, lambda)
      const p6 = poissonProbability(6, lambda)
      expect(p6).toBeLessThan(p5)

      // Sum over reasonable range should be ~1
      let sum = 0
      for (let i = 0; i <= 10; i++) {
        sum += poissonProbability(i, lambda)
      }
      expect(sum).toBeCloseTo(1, 3)
    })
  })

  describe('Value Calculator Edge Cases', () => {
    it('handles very long odds', () => {
      const modelProbs = { homeProb: 0.1, drawProb: 0.2, awayProb: 0.7 }
      const odds = { homeOdds: 15.0, drawOdds: 6.0, awayOdds: 1.4 }

      const evs = calculateExpectedValues(modelProbs, odds)

      // EV calculations should still work
      expect(evs.evHome).toBeCloseTo(0.1 * 15.0 - 1, 2) // 0.5 = 50% EV
      expect(evs.evAway).toBeCloseTo(0.7 * 1.4 - 1, 2) // -0.02 = -2% EV
    })

    it('handles very short odds', () => {
      const modelProbs = { homeProb: 0.85, drawProb: 0.1, awayProb: 0.05 }
      const odds = { homeOdds: 1.15, drawOdds: 7.0, awayOdds: 15.0 }

      const evs = calculateExpectedValues(modelProbs, odds)

      // Heavy favorite at 1.15 odds
      expect(evs.evHome).toBeCloseTo(0.85 * 1.15 - 1, 2) // -0.0225
    })

    it('calculates margin correctly for typical 3-way market', () => {
      // Typical bookmaker odds with ~5% margin
      const odds = { homeOdds: 2.1, drawOdds: 3.3, awayOdds: 3.4 }
      const fair = calculateFairProbabilities(odds)

      // Margin should be around 5%
      expect(fair.margin).toBeGreaterThan(0.03)
      expect(fair.margin).toBeLessThan(0.08)
    })
  })

  describe('End-to-End Scenario Tests', () => {
    it('scenario: clear favorite with value on underdog', () => {
      // Barcelona (strong) vs Getafe (weak) at home
      const homeElo = 1750
      const awayElo = 1350

      // Home heavily favored
      const homeExpected = calculateExpected(homeElo, awayElo)
      expect(homeExpected).toBeGreaterThan(0.85)

      // Dixon-Coles with strong home attack
      const probs = calculateProbabilitiesFromLambda(2.5, 0.8)
      expect(probs.homeWinProb).toBeGreaterThan(0.7)

      // But market overestimates home win
      const odds = { homeOdds: 1.2, drawOdds: 7.0, awayOdds: 12.0 }
      const modelProbs = {
        homeProb: probs.homeWinProb,
        drawProb: probs.drawProb,
        awayProb: probs.awayWinProb,
      }

      const evs = calculateExpectedValues(modelProbs, odds, DEFAULT_CONFIG)

      // Heavy favorite, likely negative EV on home
      expect(evs.evHome).toBeLessThan(0)
    })

    it('scenario: evenly matched teams', () => {
      // Two similarly rated teams
      const homeElo = 1520
      const awayElo = 1500

      const homeExpected = calculateExpected(homeElo, awayElo)
      expect(homeExpected).toBeCloseTo(0.53, 1) // Slight home edge

      // Similar expected goals with home advantage
      const probs = calculateProbabilitiesFromLambda(1.4, 1.2)

      // Draw should be significant probability
      expect(probs.drawProb).toBeGreaterThan(0.25)

      // Home and away win should be closer
      expect(Math.abs(probs.homeWinProb - probs.awayWinProb)).toBeLessThan(0.2)
    })

    it('scenario: team in poor form but good xG', () => {
      // Team losing but creating chances
      const matches: RecentMatch[] = [
        {
          teamId: 1,
          opponentId: 2,
          matchDate: new Date('2024-12-10'),
          outcome: 'L',
          goalsFor: 0,
          goalsAgainst: 1,
          xgFor: 2.1,
          xgAgainst: 0.5,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 3,
          matchDate: new Date('2024-12-07'),
          outcome: 'L',
          goalsFor: 1,
          goalsAgainst: 2,
          xgFor: 1.8,
          xgAgainst: 0.8,
          isHome: false,
        },
        {
          teamId: 1,
          opponentId: 4,
          matchDate: new Date('2024-12-03'),
          outcome: 'D',
          goalsFor: 1,
          goalsAgainst: 1,
          xgFor: 2.0,
          xgAgainst: 0.6,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 5,
          matchDate: new Date('2024-11-30'),
          outcome: 'L',
          goalsFor: 0,
          goalsAgainst: 1,
          xgFor: 1.9,
          xgAgainst: 0.4,
          isHome: false,
        },
      ]

      const metrics = calculateFormMetrics(matches)

      // Bad actual form
      expect(metrics.emaForm).toBeLessThan(0.3)

      // But great xG trend - dominating opponents
      expect(metrics.xgTrend).toBeGreaterThan(1.0)

      // Should be flagged as underperforming
      expect(metrics.regressionFlag).toBe('underperforming')

      // This team is a potential value bet - results should regress to xG
    })
  })
})
