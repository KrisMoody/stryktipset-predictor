/**
 * Game type definitions for multi-game support
 * Supports Stryktipset, Europatipset, and Topptipset
 */

/**
 * Supported game type identifiers
 */
export type GameType = 'stryktipset' | 'europatipset' | 'topptipset'

/**
 * Prize tier configuration
 */
export interface PrizeTier {
  /** Number of correct predictions required */
  correctCount: number
  /** Display name (e.g., "13 rätt", "12 rätt") */
  name: string
}

/**
 * Game-specific betting system rules
 */
export interface SystemRules {
  /** Maximum number of helgarderingar (full hedges - all 3 outcomes) */
  maxHelgarderingar: number
  /** Maximum number of halvgarderingar (half hedges - 2 outcomes) */
  maxHalvgarderingar: number
  /** Maximum total rows allowed */
  maxRows: number
}

/**
 * Complete game configuration
 */
export interface GameConfig {
  /** Unique game identifier */
  id: GameType
  /** Internal name (lowercase, used in API paths) */
  name: string
  /** Display name for UI */
  displayName: string
  /** Number of matches per round */
  matchCount: number
  /** Payout percentage (e.g., 65 for 65%) */
  payoutPercentage: number
  /** Prize tier structure */
  prizeTiers: PrizeTier[]
  /** Whether Svenska Spel provides official R/U-systems */
  hasOfficialSystems: boolean
  /** Available stake amounts in SEK */
  stakesOptions: number[]
  /** API path segment (e.g., '/draw/1/stryktipset') */
  apiPath: string
  /** Svenska Spel product ID */
  productId: number
  /** Base path for scraping URLs */
  scrapeBasePath: string
  /** System betting rules */
  systemRules: SystemRules
}

/**
 * Type guard to check if a string is a valid GameType
 */
export function isValidGameType(value: string): value is GameType {
  return ['stryktipset', 'europatipset', 'topptipset'].includes(value)
}

/**
 * Default game type for backward compatibility
 */
export const DEFAULT_GAME_TYPE: GameType = 'stryktipset'
