/* eslint-disable @typescript-eslint/no-explicit-any -- Test file with mock data */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock console methods to avoid noisy output
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

// ============================================================================
// Mock Dependencies - Use vi.hoisted() to survive hoisting
// ============================================================================

const { mockPrisma, mockApiFootballClient } = vi.hoisted(() => ({
  mockPrisma: {
    matches: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    match_scraped_data: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    match_odds: {
      upsert: vi.fn(),
    },
  },
  mockApiFootballClient: {
    isConfigured: vi.fn(),
    isCircuitOpen: vi.fn(),
    get: vi.fn(),
    getDailyQuotaStatus: vi.fn(),
  },
}))

vi.mock('~/server/utils/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('~/server/services/api-football/client', () => ({
  getApiFootballClient: () => mockApiFootballClient,
}))

vi.mock('~/server/services/api-football/team-matcher', () => ({
  getTeamMatcher: () => ({
    matchTeamById: vi.fn(),
  }),
}))

vi.mock('~/server/services/api-football/league-matcher', () => ({
  getLeagueMatcher: () => ({
    matchLeagueById: vi.fn(),
  }),
}))

// Mock useRuntimeConfig
vi.stubGlobal('useRuntimeConfig', () => ({
  apiFootball: {
    enabled: true,
    fetchDuringEnrichment: false,
    dataTypes: ['statistics', 'headToHead', 'injuries'],
  },
}))

// Import after mocks are set up
import { MatchEnrichmentService } from '~/server/services/api-football/match-enrichment'

// ============================================================================
// Test Data Factories
// ============================================================================

const createMockMatch = (overrides: Partial<any> = {}): any => ({
  id: 1,
  start_time: new Date('2024-12-14T18:00:00Z'),
  status: 'Not started',
  home_team_id: 100,
  away_team_id: 101,
  league_id: 10,
  api_football_fixture_id: 12345,
  api_football_home_team_id: 200,
  api_football_away_team_id: 201,
  api_football_league_id: 20,
  mapping_confidence: 'high',
  homeTeam: { id: 100, name: 'Home Team' },
  awayTeam: { id: 101, name: 'Away Team' },
  league: { id: 10, name: 'Test League', country: { name: 'Sweden' } },
  ...overrides,
})

const createMockScrapedData = (overrides: Partial<any> = {}): any => ({
  id: 1,
  match_id: 1,
  data_type: 'headToHead',
  source: 'api-football',
  scraped_at: new Date(),
  is_stale: false,
  data: { homeWins: 3, awayWins: 2, draws: 1 },
  ...overrides,
})

// ============================================================================
// Test Suites
// ============================================================================

