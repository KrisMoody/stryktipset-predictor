import { Anthropic } from '@anthropic-ai/sdk'
import { recordAIUsage } from '~/server/utils/ai-usage-recorder'
import { captureAIError } from '~/server/utils/bugsnag-helpers'
import { calculateAICost } from '~/server/constants/ai-pricing'
import type { CouponSelection, BettingSystem, HedgeAssignment } from '~/types'

/**
 * AI response structure for hedge assignment
 */
interface AIHedgeResponse {
  reasoning: string
  match_assignments: Array<{
    matchNumber: number
    assignment: 'spik' | 'helgarderad' | 'halvgarderad'
    spikOutcome?: string
    reasoning: string
  }>
  validation: {
    spikCount: number
    helgCount: number
    halvgCount: number
    totalMatches: number
    meetsSystemRequirements: boolean
  }
}

/**
 * Service for generating hedge assignments using AI with algorithmic fallback
 */
export class HedgeAssignmentService {
  private anthropic: Anthropic | null = null

  /**
   * Lazily initialize and return Anthropic client
   */
  private getAnthropicClient(): Anthropic {
    if (!this.anthropic) {
      const apiKey = useRuntimeConfig().anthropicApiKey
      if (!apiKey) {
        throw new Error('Anthropic API key not configured')
      }
      this.anthropic = new Anthropic({ apiKey })
    }
    return this.anthropic
  }

  /**
   * Main entry point - tries AI first, falls back to algorithmic
   */
  async generateHedgeAssignment(
    predictions: CouponSelection[],
    system: BettingSystem,
    matchCount: number,
    options?: { userId?: string; useAI?: boolean }
  ): Promise<HedgeAssignment> {
    const useAI = options?.useAI ?? true

    if (useAI) {
      try {
        const aiAssignment = await this.generateAIHedgeAssignment(
          predictions,
          system,
          matchCount,
          options?.userId
        )

        if (aiAssignment && this.validateHedgeAssignment(aiAssignment, system, matchCount)) {
          console.log('[HedgeAssignmentService] Using AI-powered assignment')
          return aiAssignment
        } else if (aiAssignment) {
          console.warn('[HedgeAssignmentService] AI assignment failed validation, using fallback')
        }
      } catch (error) {
        console.warn(
          '[HedgeAssignmentService] AI assignment failed, using algorithmic fallback:',
          error
        )
      }
    }

    console.log('[HedgeAssignmentService] Using algorithmic assignment')
    return this.generateAlgorithmicHedgeAssignment(predictions, system, matchCount)
  }

  /**
   * System prompt for AI hedge assignment (cached for efficiency)
   */
  private static readonly HEDGE_ASSIGNMENT_SYSTEM_PROMPT = `You are an expert Swedish football betting strategist specializing in reduced betting systems (R-systems and U-systems). Your task is to assign hedging strategies to matches based on AI predictions and system constraints.

HEDGING TYPES:
1. SPIK (single outcome): High confidence, one outcome only (1, X, or 2)
2. HELGARDERAD (full hedge): Cover all three outcomes (1, X, 2) - for most uncertain matches
3. HALVGARDERAD (half hedge): Cover two outcomes - for medium uncertainty

CRITICAL CONSTRAINTS:
- Total matches must equal: Spiks + Helgarderingar + Halvgarderingar
- Helgarderingar count must be EXACTLY as specified in system requirements
- Halvgarderingar count must be EXACTLY as specified in system requirements
- Spiks count = Total matches - Helgarderingar - Halvgarderingar

ASSIGNMENT STRATEGY:
1. LOW confidence matches (confidence='low') -> NEVER spiks, strongly prefer helgarderad (full coverage)
2. MEDIUM confidence matches -> Consider for halvgarderad (partial coverage)
3. HIGH confidence matches with suitable_as_spik=true -> Strong spik candidates
4. Consider match-specific factors:
   - Key player injuries/suspensions -> More uncertainty -> Need coverage
   - Strong home advantage -> Higher confidence
   - Form streaks (winning/losing) -> Impact confidence
   - League position disparity -> May indicate clear favorite
   - Historical head-to-head -> Pattern recognition

STRATEGIC REASONING:
- Which matches are truly unpredictable? -> Full hedge (helgarderad)
- Which matches have two likely outcomes? -> Half hedge (halvgarderad)
- Which matches are highly predictable? -> Spik
- Balance: Too many spiks = high risk, too few = high cost

OUTPUT FORMAT (JSON):
{
  "reasoning": "Overall strategy explanation for this hedge assignment",
  "match_assignments": [
    {
      "matchNumber": 1,
      "assignment": "spik" | "helgarderad" | "halvgarderad",
      "spikOutcome": "1" or "X" or "2" (ONLY if assignment is "spik"),
      "reasoning": "Specific reasoning for this match's assignment"
    }
  ],
  "validation": {
    "spikCount": N,
    "helgCount": N,
    "halvgCount": N,
    "totalMatches": N,
    "meetsSystemRequirements": true
  }
}

CRITICAL: Validate counts before responding. If validation fails, adjust assignments until constraints are met.`

