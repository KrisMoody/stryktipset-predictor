import { describe, it, expect, beforeEach } from 'vitest'
import { HedgeAssignmentService } from '~/server/services/hedge-assignment-service'
import type { CouponSelection, BettingSystem, HedgeAssignment } from '~/types'
import bettingSystems from '~/server/constants/betting-systems.json'

// Helper function to create mock selections
function createSelection(
  matchNumber: number,
  selection: string,
  isSpik: boolean,
  expectedValue: number
): CouponSelection {
  return {
    matchNumber,
    homeTeam: `Home Team ${matchNumber}`,
    awayTeam: `Away Team ${matchNumber}`,
    selection,
    is_spik: isSpik,
    expected_value: expectedValue,
    reasoning: `Test reasoning for match ${matchNumber}`,
  }
}

// Helper function to create 13 mock selections for Stryktipset/Europatipset
function createMockSelections13(): CouponSelection[] {
  return Array.from({ length: 13 }, (_, i) => {
    // Vary the properties to create realistic test data
    const isSpik = i < 5 // First 5 matches are spik-suitable
    const ev = 10 - i * 0.5 // EV decreases with match number
    const selection = i % 3 === 0 ? '1' : i % 3 === 1 ? 'X' : '2'
    return createSelection(i + 1, selection, isSpik, ev)
  })
}

// Helper function to create 8 mock selections for Topptipset
function createMockSelections8(): CouponSelection[] {
  return Array.from({ length: 8 }, (_, i) => {
    const isSpik = i < 3
    const ev = 8 - i * 0.5
    const selection = i % 3 === 0 ? '1' : i % 3 === 1 ? 'X' : '2'
    return createSelection(i + 1, selection, isSpik, ev)
  })
}

