/* eslint-disable @typescript-eslint/no-explicit-any -- Test file with mock data */
import { describe, it, expect } from 'vitest'

// Import calculation functions directly to test pure logic
import {
  calculateExpected,
  calculateKFactor,
  getActualScore,
  getConfidence,
} from '../../../server/services/statistical-calculations/elo-rating'

import {
  poissonProbability,
  dixonColesCorrection,
  calculateProbabilitiesFromLambda,
  scorelineProbability,
} from '../../../server/services/statistical-calculations/dixon-coles'

import {
  resultToPoints,
  xgToPoints,
  calculateEMAForm,
  calculateXGForm,
  identifyRegressionCandidate,
  determineOutcome,
  type RecentMatch,
} from '../../../server/services/statistical-calculations/form-calculator'

import {
  calculateFairProbabilities,
  calculateExpectedValues,
  calculateEV,
  oddsToImpliedProbability,
  calculateMargin,
} from '../../../server/services/statistical-calculations/value-calculator'

describe('Elo Rating System', () => {
  describe('calculateExpected', () => {
    it('returns 0.5 for equal ratings', () => {
      expect(calculateExpected(1500, 1500)).toBeCloseTo(0.5, 2)
    })

    it('returns higher value for higher rated team', () => {
      const expected = calculateExpected(1600, 1400)
      expect(expected).toBeGreaterThan(0.5)
      expect(expected).toBeLessThan(1)
    })

    it('returns lower value for lower rated team', () => {
      const expected = calculateExpected(1400, 1600)
      expect(expected).toBeLessThan(0.5)
      expect(expected).toBeGreaterThan(0)
    })

    it('symmetric probabilities sum to 1', () => {
      const expectedA = calculateExpected(1600, 1400)
      const expectedB = calculateExpected(1400, 1600)
      expect(expectedA + expectedB).toBeCloseTo(1, 5)
    })

    it('400 point difference gives ~91% expected score', () => {
      const expected = calculateExpected(1900, 1500)
      expect(expected).toBeCloseTo(0.91, 1)
    })
  })

  describe('getActualScore', () => {
    it('returns 1 for win', () => {
      expect(getActualScore(3, 1)).toBe(1)
    })

    it('returns 0.5 for draw', () => {
      expect(getActualScore(2, 2)).toBe(0.5)
    })

    it('returns 0 for loss', () => {
      expect(getActualScore(0, 2)).toBe(0)
    })
  })

  describe('calculateKFactor', () => {
    it('applies lower K-factor for home team', () => {
      const kHome = calculateKFactor(2, true)
      const kAway = calculateKFactor(2, false)
      expect(kHome).toBeLessThan(kAway)
    })

    it('increases K-factor for large margins', () => {
      const kSmall = calculateKFactor(1, true)
      const kLarge = calculateKFactor(3, true)
      expect(kLarge).toBeGreaterThan(kSmall)
    })
  })

  describe('getConfidence', () => {
    it('returns low for few matches', () => {
      expect(getConfidence(3)).toBe('low')
    })

    it('returns medium for moderate matches', () => {
      expect(getConfidence(8)).toBe('medium')
    })

    it('returns high for many matches', () => {
      expect(getConfidence(20)).toBe('high')
    })
  })
})

