import { prisma } from '~/server/utils/prisma'

/**
 * GET /api/admin/model-performance
 * Returns statistical model performance metrics
 */
export default defineEventHandler(async () => {
  // Get completed matches with calculations
  const matchesWithCalcs = await prisma.matches.findMany({
    where: {
      outcome: { not: null },
      match_calculations: { isNot: null },
    },
    include: {
      match_calculations: true,
    },
  })

  if (matchesWithCalcs.length === 0) {
    return {
      success: true,
      data: {
        totalMatches: 0,
        modelAccuracy: 0,
        brierScore: null,
        valueOpportunities: {
          total: 0,
          correct: 0,
          roi: 0,
        },
        calibration: [],
      },
    }
  }

  // Calculate model accuracy
  let correctPredictions = 0
  let brierScoreSum = 0
  let valueOpportunitiesTotal = 0
  let valueOpportunitiesCorrect = 0

  // Calibration buckets (0-10%, 10-20%, ..., 90-100%)
  const calibrationBuckets: { predicted: number; actual: number; count: number }[] = Array.from(
    { length: 10 },
    () => ({ predicted: 0, actual: 0, count: 0 })
  )

  for (const match of matchesWithCalcs) {
    const calc = match.match_calculations
    if (!calc || !match.outcome) continue

    const outcome = match.outcome as '1' | 'X' | '2'
    const modelProbs = {
      '1': Number(calc.model_prob_home),
      X: Number(calc.model_prob_draw),
      '2': Number(calc.model_prob_away),
    }

    // Find predicted outcome (highest probability)
    const predictedOutcome = (Object.entries(modelProbs) as [string, number][]).reduce((a, b) =>
      a[1] > b[1] ? a : b
    )[0]

    if (predictedOutcome === outcome) {
      correctPredictions++
    }

    // Brier score: sum of (p - actual)^2 for each outcome
    // actual is 1 for the outcome that happened, 0 otherwise
    const brier =
      Math.pow(modelProbs['1'] - (outcome === '1' ? 1 : 0), 2) +
      Math.pow(modelProbs['X'] - (outcome === 'X' ? 1 : 0), 2) +
      Math.pow(modelProbs['2'] - (outcome === '2' ? 1 : 0), 2)
    brierScoreSum += brier

    // Value opportunity tracking
    if (calc.best_value_outcome) {
      valueOpportunitiesTotal++
      if (calc.best_value_outcome === outcome) {
        valueOpportunitiesCorrect++
      }
    }

    // Calibration tracking - bucket based on highest probability
    const highestProb = Math.max(modelProbs['1'], modelProbs['X'], modelProbs['2'])
    const bucketIndex = Math.min(Math.floor(highestProb * 10), 9)
    const bucket = calibrationBuckets[bucketIndex]
    if (bucket) {
      bucket.predicted += highestProb
      bucket.actual += predictedOutcome === outcome ? 1 : 0
      bucket.count++
    }
  }

  // Calculate averages for calibration
  const calibration = calibrationBuckets
    .map((bucket, index) => ({
      range: `${index * 10}-${(index + 1) * 10}%`,
      predicted: bucket.count > 0 ? bucket.predicted / bucket.count : 0,
      actual: bucket.count > 0 ? bucket.actual / bucket.count : 0,
      count: bucket.count,
    }))
    .filter(b => b.count > 0)

  // Calculate value ROI (assuming flat betting 1 unit per value opportunity)
  // Simplified: correct value bets return at fair odds minus margin
  const valueRoi =
    valueOpportunitiesTotal > 0
      ? ((valueOpportunitiesCorrect / valueOpportunitiesTotal - 1) * 100).toFixed(1)
      : 0

  return {
    success: true,
    data: {
      totalMatches: matchesWithCalcs.length,
      modelAccuracy:
        matchesWithCalcs.length > 0 ? (correctPredictions / matchesWithCalcs.length) * 100 : 0,
      brierScore: matchesWithCalcs.length > 0 ? brierScoreSum / matchesWithCalcs.length : null,
      valueOpportunities: {
        total: valueOpportunitiesTotal,
        correct: valueOpportunitiesCorrect,
        hitRate:
          valueOpportunitiesTotal > 0
            ? (valueOpportunitiesCorrect / valueOpportunitiesTotal) * 100
            : 0,
        roi: valueRoi,
      },
      calibration,
    },
  }
})
