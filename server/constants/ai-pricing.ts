/**
 * AI Model Pricing Constants
 * All prices are in USD per 1 million tokens
 */

export const AI_PRICING = {
  // Anthropic Claude models
  CLAUDE_HAIKU_4_5: {
    model: 'claude-haiku-4-5',
    inputPricePerMillion: 1.0,
    outputPricePerMillion: 5.0,
    description: 'Claude 4.5 Haiku - Used for web scraping',
  },
  CLAUDE_SONNET_3_5: {
    model: 'claude-3-5-sonnet',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    description: 'Claude 3.5 Sonnet - Legacy model',
  },
  CLAUDE_SONNET_4_5: {
    model: 'claude-sonnet-4-5',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    description: 'Claude Sonnet 4.5 - Used for match predictions',
  },
  CLAUDE_OPUS_4_5: {
    model: 'claude-opus-4-5',
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
    description: 'Claude Opus 4.5 - Premium model for high-stakes predictions',
  },

  // OpenAI models
  TEXT_EMBEDDING_3_SMALL: {
    model: 'text-embedding-3-small',
    inputPricePerMillion: 0.02,
    outputPricePerMillion: 0, // Embeddings don't have output tokens
    description: 'OpenAI text-embedding-3-small - Used for vector embeddings',
  },
} as const

export type AIModel = keyof typeof AI_PRICING

/**
 * Cache pricing multipliers for prompt caching
 * Cache write: 25% more than regular input price
 * Cache read: 90% less than regular input price (10% of regular)
 */
export const CACHE_PRICING_MULTIPLIERS = {
  cacheWriteMultiplier: 1.25, // 25% more expensive to write
  cacheReadMultiplier: 0.1, // 90% cheaper to read from cache
} as const

/**
 * Calculate cost for AI usage with optional cache token support
 */
export function calculateAICost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number = 0,
  cacheReadTokens: number = 0
): number {
  // Find matching model pricing
  const pricing = Object.values(AI_PRICING).find(p => p.model === model)

  if (!pricing) {
    console.warn(`[AI Pricing] Unknown model: ${model}, using default pricing`)
    return 0
  }

  // Regular input tokens (excluding cache tokens)
  const regularInputTokens = inputTokens - cacheCreationTokens - cacheReadTokens
  const inputCost = (regularInputTokens / 1_000_000) * pricing.inputPricePerMillion

  // Cache write cost (25% more than regular)
  const cacheWriteCost =
    (cacheCreationTokens / 1_000_000) *
    pricing.inputPricePerMillion *
    CACHE_PRICING_MULTIPLIERS.cacheWriteMultiplier

  // Cache read cost (90% cheaper than regular)
  const cacheReadCost =
    (cacheReadTokens / 1_000_000) *
    pricing.inputPricePerMillion *
    CACHE_PRICING_MULTIPLIERS.cacheReadMultiplier

  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion

  return inputCost + cacheWriteCost + cacheReadCost + outputCost
}

/**
 * Get model pricing information
 */
export function getModelPricing(model: string) {
  return Object.values(AI_PRICING).find(p => p.model === model)
}

/**
 * Format cost as USD string
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(6)}`
}

/**
 * Get all supported models
 */
export function getSupportedModels(): string[] {
  return Object.values(AI_PRICING).map(p => p.model)
}
