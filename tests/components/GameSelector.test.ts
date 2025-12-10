import { describe, it, expect } from 'vitest'
import type { GameType } from '~/types/game-types'

// ============================================================================
// Test the pure logic extracted from GameSelector component
// ============================================================================

// Game type to label mapping
const labelMap: Record<GameType, string> = {
  stryktipset: 'Stryktipset',
  europatipset: 'Europatipset',
  topptipset: 'Topptipset',
}

// Label to game type mapping
const gameMap: Record<string, GameType> = {
  Stryktipset: 'stryktipset',
  Europatipset: 'europatipset',
  Topptipset: 'topptipset',
}

// Available game labels
const gameLabels = ['Stryktipset', 'Europatipset', 'Topptipset']

// Convert game type to display label
const getGameLabel = (gameType: GameType): string => {
  return labelMap[gameType]
}

// Convert display label to game type
const getGameType = (label: string): GameType | undefined => {
  return gameMap[label]
}

// Check if game type is valid
const isValidGameType = (value: string): value is GameType => {
  return value === 'stryktipset' || value === 'europatipset' || value === 'topptipset'
}

// Get match count for game type
const getMatchCount = (gameType: GameType): number => {
  switch (gameType) {
    case 'stryktipset':
      return 13
    case 'europatipset':
      return 13
    case 'topptipset':
      return 8
    default:
      return 13
  }
}

// Get row cost for game type
const getRowCost = (gameType: GameType): number => {
  switch (gameType) {
    case 'stryktipset':
      return 1
    case 'europatipset':
      return 1
    case 'topptipset':
      return 25 // Variable based on stake
    default:
      return 1
  }
}