  /**
   * Prepare the user prompt with match predictions and system constraints
   */
  private prepareHedgeAssignmentPrompt(
    predictions: CouponSelection[],
    system: BettingSystem,
    matchCount: number
  ): string {
    const parts: string[] = []

    parts.push('SYSTEM REQUIREMENTS')
    parts.push('===================')
    parts.push(`System: ${system.id} (${system.type}-system)`)
    parts.push(`Helgarderingar required: ${system.helgarderingar} (EXACTLY)`)
    parts.push(`Halvgarderingar required: ${system.halvgarderingar} (EXACTLY)`)
    parts.push(`Total matches: ${matchCount}`)
    parts.push(`Calculated spiks: ${matchCount - system.helgarderingar - system.halvgarderingar}`)
    parts.push(`Rows in system: ${system.rows}`)
    if (system.guarantee) {
      parts.push(`Guarantee level: ${system.guarantee}-ratt`)
    }
    parts.push('')

    parts.push('MATCH PREDICTIONS')
    parts.push('=================')

    for (const pred of predictions) {
      parts.push(`Match ${pred.matchNumber}: ${pred.homeTeam} vs ${pred.awayTeam}`)
      parts.push(`  Selection: ${pred.selection}`)
      parts.push(`  Suitable as spik: ${pred.is_spik ? 'YES' : 'NO'}`)
      parts.push(`  Expected Value: ${pred.expected_value.toFixed(2)}`)
      parts.push(`  AI Reasoning: ${pred.reasoning}`)
      parts.push('')
    }

    parts.push('YOUR TASK')
    parts.push('=========')
    parts.push('Assign hedging strategy to each match that EXACTLY satisfies:')
    parts.push(`- ${system.helgarderingar} matches as "helgarderad" (full hedge: 1X2)`)
    parts.push(`- ${system.halvgarderingar} matches as "halvgarderad" (half hedge: 2 outcomes)`)
    parts.push(
      `- ${matchCount - system.helgarderingar - system.halvgarderingar} matches as "spik" (single outcome)`
    )
    parts.push('')
    parts.push('IMPORTANT RULES:')
    parts.push('1. Matches with is_spik=NO should NOT be spiks unless absolutely necessary')
    parts.push('2. Consider strategic value: which matches need coverage vs can be safely spiked')
    parts.push('3. Counts must be EXACT - validate before returning')
    parts.push('4. For spiks, specify which outcome (1, X, or 2) based on the prediction')
    parts.push('5. Provide clear reasoning for each assignment decision')

    return parts.join('\n')
  }

