#!/usr/bin/env node
/**
 * Model Validation Script
 *
 * Validates the statistical model against known match outcomes.
 * Calculates Brier score and other calibration metrics.
 *
 * Brier Score = (1/N) × Σ(predicted_probability - actual_outcome)²
 * - Perfect predictions: 0.0
 * - Random (33% each): 0.667
 * - Lower is better
 *
 * Usage:
 *   npx tsx scripts/validate-model.ts
 *   npx tsx scripts/validate-model.ts --limit 100
 */

import 'dotenv/config'
import { prisma } from '../server/utils/prisma'

interface ValidationResult {
  totalMatches: number
  brierScore: number
  brierScoreHome: number
  brierScoreDraw: number
  brierScoreAway: number
  logLoss: number
  accuracy: number
  calibration: {
    bucket: string
    predicted: number
    actual: number
    count: number
  }[]
}

/**
 * Calculate Brier score for a single prediction
 * Brier = Σ(p_i - o_i)² for each outcome
 */
function singleBrier(
  homeProb: number,
  drawProb: number,
  awayProb: number,
  actualOutcome: 'home' | 'draw' | 'away'
): { total: number; home: number; draw: number; away: number } {
  const homeActual = actualOutcome === 'home' ? 1 : 0
  const drawActual = actualOutcome === 'draw' ? 1 : 0
  const awayActual = actualOutcome === 'away' ? 1 : 0

  const homeSquared = Math.pow(homeProb - homeActual, 2)
  const drawSquared = Math.pow(drawProb - drawActual, 2)
  const awaySquared = Math.pow(awayProb - awayActual, 2)

  return {
    total: homeSquared + drawSquared + awaySquared,
    home: homeSquared,
    draw: drawSquared,
    away: awaySquared,
  }
}

/**
 * Calculate log loss for a single prediction
 * LogLoss = -log(probability of actual outcome)
 */
function singleLogLoss(
  homeProb: number,
  drawProb: number,
  awayProb: number,
  actualOutcome: 'home' | 'draw' | 'away'
): number {
  // Clip probabilities to avoid log(0)
  const epsilon = 1e-10
  const clippedHome = Math.max(epsilon, Math.min(1 - epsilon, homeProb))
  const clippedDraw = Math.max(epsilon, Math.min(1 - epsilon, drawProb))
  const clippedAway = Math.max(epsilon, Math.min(1 - epsilon, awayProb))

  if (actualOutcome === 'home') return -Math.log(clippedHome)
  if (actualOutcome === 'draw') return -Math.log(clippedDraw)
  return -Math.log(clippedAway)
}

/**
 * Determine actual outcome from match result
 */
function getActualOutcome(homeGoals: number, awayGoals: number): 'home' | 'draw' | 'away' {
  if (homeGoals > awayGoals) return 'home'
  if (homeGoals === awayGoals) return 'draw'
  return 'away'
}

/**
 * Get predicted outcome (highest probability)
 */
function getPredictedOutcome(
  homeProb: number,
  drawProb: number,
  awayProb: number
): 'home' | 'draw' | 'away' {
  if (homeProb >= drawProb && homeProb >= awayProb) return 'home'
  if (drawProb >= homeProb && drawProb >= awayProb) return 'draw'
  return 'away'
}

/**
 * Calculate calibration buckets
 * Groups predictions by confidence level and checks actual win rates
 */
function calculateCalibration(
  predictions: Array<{
    probability: number
    actual: boolean
  }>
): Array<{ bucket: string; predicted: number; actual: number; count: number }> {
  const buckets = [
    { min: 0, max: 0.2, label: '0-20%' },
    { min: 0.2, max: 0.3, label: '20-30%' },
    { min: 0.3, max: 0.4, label: '30-40%' },
    { min: 0.4, max: 0.5, label: '40-50%' },
    { min: 0.5, max: 0.6, label: '50-60%' },
    { min: 0.6, max: 0.7, label: '60-70%' },
    { min: 0.7, max: 0.8, label: '70-80%' },
    { min: 0.8, max: 1.0, label: '80-100%' },
  ]

  return buckets.map(bucket => {
    const inBucket = predictions.filter(
      p => p.probability >= bucket.min && p.probability < bucket.max
    )

    if (inBucket.length === 0) {
      return {
        bucket: bucket.label,
        predicted: (bucket.min + bucket.max) / 2,
        actual: 0,
        count: 0,
      }
    }

    const avgPredicted = inBucket.reduce((sum, p) => sum + p.probability, 0) / inBucket.length
    const actualRate = inBucket.filter(p => p.actual).length / inBucket.length

    return {
      bucket: bucket.label,
      predicted: avgPredicted,
      actual: actualRate,
      count: inBucket.length,
    }
  })
}