describe('Dixon-Coles Model', () => {
  describe('poissonProbability', () => {
    it('returns valid probability for 0 goals', () => {
      const prob = poissonProbability(0, 1.5)
      expect(prob).toBeGreaterThan(0)
      expect(prob).toBeLessThan(1)
    })

    it('returns valid probability for multiple goals', () => {
      const prob = poissonProbability(3, 1.5)
      expect(prob).toBeGreaterThan(0)
      expect(prob).toBeLessThan(1)
    })

    it('higher lambda increases probability of high goals', () => {
      const probLow = poissonProbability(3, 1.0)
      const probHigh = poissonProbability(3, 2.5)
      expect(probHigh).toBeGreaterThan(probLow)
    })

    it('probabilities sum approximately to 1 over reasonable range', () => {
      const lambda = 1.5
      let sum = 0
      for (let i = 0; i <= 10; i++) {
        sum += poissonProbability(i, lambda)
      }
      expect(sum).toBeCloseTo(1, 2)
    })
  })

  describe('dixonColesCorrection', () => {
    it('returns 1.0 for high scores (no correction needed)', () => {
      expect(dixonColesCorrection(3, 2, 1.5, 1.2, -0.1)).toBe(1.0)
      expect(dixonColesCorrection(2, 3, 1.5, 1.2, -0.1)).toBe(1.0)
    })

    it('applies correction for 0-0 draws', () => {
      const correction = dixonColesCorrection(0, 0, 1.5, 1.2, -0.1)
      expect(correction).not.toBe(1.0)
    })

    it('applies correction for 1-0 and 0-1 results', () => {
      const correction10 = dixonColesCorrection(1, 0, 1.5, 1.2, -0.1)
      const correction01 = dixonColesCorrection(0, 1, 1.5, 1.2, -0.1)
      expect(correction10).not.toBe(1.0)
      expect(correction01).not.toBe(1.0)
    })

    it('applies correction for 1-1 draws', () => {
      const correction = dixonColesCorrection(1, 1, 1.5, 1.2, -0.1)
      expect(correction).not.toBe(1.0)
    })

    it('correction varies with rho parameter', () => {
      const rhoNeg = dixonColesCorrection(0, 0, 1.5, 1.2, -0.1)
      const rhoPos = dixonColesCorrection(0, 0, 1.5, 1.2, 0.1)
      expect(rhoNeg).not.toBe(rhoPos)
    })
  })

  describe('calculateProbabilitiesFromLambda', () => {
    it('returns probabilities that sum to 1', () => {
      const result = calculateProbabilitiesFromLambda(1.5, 1.2)
      const sum = result.homeWinProb + result.drawProb + result.awayWinProb
      expect(sum).toBeCloseTo(1, 3)
    })

    it('higher home lambda increases home win probability', () => {
      const lowHome = calculateProbabilitiesFromLambda(1.0, 1.5)
      const highHome = calculateProbabilitiesFromLambda(2.0, 1.5)
      expect(highHome.homeWinProb).toBeGreaterThan(lowHome.homeWinProb)
    })

    it('equal lambdas favor draw more', () => {
      const equal = calculateProbabilitiesFromLambda(1.5, 1.5)
      const unequal = calculateProbabilitiesFromLambda(2.0, 1.0)
      expect(equal.drawProb).toBeGreaterThan(unequal.drawProb)
    })

    it('includes expected goals in result', () => {
      const result = calculateProbabilitiesFromLambda(1.8, 1.3)
      expect(result.expectedHomeGoals).toBeCloseTo(1.8, 1)
      expect(result.expectedAwayGoals).toBeCloseTo(1.3, 1)
    })
  })

  describe('scorelineProbability', () => {
    it('returns valid probability', () => {
      const prob = scorelineProbability(2, 1, 1.5, 1.2, -0.1)
      expect(prob).toBeGreaterThan(0)
      expect(prob).toBeLessThan(1)
    })

    it('most common scoreline has highest probability', () => {
      // For lambda around 1.5, 1-1 or 2-1 should be relatively common
      const prob_0_0 = scorelineProbability(0, 0, 1.5, 1.0, -0.1)
      const prob_1_1 = scorelineProbability(1, 1, 1.5, 1.0, -0.1)
      const prob_5_5 = scorelineProbability(5, 5, 1.5, 1.0, -0.1)
      expect(prob_5_5).toBeLessThan(prob_1_1)
      expect(prob_5_5).toBeLessThan(prob_0_0)
    })
  })
})