  /**
   * AI-powered assignment using Claude
   */
  private async generateAIHedgeAssignment(
    predictions: CouponSelection[],
    system: BettingSystem,
    matchCount: number,
    userId?: string
  ): Promise<HedgeAssignment | null> {
    const startTime = Date.now()

    try {
      const anthropic = this.getAnthropicClient()
      const userPrompt = this.prepareHedgeAssignmentPrompt(predictions, system, matchCount)

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        system: [
          {
            type: 'text',
            text: HedgeAssignmentService.HEDGE_ASSIGNMENT_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      })

      const content = message.content[0]
      if (!content || content.type !== 'text') {
        throw new Error('Invalid response from Claude')
      }

      // Extract JSON from response
      const jsonMatch =
        content.text.match(/```json\n?([\s\S]*?)\n?```/) || content.text.match(/({[\s\S]*})/)
      if (!jsonMatch?.[1]) {
        throw new Error('Could not extract JSON from Claude response')
      }

      const aiResponse: AIHedgeResponse = JSON.parse(jsonMatch[1])

      // Validate response structure
      if (!aiResponse.match_assignments || !Array.isArray(aiResponse.match_assignments)) {
        throw new Error('Invalid AI response structure')
      }

      // Convert to HedgeAssignment format
      const assignment: HedgeAssignment = {
        spiks: [],
        helgarderingar: [],
        halvgarderingar: [],
        spikOutcomes: {},
      }

      for (const ma of aiResponse.match_assignments) {
        if (ma.assignment === 'spik') {
          assignment.spiks.push(ma.matchNumber)
          // Get spik outcome from AI or fall back to prediction
          const pred = predictions.find(p => p.matchNumber === ma.matchNumber)
          const outcome =
            ma.spikOutcome ||
            (pred?.selection.length === 1 ? pred.selection : pred?.selection[0]) ||
            '1'
          assignment.spikOutcomes[ma.matchNumber] = outcome
        } else if (ma.assignment === 'helgarderad') {
          assignment.helgarderingar.push(ma.matchNumber)
        } else if (ma.assignment === 'halvgarderad') {
          assignment.halvgarderingar.push(ma.matchNumber)
        }
      }

      // Track AI usage
      const duration = Date.now() - startTime
      const inputTokens = message.usage.input_tokens
      const outputTokens = message.usage.output_tokens
      const cacheCreationTokens =
        'cache_creation_input_tokens' in message.usage
          ? (message.usage.cache_creation_input_tokens as number)
          : 0
      const cacheReadTokens =
        'cache_read_input_tokens' in message.usage
          ? (message.usage.cache_read_input_tokens as number)
          : 0

      const cost = calculateAICost(
        'claude-sonnet-4-5',
        inputTokens,
        outputTokens,
        cacheCreationTokens,
        cacheReadTokens
      )

      await recordAIUsage({
        userId,
        model: 'claude-sonnet-4-5',
        inputTokens,
        outputTokens,
        cost,
        dataType: 'hedge_assignment',
        operationId: `system_${system.id}`,
        endpoint: 'messages.create',
        duration,
        success: true,
      }).catch(err => console.error('Failed to record AI usage:', err))

      const cacheInfo =
        cacheCreationTokens > 0 || cacheReadTokens > 0
          ? ` (cache: ${cacheCreationTokens} write, ${cacheReadTokens} read)`
          : ''
      console.log(
        `[HedgeAssignmentService] AI usage: ${inputTokens} in, ${outputTokens} out, $${cost.toFixed(6)}, ${duration}ms${cacheInfo}`
      )
      console.log(`[HedgeAssignmentService] AI reasoning: ${aiResponse.reasoning}`)

      return assignment
    } catch (error) {
      const duration = Date.now() - startTime

      // Report to Bugsnag with AI context
      captureAIError(error, {
        model: 'claude-sonnet-4-5',
        operation: 'hedge_assignment',
        dataType: 'hedge_assignment',
      })

      await recordAIUsage({
        userId,
        model: 'claude-sonnet-4-5',
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        dataType: 'hedge_assignment',
        operationId: `system_${system.id}`,
        endpoint: 'messages.create',
        duration,
        success: false,
      }).catch(err => console.error('Failed to record AI usage error:', err))

      console.error('[HedgeAssignmentService] Error in AI assignment:', error)
      return null
    }
  }