async function validateModel(limit?: number): Promise<ValidationResult> {
  // Query matches with calculations and known results
  const matches = await prisma.matches.findMany({
    where: {
      result_home: { not: null },
      result_away: { not: null },
      match_calculations: {
        isNot: null,
      },
    },
    include: {
      match_calculations: true,
    },
    orderBy: {
      start_time: 'desc',
    },
    take: limit,
  })

  if (matches.length === 0) {
    console.log('No matches with calculations and results found.')
    return {
      totalMatches: 0,
      brierScore: 0,
      brierScoreHome: 0,
      brierScoreDraw: 0,
      brierScoreAway: 0,
      logLoss: 0,
      accuracy: 0,
      calibration: [],
    }
  }

  let totalBrier = 0
  let totalBrierHome = 0
  let totalBrierDraw = 0
  let totalBrierAway = 0
  let totalLogLoss = 0
  let correctPredictions = 0

  // For calibration analysis
  const allPredictions: Array<{ probability: number; actual: boolean }> = []

  for (const match of matches) {
    const calc = match.match_calculations
    if (!calc) continue

    const homeProb = calc.model_prob_home?.toNumber() ?? 0.33
    const drawProb = calc.model_prob_draw?.toNumber() ?? 0.33
    const awayProb = calc.model_prob_away?.toNumber() ?? 0.34

    const actualOutcome = getActualOutcome(match.result_home!, match.result_away!)
    const predictedOutcome = getPredictedOutcome(homeProb, drawProb, awayProb)

    // Brier scores
    const brier = singleBrier(homeProb, drawProb, awayProb, actualOutcome)
    totalBrier += brier.total
    totalBrierHome += brier.home
    totalBrierDraw += brier.draw
    totalBrierAway += brier.away

    // Log loss
    totalLogLoss += singleLogLoss(homeProb, drawProb, awayProb, actualOutcome)

    // Accuracy
    if (predictedOutcome === actualOutcome) {
      correctPredictions++
    }

    // Calibration data (for home win predictions)
    allPredictions.push({
      probability: homeProb,
      actual: actualOutcome === 'home',
    })
    allPredictions.push({
      probability: drawProb,
      actual: actualOutcome === 'draw',
    })
    allPredictions.push({
      probability: awayProb,
      actual: actualOutcome === 'away',
    })
  }

  const n = matches.length

  return {
    totalMatches: n,
    brierScore: totalBrier / n,
    brierScoreHome: totalBrierHome / n,
    brierScoreDraw: totalBrierDraw / n,
    brierScoreAway: totalBrierAway / n,
    logLoss: totalLogLoss / n,
    accuracy: correctPredictions / n,
    calibration: calculateCalibration(allPredictions),
  }
}

async function main() {
  const args = process.argv.slice(2)
  const limitIndex = args.indexOf('--limit')
  const limitArg = limitIndex >= 0 ? args[limitIndex + 1] : undefined
  const limit = limitArg ? parseInt(limitArg, 10) : undefined

  console.log('=== Model Validation ===\n')
  console.log(
    limit
      ? `Validating on last ${limit} matches...`
      : 'Validating on all matches with calculations...'
  )

  try {
    const result = await validateModel(limit)

    if (result.totalMatches === 0) {
      console.log('\nNo data available for validation.')
      console.log('Run the following to generate calculations:')
      console.log('  npx tsx scripts/init-team-ratings.ts --train')
      console.log('  npx tsx scripts/backfill-calculations.ts')
      return
    }

    console.log(`\nMatches analyzed: ${result.totalMatches}`)
    console.log('\n--- Brier Score ---')
    console.log(`Overall:   ${result.brierScore.toFixed(4)} (lower is better, 0.667 = random)`)
    console.log(`Home Win:  ${result.brierScoreHome.toFixed(4)}`)
    console.log(`Draw:      ${result.brierScoreDraw.toFixed(4)}`)
    console.log(`Away Win:  ${result.brierScoreAway.toFixed(4)}`)

    console.log('\n--- Other Metrics ---')
    console.log(`Log Loss:  ${result.logLoss.toFixed(4)} (lower is better)`)
    console.log(`Accuracy:  ${(result.accuracy * 100).toFixed(1)}% (picking highest probability)`)

    console.log('\n--- Calibration (Predicted vs Actual) ---')
    console.log('Bucket      | Predicted | Actual  | Count')
    console.log('------------|-----------|---------|------')
    for (const bucket of result.calibration) {
      if (bucket.count > 0) {
        const predicted = (bucket.predicted * 100).toFixed(1).padStart(6)
        const actual = (bucket.actual * 100).toFixed(1).padStart(6)
        const count = bucket.count.toString().padStart(5)
        console.log(`${bucket.bucket.padEnd(11)} | ${predicted}%  | ${actual}% | ${count}`)
      }
    }

    console.log('\n--- Interpretation ---')
    if (result.brierScore < 0.2) {
      console.log('✓ Excellent prediction accuracy')
    } else if (result.brierScore < 0.25) {
      console.log('✓ Good prediction accuracy')
    } else if (result.brierScore < 0.3) {
      console.log('○ Moderate prediction accuracy - room for improvement')
    } else {
      console.log('✗ Poor prediction accuracy - consider parameter tuning')
    }

    // Check calibration
    const wellCalibrated = result.calibration.filter(
      b => b.count > 10 && Math.abs(b.predicted - b.actual) < 0.1
    )
    const poorlyCalibrated = result.calibration.filter(
      b => b.count > 10 && Math.abs(b.predicted - b.actual) >= 0.1
    )

    if (poorlyCalibrated.length > 0) {
      console.log('\nCalibration issues detected in buckets:')
      for (const bucket of poorlyCalibrated) {
        const diff = bucket.actual - bucket.predicted
        const direction = diff > 0 ? 'underconfident' : 'overconfident'
        console.log(
          `  ${bucket.bucket}: Model is ${direction} by ${(Math.abs(diff) * 100).toFixed(1)}%`
        )
      }
    } else if (wellCalibrated.length > 0) {
      console.log('\n✓ Model appears well-calibrated')
    }
  } catch (error) {
    console.error('Validation failed:', error)
    process.exit(1)
  }
}

main()
