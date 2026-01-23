import { prisma } from '~/server/utils/prisma'
import type { predictions, matches } from '@prisma/client'

/**
 * Prediction with match relation for performance tracking
 */
type PredictionWithMatch = predictions & { match: matches }

/**
 * Performance breakdown by category (confidence level or outcome)
 */
interface PerformanceBreakdown {
  [key: string]: {
    total: number
    correct: number
    accuracy: number
  }
}

/**
 * Overall performance statistics
 */
interface OverallStats {
  totalPredictions: number
  correctPredictions: number
  accuracy: number
  averageProbabilityScore: number
  byConfidence: PerformanceBreakdown
  byOutcome: PerformanceBreakdown
}

/**
 * League performance statistics
 */
interface LeaguePerformance {
  league: string
  totalPredictions: number
  correctPredictions: number
  accuracy: number
}

/**
 * Service for tracking and analyzing prediction performance
 */
export class PerformanceTracker {
  /**
   * Update performance for completed matches
   */
  async updatePerformance(): Promise<{ updated: number; errors: number }> {
    try {
      console.log('[Performance Tracker] Updating prediction performance...')

      // Find matches with predictions but no performance record that have results
      const matchesWithPredictions = await prisma.predictions.findMany({
        where: {
          match: {
            outcome: { not: null },
          },
          prediction_performance: {
            none: {},
          },
        },
        include: {
          match: true,
        },
      })

      let updated = 0
      let errors = 0

      for (const prediction of matchesWithPredictions) {
        try {
          await this.createPerformanceRecord(prediction)
          updated++
        } catch (error) {
          console.error(
            `[Performance Tracker] Error creating performance record for prediction ${prediction.id}:`,
            error
          )
          errors++
        }
      }

      console.log(`[Performance Tracker] Updated ${updated} performance records (${errors} errors)`)

      return { updated, errors }
    } catch (error) {
      console.error('[Performance Tracker] Error updating performance:', error)
      return { updated: 0, errors: 1 }
    }
  }

  /**
   * Create performance record for a prediction
   */
  private async createPerformanceRecord(prediction: PredictionWithMatch): Promise<void> {
    const actualOutcome = prediction.match.outcome
    const predictedOutcome = prediction.predicted_outcome

    // Check if prediction was correct
    const correctlyPredicted = actualOutcome === predictedOutcome

    // Get probability assigned to actual outcome
    let probabilityScore = 0
    if (actualOutcome === '1') {
      probabilityScore = Number(prediction.probability_home)
    } else if (actualOutcome === 'X') {
      probabilityScore = Number(prediction.probability_draw)
    } else if (actualOutcome === '2') {
      probabilityScore = Number(prediction.probability_away)
    }

    // Create performance record
    await prisma.prediction_performance.create({
      data: {
        prediction_id: prediction.id,
        actual_outcome: actualOutcome ?? 'unknown',
        correctly_predicted: correctlyPredicted,
        probability_score: probabilityScore,
        analysis_notes: `Predicted: ${predictedOutcome}, Actual: ${actualOutcome}`,
      },
    })
  }

  /**
   * Get overall performance statistics
   */
  async getOverallStats(): Promise<OverallStats | null> {
    try {
      const totalPredictions = await prisma.prediction_performance.count()

      if (totalPredictions === 0) {
        return {
          totalPredictions: 0,
          correctPredictions: 0,
          accuracy: 0,
          averageProbabilityScore: 0,
          byConfidence: {},
          byOutcome: {},
        }
      }

      const correctPredictions = await prisma.prediction_performance.count({
        where: { correctly_predicted: true },
      })

      const avgProbScore = await prisma.prediction_performance.aggregate({
        _avg: { probability_score: true },
      })

      // Get performance by confidence level
      const byConfidence = await this.getPerformanceByConfidence()

      // Get performance by predicted outcome
      const byOutcome = await this.getPerformanceByOutcome()

      return {
        totalPredictions,
        correctPredictions,
        accuracy: (correctPredictions / totalPredictions) * 100,
        averageProbabilityScore: Number(avgProbScore._avg.probability_score || 0),
        byConfidence,
        byOutcome,
      }
    } catch (error) {
      console.error('[Performance Tracker] Error getting overall stats:', error)
      return null
    }
  }

  /**
   * Get performance broken down by confidence level
   */
  private async getPerformanceByConfidence(): Promise<PerformanceBreakdown> {
    try {
      const confidenceLevels = ['high', 'medium', 'low']
      const results: PerformanceBreakdown = {}

      for (const confidence of confidenceLevels) {
        const predictions = await prisma.prediction_performance.findMany({
          where: {
            predictions: {
              confidence,
            },
          },
        })

        if (predictions.length > 0) {
          const correct = predictions.filter(p => p.correctly_predicted).length
          results[confidence] = {
            total: predictions.length,
            correct,
            accuracy: (correct / predictions.length) * 100,
          }
        }
      }

      return results
    } catch (error) {
      console.error('[Performance Tracker] Error getting performance by confidence:', error)
      return {}
    }
  }

  /**
   * Get performance broken down by predicted outcome
   */
  private async getPerformanceByOutcome(): Promise<PerformanceBreakdown> {
    try {
      const outcomes = ['1', 'X', '2']
      const results: PerformanceBreakdown = {}

      for (const outcome of outcomes) {
        const predictions = await prisma.prediction_performance.findMany({
          where: {
            predictions: {
              predicted_outcome: outcome,
            },
          },
        })

        if (predictions.length > 0) {
          const correct = predictions.filter(p => p.correctly_predicted).length
          results[outcome] = {
            total: predictions.length,
            correct,
            accuracy: (correct / predictions.length) * 100,
          }
        }
      }

      return results
    } catch (error) {
      console.error('[Performance Tracker] Error getting performance by outcome:', error)
      return {}
    }
  }

  /**
   * Get performance for a specific league
   */
  async getLeaguePerformance(league: string): Promise<LeaguePerformance | null> {
    try {
      const predictions = await prisma.prediction_performance.findMany({
        where: {
          predictions: {
            match: {
              league: {
                name: league,
              },
            },
          },
        },
      })

      if (predictions.length === 0) {
        return {
          league,
          totalPredictions: 0,
          correctPredictions: 0,
          accuracy: 0,
        }
      }

      const correct = predictions.filter(p => p.correctly_predicted).length

      return {
        league,
        totalPredictions: predictions.length,
        correctPredictions: correct,
        accuracy: (correct / predictions.length) * 100,
      }
    } catch (error) {
      console.error(`[Performance Tracker] Error getting performance for league ${league}:`, error)
      return null
    }
  }
}

// Export singleton instance
export const performanceTracker = new PerformanceTracker()