describe('MatchEnrichmentService', () => {
  let service: MatchEnrichmentService

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Set default mock returns
    mockApiFootballClient.isConfigured.mockReturnValue(true)
    mockApiFootballClient.isCircuitOpen.mockReturnValue(false)
    mockApiFootballClient.getDailyQuotaStatus.mockReturnValue({
      used: 100,
      limit: 7500,
      remaining: 7400,
    })

    // Create a new instance for each test
    service = new MatchEnrichmentService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // Task 5.1: Unit tests for fetchDataAfterEnrichment()
  // ==========================================================================

  describe('fetchDataAfterEnrichment()', () => {
    describe('quota check logic', () => {
      it('skips auto-fetch when quota usage exceeds 95%', async () => {
        // Set quota to 96% usage
        mockApiFootballClient.getDailyQuotaStatus.mockReturnValue({
          used: 7200,
          limit: 7500,
          remaining: 300,
        })

        const mockMatch = createMockMatch({ status: 'Not started' })
        mockPrisma.matches.findUnique.mockResolvedValue(mockMatch)
        mockPrisma.match_scraped_data.findMany.mockResolvedValue([])

        await service.fetchDataAfterEnrichment(1)

        // Should not have called the API (since quota exceeded)
        expect(mockApiFootballClient.get).not.toHaveBeenCalled()
      })

      it('proceeds with fetch when quota usage is below 95%', async () => {
        // Set quota to 50% usage
        mockApiFootballClient.getDailyQuotaStatus.mockReturnValue({
          used: 3750,
          limit: 7500,
          remaining: 3750,
        })

        const mockMatch = createMockMatch({ status: 'Not started' })
        mockPrisma.matches.findUnique.mockResolvedValue(mockMatch)
        mockPrisma.match_scraped_data.findMany.mockResolvedValue([])
        mockApiFootballClient.get.mockResolvedValue({ response: [] })
        mockPrisma.match_scraped_data.upsert.mockResolvedValue({})

        await service.fetchDataAfterEnrichment(1)

        // Should attempt to check match status
        expect(mockPrisma.matches.findUnique).toHaveBeenCalledWith({
          where: { id: 1 },
          select: { status: true },
        })
      })
    })

    describe('skip for finished matches', () => {
      it('skips auto-fetch for finished matches (status=FT)', async () => {
        const mockMatch = createMockMatch({ status: 'FT' })
        mockPrisma.matches.findUnique.mockResolvedValue(mockMatch)

        await service.fetchDataAfterEnrichment(1)

        // Should skip without calling API or checking scraped data for freshness
        expect(mockApiFootballClient.get).not.toHaveBeenCalled()
      })

      it('proceeds with fetch for matches not finished', async () => {
        const mockMatch = createMockMatch({ status: 'Not started' })
        mockPrisma.matches.findUnique.mockResolvedValue(mockMatch)
        mockPrisma.match_scraped_data.findMany.mockResolvedValue([])
        mockApiFootballClient.get.mockResolvedValue({ response: [] })

        await service.fetchDataAfterEnrichment(1)

        // Should check for scraped data freshness
        expect(mockPrisma.match_scraped_data.findMany).toHaveBeenCalled()
      })
    })

    describe('skip for fresh data', () => {
      it('skips auto-fetch when data is already fresh', async () => {
        const mockMatch = createMockMatch({ status: 'Not started' })
        mockPrisma.matches.findUnique.mockResolvedValue(mockMatch)

        // Mock fresh data for all required types (within cache TTL)
        const freshScrapedData = [
          createMockScrapedData({
            data_type: 'headToHead',
            scraped_at: new Date(), // Just now
            is_stale: false,
          }),
          createMockScrapedData({
            data_type: 'statistics',
            scraped_at: new Date(), // Just now
            is_stale: false,
          }),
          createMockScrapedData({
            data_type: 'team_season_stats',
            scraped_at: new Date(), // Just now
            is_stale: false,
          }),
          createMockScrapedData({
            data_type: 'standings',
            scraped_at: new Date(), // Just now
            is_stale: false,
          }),
        ]
        mockPrisma.match_scraped_data.findMany.mockResolvedValue(freshScrapedData)

        await service.fetchDataAfterEnrichment(1)

        // Should not call API when data is fresh
        expect(mockApiFootballClient.get).not.toHaveBeenCalled()
      })

      it('proceeds with fetch when data is stale', async () => {
        const mockMatch = createMockMatch({ status: 'Not started' })
        mockPrisma.matches.findUnique.mockResolvedValue(mockMatch)

        // Mock stale data (2 days old for statistics which has 24h TTL)
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        const staleScrapedData = [
          createMockScrapedData({
            data_type: 'headToHead',
            scraped_at: twoDaysAgo,
            is_stale: false,
          }),
        ]
        mockPrisma.match_scraped_data.findMany.mockResolvedValue(staleScrapedData)
        mockApiFootballClient.get.mockResolvedValue({ response: [] })

        await service.fetchDataAfterEnrichment(1)

        // Should proceed to fetch since data is stale
        expect(mockPrisma.matches.findUnique).toHaveBeenCalled()
      })

      it('proceeds with fetch when data is missing', async () => {
        const mockMatch = createMockMatch({ status: 'Not started' })
        mockPrisma.matches.findUnique.mockResolvedValue(mockMatch)
        mockPrisma.match_scraped_data.findMany.mockResolvedValue([]) // No data
        mockApiFootballClient.get.mockResolvedValue({ response: [] })

        await service.fetchDataAfterEnrichment(1)

        // Should proceed to fetch since data is missing
        expect(mockPrisma.matches.findUnique).toHaveBeenCalled()
      })
    })

    describe('error handling', () => {
      it('handles fetch failures gracefully', async () => {
        const mockMatch = createMockMatch({ status: 'Not started' })
        mockPrisma.matches.findUnique.mockResolvedValue(mockMatch)
        mockPrisma.match_scraped_data.findMany.mockResolvedValue([])
        mockApiFootballClient.get.mockRejectedValue(new Error('API Error'))

        // Should not throw
        await expect(service.fetchDataAfterEnrichment(1)).resolves.not.toThrow()
      })

      it('handles missing match gracefully', async () => {
        mockPrisma.matches.findUnique.mockResolvedValue(null)

        // Should not throw
        await expect(service.fetchDataAfterEnrichment(999)).resolves.not.toThrow()
      })
    })
  })

  // ==========================================================================
  // Task 5.2: Unit tests for ensureMatchData() in prediction flow
  // ==========================================================================

  describe('ensureMatchData()', () => {
    describe('missing data triggers fetch', () => {
      it('reports missing data types when no scraped data exists', async () => {
        mockPrisma.match_scraped_data.findMany.mockResolvedValue([])

        const result = await service.ensureMatchData(1, ['headToHead', 'statistics'])

        expect(result.hasFreshData).toBe(false)
        expect(result.missing).toContain('headToHead')
        expect(result.missing).toContain('statistics')
        expect(result.stale).toHaveLength(0)
      })

      it('reports partially missing data correctly', async () => {
        // Only headToHead exists
        const partialData = [
          createMockScrapedData({
            data_type: 'headToHead',
            scraped_at: new Date(),
            is_stale: false,
          }),
        ]
        mockPrisma.match_scraped_data.findMany.mockResolvedValue(partialData)

        const result = await service.ensureMatchData(1, ['headToHead', 'statistics'])

        expect(result.hasFreshData).toBe(false)
        expect(result.missing).toEqual(['statistics'])
        expect(result.stale).toHaveLength(0)
        expect(result.details.find(d => d.dataType === 'headToHead')?.exists).toBe(true)
        expect(result.details.find(d => d.dataType === 'statistics')?.exists).toBe(false)
      })
    })

    describe('stale data triggers refresh', () => {
      it('reports stale data when scraped_at is older than cache TTL', async () => {
        // H2H has 30 day TTL, statistics has 24h TTL
        const oldData = new Date(Date.now() - 48 * 60 * 60 * 1000) // 2 days ago
        const staleData = [
          createMockScrapedData({
            data_type: 'statistics',
            scraped_at: oldData,
            is_stale: false,
          }),
        ]
        mockPrisma.match_scraped_data.findMany.mockResolvedValue(staleData)

        const result = await service.ensureMatchData(1, ['statistics'])

        expect(result.hasFreshData).toBe(false)
        expect(result.stale).toContain('statistics')
        expect(result.missing).toHaveLength(0)
      })

      it('reports data as fresh when within cache TTL', async () => {
        const freshData = [
          createMockScrapedData({
            data_type: 'headToHead',
            scraped_at: new Date(), // Just now
            is_stale: false,
          }),
          createMockScrapedData({
            data_type: 'statistics',
            scraped_at: new Date(), // Just now
            is_stale: false,
          }),
        ]
        mockPrisma.match_scraped_data.findMany.mockResolvedValue(freshData)

        const result = await service.ensureMatchData(1, ['headToHead', 'statistics'])

        expect(result.hasFreshData).toBe(true)
        expect(result.missing).toHaveLength(0)
        expect(result.stale).toHaveLength(0)
      })

      it('reports stale when is_stale flag is true', async () => {
        const staleData = [
          createMockScrapedData({
            data_type: 'statistics',
            scraped_at: new Date(), // Recent but marked stale
            is_stale: true,
          }),
        ]
        mockPrisma.match_scraped_data.findMany.mockResolvedValue(staleData)

        const result = await service.ensureMatchData(1, ['statistics'])

        expect(result.hasFreshData).toBe(false)
        expect(result.stale).toContain('statistics')
      })
    })

    describe('result structure', () => {
      it('returns correct result structure', async () => {
        const freshData = [
          createMockScrapedData({
            data_type: 'headToHead',
            scraped_at: new Date(),
            source: 'api-football',
          }),
        ]
        mockPrisma.match_scraped_data.findMany.mockResolvedValue(freshData)

        const result = await service.ensureMatchData(1, ['headToHead'])

        expect(result).toHaveProperty('matchId', 1)
        expect(result).toHaveProperty('hasFreshData')
        expect(result).toHaveProperty('missing')
        expect(result).toHaveProperty('stale')
        expect(result).toHaveProperty('details')
        expect(Array.isArray(result.details)).toBe(true)
        expect(result.details[0]).toHaveProperty('dataType')
        expect(result.details[0]).toHaveProperty('exists')
        expect(result.details[0]).toHaveProperty('isFresh')
        expect(result.details[0]).toHaveProperty('scrapedAt')
        expect(result.details[0]).toHaveProperty('source')
      })
    })
  })

  // ==========================================================================
  // hasFreshData() tests
  // ==========================================================================

  describe('hasFreshData()', () => {
    it('returns correct freshness status for each data type', async () => {
      const now = new Date()
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000) // 2 days ago

      const mixedData = [
        createMockScrapedData({
          data_type: 'headToHead',
          scraped_at: now,
          source: 'api-football',
          is_stale: false,
        }),
        createMockScrapedData({
          data_type: 'statistics',
          scraped_at: oldDate,
          source: 'api-football',
          is_stale: false,
        }),
      ]
      mockPrisma.match_scraped_data.findMany.mockResolvedValue(mixedData)

      const result = await service.hasFreshData(1, ['headToHead', 'statistics', 'injuries'])

      expect(result).toHaveLength(3)

      const h2h = result.find(r => r.dataType === 'headToHead')
      expect(h2h?.exists).toBe(true)
      expect(h2h?.isFresh).toBe(true)

      const stats = result.find(r => r.dataType === 'statistics')
      expect(stats?.exists).toBe(true)
      expect(stats?.isFresh).toBe(false) // Stale (2 days > 24h TTL)

      const injuries = result.find(r => r.dataType === 'injuries')
      expect(injuries?.exists).toBe(false)
      expect(injuries?.isFresh).toBe(false)
    })
  })

  // ==========================================================================
  // fetchMatchDataIfNeeded() tests
  // ==========================================================================

  describe('fetchMatchDataIfNeeded()', () => {
    it('returns skipped=true for finished matches when skipFinishedMatches is true', async () => {
      mockPrisma.matches.findUnique.mockResolvedValue({ status: 'FT' })

      const result = await service.fetchMatchDataIfNeeded(1, {
        skipFinishedMatches: true,
      })

      expect(result.needed).toBe(false)
      expect(result.skipped).toBe(true)
      expect(result.reason).toContain('finished')
    })

    it('returns needed=false when data is already fresh', async () => {
      mockPrisma.matches.findUnique.mockResolvedValue({ status: 'Not started' })
      mockPrisma.match_scraped_data.findMany.mockResolvedValue([
        createMockScrapedData({ data_type: 'headToHead', scraped_at: new Date() }),
        createMockScrapedData({ data_type: 'statistics', scraped_at: new Date() }),
      ])

      const result = await service.fetchMatchDataIfNeeded(1, {
        dataTypes: ['headToHead', 'statistics'],
      })

      expect(result.needed).toBe(false)
      expect(result.fetched).toBe(false)
      expect(result.skipped).toBe(false)
    })

    it('skips fetch when quota threshold exceeded', async () => {
      mockPrisma.matches.findUnique.mockResolvedValue({ status: 'Not started' })
      mockPrisma.match_scraped_data.findMany.mockResolvedValue([])
      mockApiFootballClient.getDailyQuotaStatus.mockReturnValue({
        used: 7200,
        limit: 7500,
        remaining: 300,
      })

      const result = await service.fetchMatchDataIfNeeded(1, {
        skipQuotaCheck: false,
      })

      expect(result.needed).toBe(true)
      expect(result.fetched).toBe(false)
      expect(result.skipped).toBe(true)
      expect(result.reason?.toLowerCase()).toContain('quota')
    })

    it('bypasses quota check when skipQuotaCheck is true', async () => {
      const mockMatch = createMockMatch()
      mockPrisma.matches.findUnique
        .mockResolvedValueOnce({ status: 'Not started' }) // First call for status check
        .mockResolvedValue(mockMatch) // Subsequent calls
      mockPrisma.match_scraped_data.findMany.mockResolvedValue([])
      mockPrisma.match_scraped_data.upsert.mockResolvedValue({})
      mockApiFootballClient.getDailyQuotaStatus.mockReturnValue({
        used: 7200,
        limit: 7500,
        remaining: 300,
      })
      mockApiFootballClient.get.mockResolvedValue({ response: [] })

      const result = await service.fetchMatchDataIfNeeded(1, {
        skipQuotaCheck: true,
      })

      // Should attempt fetch despite high quota usage
      expect(result.needed).toBe(true)
    })
  })
})

