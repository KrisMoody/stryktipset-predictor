import { vi } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { DeepMockProxy } from 'vitest-mock-extended'
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

interface MockDraw {
  id: number
  draw_number: number
  draw_date: Date
  close_time: Date
  status: 'Open' | 'Closed'
  net_sale: string | null
  product_id: number
  raw_data: unknown
  is_current: boolean
  archived_at: Date | null
  created_at: Date
  updated_at: Date
}

export const mockDrawFactory = (overrides: Partial<MockDraw> = {}): MockDraw => ({
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

interface MockTeam {
  id: number
  name: string
  short_name: string
  country_id: number
  external_id: string | null
  created_at: Date
  updated_at: Date
}

export const mockTeamFactory = (overrides: Partial<MockTeam> = {}): MockTeam => ({
  id: 1,
  name: 'Test Team',
  short_name: 'TT',
  country_id: 1,
  external_id: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
})

interface MockLeague {
  id: number
  name: string
  country_id: number
  external_id: string | null
  created_at: Date
  updated_at: Date
}

export const mockLeagueFactory = (overrides: Partial<MockLeague> = {}): MockLeague => ({
  id: 1,
  name: 'Test League',
  country_id: 1,
  external_id: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
})

interface MockMatch {
  id: number
  draw_id: number
  match_number: number
  match_id: number
  home_team_id: number
  away_team_id: number
  league_id: number
  start_time: Date
  status: 'Not started' | 'In progress' | 'Finished'
  status_time: string | null
  result_home: number | null
  result_away: number | null
  outcome: string | null
  coverage: number
  betRadar_id: string | null
  kambi_id: string | null
  raw_data: unknown
  created_at: Date
  updated_at: Date
}

export const mockMatchFactory = (overrides: Partial<MockMatch> = {}): MockMatch => ({
  id: 1,
  draw_id: 1,
  match_number: 1,
  match_id: 12345,
  home_team_id: 1,
  away_team_id: 2,
  league_id: 1,
  start_time: new Date('2024-12-14T18:00:00Z'),
  status: 'Not started',
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

interface MockPrediction {
  id: number
  match_id: number
  model: string
  model_version: string
  probability_home: number
  probability_draw: number
  probability_away: number
  predicted_outcome: '1' | 'X' | '2'
  confidence: 'high' | 'medium' | 'low'
  is_spik_suitable: boolean
  reasoning: string
  key_factors: string[]
  similar_matches: unknown
  raw_response: unknown
  user_context: string | null
  is_reevaluation: boolean
  created_at: Date
}

export const mockPredictionFactory = (overrides: Partial<MockPrediction> = {}): MockPrediction => ({
  id: 1,
  match_id: 1,
  model: 'claude-sonnet-4-20250514',
  model_version: '20250514',
  probability_home: 0.45,
  probability_draw: 0.3,
  probability_away: 0.25,
  predicted_outcome: '1',
  confidence: 'medium',
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

interface MockMatchOdds {
  id: number
  match_id: number
  source: 'svenska_spel' | 'betfair'
  odds_type: 'current' | 'opening'
  home_odds: number
  draw_odds: number
  away_odds: number
  fetched_at: Date
  raw_data: unknown
}

export const mockMatchOddsFactory = (overrides: Partial<MockMatchOdds> = {}): MockMatchOdds => ({
  id: 1,
  match_id: 1,
  source: 'svenska_spel',
  odds_type: 'current',
  home_odds: 2.1,
  draw_odds: 3.4,
  away_odds: 3.5,
  fetched_at: new Date(),
  raw_data: null,
  ...overrides,
})

interface MockMatchScrapedData {
  id: number
  match_id: number
  data_type: 'xstats' | 'statistics' | 'headtohead' | 'news'
  source: string
  scraped_at: Date
  data: unknown
  scrape_operation_id: number | null
}

export const mockMatchScrapedDataFactory = (
  overrides: Partial<MockMatchScrapedData> = {}
): MockMatchScrapedData => ({
  id: 1,
  match_id: 1,
  data_type: 'xstats',
  source: 'flashscore',
  scraped_at: new Date(),
  data: {
    home: { xG: 1.5, shots: 12, shotsOnTarget: 5 },
    away: { xG: 0.8, shots: 8, shotsOnTarget: 3 },
  },
  scrape_operation_id: null,
  ...overrides,
})

interface MockCoupon {
  id: number
  draw_id: number
  system_type: 'R' | 'U' | 'M'
  system_id: string
  total_rows: number
  total_cost: number
  selections: unknown[]
  hedge_assignment: unknown
  expected_value: number
  status: 'generated' | 'saved' | 'played'
  saved_at: Date | null
  played_at: Date | null
  analyzed_at: Date | null
  performance_data: unknown
  created_at: Date
  updated_at: Date
}

export const mockCouponFactory = (overrides: Partial<MockCoupon> = {}): MockCoupon => ({
  id: 1,
  draw_id: 1,
  system_type: 'R',
  system_id: 'R-4-0-9-12',
  total_rows: 9,
  total_cost: 9,
  selections: [],
  hedge_assignment: null,
  expected_value: 5.2,
  status: 'generated',
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
  return Array.from({ length: count }, (_, i) =>
    mockMatchFactory({
      id: i + 1,
      draw_id: drawId,
      match_number: i + 1,
      match_id: 10000 + i,
      home_team_id: i * 2 + 1,
      away_team_id: i * 2 + 2,
    })
  )
}

export const generatePredictions = (matches: ReturnType<typeof mockMatchFactory>[]) => {
  return matches.map((match, i) =>
    mockPredictionFactory({
      id: i + 1,
      match_id: match.id,
      probability_home: 0.3 + Math.random() * 0.4,
      probability_draw: 0.2 + Math.random() * 0.2,
      probability_away: 0.2 + Math.random() * 0.3,
      confidence: ['high', 'medium', 'low'][i % 3] as 'high' | 'medium' | 'low',
      is_spik_suitable: i < 6,
    })
  )
}