  /**
   * Algorithmic fallback (EV-based sorting with correct constraints)
   */
  generateAlgorithmicHedgeAssignment(
    predictions: CouponSelection[],
    system: BettingSystem,
    matchCount: number
  ): HedgeAssignment {
    const totalHedges = system.helgarderingar + system.halvgarderingar
    const totalSpiks = matchCount - totalHedges

    // Sort matches by confidence (spik-suitable first, then by EV)
    const sorted = [...predictions].sort((a, b) => {
      if (a.is_spik && !b.is_spik) return -1
      if (!a.is_spik && b.is_spik) return 1
      return b.expected_value - a.expected_value
    })

    const spiks: number[] = []
    const helgarderingar: number[] = []
    const halvgarderingar: number[] = []
    const spikOutcomes: Record<number, string> = {}

    // Assign spiks (top N high-confidence matches)
    for (let i = 0; i < totalSpiks && i < sorted.length; i++) {
      const sel = sorted[i]!
      spiks.push(sel.matchNumber)
      spikOutcomes[sel.matchNumber] = sel.selection.length === 1 ? sel.selection : sel.selection[0]!
    }

    // Assign helgarderingar and halvgarderingar to remaining matches
    const remaining = sorted.slice(totalSpiks)

    // Sort remaining by uncertainty (lowest EV = most uncertain = needs full hedge)
    const sortedByUncertainty = remaining.sort((a, b) => a.expected_value - b.expected_value)

    // Assign helgarderingar (most uncertain matches) - EXACTLY system.helgarderingar count
    for (let i = 0; i < system.helgarderingar && i < sortedByUncertainty.length; i++) {
      helgarderingar.push(sortedByUncertainty[i]!.matchNumber)
    }

    // Assign halvgarderingar - EXACTLY system.halvgarderingar count
    const halvgEnd = system.helgarderingar + system.halvgarderingar
    for (let i = system.helgarderingar; i < halvgEnd && i < sortedByUncertainty.length; i++) {
      halvgarderingar.push(sortedByUncertainty[i]!.matchNumber)
    }

    return {
      spiks,
      helgarderingar,
      halvgarderingar,
      spikOutcomes,
    }
  }

  /**
   * Validate hedge assignment meets system requirements
   */
  validateHedgeAssignment(
    assignment: HedgeAssignment,
    system: BettingSystem,
    matchCount: number
  ): boolean {
    // Check exact counts
    if (assignment.helgarderingar.length !== system.helgarderingar) {
      console.warn(
        `[HedgeAssignmentService] Validation failed: helgarderingar count ${assignment.helgarderingar.length} !== ${system.helgarderingar}`
      )
      return false
    }
    if (assignment.halvgarderingar.length !== system.halvgarderingar) {
      console.warn(
        `[HedgeAssignmentService] Validation failed: halvgarderingar count ${assignment.halvgarderingar.length} !== ${system.halvgarderingar}`
      )
      return false
    }

    const expectedSpiks = matchCount - system.helgarderingar - system.halvgarderingar
    if (assignment.spiks.length !== expectedSpiks) {
      console.warn(
        `[HedgeAssignmentService] Validation failed: spiks count ${assignment.spiks.length} !== ${expectedSpiks}`
      )
      return false
    }

    // Check all matches assigned exactly once
    const allMatches = new Set([
      ...assignment.spiks,
      ...assignment.helgarderingar,
      ...assignment.halvgarderingar,
    ])
    if (allMatches.size !== matchCount) {
      console.warn(
        `[HedgeAssignmentService] Validation failed: total unique matches ${allMatches.size} !== ${matchCount}`
      )
      return false
    }

    // Check for duplicates
    const totalAssigned =
      assignment.spiks.length + assignment.helgarderingar.length + assignment.halvgarderingar.length
    if (totalAssigned !== matchCount) {
      console.warn(
        `[HedgeAssignmentService] Validation failed: total assigned ${totalAssigned} !== ${matchCount} (possible duplicates)`
      )
      return false
    }

    // Check all spiks have outcomes
    for (const spikMatch of assignment.spiks) {
      if (!assignment.spikOutcomes[spikMatch]) {
        console.warn(
          `[HedgeAssignmentService] Validation failed: missing spikOutcome for match ${spikMatch}`
        )
        return false
      }
    }

    return true
  }
}

// Export singleton instance
export const hedgeAssignmentService = new HedgeAssignmentService()