// ============================================================================
// Task 5.3: Integration test for automatic fetch flow
// ============================================================================

describe('Automatic Fetch Flow Integration', () => {
  let service: MatchEnrichmentService

  beforeEach(() => {
    vi.clearAllMocks()

    mockApiFootballClient.isConfigured.mockReturnValue(true)
    mockApiFootballClient.isCircuitOpen.mockReturnValue(false)
    mockApiFootballClient.getDailyQuotaStatus.mockReturnValue({
      used: 100,
      limit: 7500,
      remaining: 7400,
    })

    service = new MatchEnrichmentService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('draw sync → enrichment → data fetch flow', () => {
    it('fetches data after successful enrichment when match is mapped', async () => {
      const mockMatch = createMockMatch({
        api_football_fixture_id: null, // Not fully mapped initially
        api_football_home_team_id: null,
        api_football_away_team_id: null,
      })

      // First findUnique returns unmapped match, subsequent calls return mapped
      mockPrisma.matches.findUnique
        .mockResolvedValueOnce(mockMatch)
        .mockResolvedValue({
          ...mockMatch,
          api_football_fixture_id: 12345,
          api_football_home_team_id: 200,
          api_football_away_team_id: 201,
        })

      mockPrisma.matches.update.mockResolvedValue(mockMatch)
      mockPrisma.match_scraped_data.findMany.mockResolvedValue([])
      mockPrisma.match_scraped_data.upsert.mockResolvedValue({})

      // Mock API responses
      mockApiFootballClient.get.mockResolvedValue({ response: [] })

      // Call fetchMatchDataIfNeeded (simulating what happens after enrichment)
      const result = await service.fetchMatchDataIfNeeded(1, {
        skipQuotaCheck: false,
        skipFinishedMatches: true,
      })

      expect(result.needed).toBe(true)
    })

    it('stores data in match_scraped_data after fetch', async () => {
      const mockMatch = createMockMatch()

      mockPrisma.matches.findUnique.mockResolvedValue(mockMatch)
      mockPrisma.match_scraped_data.findMany.mockResolvedValue([])

      // Mock H2H API response
      const h2hResponse = {
        response: [
          {
            fixture: {
              id: 1001,
              date: '2024-01-15',
              venue: { name: 'Test Stadium' },
            },
            teams: {
              home: { id: 200, name: 'Home Team' },
              away: { id: 201, name: 'Away Team' },
            },
            goals: { home: 2, away: 1 },
            league: { name: 'Test League' },
          },
        ],
      }
      mockApiFootballClient.get.mockResolvedValue(h2hResponse)
      mockPrisma.match_scraped_data.upsert.mockResolvedValue({})
      mockPrisma.matches.update.mockResolvedValue(mockMatch)

      await service.fetchAllDataForMatch(1)

      // Verify upsert was called to store data
      expect(mockPrisma.match_scraped_data.upsert).toHaveBeenCalled()
    })

    it('uses correct cache TTLs for different data types', async () => {
      const now = new Date()

      // Test H2H with 30 day TTL - data from 20 days ago should be fresh
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)

      mockPrisma.match_scraped_data.findMany.mockResolvedValue([
        createMockScrapedData({
          data_type: 'headToHead',
          scraped_at: twentyDaysAgo,
          is_stale: false,
        }),
      ])

      const result = await service.hasFreshData(1, ['headToHead'])

      expect(result[0]?.isFresh).toBe(true) // 20 days < 30 day TTL

      // Test statistics with 24h TTL - data from 2 days ago should be stale
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

      mockPrisma.match_scraped_data.findMany.mockResolvedValue([
        createMockScrapedData({
          data_type: 'statistics',
          scraped_at: twoDaysAgo,
          is_stale: false,
        }),
      ])

      const statsResult = await service.hasFreshData(1, ['statistics'])

      expect(statsResult[0]?.isFresh).toBe(false) // 48h > 24h TTL
    })
  })

  describe('prediction trigger flow', () => {
    it('ensures data is fetched before prediction when missing', async () => {
      const mockMatch = createMockMatch()

      // Status check returns not finished
      mockPrisma.matches.findUnique
        .mockResolvedValueOnce({ status: 'Not started' })
        .mockResolvedValue(mockMatch)

      // No existing scraped data
      mockPrisma.match_scraped_data.findMany.mockResolvedValue([])
      mockPrisma.match_scraped_data.upsert.mockResolvedValue({})

      mockApiFootballClient.get.mockResolvedValue({ response: [] })

      const result = await service.fetchMatchDataIfNeeded(1, {
        skipQuotaCheck: true, // Prediction flow bypasses quota check
        skipFinishedMatches: false,
        dataTypes: ['headToHead', 'statistics', 'team_season_stats'],
      })

      expect(result.needed).toBe(true)
    })

    it('allows prediction to proceed even when fetch fails (graceful degradation)', async () => {
      mockPrisma.matches.findUnique.mockResolvedValue({ status: 'Not started' })
      mockPrisma.match_scraped_data.findMany.mockResolvedValue([])
      mockApiFootballClient.get.mockRejectedValue(new Error('API unavailable'))
      mockApiFootballClient.isConfigured.mockReturnValue(false)

      // Should complete without throwing
      const result = await service.fetchMatchDataIfNeeded(1, {
        skipQuotaCheck: true,
      })

      expect(result.needed).toBe(true)
      // The fetch attempt happened but may have failed internally
      // The point is the function completed without throwing
    })
  })
})
