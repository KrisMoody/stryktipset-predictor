import { http, HttpResponse } from 'msw'

// ============================================
// Svenska Spel API Mocks
// ============================================

const svenskaSpelDrawResponse = {
  responses: [
    {
      draw: {
        drawNumber: 2849,
        drawState: 'Open',
        regCloseTime: '2024-12-14T14:59:59.999Z',
        productId: 1,
        netSale: 15000000,
        drawEvents: Array.from({ length: 13 }, (_, i) => ({
          eventNumber: i + 1,
          eventDescription: `Home Team ${i + 1} - Away Team ${i + 1}`,
          match: {
            matchId: 10000 + i,
            matchStart: '2024-12-14T18:00:00Z',
            status: 'Not started',
            participants: [
              { id: i * 2 + 1, name: `Home Team ${i + 1}`, type: 'home' },
              { id: i * 2 + 2, name: `Away Team ${i + 1}`, type: 'away' },
            ],
            league: { id: 1, name: 'Test League', country: { id: 1, name: 'Sweden' } },
          },
          odds: {
            odds: [
              { outcome: '1', odds: 2.1 + i * 0.1 },
              { outcome: 'X', odds: 3.4 },
              { outcome: '2', odds: 3.5 - i * 0.05 },
            ],
          },
          distribution: {
            outcome1: 45 - i,
            outcomeX: 25,
            outcome2: 30 + i,
          },
        })),
      },
    },
  ],
}

// ============================================
// Anthropic Claude API Mocks
// ============================================

const claudePredictionResponse = {
  id: 'msg_test123',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        probabilities: {
          home_win: 0.45,
          draw: 0.3,
          away_win: 0.25,
        },
        reasoning:
          'The home team has shown strong form in recent matches with 4 wins in their last 5 games. Key player statistics favor the home side.',
        key_factors: [
          'Strong home form (4W 1D in last 5)',
          'Key striker returning from injury',
          'Away team missing captain',
          'Historical advantage at this venue',
        ],
        recommended_bet: '1',
        suitable_as_spik: false,
        confidence: 'medium',
      }),
    },
  ],
  model: 'claude-sonnet-4-20250514',
  usage: {
    input_tokens: 1500,
    output_tokens: 500,
  },
}

// ============================================
// MSW Request Handlers
// ============================================

export const handlers = [
  // Svenska Spel API - Get current draws
  http.get('https://api.spela.svenskaspel.se/draw/1/stryktipset/draws', () => {
    return HttpResponse.json(svenskaSpelDrawResponse)
  }),

  // Svenska Spel API - Get specific draw
  http.get(
    'https://api.spela.svenskaspel.se/draw/1/stryktipset/draws/:drawNumber',
    ({ params }) => {
      const response = { ...svenskaSpelDrawResponse }
      const firstResponse = response.responses[0]
      if (firstResponse) {
        firstResponse.draw.drawNumber = parseInt(params.drawNumber as string)
      }
      return HttpResponse.json(response)
    }
  ),

  // Anthropic Claude API
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json(claudePredictionResponse)
  }),

  // ============================================
  // Internal API Mocks
  // ============================================

  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  }),

  // Get current draws
  http.get('/api/draws/current', () => {
    return HttpResponse.json({
      success: true,
      draws: [
        {
          draw_number: 2849,
          status: 'Open',
          close_time: '2024-12-14T14:59:00Z',
          matches: [],
        },
      ],
    })
  }),

  // Get specific draw
  http.get('/api/draws/:drawNumber', ({ params }) => {
    return HttpResponse.json({
      success: true,
      draw: {
        draw_number: parseInt(params.drawNumber as string),
        status: 'Open',
        matches: Array.from({ length: 13 }, (_, i) => ({
          match_number: i + 1,
          home_team: { name: `Home Team ${i + 1}` },
          away_team: { name: `Away Team ${i + 1}` },
          prediction: null,
        })),
      },
    })
  }),

  // Optimize coupon
  http.post('/api/draws/:drawNumber/optimize', async ({ params, request }) => {
    const body = (await request.json()) as { mode?: string; systemId?: string; budget?: number }
    const drawNumber = parseInt(params.drawNumber as string)

    return HttpResponse.json({
      success: true,
      mode: body.mode || 'ai',
      coupon: {
        drawNumber,
        systemId: body.systemId || null,
        selections: Array.from({ length: 13 }, (_, i) => ({
          matchNumber: i + 1,
          homeTeam: `Home Team ${i + 1}`,
          awayTeam: `Away Team ${i + 1}`,
          selection: ['1', 'X', '2'][i % 3],
          is_spik: i < 8,
          expected_value: 5.0 + Math.random() * 2,
          reasoning: 'AI-generated selection based on match analysis',
        })),
        totalRows: body.mode === 'system' ? 9 : 1,
        totalCost: body.mode === 'system' ? 9 : 1,
        expectedValue: 5.2,
      },
    })
  }),

  // Generate prediction for match
  http.post('/api/matches/:matchId/predict', ({ params }) => {
    return HttpResponse.json({
      success: true,
      prediction: {
        match_id: parseInt(params.matchId as string),
        probability_home: 0.45,
        probability_draw: 0.3,
        probability_away: 0.25,
        predicted_outcome: '1',
        confidence: 'medium',
        is_spik_suitable: false,
        reasoning: 'Mock prediction reasoning',
        key_factors: ['Factor 1', 'Factor 2'],
      },
    })
  }),

  // Admin sync
  http.post('/api/admin/sync', () => {
    return HttpResponse.json({
      success: true,
      processedDraws: 1,
      matchesProcessed: 13,
    })
  }),

  // Schedule status
  http.get('/api/schedule/status', () => {
    return HttpResponse.json({
      isInActiveWindow: true,
      currentPhase: 'mid',
      minutesUntilClose: 120,
      nextWindowStart: null,
    })
  }),

  // AI metrics
  http.get('/api/admin/ai-metrics/summary', () => {
    return HttpResponse.json({
      success: true,
      summary: {
        totalCost: 15.5,
        totalTokens: 125000,
        totalRequests: 50,
        avgCostPerRequest: 0.31,
        avgTokensPerRequest: 2500,
      },
    })
  }),
]

// ============================================
// Helper to add custom handlers for specific tests
// ============================================

export const createErrorHandler = (path: string, statusCode: number, message: string) => {
  return http.all(path, () => {
    return HttpResponse.json({ success: false, error: message }, { status: statusCode })
  })
}

export const createDelayedHandler = (
  path: string,
  delayMs: number,
  response: Record<string, unknown>
) => {
  return http.all(path, async () => {
    await new Promise(resolve => setTimeout(resolve, delayMs))
    return HttpResponse.json(response)
  })
}
