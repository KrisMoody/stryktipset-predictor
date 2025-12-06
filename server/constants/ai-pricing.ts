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
 * Calculate cost for AI usage
 */
export function calculateAICost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  // Find matching model pricing
  const pricing = Object.values(AI_PRICING).find(p => p.model === model)

  if (!pricing) {
    console.warn(`[AI Pricing] Unknown model: ${model}, using default pricing`)
    return 0
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion

  return inputCost + outputCost
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