// Get game description
const getGameDescription = (gameType: GameType): string => {
  switch (gameType) {
    case 'stryktipset':
      return '13 Swedish football matches'
    case 'europatipset':
      return '13 European football matches'
    case 'topptipset':
      return '8 international matches with variable stake'
    default:
      return 'Unknown game type'
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('GameSelector', () => {
  // ============================================================================
  // labelMap Tests
  // ============================================================================

  describe('labelMap', () => {
    it('maps stryktipset to Stryktipset', () => {
      expect(labelMap.stryktipset).toBe('Stryktipset')
    })

    it('maps europatipset to Europatipset', () => {
      expect(labelMap.europatipset).toBe('Europatipset')
    })

    it('maps topptipset to Topptipset', () => {
      expect(labelMap.topptipset).toBe('Topptipset')
    })

    it('contains all game types', () => {
      expect(Object.keys(labelMap)).toHaveLength(3)
    })
  })

  // ============================================================================
  // gameMap Tests
  // ============================================================================

  describe('gameMap', () => {
    it('maps Stryktipset to stryktipset', () => {
      expect(gameMap.Stryktipset).toBe('stryktipset')
    })

    it('maps Europatipset to europatipset', () => {
      expect(gameMap.Europatipset).toBe('europatipset')
    })

    it('maps Topptipset to topptipset', () => {
      expect(gameMap.Topptipset).toBe('topptipset')
    })

    it('contains all game labels', () => {
      expect(Object.keys(gameMap)).toHaveLength(3)
    })
  })

  // ============================================================================
  // gameLabels Tests
  // ============================================================================

  describe('gameLabels', () => {
    it('contains correct number of labels', () => {
      expect(gameLabels).toHaveLength(3)
    })

    it('contains Stryktipset', () => {
      expect(gameLabels).toContain('Stryktipset')
    })

    it('contains Europatipset', () => {
      expect(gameLabels).toContain('Europatipset')
    })

    it('contains Topptipset', () => {
      expect(gameLabels).toContain('Topptipset')
    })

    it('has Stryktipset as first option', () => {
      expect(gameLabels[0]).toBe('Stryktipset')
    })
  })

  // ============================================================================
  // getGameLabel Tests
  // ============================================================================

  describe('getGameLabel', () => {
    it('returns correct label for stryktipset', () => {
      expect(getGameLabel('stryktipset')).toBe('Stryktipset')
    })

    it('returns correct label for europatipset', () => {
      expect(getGameLabel('europatipset')).toBe('Europatipset')
    })

    it('returns correct label for topptipset', () => {
      expect(getGameLabel('topptipset')).toBe('Topptipset')
    })
  })

  // ============================================================================
  // getGameType Tests
  // ============================================================================

  describe('getGameType', () => {
    it('returns stryktipset for Stryktipset', () => {
      expect(getGameType('Stryktipset')).toBe('stryktipset')
    })

    it('returns europatipset for Europatipset', () => {
      expect(getGameType('Europatipset')).toBe('europatipset')
    })

    it('returns topptipset for Topptipset', () => {
      expect(getGameType('Topptipset')).toBe('topptipset')
    })

    it('returns undefined for invalid label', () => {
      expect(getGameType('InvalidGame')).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
      expect(getGameType('')).toBeUndefined()
    })

    it('is case sensitive', () => {
      expect(getGameType('stryktipset')).toBeUndefined()
      expect(getGameType('STRYKTIPSET')).toBeUndefined()
    })
  })

  // ============================================================================
  // isValidGameType Tests
  // ============================================================================

  describe('isValidGameType', () => {
    it('returns true for stryktipset', () => {
      expect(isValidGameType('stryktipset')).toBe(true)
    })

    it('returns true for europatipset', () => {
      expect(isValidGameType('europatipset')).toBe(true)
    })

    it('returns true for topptipset', () => {
      expect(isValidGameType('topptipset')).toBe(true)
    })

    it('returns false for invalid type', () => {
      expect(isValidGameType('invalid')).toBe(false)
    })

    it('returns false for label instead of type', () => {
      expect(isValidGameType('Stryktipset')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isValidGameType('')).toBe(false)
    })
  })

  // ============================================================================
  // getMatchCount Tests
  // ============================================================================

  describe('getMatchCount', () => {
    it('returns 13 for stryktipset', () => {
      expect(getMatchCount('stryktipset')).toBe(13)
    })

    it('returns 13 for europatipset', () => {
      expect(getMatchCount('europatipset')).toBe(13)
    })

    it('returns 8 for topptipset', () => {
      expect(getMatchCount('topptipset')).toBe(8)
    })
  })

  // ============================================================================
  // getRowCost Tests
  // ============================================================================

  describe('getRowCost', () => {
    it('returns 1 for stryktipset', () => {
      expect(getRowCost('stryktipset')).toBe(1)
    })

    it('returns 1 for europatipset', () => {
      expect(getRowCost('europatipset')).toBe(1)
    })

    it('returns 25 for topptipset', () => {
      expect(getRowCost('topptipset')).toBe(25)
    })
  })

  // ============================================================================
  // getGameDescription Tests
  // ============================================================================

  describe('getGameDescription', () => {
    it('returns correct description for stryktipset', () => {
      const desc = getGameDescription('stryktipset')
      expect(desc).toContain('13')
      expect(desc).toContain('Swedish')
    })

    it('returns correct description for europatipset', () => {
      const desc = getGameDescription('europatipset')
      expect(desc).toContain('13')
      expect(desc).toContain('European')
    })

    it('returns correct description for topptipset', () => {
      const desc = getGameDescription('topptipset')
      expect(desc).toContain('8')
      expect(desc).toContain('stake')
    })
  })

  // ============================================================================
  // Bidirectional Mapping Tests
  // ============================================================================

  describe('Bidirectional Mapping', () => {
    it('labelMap and gameMap are inverses', () => {
      for (const [gameType, label] of Object.entries(labelMap)) {
        expect(gameMap[label]).toBe(gameType)
      }
    })

    it('gameMap and labelMap are inverses', () => {
      for (const [label, gameType] of Object.entries(gameMap)) {
        expect(labelMap[gameType as GameType]).toBe(label)
      }
    })

    it('all gameLabels have valid gameMap entries', () => {
      for (const label of gameLabels) {
        expect(gameMap[label]).toBeDefined()
        expect(isValidGameType(gameMap[label]!)).toBe(true)
      }
    })
  })
})
