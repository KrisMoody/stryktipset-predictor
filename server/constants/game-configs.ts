import type { GameConfig, GameType } from '~/types/game-types'

/**
 * Default game type when none is specified
 */
export const DEFAULT_GAME_TYPE: GameType = 'stryktipset'

/**
 * Valid game types
 */
export const VALID_GAME_TYPES: GameType[] = ['stryktipset', 'europatipset', 'topptipset']

/**
 * Check if a string is a valid game type
 */
export function isValidGameType(value: string): value is GameType {
  return VALID_GAME_TYPES.includes(value as GameType)
}

/**
 * Game configuration registry for all supported Svenska Spel 1X2 pool games
 */
export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  stryktipset: {
    id: 'stryktipset',
    name: 'stryktipset',
    displayName: 'Stryktipset',
    matchCount: 13,
    payoutPercentage: 65,
    prizeTiers: [
      { correctCount: 13, name: '13 rätt' },
      { correctCount: 12, name: '12 rätt' },
      { correctCount: 11, name: '11 rätt' },
      { correctCount: 10, name: '10 rätt' },
    ],
    hasOfficialSystems: true,
    stakesOptions: [1],
    apiPath: '/draw/1/stryktipset',
    productId: 1,
    scrapeBasePath: '/stryktipset',
    systemRules: {
      maxHelgarderingar: 13,
      maxHalvgarderingar: 13,
      maxRows: 1594323, // 3^13
    },
  },

  europatipset: {
    id: 'europatipset',
    name: 'europatipset',
    displayName: 'Europatipset',
    matchCount: 13,
    payoutPercentage: 65,
    prizeTiers: [
      { correctCount: 13, name: '13 rätt' },
      { correctCount: 12, name: '12 rätt' },
      { correctCount: 11, name: '11 rätt' },
      { correctCount: 10, name: '10 rätt' },
    ],
    hasOfficialSystems: true, // Same systems as Stryktipset apply
    stakesOptions: [1],
    apiPath: '/draw/1/europatipset',
    productId: 2, // TODO: Verify actual product ID from API
    scrapeBasePath: '/europatipset',
    systemRules: {
      maxHelgarderingar: 13,
      maxHalvgarderingar: 13,
      maxRows: 1594323, // 3^13
    },
  },

  topptipset: {
    id: 'topptipset',
    name: 'topptipset',
    displayName: 'Topptipset',
    matchCount: 8,
    payoutPercentage: 70,
    prizeTiers: [
      { correctCount: 8, name: '8 rätt' }, // All-or-nothing single tier
    ],
    hasOfficialSystems: false, // No official R/U-systems from Svenska Spel
    stakesOptions: [1, 2, 3, 5, 10],
    apiPath: '/draw/1/topptipset',
    productId: 25, // Primary Topptipset product ID (23, 24, 25 are variants for different days)
    scrapeBasePath: '/topptipset',
    systemRules: {
      maxHelgarderingar: 7,
      maxHalvgarderingar: 8,
      maxRows: 4374, // 7 helg + 1 halvg = 3^7 * 2^1 = 4374
    },
  },
}

/**
 * Topptipset uses multiple product IDs for different draw variants
 * - 23: Saturday draws (Lördags-Topptipset)
 * - 24: Midweek draws variant
 * - 25: Regular Topptipset
 */
export const TOPPTIPSET_PRODUCT_IDS = [23, 24, 25]

/**
 * Check if a product ID is a Topptipset variant
 */
export function isTopptipsetProductId(productId: number): boolean {
  return TOPPTIPSET_PRODUCT_IDS.includes(productId)
}

/**
 * Get configuration for a specific game type
 * @param gameType - The game type identifier
 * @returns The game configuration
 * @throws Error if game type is not supported
 */
export function getGameConfig(gameType: GameType): GameConfig {
  const config = GAME_CONFIGS[gameType]
  if (!config) {
    throw new Error(`Unsupported game type: ${gameType}`)
  }
  return config
}

/**
 * Get all supported game types
 */
export function getAllGameTypes(): GameType[] {
  return Object.keys(GAME_CONFIGS) as GameType[]
}

/**
 * Get all game configs as an array (useful for UI dropdowns)
 */
export function getAllGameConfigs(): GameConfig[] {
  return Object.values(GAME_CONFIGS)
}

/**
 * Check if a game type supports official reduced systems
 */
export function hasOfficialSystems(gameType: GameType): boolean {
  return getGameConfig(gameType).hasOfficialSystems
}

/**
 * Get the total combination space for a game type
 * @returns Total possible outcomes (3^matchCount)
 */
export function getTotalCombinations(gameType: GameType): number {
  const config = getGameConfig(gameType)
  return Math.pow(3, config.matchCount)
}

/**
 * Calculate cost for a given number of rows and stake
 * @param gameType - The game type
 * @param rows - Number of rows
 * @param stake - Stake per row (defaults to minimum for game type)
 */
export function calculateCost(gameType: GameType, rows: number, stake?: number): number {
  const config = getGameConfig(gameType)
  const defaultStake = config.stakesOptions[0]
  if (defaultStake === undefined) {
    throw new Error(`No stakes options defined for ${gameType}`)
  }
  const actualStake = stake ?? defaultStake

  if (!config.stakesOptions.includes(actualStake)) {
    throw new Error(
      `Invalid stake ${actualStake} for ${gameType}. Valid stakes: ${config.stakesOptions.join(', ')}`
    )
  }

  return rows * actualStake
}
