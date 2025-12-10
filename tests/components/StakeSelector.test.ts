import { describe, it, expect } from 'vitest'

// ============================================================================
// Test the pure logic extracted from StakeSelector component
// ============================================================================

// Valid stake values for Topptipset
type TopptipsetStake = 1 | 2 | 5 | 10

// Available stakes
const stakes: TopptipsetStake[] = [1, 2, 5, 10]

// Validate stake value
const isValidStake = (value: number): value is TopptipsetStake => {
  return stakes.includes(value as TopptipsetStake)
}

// Get multiplier for a stake
const getStakeMultiplier = (stake: TopptipsetStake): number => {
  return stake
}

// Calculate total cost for a system with given stake
const calculateTotalCost = (rows: number, stake: TopptipsetStake): number => {
  return rows * stake
}

// Get display text for stake button
const getStakeDisplayText = (stake: TopptipsetStake): string => {
  return `${stake} SEK`
}

// Get next available stake (for cycling)
const getNextStake = (currentStake: TopptipsetStake): TopptipsetStake => {
  const currentIndex = stakes.indexOf(currentStake)
  const nextIndex = (currentIndex + 1) % stakes.length
  return stakes[nextIndex]!
}

// Get previous available stake (for cycling)
const getPreviousStake = (currentStake: TopptipsetStake): TopptipsetStake => {
  const currentIndex = stakes.indexOf(currentStake)
  const prevIndex = (currentIndex - 1 + stakes.length) % stakes.length
  return stakes[prevIndex]!
}

// Get minimum stake
const getMinStake = (): TopptipsetStake => {
  return stakes[0]!
}

// Get maximum stake
const getMaxStake = (): TopptipsetStake => {
  return stakes[stakes.length - 1]!
}

// Calculate potential winnings multiplier compared to base stake
const getWinningsMultiplier = (stake: TopptipsetStake): number => {
  return stake / getMinStake()
}

// Format stake for display (with currency)
const formatStake = (stake: TopptipsetStake, showCurrency: boolean = true): string => {
  return showCurrency ? `${stake} SEK` : `${stake}`
}

// Get stake index (for use in UI highlights)
const getStakeIndex = (stake: TopptipsetStake): number => {
  return stakes.indexOf(stake)
}

// ============================================================================
// Tests
// ============================================================================