describe('Form Calculator', () => {
  describe('resultToPoints', () => {
    it('returns 1.0 for win', () => {
      expect(resultToPoints('W')).toBe(1.0)
    })

    it('returns 0.33 for draw', () => {
      expect(resultToPoints('D')).toBeCloseTo(0.33, 2)
    })

    it('returns 0.0 for loss', () => {
      expect(resultToPoints('L')).toBe(0.0)
    })
  })

  describe('xgToPoints', () => {
    it('returns 0.5 for equal xG', () => {
      expect(xgToPoints(1.5, 1.5)).toBeCloseTo(0.5, 2)
    })

    it('returns 1.0 for dominant xG (diff >= 1)', () => {
      expect(xgToPoints(2.5, 1.0)).toBe(1.0)
    })

    it('returns 0.0 for dominated xG (diff <= -1)', () => {
      expect(xgToPoints(0.5, 2.0)).toBe(0.0)
    })

    it('linear interpolation for small differences', () => {
      const result = xgToPoints(1.8, 1.3) // diff = 0.5
      expect(result).toBeCloseTo(0.75, 2)
    })
  })

  describe('calculateEMAForm', () => {
    it('returns 0.5 for empty matches', () => {
      expect(calculateEMAForm([])).toBe(0.5)
    })

    it('increases form for wins', () => {
      const matches: RecentMatch[] = [
        {
          teamId: 1,
          opponentId: 2,
          matchDate: new Date('2024-01-03'),
          outcome: 'W',
          goalsFor: 2,
          goalsAgainst: 1,
          xgFor: null,
          xgAgainst: null,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 3,
          matchDate: new Date('2024-01-02'),
          outcome: 'W',
          goalsFor: 1,
          goalsAgainst: 0,
          xgFor: null,
          xgAgainst: null,
          isHome: false,
        },
        {
          teamId: 1,
          opponentId: 4,
          matchDate: new Date('2024-01-01'),
          outcome: 'W',
          goalsFor: 3,
          goalsAgainst: 0,
          xgFor: null,
          xgAgainst: null,
          isHome: true,
        },
      ]
      const form = calculateEMAForm(matches)
      expect(form).toBeGreaterThan(0.5)
    })

    it('decreases form for losses', () => {
      const matches: RecentMatch[] = [
        {
          teamId: 1,
          opponentId: 2,
          matchDate: new Date('2024-01-03'),
          outcome: 'L',
          goalsFor: 0,
          goalsAgainst: 2,
          xgFor: null,
          xgAgainst: null,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 3,
          matchDate: new Date('2024-01-02'),
          outcome: 'L',
          goalsFor: 1,
          goalsAgainst: 3,
          xgFor: null,
          xgAgainst: null,
          isHome: false,
        },
        {
          teamId: 1,
          opponentId: 4,
          matchDate: new Date('2024-01-01'),
          outcome: 'L',
          goalsFor: 0,
          goalsAgainst: 1,
          xgFor: null,
          xgAgainst: null,
          isHome: true,
        },
      ]
      const form = calculateEMAForm(matches)
      expect(form).toBeLessThan(0.5)
    })

    it('converges towards recent results over time', () => {
      // All wins should push form toward 1
      const allWins: RecentMatch[] = Array.from({ length: 10 }, (_, i) => ({
        teamId: 1,
        opponentId: i + 2,
        matchDate: new Date(`2024-01-${10 - i}`),
        outcome: 'W' as const,
        goalsFor: 2,
        goalsAgainst: 0,
        xgFor: null,
        xgAgainst: null,
        isHome: i % 2 === 0,
      }))
      const formWins = calculateEMAForm(allWins)
      expect(formWins).toBeGreaterThan(0.8)

      // All losses should push form toward 0
      const allLosses: RecentMatch[] = Array.from({ length: 10 }, (_, i) => ({
        teamId: 1,
        opponentId: i + 2,
        matchDate: new Date(`2024-01-${10 - i}`),
        outcome: 'L' as const,
        goalsFor: 0,
        goalsAgainst: 2,
        xgFor: null,
        xgAgainst: null,
        isHome: i % 2 === 0,
      }))
      const formLosses = calculateEMAForm(allLosses)
      expect(formLosses).toBeLessThan(0.2)
    })
  })

  describe('calculateXGForm', () => {
    it('returns null for insufficient xG data', () => {
      const matches: RecentMatch[] = [
        {
          teamId: 1,
          opponentId: 2,
          matchDate: new Date('2024-01-01'),
          outcome: 'W',
          goalsFor: 2,
          goalsAgainst: 1,
          xgFor: 1.5,
          xgAgainst: 1.0,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 3,
          matchDate: new Date('2024-01-02'),
          outcome: 'D',
          goalsFor: 1,
          goalsAgainst: 1,
          xgFor: null,
          xgAgainst: null,
          isHome: false,
        }, // No xG
      ]
      expect(calculateXGForm(matches)).toBeNull()
    })

    it('returns form based on xG performance', () => {
      const matches: RecentMatch[] = [
        {
          teamId: 1,
          opponentId: 2,
          matchDate: new Date('2024-01-04'),
          outcome: 'W',
          goalsFor: 2,
          goalsAgainst: 1,
          xgFor: 2.0,
          xgAgainst: 0.5,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 3,
          matchDate: new Date('2024-01-03'),
          outcome: 'W',
          goalsFor: 1,
          goalsAgainst: 0,
          xgFor: 1.8,
          xgAgainst: 0.8,
          isHome: false,
        },
        {
          teamId: 1,
          opponentId: 4,
          matchDate: new Date('2024-01-02'),
          outcome: 'D',
          goalsFor: 1,
          goalsAgainst: 1,
          xgFor: 1.5,
          xgAgainst: 1.0,
          isHome: true,
        },
        {
          teamId: 1,
          opponentId: 5,
          matchDate: new Date('2024-01-01'),
          outcome: 'W',
          goalsFor: 3,
          goalsAgainst: 0,
          xgFor: 2.2,
          xgAgainst: 0.6,
          isHome: false,
        },
      ]
      const form = calculateXGForm(matches)
      expect(form).not.toBeNull()
      expect(form).toBeGreaterThan(0.5)
    })
  })

  describe('identifyRegressionCandidate', () => {
    it('returns null when xgForm is null', () => {
      expect(identifyRegressionCandidate(0.7, null)).toBeNull()
    })

    it('returns null for small differences', () => {
      expect(identifyRegressionCandidate(0.6, 0.55)).toBeNull()
    })

    it('returns overperforming when actual > xG by threshold', () => {
      expect(identifyRegressionCandidate(0.8, 0.5)).toBe('overperforming')
    })

    it('returns underperforming when actual < xG by threshold', () => {
      expect(identifyRegressionCandidate(0.3, 0.6)).toBe('underperforming')
    })

    it('respects custom threshold', () => {
      expect(identifyRegressionCandidate(0.65, 0.5, 0.1)).toBe('overperforming')
      expect(identifyRegressionCandidate(0.65, 0.5, 0.2)).toBeNull()
    })
  })

  describe('determineOutcome', () => {
    it('returns W for home win', () => {
      expect(determineOutcome(3, 1)).toBe('W')
    })

    it('returns D for draw', () => {
      expect(determineOutcome(2, 2)).toBe('D')
    })

    it('returns L for away win', () => {
      expect(determineOutcome(0, 2)).toBe('L')
    })
  })
})

