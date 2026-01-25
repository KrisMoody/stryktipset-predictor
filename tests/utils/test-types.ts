/**
 * Shared type utilities for test files
 *
 * These utilities provide type-safe alternatives to `any` for common test patterns.
 */

import type { Mock } from 'vitest'

// ============================================================================
// Mock Prisma Types
// ============================================================================

/**
 * Generic mock function type that preserves return type
 */
export type MockFn<T = unknown> = Mock<(...args: unknown[]) => T>

/**
 * Mock Prisma client for testing
 * Uses Record<string, MockFn> for table methods
 */
export interface MockPrismaClient {
  draws: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
    count: MockFn
  }
  matches: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
    count: MockFn
  }
  teams: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
  }
  leagues: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
  }
  countries: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
  }
  match_odds: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
  }
  match_scraped_data: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
  }
  predictions: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
  }
  team_ratings: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
  }
  match_calculations: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
  }
  scrape_operations: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
  }
  ai_usage: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
    aggregate: MockFn
    groupBy: MockFn
  }
  failed_games: {
    findMany: MockFn
    findUnique: MockFn
    findFirst: MockFn
    create: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
  }
  $transaction: MockFn
}

// ============================================================================
// Test Data Factory Types
// ============================================================================

/**
 * Type for partial override functions
 * Use this instead of Partial<any>
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Mock draw data matching DrawData interface
 */
export interface MockDrawData {
  drawNumber: number
  drawState: string
  regCloseTime: string
  drawDate?: string
  productId?: string
  productName?: string
  currentNetSale?: string
  drawEvents: MockDrawEventData[]
}

/**
 * Mock draw event data
 */
export interface MockDrawEventData {
  eventNumber: number
  match: {
    matchId: number
    matchStart: string
    status: string
    participants: Array<{
      id: number
      name: string
      type: string
      shortName?: string
    }>
    league: {
      id: number
      name: string
      country?: { id: number; name: string; isoCode?: string }
    }
    result?: Array<{ home: number; away: number; type?: string }>
  }
  odds?: { one: string; x: string; two: string }
  svenskaFolket?: { one: string; x: string; two: string }
}

/**
 * Mock match database record
 */
export interface MockMatchRecord {
  id: number
  draw_id: number
  match_number: number
  match_id: number
  home_team_id: number
  away_team_id: number
  league_id: number
  start_time: Date
  status: string
  result_home: number | null
  result_away: number | null
  outcome: string | null
}

/**
 * Mock team database record
 */
export interface MockTeamRecord {
  id: number
  name: string
  short_name: string | null
  medium_name: string | null
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create mock draw data with optional overrides
 */
export function createMockDraw(overrides: Partial<MockDrawData> = {}): MockDrawData {
  const base: MockDrawData = {
    drawNumber: 1,
    drawState: 'Open',
    regCloseTime: '2024-12-15T12:00:00.000Z',
    drawDate: '2024-12-15',
    productId: 'STRYKTIPSET',
    currentNetSale: '1,000,000',
    drawEvents: [],
  }
  return { ...base, ...overrides }
}

/**
 * Create mock match event with optional overrides
 */
export function createMockMatchEvent(
  overrides: Partial<MockDrawEventData> = {}
): MockDrawEventData {
  const base: MockDrawEventData = {
    eventNumber: 1,
    match: {
      matchId: 12345,
      matchStart: '2024-12-15T15:00:00.000Z',
      status: 'upcoming',
      participants: [
        { id: 100, name: 'Home Team', type: 'home' },
        { id: 200, name: 'Away Team', type: 'away' },
      ],
      league: {
        id: 10,
        name: 'Premier League',
        country: { id: 1, name: 'England', isoCode: 'GB' },
      },
      result: [],
    },
    odds: { one: '2,00', x: '3,50', two: '3,00' },
  }
  return { ...base, ...overrides }
}

/**
 * Create mock match record with optional overrides
 */
export function createMockMatchRecord(overrides: Partial<MockMatchRecord> = {}): MockMatchRecord {
  return {
    id: 1,
    draw_id: 1,
    match_number: 1,
    match_id: 12345,
    home_team_id: 100,
    away_team_id: 200,
    league_id: 10,
    start_time: new Date('2024-12-15T15:00:00.000Z'),
    status: 'upcoming',
    result_home: null,
    result_away: null,
    outcome: null,
    ...overrides,
  }
}
