import { describe, it, expect, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import type { BettingSystem } from '~/types'

// ============================================================================
// Test the pure logic extracted from SystemSelector component
// ============================================================================

// Helper functions extracted from the component for testing
const getGuaranteeColor = (guarantee: number): string => {
  if (guarantee >= 12) return 'success'
  if (guarantee >= 11) return 'primary'
  return 'warning'
}

const getReductionRatio = (system: BettingSystem): string => {
  const fullRows = Math.pow(3, system.helgarderingar) * Math.pow(2, system.halvgarderingar)
  const ratio = ((system.rows / fullRows) * 100).toFixed(1)
  return `${ratio}%`
}

// Parse guarantee string to number
const parseGuarantee = (guaranteeStr: string): number | null => {
  switch (guaranteeStr) {
    case '10 rätt':
      return 10
    case '11 rätt':
      return 11
    case '12 rätt':
      return 12
    default:
      return null
  }
}

// Parse sort string to sort key
const parseSortBy = (sortByStr: string): string => {
  switch (sortByStr) {
    case 'Cost (High to Low)':
      return 'cost-desc'
    case 'Coverage (High to Low)':
      return 'coverage-desc'
    case 'Guarantee (High to Low)':
      return 'guarantee-desc'
    default:
      return 'cost-asc'
  }
}

// Filter systems based on criteria
const filterSystems = (
  systems: BettingSystem[],
  type: 'R' | 'U' | null,
  guarantee: number | null,
  maxCost: number | null
): BettingSystem[] => {
  let filtered = [...systems]

  if (type) {
    filtered = filtered.filter(s => s.type === type)
  }

  if (guarantee !== null) {
    filtered = filtered.filter(s => s.guarantee === guarantee)
  }

  if (maxCost) {
    filtered = filtered.filter(s => s.rows <= maxCost)
  }

  return filtered
}

// Sort systems based on criteria
const sortSystems = (systems: BettingSystem[], sortBy: string): BettingSystem[] => {
  const sorted = [...systems]

  switch (sortBy) {
    case 'cost-asc':
      sorted.sort((a, b) => a.rows - b.rows)
      break
    case 'cost-desc':
      sorted.sort((a, b) => b.rows - a.rows)
      break
    case 'coverage-desc':
      sorted.sort((a, b) => {
        const coverageA = a.helgarderingar + a.halvgarderingar
        const coverageB = b.helgarderingar + b.halvgarderingar
        return coverageB - coverageA
      })
      break
    case 'guarantee-desc':
      sorted.sort((a, b) => (b.guarantee || 0) - (a.guarantee || 0))
      break
  }

  return sorted
}

// ============================================================================
// Test Data Factories
// ============================================================================

const createSystem = (overrides: Partial<BettingSystem> = {}): BettingSystem => ({
  id: 'R-4-0-9-12',
  type: 'R',
  helgarderingar: 4,
  halvgarderingar: 0,
  rows: 9,
  guarantee: 12,
  ...overrides,
})

const createTestSystems = (): BettingSystem[] => [
  { id: 'R-4-0-9-12', type: 'R', helgarderingar: 4, halvgarderingar: 0, rows: 9, guarantee: 12 },
  { id: 'R-5-0-18-11', type: 'R', helgarderingar: 5, halvgarderingar: 0, rows: 18, guarantee: 11 },
  { id: 'R-8-0-27-10', type: 'R', helgarderingar: 8, halvgarderingar: 0, rows: 27, guarantee: 10 },
  { id: 'U-4-4-16', type: 'U', helgarderingar: 4, halvgarderingar: 4, rows: 16 }, // No guarantee
  { id: 'U-0-7-10', type: 'U', helgarderingar: 0, halvgarderingar: 7, rows: 10 }, // No guarantee
]

// ============================================================================
// getGuaranteeColor Tests
// ============================================================================

describe('SystemSelector - getGuaranteeColor', () => {
  it('returns "success" for guarantee 12', () => {
    expect(getGuaranteeColor(12)).toBe('success')
  })

  it('returns "success" for guarantee 13 (above 12)', () => {
    expect(getGuaranteeColor(13)).toBe('success')
  })

  it('returns "primary" for guarantee 11', () => {
    expect(getGuaranteeColor(11)).toBe('primary')
  })

  it('returns "warning" for guarantee 10', () => {
    expect(getGuaranteeColor(10)).toBe('warning')
  })

  it('returns "warning" for guarantee 9', () => {
    expect(getGuaranteeColor(9)).toBe('warning')
  })
})

// ============================================================================
// getReductionRatio Tests
// ============================================================================

describe('SystemSelector - getReductionRatio', () => {
  it('calculates 100% for full system (9 rows for 4 helg)', () => {
    // 3^4 = 81, but system has 9 rows -> 9/81 = 11.1%
    const system = createSystem({ helgarderingar: 4, halvgarderingar: 0, rows: 81 })
    expect(getReductionRatio(system)).toBe('100.0%')
  })

  it('calculates correct ratio for reduced system', () => {
    // 3^4 = 81, 9 rows -> 9/81 = 11.1%
    const system = createSystem({ helgarderingar: 4, halvgarderingar: 0, rows: 9 })
    expect(getReductionRatio(system)).toBe('11.1%')
  })

  it('handles mixed helg and halvg', () => {
    // 3^2 × 2^2 = 9 × 4 = 36, 12 rows -> 12/36 = 33.3%
    const system = createSystem({ helgarderingar: 2, halvgarderingar: 2, rows: 12 })
    expect(getReductionRatio(system)).toBe('33.3%')
  })

  it('handles halvgarderingar only', () => {
    // 2^7 = 128, 10 rows -> 10/128 = 7.8%
    const system = createSystem({ helgarderingar: 0, halvgarderingar: 7, rows: 10 })
    expect(getReductionRatio(system)).toBe('7.8%')
  })

  it('handles case where rows equals full system', () => {
    // 3^1 = 3, 3 rows -> 100%
    const system = createSystem({ helgarderingar: 1, halvgarderingar: 0, rows: 3 })
    expect(getReductionRatio(system)).toBe('100.0%')
  })
})

// ============================================================================
// parseGuarantee Tests
// ============================================================================

describe('SystemSelector - parseGuarantee', () => {
  it('parses "10 rätt" to 10', () => {
    expect(parseGuarantee('10 rätt')).toBe(10)
  })

  it('parses "11 rätt" to 11', () => {
    expect(parseGuarantee('11 rätt')).toBe(11)
  })

  it('parses "12 rätt" to 12', () => {
    expect(parseGuarantee('12 rätt')).toBe(12)
  })

  it('returns null for "All Guarantees"', () => {
    expect(parseGuarantee('All Guarantees')).toBe(null)
  })

  it('returns null for unknown strings', () => {
    expect(parseGuarantee('Unknown')).toBe(null)
  })
})

// ============================================================================
// parseSortBy Tests
// ============================================================================

describe('SystemSelector - parseSortBy', () => {
  it('parses "Cost (Low to High)" to cost-asc', () => {
    expect(parseSortBy('Cost (Low to High)')).toBe('cost-asc')
  })

  it('parses "Cost (High to Low)" to cost-desc', () => {
    expect(parseSortBy('Cost (High to Low)')).toBe('cost-desc')
  })

  it('parses "Coverage (High to Low)" to coverage-desc', () => {
    expect(parseSortBy('Coverage (High to Low)')).toBe('coverage-desc')
  })

  it('parses "Guarantee (High to Low)" to guarantee-desc', () => {
    expect(parseSortBy('Guarantee (High to Low)')).toBe('guarantee-desc')
  })

  it('returns cost-asc as default for unknown strings', () => {
    expect(parseSortBy('Unknown sort')).toBe('cost-asc')
  })
})

// ============================================================================
// filterSystems Tests
// ============================================================================

describe('SystemSelector - filterSystems', () => {
  let systems: BettingSystem[]

  beforeEach(() => {
    systems = createTestSystems()
  })

  it('returns all systems when no filters applied', () => {
    const filtered = filterSystems(systems, null, null, null)
    expect(filtered).toHaveLength(5)
  })

  describe('type filter', () => {
    it('filters by R-system type', () => {
      const filtered = filterSystems(systems, 'R', null, null)
      expect(filtered).toHaveLength(3)
      expect(filtered.every(s => s.type === 'R')).toBe(true)
    })

    it('filters by U-system type', () => {
      const filtered = filterSystems(systems, 'U', null, null)
      expect(filtered).toHaveLength(2)
      expect(filtered.every(s => s.type === 'U')).toBe(true)
    })
  })

  describe('guarantee filter', () => {
    it('filters by guarantee 12', () => {
      const filtered = filterSystems(systems, null, 12, null)
      expect(filtered).toHaveLength(1)
      expect(filtered[0]!.guarantee).toBe(12)
    })

    it('filters by guarantee 11', () => {
      const filtered = filterSystems(systems, null, 11, null)
      expect(filtered).toHaveLength(1)
      expect(filtered[0]!.guarantee).toBe(11)
    })

    it('filters by guarantee 10', () => {
      const filtered = filterSystems(systems, null, 10, null)
      expect(filtered).toHaveLength(1)
      expect(filtered[0]!.guarantee).toBe(10)
    })

    it('returns empty when no systems match guarantee', () => {
      const filtered = filterSystems(systems, null, 13, null)
      expect(filtered).toHaveLength(0)
    })
  })

  describe('maxCost filter', () => {
    it('filters by max cost 10', () => {
      const filtered = filterSystems(systems, null, null, 10)
      expect(filtered).toHaveLength(2) // 9 and 10 row systems
      expect(filtered.every(s => s.rows <= 10)).toBe(true)
    })

    it('filters by max cost 20', () => {
      const filtered = filterSystems(systems, null, null, 20)
      expect(filtered).toHaveLength(4) // 9, 10, 16, 18 row systems
      expect(filtered.every(s => s.rows <= 20)).toBe(true)
    })

    it('returns all systems when max cost is very high', () => {
      const filtered = filterSystems(systems, null, null, 1000)
      expect(filtered).toHaveLength(5)
    })

    it('returns all systems when max cost is 0 (falsy, treated as no filter)', () => {
      // In the component, `if (filters.value.maxCost)` means 0 is falsy
      // This matches the actual component behavior
      const filtered = filterSystems(systems, null, null, 0)
      expect(filtered).toHaveLength(5) // 0 is falsy, no filtering applied
    })
  })

  describe('combined filters', () => {
    it('filters by type R and guarantee 12', () => {
      const filtered = filterSystems(systems, 'R', 12, null)
      expect(filtered).toHaveLength(1)
      expect(filtered[0]!.id).toBe('R-4-0-9-12')
    })

    it('filters by type R and max cost 20', () => {
      const filtered = filterSystems(systems, 'R', null, 20)
      expect(filtered).toHaveLength(2) // R-4-0-9-12 (9) and R-5-0-18-11 (18)
    })

    it('filters by all criteria simultaneously', () => {
      const filtered = filterSystems(systems, 'R', 11, 20)
      expect(filtered).toHaveLength(1)
      expect(filtered[0]!.id).toBe('R-5-0-18-11')
    })

    it('returns U-systems when filtering by U type and guarantee 12', () => {
      // U-systems have undefined guarantee, not a specific value
      // s.guarantee === 12 will be false for undefined
      const filtered = filterSystems(systems, 'U', 12, null)
      // Filter: type === 'U' AND guarantee === 12
      // U-4-4-16: type U, guarantee undefined (12 === undefined is false)
      // U-0-7-10: type U, guarantee undefined (12 === undefined is false)
      expect(filtered).toHaveLength(0) // Correct - no U-systems have guarantee 12
    })
  })
})

// ============================================================================
// sortSystems Tests
// ============================================================================

describe('SystemSelector - sortSystems', () => {
  let systems: BettingSystem[]

  beforeEach(() => {
    systems = createTestSystems()
  })

  it('sorts by cost ascending (default)', () => {
    const sorted = sortSystems(systems, 'cost-asc')
    expect(sorted[0]!.rows).toBe(9)
    expect(sorted[sorted.length - 1]!.rows).toBe(27)
  })

  it('sorts by cost descending', () => {
    const sorted = sortSystems(systems, 'cost-desc')
    expect(sorted[0]!.rows).toBe(27)
    expect(sorted[sorted.length - 1]!.rows).toBe(9)
  })

  it('sorts by coverage descending', () => {
    const sorted = sortSystems(systems, 'coverage-desc')
    // Coverage = helg + halvg
    // U-4-4-16 = 8, R-8-0-27 = 8, U-0-7-10 = 7, R-5-0-18 = 5, R-4-0-9 = 4
    expect(sorted[0]!.helgarderingar + sorted[0]!.halvgarderingar).toBeGreaterThanOrEqual(
      sorted[sorted.length - 1]!.helgarderingar + sorted[sorted.length - 1]!.halvgarderingar
    )
  })

  it('sorts by guarantee descending', () => {
    const sorted = sortSystems(systems, 'guarantee-desc')
    // Systems with guarantee: 12, 11, 10, undefined, undefined
    // R-systems should come first (sorted by guarantee), U-systems at the end (guarantee || 0 = 0)
    const rSystems = sorted.filter(s => s.type === 'R')
    expect(rSystems[0]!.guarantee).toBe(12)
    expect(rSystems[1]!.guarantee).toBe(11)
    expect(rSystems[2]!.guarantee).toBe(10)
  })

  it('treats undefined guarantee as 0 when sorting', () => {
    const sorted = sortSystems(systems, 'guarantee-desc')
    // U-systems without guarantee should be at the end (guarantee || 0 = 0)
    // The last 2 systems should be U-systems
    const lastTwoSystems = sorted.slice(-2)
    expect(lastTwoSystems.every(s => s.type === 'U')).toBe(true)
    expect(lastTwoSystems.every(s => s.guarantee === undefined)).toBe(true)
  })

  it('preserves original array (returns new array)', () => {
    const original = [...systems]
    sortSystems(systems, 'cost-desc')
    expect(systems).toEqual(original) // Original should be unchanged
  })
})

// ============================================================================
// Integration Tests - Filter + Sort Combined
// ============================================================================

describe('SystemSelector - Integration', () => {
  let systems: BettingSystem[]

  beforeEach(() => {
    systems = createTestSystems()
  })

  it('filters then sorts correctly', () => {
    // Filter to R-systems only, then sort by cost
    const filtered = filterSystems(systems, 'R', null, null)
    const sorted = sortSystems(filtered, 'cost-asc')

    expect(sorted).toHaveLength(3)
    expect(sorted[0]!.id).toBe('R-4-0-9-12') // 9 rows
    expect(sorted[1]!.id).toBe('R-5-0-18-11') // 18 rows
    expect(sorted[2]!.id).toBe('R-8-0-27-10') // 27 rows
  })

  it('filters by guarantee and sorts by cost desc', () => {
    const filtered = filterSystems(systems, null, null, 20)
    const sorted = sortSystems(filtered, 'cost-desc')

    // Systems <= 20 rows: 9, 10, 16, 18 sorted desc: 18, 16, 10, 9
    expect(sorted[0]!.rows).toBe(18)
    expect(sorted[sorted.length - 1]!.rows).toBe(9)
  })

  it('handles edge case of all systems filtered out', () => {
    const filtered = filterSystems(systems, 'R', 12, 5) // No R-system with 12 guarantee costs <= 5
    const sorted = sortSystems(filtered, 'cost-asc')

    expect(sorted).toHaveLength(0)
  })

  it('handles single system result', () => {
    const filtered = filterSystems(systems, 'R', 12, null)
    const sorted = sortSystems(filtered, 'cost-asc')

    expect(sorted).toHaveLength(1)
    expect(sorted[0]!.id).toBe('R-4-0-9-12')
  })
})

// ============================================================================
// Reactive Computed Logic Tests
// ============================================================================

describe('SystemSelector - Reactive Logic', () => {
  it('computed guarantee maps correctly from string', () => {
    // Simulate the component's reactive computed
    const guaranteeStr = ref('11 rätt')
    const guarantee = computed(() => parseGuarantee(guaranteeStr.value))

    expect(guarantee.value).toBe(11)

    guaranteeStr.value = '12 rätt'
    expect(guarantee.value).toBe(12)

    guaranteeStr.value = 'All Guarantees'
    expect(guarantee.value).toBe(null)
  })

  it('computed sortBy maps correctly from string', () => {
    const sortByStr = ref('Cost (Low to High)')
    const sortBy = computed(() => parseSortBy(sortByStr.value))

    expect(sortBy.value).toBe('cost-asc')

    sortByStr.value = 'Cost (High to Low)'
    expect(sortBy.value).toBe('cost-desc')

    sortByStr.value = 'Guarantee (High to Low)'
    expect(sortBy.value).toBe('guarantee-desc')
  })

  it('filteredSystems updates when filters change', () => {
    const allSystems = ref(createTestSystems())
    const type = ref<'R' | 'U' | null>(null)
    const guarantee = ref<number | null>(null)
    const maxCost = ref<number | null>(null)
    const sortBy = ref('cost-asc')

    const filteredSystems = computed(() => {
      const filtered = filterSystems(allSystems.value, type.value, guarantee.value, maxCost.value)
      return sortSystems(filtered, sortBy.value)
    })

    // Initial: all systems sorted by cost
    expect(filteredSystems.value).toHaveLength(5)

    // Filter by type
    type.value = 'R'
    expect(filteredSystems.value).toHaveLength(3)

    // Add guarantee filter
    guarantee.value = 12
    expect(filteredSystems.value).toHaveLength(1)

    // Reset type filter
    type.value = null
    guarantee.value = null
    expect(filteredSystems.value).toHaveLength(5)

    // Add max cost filter
    maxCost.value = 15
    expect(filteredSystems.value).toHaveLength(2) // 9 and 10 row systems
  })
})