describe('Value Calculator', () => {
  describe('oddsToImpliedProbability', () => {
    it('converts odds to probability', () => {
      expect(oddsToImpliedProbability(2.0)).toBe(0.5)
      expect(oddsToImpliedProbability(4.0)).toBe(0.25)
    })

    it('handles edge case of odds <= 1', () => {
      expect(oddsToImpliedProbability(1.0)).toBe(1)
      expect(oddsToImpliedProbability(0.5)).toBe(1)
    })
  })

  describe('calculateMargin', () => {
    it('calculates bookmaker margin', () => {
      // Fair odds (no margin) would have implied probs sum to 1
      // With margin, sum > 1
      const odds = { homeOdds: 2.1, drawOdds: 3.3, awayOdds: 3.5 }
      const margin = calculateMargin(odds)
      expect(margin).toBeGreaterThan(0)
    })

    it('returns approximately 0 for fair odds', () => {
      // These odds have implied probs summing to exactly 1
      // 1/2 + 1/3 + 1/6 = 3/6 + 2/6 + 1/6 = 1
      const fairOdds = { homeOdds: 2.0, drawOdds: 3.0, awayOdds: 6.0 }
      const margin = calculateMargin(fairOdds)
      expect(Math.abs(margin)).toBeLessThan(0.001)
    })
  })

  describe('calculateFairProbabilities', () => {
    it('returns probabilities summing to 1', () => {
      const odds = { homeOdds: 1.8, drawOdds: 3.5, awayOdds: 4.5 }
      const fair = calculateFairProbabilities(odds)
      const sum = fair.homeProbability + fair.drawProbability + fair.awayProbability
      expect(sum).toBeCloseTo(1, 5)
    })

    it('fair probabilities are proportional to implied probabilities', () => {
      const odds = { homeOdds: 2.0, drawOdds: 3.0, awayOdds: 4.0 }
      const fair = calculateFairProbabilities(odds)

      // Home has lowest odds, should have highest probability
      expect(fair.homeProbability).toBeGreaterThan(fair.drawProbability)
      expect(fair.drawProbability).toBeGreaterThan(fair.awayProbability)
    })

    it('includes margin in result', () => {
      const odds = { homeOdds: 2.1, drawOdds: 3.3, awayOdds: 3.5 }
      const fair = calculateFairProbabilities(odds)
      expect(fair.margin).toBeGreaterThan(0)
    })
  })

  describe('calculateEV', () => {
    it('positive EV when probability higher than implied', () => {
      // Odds 2.0 implies 50%, but model says 60%
      const ev = calculateEV(0.6, 2.0)
      expect(ev).toBeCloseTo(0.2, 2) // 60% * 2.0 - 1 = 0.2
    })

    it('negative EV when probability lower than implied', () => {
      // Odds 2.0 implies 50%, but model says 40%
      const ev = calculateEV(0.4, 2.0)
      expect(ev).toBeCloseTo(-0.2, 2) // 40% * 2.0 - 1 = -0.2
    })

    it('zero EV when probability equals implied', () => {
      const ev = calculateEV(0.5, 2.0)
      expect(ev).toBeCloseTo(0, 2)
    })
  })

  describe('calculateExpectedValues', () => {
    it('calculates EV for all outcomes', () => {
      const modelProb = { homeProb: 0.6, drawProb: 0.25, awayProb: 0.15 }
      const odds = { homeOdds: 2.0, drawOdds: 3.5, awayOdds: 6.0 }
      const evs = calculateExpectedValues(modelProb, odds)

      // EV = prob * odds - 1
      expect(evs.evHome).toBeCloseTo(0.6 * 2.0 - 1, 2)
      expect(evs.evDraw).toBeCloseTo(0.25 * 3.5 - 1, 2)
      expect(evs.evAway).toBeCloseTo(0.15 * 6.0 - 1, 2)
    })

    it('identifies best value outcome when above threshold', () => {
      const modelProb = { homeProb: 0.55, drawProb: 0.25, awayProb: 0.2 }
      // Away is overpriced relative to model
      const odds = { homeOdds: 1.8, drawOdds: 3.5, awayOdds: 7.0 }
      const evs = calculateExpectedValues(modelProb, odds, { evThreshold: 0.03 } as any)

      // 7.0 odds for 20% model probability = EV of (0.2 * 7) - 1 = 0.4 = 40%
      expect(evs.evAway).toBeCloseTo(0.4, 2)
      expect(evs.bestValueOutcome).toBe('2') // '2' represents away win
    })

    it('returns null bestValueOutcome when no EV above threshold', () => {
      const modelProb = { homeProb: 0.5, drawProb: 0.25, awayProb: 0.25 }
      // Market roughly matches model
      const odds = { homeOdds: 2.0, drawOdds: 4.0, awayOdds: 4.0 }
      const evs = calculateExpectedValues(modelProb, odds, { evThreshold: 0.1 } as any)

      expect(evs.bestValueOutcome).toBeNull()
    })
  })
})