describe('StakeSelector', () => {
  // ============================================================================
  // stakes array Tests
  // ============================================================================

  describe('stakes', () => {
    it('contains exactly 4 stake options', () => {
      expect(stakes).toHaveLength(4)
    })

    it('contains 1 SEK stake', () => {
      expect(stakes).toContain(1)
    })

    it('contains 2 SEK stake', () => {
      expect(stakes).toContain(2)
    })

    it('contains 5 SEK stake', () => {
      expect(stakes).toContain(5)
    })

    it('contains 10 SEK stake', () => {
      expect(stakes).toContain(10)
    })

    it('is sorted in ascending order', () => {
      for (let i = 0; i < stakes.length - 1; i++) {
        expect(stakes[i]!).toBeLessThan(stakes[i + 1]!)
      }
    })

    it('starts with 1', () => {
      expect(stakes[0]).toBe(1)
    })

    it('ends with 10', () => {
      expect(stakes[stakes.length - 1]).toBe(10)
    })
  })

  // ============================================================================
  // isValidStake Tests
  // ============================================================================

  describe('isValidStake', () => {
    it('returns true for 1', () => {
      expect(isValidStake(1)).toBe(true)
    })

    it('returns true for 2', () => {
      expect(isValidStake(2)).toBe(true)
    })

    it('returns true for 5', () => {
      expect(isValidStake(5)).toBe(true)
    })

    it('returns true for 10', () => {
      expect(isValidStake(10)).toBe(true)
    })

    it('returns false for 0', () => {
      expect(isValidStake(0)).toBe(false)
    })

    it('returns false for 3', () => {
      expect(isValidStake(3)).toBe(false)
    })

    it('returns false for 4', () => {
      expect(isValidStake(4)).toBe(false)
    })

    it('returns false for 6', () => {
      expect(isValidStake(6)).toBe(false)
    })

    it('returns false for 20', () => {
      expect(isValidStake(20)).toBe(false)
    })

    it('returns false for negative numbers', () => {
      expect(isValidStake(-1)).toBe(false)
    })

    it('returns false for decimal numbers', () => {
      expect(isValidStake(1.5)).toBe(false)
    })
  })

  // ============================================================================
  // getStakeMultiplier Tests
  // ============================================================================

  describe('getStakeMultiplier', () => {
    it('returns 1 for stake 1', () => {
      expect(getStakeMultiplier(1)).toBe(1)
    })

    it('returns 2 for stake 2', () => {
      expect(getStakeMultiplier(2)).toBe(2)
    })

    it('returns 5 for stake 5', () => {
      expect(getStakeMultiplier(5)).toBe(5)
    })

    it('returns 10 for stake 10', () => {
      expect(getStakeMultiplier(10)).toBe(10)
    })
  })

  // ============================================================================
  // calculateTotalCost Tests
  // ============================================================================

  describe('calculateTotalCost', () => {
    it('calculates cost correctly for stake 1', () => {
      expect(calculateTotalCost(100, 1)).toBe(100)
    })

    it('calculates cost correctly for stake 2', () => {
      expect(calculateTotalCost(100, 2)).toBe(200)
    })

    it('calculates cost correctly for stake 5', () => {
      expect(calculateTotalCost(100, 5)).toBe(500)
    })

    it('calculates cost correctly for stake 10', () => {
      expect(calculateTotalCost(100, 10)).toBe(1000)
    })

    it('handles zero rows', () => {
      expect(calculateTotalCost(0, 5)).toBe(0)
    })

    it('handles single row', () => {
      expect(calculateTotalCost(1, 5)).toBe(5)
    })

    it('handles large number of rows', () => {
      expect(calculateTotalCost(1000, 10)).toBe(10000)
    })
  })

  // ============================================================================
  // getStakeDisplayText Tests
  // ============================================================================

  describe('getStakeDisplayText', () => {
    it('returns "1 SEK" for stake 1', () => {
      expect(getStakeDisplayText(1)).toBe('1 SEK')
    })

    it('returns "2 SEK" for stake 2', () => {
      expect(getStakeDisplayText(2)).toBe('2 SEK')
    })

    it('returns "5 SEK" for stake 5', () => {
      expect(getStakeDisplayText(5)).toBe('5 SEK')
    })

    it('returns "10 SEK" for stake 10', () => {
      expect(getStakeDisplayText(10)).toBe('10 SEK')
    })
  })

  // ============================================================================
  // getNextStake Tests
  // ============================================================================

  describe('getNextStake', () => {
    it('returns 2 after 1', () => {
      expect(getNextStake(1)).toBe(2)
    })

    it('returns 5 after 2', () => {
      expect(getNextStake(2)).toBe(5)
    })

    it('returns 10 after 5', () => {
      expect(getNextStake(5)).toBe(10)
    })

    it('wraps around to 1 after 10', () => {
      expect(getNextStake(10)).toBe(1)
    })
  })

  // ============================================================================
  // getPreviousStake Tests
  // ============================================================================

  describe('getPreviousStake', () => {
    it('returns 10 before 1 (wraps around)', () => {
      expect(getPreviousStake(1)).toBe(10)
    })

    it('returns 1 before 2', () => {
      expect(getPreviousStake(2)).toBe(1)
    })

    it('returns 2 before 5', () => {
      expect(getPreviousStake(5)).toBe(2)
    })

    it('returns 5 before 10', () => {
      expect(getPreviousStake(10)).toBe(5)
    })
  })

  // ============================================================================
  // getMinStake Tests
  // ============================================================================

  describe('getMinStake', () => {
    it('returns 1', () => {
      expect(getMinStake()).toBe(1)
    })
  })

  // ============================================================================
  // getMaxStake Tests
  // ============================================================================

  describe('getMaxStake', () => {
    it('returns 10', () => {
      expect(getMaxStake()).toBe(10)
    })
  })

  // ============================================================================
  // getWinningsMultiplier Tests
  // ============================================================================

  describe('getWinningsMultiplier', () => {
    it('returns 1 for stake 1', () => {
      expect(getWinningsMultiplier(1)).toBe(1)
    })

    it('returns 2 for stake 2', () => {
      expect(getWinningsMultiplier(2)).toBe(2)
    })

    it('returns 5 for stake 5', () => {
      expect(getWinningsMultiplier(5)).toBe(5)
    })

    it('returns 10 for stake 10', () => {
      expect(getWinningsMultiplier(10)).toBe(10)
    })
  })

  // ============================================================================
  // formatStake Tests
  // ============================================================================

  describe('formatStake', () => {
    it('formats with currency by default', () => {
      expect(formatStake(5)).toBe('5 SEK')
    })

    it('formats with currency when showCurrency is true', () => {
      expect(formatStake(5, true)).toBe('5 SEK')
    })

    it('formats without currency when showCurrency is false', () => {
      expect(formatStake(5, false)).toBe('5')
    })

    it('formats stake 1 correctly', () => {
      expect(formatStake(1)).toBe('1 SEK')
      expect(formatStake(1, false)).toBe('1')
    })

    it('formats stake 10 correctly', () => {
      expect(formatStake(10)).toBe('10 SEK')
      expect(formatStake(10, false)).toBe('10')
    })
  })

  // ============================================================================
  // getStakeIndex Tests
  // ============================================================================

  describe('getStakeIndex', () => {
    it('returns 0 for stake 1', () => {
      expect(getStakeIndex(1)).toBe(0)
    })

    it('returns 1 for stake 2', () => {
      expect(getStakeIndex(2)).toBe(1)
    })

    it('returns 2 for stake 5', () => {
      expect(getStakeIndex(5)).toBe(2)
    })

    it('returns 3 for stake 10', () => {
      expect(getStakeIndex(10)).toBe(3)
    })
  })

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('all stakes are valid', () => {
      stakes.forEach(stake => {
        expect(isValidStake(stake)).toBe(true)
      })
    })

    it('cycling through all stakes works correctly', () => {
      let current: TopptipsetStake = 1
      const visited: TopptipsetStake[] = [current]

      for (let i = 0; i < stakes.length - 1; i++) {
        current = getNextStake(current)
        visited.push(current)
      }

      expect(visited).toEqual([1, 2, 5, 10])
    })

    it('cycling backwards through all stakes works correctly', () => {
      let current: TopptipsetStake = 10
      const visited: TopptipsetStake[] = [current]

      for (let i = 0; i < stakes.length - 1; i++) {
        current = getPreviousStake(current)
        visited.push(current)
      }

      expect(visited).toEqual([10, 5, 2, 1])
    })

    it('cost calculation is consistent with multiplier', () => {
      const rows = 50
      stakes.forEach(stake => {
        expect(calculateTotalCost(rows, stake)).toBe(rows * getStakeMultiplier(stake))
      })
    })
  })
})
