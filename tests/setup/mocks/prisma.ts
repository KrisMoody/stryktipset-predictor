import { vi } from 'vitest'
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

// Create a deep mock of PrismaClient
export type MockPrismaClient = DeepMockProxy<PrismaClient>
export const prismaMock: MockPrismaClient = mockDeep<PrismaClient>()

// Mock the prisma module
vi.mock('~/server/utils/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

// Helper to reset the mock between tests
export const resetPrismaMock = () => mockReset(prismaMock)

// ============================================
// Mock Data Factories
// ============================================

export const mockDrawFactory = (overrides: Partial<ReturnType<typeof mockDrawFactory>> = {}) => ({
  id: 1,
  draw_number: 2849,
  draw_date: new Date('2024-12-14'),
  close_time: new Date('2024-12-14T14:59:00Z'),
  status: 'Open' as const,
  net_sale: null,
  product_id: 1,
  raw_data: null,
  is_current: true,
  archived_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
})

export const mockTeamFactory = (overrides: Partial<ReturnType<typeof mockTeamFactory>> = {}) => ({
  id: 1,
  name: 'Test Team',
  short_name: 'TT',
  country_id: 1,
  external_id: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
})

export const mockLeagueFactory = (overrides: Partial<ReturnType<typeof mockLeagueFactory>> = {}) => ({
  id: 1,
  name: 'Test League',
  country_id: 1,
  external_id: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
})

export const mockMatchFactory = (overrides: Partial<ReturnType<typeof mockMatchFactory>> = {}) => ({
  id: 1,
  draw_id: 1,
  match_number: 1,
  match_id: 12345,
  home_team_id: 1,
  away_team_id: 2,
  league_id: 1,
  start_time: new Date('2024-12-14T18:00:00Z'),
  status: 'Not started' as const,
  status_time: null,
  result_home: null,
  result_away: null,
  outcome: null,
  coverage: 1,
  betRadar_id: null,
  kambi_id: null,
  raw_data: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
})

export const mockPredictionFactory = (overrides: Partial<ReturnType<typeof mockPredictionFactory>> = {}) => ({
  id: 1,
  match_id: 1,
  model: 'claude-sonnet-4-20250514',
  model_version: '20250514',
  probability_home: 0.45,
  probability_draw: 0.30,
  probability_away: 0.25,
  predicted_outcome: '1' as const,
  confidence: 'medium' as const,
  is_spik_suitable: false,
  reasoning: 'Test reasoning for this prediction',
  key_factors: ['Factor 1', 'Factor 2', 'Factor 3'],
  similar_matches: null,
  raw_response: null,
  user_context: null,
  is_reevaluation: false,
  created_at: new Date(),
  ...overrides,
})

export const mockMatchOddsFactory = (overrides: Partial<ReturnType<typeof mockMatchOddsFactory>> = {}) => ({
  id: 1,
  match_id: 1,
  source: 'svenska_spel' as const,
  odds_type: 'current' as const,
  home_odds: 2.10,
  draw_odds: 3.40,
  away_odds: 3.50,
  fetched_at: new Date(),
  raw_data: null,
  ...overrides,
})

export const mockMatchScrapedDataFactory = (overrides: Partial<ReturnType<typeof mockMatchScrapedDataFactory>> = {}) => ({
  id: 1,
  match_id: 1,
  data_type: 'xstats' as const,
  source: 'flashscore',
  scraped_at: new Date(),
  data: {
    home: { xG: 1.5, shots: 12, shotsOnTarget: 5 },
    away: { xG: 0.8, shots: 8, shotsOnTarget: 3 },
  },
  scrape_operation_id: null,
  ...overrides,
})

export const mockCouponFactory = (overrides: Partial<ReturnType<typeof mockCouponFactory>> = {}) => ({
  id: 1,
  draw_id: 1,
  system_type: 'R' as const,
  system_id: 'R-4-0-9-12',
  total_rows: 9,
  total_cost: 9,
  selections: [],
  hedge_assignment: null,
  expected_value: 5.2,
  status: 'generated' as const,
  saved_at: null,
  played_at: null,
  analyzed_at: null,
  performance_data: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
})

// ============================================
// Fixture Generators for Multiple Records
// ============================================

export const generateMatches = (drawId: number, count = 13) => {
  return Array.from({ length: count }, (_, i) => mockMatchFactory({
    id: i + 1,
    draw_id: drawId,
    match_number: i + 1,
    match_id: 10000 + i,
    home_team_id: i * 2 + 1,
    away_team_id: i * 2 + 2,
  }))
}

export const generatePredictions = (matches: ReturnType<typeof mockMatchFactory>[]) => {
  return matches.map((match, i) => mockPredictionFactory({
    id: i + 1,
    match_id: match.id,
    probability_home: 0.3 + Math.random() * 0.4,
    probability_draw: 0.2 + Math.random() * 0.2,
    probability_away: 0.2 + Math.random() * 0.3,
    confidence: ['high', 'medium', 'low'][i % 3] as 'high' | 'medium' | 'low',
    is_spik_suitable: i < 6,
  }))
}