describe('HedgeAssignmentService', () => {
  let service: HedgeAssignmentService

  beforeEach(() => {
    service = new HedgeAssignmentService()
  })

  // ============================================================================
  // validateHedgeAssignment Tests
  // ============================================================================

  describe('validateHedgeAssignment', () => {
    it('validates correct assignment', () => {
      const system: BettingSystem = {
        id: 'R-4-4-144-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 4,
        rows: 144,
        guarantee: 12,
      }

      const assignment: HedgeAssignment = {
        spiks: [1, 2, 3, 4, 5],
        helgarderingar: [6, 7, 8, 9],
        halvgarderingar: [10, 11, 12, 13],
        spikOutcomes: { 1: '1', 2: 'X', 3: '2', 4: '1', 5: 'X' },
      }

      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(true)
    })

    it('rejects wrong helgarderingar count', () => {
      const system: BettingSystem = {
        id: 'R-4-4-144-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 4,
        rows: 144,
        guarantee: 12,
      }

      const assignment: HedgeAssignment = {
        spiks: [1, 2, 3, 4, 5, 6],
        helgarderingar: [7, 8, 9], // Only 3, should be 4
        halvgarderingar: [10, 11, 12, 13],
        spikOutcomes: { 1: '1', 2: 'X', 3: '2', 4: '1', 5: 'X', 6: '1' },
      }

      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(false)
    })

    it('rejects wrong halvgarderingar count', () => {
      const system: BettingSystem = {
        id: 'R-4-4-144-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 4,
        rows: 144,
        guarantee: 12,
      }

      const assignment: HedgeAssignment = {
        spiks: [1, 2],
        helgarderingar: [3, 4, 5, 6],
        halvgarderingar: [7, 8, 9, 10, 11, 12, 13], // 7, should be 4
        spikOutcomes: { 1: '1', 2: 'X' },
      }

      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(false)
    })

    it('rejects wrong spiks count', () => {
      const system: BettingSystem = {
        id: 'R-4-4-144-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 4,
        rows: 144,
        guarantee: 12,
      }

      const assignment: HedgeAssignment = {
        spiks: [1, 2, 3], // 3, should be 5
        helgarderingar: [4, 5, 6, 7],
        halvgarderingar: [8, 9, 10, 11],
        spikOutcomes: { 1: '1', 2: 'X', 3: '2' },
      }

      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(false)
    })

    it('rejects duplicate match assignments', () => {
      const system: BettingSystem = {
        id: 'R-4-4-144-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 4,
        rows: 144,
        guarantee: 12,
      }

      const assignment: HedgeAssignment = {
        spiks: [1, 2, 3, 4, 5],
        helgarderingar: [5, 6, 7, 8], // 5 is duplicate!
        halvgarderingar: [9, 10, 11, 12],
        spikOutcomes: { 1: '1', 2: 'X', 3: '2', 4: '1', 5: 'X' },
      }

      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(false)
    })

    it('rejects missing spikOutcome', () => {
      const system: BettingSystem = {
        id: 'R-4-4-144-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 4,
        rows: 144,
        guarantee: 12,
      }

      const assignment: HedgeAssignment = {
        spiks: [1, 2, 3, 4, 5],
        helgarderingar: [6, 7, 8, 9],
        halvgarderingar: [10, 11, 12, 13],
        spikOutcomes: { 1: '1', 2: 'X', 3: '2', 4: '1' }, // Missing 5
      }

      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(false)
    })
  })

  // ============================================================================
  // generateAlgorithmicHedgeAssignment Tests
  // ============================================================================

  describe('generateAlgorithmicHedgeAssignment', () => {
    it('assigns correct counts for R-4-4-144-12', () => {
      const selections = createMockSelections13()
      const system: BettingSystem = {
        id: 'R-4-4-144-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 4,
        rows: 144,
        guarantee: 12,
      }

      const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 13)

      expect(assignment.spiks).toHaveLength(5)
      expect(assignment.helgarderingar).toHaveLength(4)
      expect(assignment.halvgarderingar).toHaveLength(4)
      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(true)
    })

    it('assigns correct counts for system with 0 helgarderingar', () => {
      const selections = createMockSelections13()
      const system: BettingSystem = {
        id: 'R-0-7-16-12',
        type: 'R',
        helgarderingar: 0,
        halvgarderingar: 7,
        rows: 16,
        guarantee: 12,
      }

      const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 13)

      expect(assignment.spiks).toHaveLength(6)
      expect(assignment.helgarderingar).toHaveLength(0)
      expect(assignment.halvgarderingar).toHaveLength(7)
      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(true)
    })

    it('assigns correct counts for system with 0 halvgarderingar', () => {
      const selections = createMockSelections13()
      const system: BettingSystem = {
        id: 'R-4-0-9-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 0,
        rows: 9,
        guarantee: 12,
      }

      const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 13)

      expect(assignment.spiks).toHaveLength(9)
      expect(assignment.helgarderingar).toHaveLength(4)
      expect(assignment.halvgarderingar).toHaveLength(0)
      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(true)
    })

    it('prioritizes spik-suitable matches for spiks', () => {
      const selections = createMockSelections13()
      const system: BettingSystem = {
        id: 'R-4-4-144-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 4,
        rows: 144,
        guarantee: 12,
      }

      const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 13)

      // First 5 matches are spik-suitable, and we need 5 spiks
      expect(assignment.spiks).toContain(1)
      expect(assignment.spiks).toContain(2)
      expect(assignment.spiks).toContain(3)
      expect(assignment.spiks).toContain(4)
      expect(assignment.spiks).toContain(5)
    })

    it('assigns all matches exactly once', () => {
      const selections = createMockSelections13()
      const system: BettingSystem = {
        id: 'R-4-4-144-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 4,
        rows: 144,
        guarantee: 12,
      }

      const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 13)

      const allMatches = [
        ...assignment.spiks,
        ...assignment.helgarderingar,
        ...assignment.halvgarderingar,
      ]
      const uniqueMatches = new Set(allMatches)

      expect(allMatches).toHaveLength(13)
      expect(uniqueMatches.size).toBe(13)
    })
  })

  // ============================================================================
  // Test ALL R-Systems (29 systems)
  // ============================================================================

  describe('All R-Systems', () => {
    const rSystems = bettingSystems['R-systems'] as BettingSystem[]

    rSystems.forEach(system => {
      it(`correctly handles ${system.id}`, () => {
        const selections = createMockSelections13()
        const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 13)

        // Verify exact counts
        expect(assignment.helgarderingar).toHaveLength(system.helgarderingar)
        expect(assignment.halvgarderingar).toHaveLength(system.halvgarderingar)

        const expectedSpiks = 13 - system.helgarderingar - system.halvgarderingar
        expect(assignment.spiks).toHaveLength(expectedSpiks)

        // Verify no duplicates and all matches assigned
        const allMatches = [
          ...assignment.spiks,
          ...assignment.helgarderingar,
          ...assignment.halvgarderingar,
        ]
        expect(allMatches).toHaveLength(13)
        expect(new Set(allMatches).size).toBe(13)

        // Verify all spiks have outcomes
        for (const spikMatch of assignment.spiks) {
          expect(assignment.spikOutcomes[spikMatch]).toBeDefined()
        }

        // Full validation
        expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(true)
      })
    })
  })

  // ============================================================================
  // Test ALL U-Systems (25 systems)
  // ============================================================================

  describe('All U-Systems', () => {
    const uSystems = bettingSystems['U-systems'] as BettingSystem[]

    uSystems.forEach(system => {
      it(`correctly handles ${system.id}`, () => {
        const selections = createMockSelections13()
        const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 13)

        // Verify exact counts
        expect(assignment.helgarderingar).toHaveLength(system.helgarderingar)
        expect(assignment.halvgarderingar).toHaveLength(system.halvgarderingar)

        const expectedSpiks = 13 - system.helgarderingar - system.halvgarderingar
        expect(assignment.spiks).toHaveLength(expectedSpiks)

        // Verify no duplicates and all matches assigned
        const allMatches = [
          ...assignment.spiks,
          ...assignment.helgarderingar,
          ...assignment.halvgarderingar,
        ]
        expect(allMatches).toHaveLength(13)
        expect(new Set(allMatches).size).toBe(13)

        // Verify all spiks have outcomes
        for (const spikMatch of assignment.spiks) {
          expect(assignment.spikOutcomes[spikMatch]).toBeDefined()
        }

        // Full validation
        expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(true)
      })
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles system with maximum hedges (13 helg, 0 halvg, 0 spiks)', () => {
      const selections = createMockSelections13()
      // This is a theoretical system - all matches fully hedged
      const system: BettingSystem = {
        id: 'TEST-13-0',
        type: 'R',
        helgarderingar: 13,
        halvgarderingar: 0,
        rows: 1594323, // 3^13
      }

      const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 13)

      expect(assignment.spiks).toHaveLength(0)
      expect(assignment.helgarderingar).toHaveLength(13)
      expect(assignment.halvgarderingar).toHaveLength(0)
      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(true)
    })

    it('handles system with no hedges (0 helg, 0 halvg, 13 spiks)', () => {
      const selections = createMockSelections13()
      const system: BettingSystem = {
        id: 'TEST-0-0',
        type: 'R',
        helgarderingar: 0,
        halvgarderingar: 0,
        rows: 1,
      }

      const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 13)

      expect(assignment.spiks).toHaveLength(13)
      expect(assignment.helgarderingar).toHaveLength(0)
      expect(assignment.halvgarderingar).toHaveLength(0)
      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(true)
    })

    it('handles 8-match Topptipset system', () => {
      const selections = createMockSelections8()
      // Example Topptipset system
      const system: BettingSystem = {
        id: 'T-3-2-48-7',
        type: 'R',
        helgarderingar: 3,
        halvgarderingar: 2,
        rows: 48,
        guarantee: 7,
      }

      const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 8)

      expect(assignment.spiks).toHaveLength(3) // 8 - 3 - 2
      expect(assignment.helgarderingar).toHaveLength(3)
      expect(assignment.halvgarderingar).toHaveLength(2)
      expect(service.validateHedgeAssignment(assignment, system, 8)).toBe(true)
    })

    it('handles all matches with same EV', () => {
      // All matches have same EV - tests tie-breaking
      const selections = Array.from({ length: 13 }, (_, i) =>
        createSelection(i + 1, '1', i < 5, 5.0)
      )

      const system: BettingSystem = {
        id: 'R-4-4-144-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 4,
        rows: 144,
        guarantee: 12,
      }

      const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 13)

      // Should still produce valid counts
      expect(assignment.spiks).toHaveLength(5)
      expect(assignment.helgarderingar).toHaveLength(4)
      expect(assignment.halvgarderingar).toHaveLength(4)
      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(true)
    })

    it('handles all matches not spik-suitable', () => {
      const selections = Array.from({ length: 13 }, (_, i) =>
        createSelection(i + 1, '1', false, 10 - i * 0.5)
      )

      const system: BettingSystem = {
        id: 'R-4-4-144-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 4,
        rows: 144,
        guarantee: 12,
      }

      const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 13)

      // Should still assign spiks based on EV
      expect(assignment.spiks).toHaveLength(5)
      expect(assignment.helgarderingar).toHaveLength(4)
      expect(assignment.halvgarderingar).toHaveLength(4)
      expect(service.validateHedgeAssignment(assignment, system, 13)).toBe(true)
    })
  })

  // ============================================================================
  // Bug Regression Test (Original Issue: R-4-4-144-12 producing 1 helg, 7 halvg)
  // ============================================================================

  describe('Bug Regression: R-4-4-144-12', () => {
    it('MUST produce exactly 4 helgarderingar and 4 halvgarderingar', () => {
      const selections = createMockSelections13()
      const system: BettingSystem = {
        id: 'R-4-4-144-12',
        type: 'R',
        helgarderingar: 4,
        halvgarderingar: 4,
        rows: 144,
        guarantee: 12,
      }

      const assignment = service.generateAlgorithmicHedgeAssignment(selections, system, 13)

      // This was the reported bug: getting 1 helg, 7 halvg instead of 4, 4
      expect(assignment.helgarderingar).toHaveLength(4)
      expect(assignment.halvgarderingar).toHaveLength(4)
      expect(assignment.spiks).toHaveLength(5)

      // Verify this is not a fluke - run multiple times
      for (let i = 0; i < 10; i++) {
        const testSelections = Array.from({ length: 13 }, (_, j) =>
          createSelection(j + 1, '1', Math.random() > 0.5, Math.random() * 20)
        )
        const testAssignment = service.generateAlgorithmicHedgeAssignment(
          testSelections,
          system,
          13
        )

        expect(testAssignment.helgarderingar).toHaveLength(4)
        expect(testAssignment.halvgarderingar).toHaveLength(4)
        expect(testAssignment.spiks).toHaveLength(5)
      }
    })
  })
})
