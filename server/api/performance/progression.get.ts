import { prisma } from '~/server/utils/prisma'

/**
 * Weekly progression data point
 */
interface WeeklyDataPoint {
  week: string
  weekStart: string
  accuracy: number
  brierScore: number | null
  sampleCount: number
  correctCount: number
}

/**
 * Period comparison data
 */
interface PeriodComparison {
  current: {
    accuracy: number
    brierScore: number | null
    sampleCount: number
  }
  previous: {
    accuracy: number
    brierScore: number | null
    sampleCount: number
  }
  trend: 'improving' | 'declining' | 'stable'
}

/**
 * Progression response data
 */
interface ProgressionData {
  weekly: WeeklyDataPoint[]
  rollingAverage: number | null
  periodComparison: PeriodComparison
}

/**
 * GET /api/performance/progression
 * Returns time-series progression data for prediction accuracy
 *
 * Query params:
 * - gameType: Filter by game type (stryktipset, europatipset, topptipset)
 */
export default defineEventHandler(async event => {
  try {
    const query = getQuery(event)
    const gameType = query.gameType as string | undefined

    // Build the weekly aggregation query
    const weeklyData = await getWeeklyProgression(gameType)
    const rollingAverage = await getRollingAverage(30, gameType)
    const periodComparison = await getPeriodComparison(gameType)

    return {
      success: true,
      data: {
        weekly: weeklyData,
        rollingAverage,
        periodComparison,
      } as ProgressionData,
    }
  } catch (error) {
    console.error('[Progression API] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

/**
 * Get weekly aggregated prediction performance
 */
async function getWeeklyProgression(gameType?: string): Promise<WeeklyDataPoint[]> {
  // Join prediction_performance with predictions and matches to get weekly stats
  const whereClause = gameType ? `AND d.game_type = '${gameType}'` : ''

  const result = await prisma.$queryRawUnsafe<
    {
      week: string
      week_start: Date
      total_count: bigint
      correct_count: bigint
      avg_prob_score: number | null
    }[]
  >(`
    SELECT
      TO_CHAR(DATE_TRUNC('week', pp.created_at), 'IYYY-IW') as week,
      DATE_TRUNC('week', pp.created_at) as week_start,
      COUNT(*)::bigint as total_count,
      SUM(CASE WHEN pp.correctly_predicted THEN 1 ELSE 0 END)::bigint as correct_count,
      AVG(pp.probability_score::numeric) as avg_prob_score
    FROM prediction_performance pp
    JOIN predictions p ON pp.prediction_id = p.id
    JOIN matches m ON p.match_id = m.id
    JOIN draws d ON m.draw_id = d.id
    WHERE pp.created_at >= NOW() - INTERVAL '12 weeks'
    ${whereClause}
    GROUP BY DATE_TRUNC('week', pp.created_at)
    ORDER BY week_start ASC
  `)

  return result.map(row => {
    const totalCount = Number(row.total_count)
    const correctCount = Number(row.correct_count)
    const avgProbScore = row.avg_prob_score ? Number(row.avg_prob_score) : null

    // Calculate Brier score from probability scores
    // Brier = 1 - avgProbScore approximation (simplified)
    // For actual Brier, we'd need full probability distributions
    const brierScore = avgProbScore !== null ? 1 - avgProbScore : null

    const isoString = row.week_start.toISOString()
    const weekStart = isoString.split('T')[0] ?? isoString.slice(0, 10)

    return {
      week: row.week,
      weekStart,
      accuracy: totalCount > 0 ? (correctCount / totalCount) * 100 : 0,
      brierScore,
      sampleCount: totalCount,
      correctCount,
    }
  })
}

/**
 * Get rolling average accuracy for the last N days
 */
async function getRollingAverage(days: number, gameType?: string): Promise<number | null> {
  const whereClause = gameType ? `AND d.game_type = '${gameType}'` : ''

  const result = await prisma.$queryRawUnsafe<{ total_count: bigint; correct_count: bigint }[]>(`
    SELECT
      COUNT(*)::bigint as total_count,
      SUM(CASE WHEN pp.correctly_predicted THEN 1 ELSE 0 END)::bigint as correct_count
    FROM prediction_performance pp
    JOIN predictions p ON pp.prediction_id = p.id
    JOIN matches m ON p.match_id = m.id
    JOIN draws d ON m.draw_id = d.id
    WHERE pp.created_at >= NOW() - INTERVAL '${days} days'
    ${whereClause}
  `)

  const row = result[0]
  if (!row) return null

  const totalCount = Number(row.total_count)
  const correctCount = Number(row.correct_count)

  if (totalCount === 0) return null

  return (correctCount / totalCount) * 100
}

/**
 * Get period comparison (current 30 days vs previous 30 days)
 */
async function getPeriodComparison(gameType?: string): Promise<PeriodComparison> {
  const whereClause = gameType ? `AND d.game_type = '${gameType}'` : ''

  // Current period (last 30 days)
  const currentResult = await prisma.$queryRawUnsafe<
    { total_count: bigint; correct_count: bigint; avg_prob_score: number | null }[]
  >(`
    SELECT
      COUNT(*)::bigint as total_count,
      SUM(CASE WHEN pp.correctly_predicted THEN 1 ELSE 0 END)::bigint as correct_count,
      AVG(pp.probability_score::numeric) as avg_prob_score
    FROM prediction_performance pp
    JOIN predictions p ON pp.prediction_id = p.id
    JOIN matches m ON p.match_id = m.id
    JOIN draws d ON m.draw_id = d.id
    WHERE pp.created_at >= NOW() - INTERVAL '30 days'
    ${whereClause}
  `)

  // Previous period (31-60 days ago)
  const previousResult = await prisma.$queryRawUnsafe<
    { total_count: bigint; correct_count: bigint; avg_prob_score: number | null }[]
  >(`
    SELECT
      COUNT(*)::bigint as total_count,
      SUM(CASE WHEN pp.correctly_predicted THEN 1 ELSE 0 END)::bigint as correct_count,
      AVG(pp.probability_score::numeric) as avg_prob_score
    FROM prediction_performance pp
    JOIN predictions p ON pp.prediction_id = p.id
    JOIN matches m ON p.match_id = m.id
    JOIN draws d ON m.draw_id = d.id
    WHERE pp.created_at >= NOW() - INTERVAL '60 days'
      AND pp.created_at < NOW() - INTERVAL '30 days'
    ${whereClause}
  `)

  const formatPeriod = (
    result: { total_count: bigint; correct_count: bigint; avg_prob_score: number | null }[]
  ) => {
    const row = result[0]
    if (!row) {
      return { accuracy: 0, brierScore: null, sampleCount: 0 }
    }

    const totalCount = Number(row.total_count)
    const correctCount = Number(row.correct_count)
    const avgProbScore = row.avg_prob_score ? Number(row.avg_prob_score) : null

    return {
      accuracy: totalCount > 0 ? (correctCount / totalCount) * 100 : 0,
      brierScore: avgProbScore !== null ? 1 - avgProbScore : null,
      sampleCount: totalCount,
    }
  }

  const current = formatPeriod(currentResult)
  const previous = formatPeriod(previousResult)

  // Determine trend
  let trend: 'improving' | 'declining' | 'stable' = 'stable'
  if (current.sampleCount >= 5 && previous.sampleCount >= 5) {
    const diff = current.accuracy - previous.accuracy
    if (diff > 2) {
      trend = 'improving'
    } else if (diff < -2) {
      trend = 'declining'
    }
  }

  return {
    current,
    previous,
    trend,
  }
}
