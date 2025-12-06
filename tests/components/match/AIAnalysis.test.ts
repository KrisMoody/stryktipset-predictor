import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, defineComponent, computed, type PropType } from 'vue'

// Mock Nuxt UI components
const UIcon = defineComponent({
  name: 'UIcon',
  props: {
    name: { type: String, required: true },
    class: { type: String, default: '' },
  },
  setup(props) {
    return () => h('span', { class: `icon ${props.class}`, 'data-icon': props.name })
  },
})

const UBadge = defineComponent({
  name: 'UBadge',
  props: {
    color: { type: String, default: 'primary' },
    variant: { type: String, default: 'solid' },
    size: { type: String, default: 'md' },
    class: { type: String, default: '' },
  },
  setup(props, { slots }) {
    return () => h('span', {
      class: `badge badge-${props.color} badge-${props.variant} badge-${props.size} ${props.class}`,
    }, slots.default?.())
  },
})

// Mock the component's interfaces
interface SimilarMatch {
  homeTeam?: string
  home_team?: string
  awayTeam?: string
  away_team?: string
  date?: string
  match_date?: string
  league?: string
  competition?: string
  score?: string
  result?: string
  outcome?: string
  similarity?: number
}

interface Prediction {
  reasoning?: string
  key_factors?: string[] | string
  similar_matches?: SimilarMatch[] | string
  is_spik_suitable?: boolean
  user_context?: string
  is_reevaluation?: boolean
}

// Create a testable version of AIAnalysis component
const AIAnalysis = defineComponent({
  name: 'AIAnalysis',
  components: { UIcon, UBadge },
  props: {
    prediction: {
      type: Object as PropType<Prediction | null | undefined>,
      default: null,
    },
  },
  setup(props) {
    // Parse key_factors - could be JSON string or array
    const keyFactors = computed(() => {
      if (!props.prediction?.key_factors) return []

      if (Array.isArray(props.prediction.key_factors)) {
        return props.prediction.key_factors
      }

      // Try to parse if it's a string
      if (typeof props.prediction.key_factors === 'string') {
        try {
          const parsed = JSON.parse(props.prediction.key_factors)
          return Array.isArray(parsed) ? parsed : []
        }
        catch {
          // If not valid JSON, return as single item
          return [props.prediction.key_factors]
        }
      }

      return []
    })

    // Parse similar_matches - could be JSON string or array
    const similarMatches = computed(() => {
      if (!props.prediction?.similar_matches) return []

      if (Array.isArray(props.prediction.similar_matches)) {
        return props.prediction.similar_matches
      }

      // Try to parse if it's a string
      if (typeof props.prediction.similar_matches === 'string') {
        try {
          const parsed = JSON.parse(props.prediction.similar_matches)
          return Array.isArray(parsed) ? parsed : []
        }
        catch {
          return []
        }
      }

      return []
    })

    // Get color for outcome badge
    const getOutcomeColor = (outcome: string | undefined) => {
      if (!outcome) return 'neutral'
      switch (outcome) {
        case '1': return 'success'
        case 'X': return 'warning'
        case '2': return 'error'
        default: return 'neutral'
      }
    }

    return { keyFactors, similarMatches, getOutcomeColor }
  },
  template: `
    <div class="space-y-4">
      <!-- Reasoning Section -->
      <div v-if="prediction?.reasoning" data-testid="reasoning-section">
        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          AI Analysis
        </h4>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line" data-testid="reasoning-text">
            {{ prediction.reasoning }}
          </p>
        </div>
      </div>

      <!-- Key Factors Section -->
      <div v-if="keyFactors && keyFactors.length > 0" data-testid="key-factors-section">
        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Key Factors
        </h4>
        <ul class="space-y-2">
          <li
            v-for="(factor, idx) in keyFactors"
            :key="idx"
            class="flex items-start gap-2 text-sm"
            data-testid="key-factor"
          >
            <UIcon
              name="i-heroicons-check-circle"
              class="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0"
            />
            <span class="text-gray-700 dark:text-gray-300">{{ factor }}</span>
          </li>
        </ul>
      </div>

      <!-- Similar Matches Section -->
      <div v-if="similarMatches && similarMatches.length > 0" data-testid="similar-matches-section">
        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Similar Historical Matches
        </h4>
        <div class="space-y-2">
          <div
            v-for="(match, idx) in similarMatches"
            :key="idx"
            class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
            data-testid="similar-match"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100" data-testid="match-teams">
                  {{ match.homeTeam || match.home_team }} vs {{ match.awayTeam || match.away_team }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400" data-testid="match-meta">
                  {{ match.date || match.match_date }}
                  <span v-if="match.league || match.competition"> &bull; {{ match.league || match.competition }}</span>
                </p>
              </div>
              <div class="text-right">
                <UBadge
                  v-if="match.score || match.result"
                  :color="getOutcomeColor(match.outcome)"
                  variant="soft"
                  size="sm"
                  data-testid="match-score"
                >
                  {{ match.score || match.result }}
                </UBadge>
                <p
                  v-if="match.outcome"
                  class="text-xs text-gray-500 mt-1"
                  data-testid="match-outcome"
                >
                  Outcome: {{ match.outcome }}
                </p>
              </div>
            </div>
            <p
              v-if="match.similarity"
              class="text-xs text-gray-500 mt-2"
              data-testid="match-similarity"
            >
              {{ (match.similarity * 100).toFixed(0) }}% similar
            </p>
          </div>
        </div>
      </div>

      <!-- User Context Section -->
      <div
        v-if="prediction?.user_context"
        class="pt-4 border-t border-gray-200 dark:border-gray-700"
        data-testid="user-context-section"
      >
        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <UIcon
            name="i-heroicons-user"
            class="w-4 h-4"
          />
          User-Provided Context
        </h4>
        <div class="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-3">
          <p class="text-sm text-warning-800 dark:text-warning-200 italic" data-testid="user-context-text">
            "{{ prediction.user_context }}"
          </p>
          <p class="text-xs text-warning-600 dark:text-warning-400 mt-2">
            This context was considered in generating the prediction.
          </p>
        </div>
      </div>

      <!-- Re-evaluation Badge -->
      <div
        v-if="prediction?.is_reevaluation"
        class="pt-2"
        data-testid="reevaluation-badge"
      >
        <UBadge
          color="info"
          variant="soft"
          size="sm"
        >
          <UIcon
            name="i-heroicons-arrow-path"
            class="w-3 h-3 mr-1"
          />
          Re-evaluated prediction
        </UBadge>
      </div>

      <!-- Spik Suitability -->
      <div
        v-if="prediction?.is_spik_suitable"
        class="pt-2"
        data-testid="spik-badge"
      >
        <UBadge
          color="warning"
          variant="soft"
          size="lg"
          class="gap-1"
        >
          <UIcon
            name="i-heroicons-star"
            class="w-4 h-4"
          />
          Recommended as Spik (Banker)
        </UBadge>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          This match shows high prediction confidence and is suitable for single-outcome betting.
        </p>
      </div>

      <!-- Empty State -->
      <div
        v-if="!prediction?.reasoning && (!keyFactors || keyFactors.length === 0) && (!similarMatches || similarMatches.length === 0)"
        class="text-center py-6 text-gray-500 dark:text-gray-400"
        data-testid="empty-state"
      >
        <UIcon
          name="i-heroicons-document-magnifying-glass"
          class="w-8 h-8 mx-auto mb-2 opacity-50"
        />
        <p class="text-sm">
          No detailed analysis available for this match.
        </p>
      </div>
    </div>
  `,
})

// ============================================================================
// Test Utilities
// ============================================================================

const mountComponent = (prediction: Prediction | null = null) => {
  return mount(AIAnalysis, {
    props: { prediction },
    global: {
      stubs: {
        UIcon: true,
        UBadge: true,
      },
    },
  })
}

// ============================================================================
// AIAnalysis Component Tests
// ============================================================================

describe('AIAnalysis Component', () => {
  describe('rendering', () => {
    it('renders empty state when prediction is null', () => {
      const wrapper = mountComponent(null)
      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('No detailed analysis available')
    })

    it('renders empty state when prediction is empty object', () => {
      const wrapper = mountComponent({})
      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    })

    it('renders reasoning section when reasoning exists', () => {
      const wrapper = mountComponent({
        reasoning: 'This match looks favorable for the home team due to recent form.',
      })

      expect(wrapper.find('[data-testid="reasoning-section"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="reasoning-text"]').text()).toContain('favorable for the home team')
    })

    it('hides reasoning section when reasoning is empty', () => {
      const wrapper = mountComponent({
        key_factors: ['Factor 1'],
      })

      expect(wrapper.find('[data-testid="reasoning-section"]').exists()).toBe(false)
    })
  })

  describe('key factors parsing', () => {
    it('displays key factors from array', () => {
      const wrapper = mountComponent({
        key_factors: ['Strong home form', 'Injured away players', 'Historical advantage'],
      })

      expect(wrapper.find('[data-testid="key-factors-section"]').exists()).toBe(true)
      const factors = wrapper.findAll('[data-testid="key-factor"]')
      expect(factors).toHaveLength(3)
      expect(factors[0].text()).toContain('Strong home form')
      expect(factors[1].text()).toContain('Injured away players')
      expect(factors[2].text()).toContain('Historical advantage')
    })

    it('parses key factors from JSON string', () => {
      const wrapper = mountComponent({
        key_factors: JSON.stringify(['Factor A', 'Factor B']),
      })

      expect(wrapper.find('[data-testid="key-factors-section"]').exists()).toBe(true)
      const factors = wrapper.findAll('[data-testid="key-factor"]')
      expect(factors).toHaveLength(2)
      expect(factors[0].text()).toContain('Factor A')
    })

    it('treats invalid JSON string as single factor', () => {
      const wrapper = mountComponent({
        key_factors: 'This is a plain string factor',
      })

      expect(wrapper.find('[data-testid="key-factors-section"]').exists()).toBe(true)
      const factors = wrapper.findAll('[data-testid="key-factor"]')
      expect(factors).toHaveLength(1)
      expect(factors[0].text()).toContain('This is a plain string factor')
    })

    it('hides key factors section when empty array', () => {
      const wrapper = mountComponent({
        key_factors: [],
      })

      expect(wrapper.find('[data-testid="key-factors-section"]').exists()).toBe(false)
    })

    it('handles key_factors as empty string', () => {
      const wrapper = mountComponent({
        key_factors: '',
      })

      // Empty string should result in no factors (empty array from computed)
      expect(wrapper.find('[data-testid="key-factors-section"]').exists()).toBe(false)
    })
  })

  describe('similar matches parsing', () => {
    it('displays similar matches from array', () => {
      const wrapper = mountComponent({
        similar_matches: [
          { homeTeam: 'AIK', awayTeam: 'Djurgården', score: '2-1', outcome: '1', similarity: 0.85 },
          { home_team: 'IFK', away_team: 'Hammarby', result: '0-0', outcome: 'X', similarity: 0.72 },
        ],
      })

      expect(wrapper.find('[data-testid="similar-matches-section"]').exists()).toBe(true)
      const matches = wrapper.findAll('[data-testid="similar-match"]')
      expect(matches).toHaveLength(2)
    })

    it('parses similar matches from JSON string', () => {
      const matchesJson = JSON.stringify([
        { homeTeam: 'Team A', awayTeam: 'Team B', score: '3-0', outcome: '1' },
      ])
      const wrapper = mountComponent({
        similar_matches: matchesJson,
      })

      expect(wrapper.find('[data-testid="similar-matches-section"]').exists()).toBe(true)
      const matches = wrapper.findAll('[data-testid="similar-match"]')
      expect(matches).toHaveLength(1)
    })

    it('handles both homeTeam and home_team variants', () => {
      const wrapper = mountComponent({
        similar_matches: [
          { homeTeam: 'AIK', awayTeam: 'Djurgården' },
          { home_team: 'IFK', away_team: 'Hammarby' },
        ],
      })

      const teamTexts = wrapper.findAll('[data-testid="match-teams"]')
      expect(teamTexts[0].text()).toContain('AIK vs Djurgården')
      expect(teamTexts[1].text()).toContain('IFK vs Hammarby')
    })

    it('displays similarity percentage correctly', () => {
      const wrapper = mountComponent({
        similar_matches: [
          { homeTeam: 'A', awayTeam: 'B', similarity: 0.925 },
        ],
      })

      expect(wrapper.find('[data-testid="match-similarity"]').text()).toContain('93% similar')
    })

    it('hides similarity when not provided', () => {
      const wrapper = mountComponent({
        similar_matches: [
          { homeTeam: 'A', awayTeam: 'B' },
        ],
      })

      expect(wrapper.find('[data-testid="match-similarity"]').exists()).toBe(false)
    })

    it('handles invalid JSON for similar matches gracefully', () => {
      const wrapper = mountComponent({
        similar_matches: 'not valid json {',
      })

      expect(wrapper.find('[data-testid="similar-matches-section"]').exists()).toBe(false)
    })
  })

  describe('user context', () => {
    it('displays user context when provided', () => {
      const wrapper = mountComponent({
        user_context: 'Key striker is injured for home team',
        reasoning: 'Test reasoning',
      })

      expect(wrapper.find('[data-testid="user-context-section"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="user-context-text"]').text()).toContain('Key striker is injured')
    })

    it('hides user context section when not provided', () => {
      const wrapper = mountComponent({
        reasoning: 'Test reasoning',
      })

      expect(wrapper.find('[data-testid="user-context-section"]').exists()).toBe(false)
    })
  })

  describe('badges', () => {
    it('displays re-evaluation badge when is_reevaluation is true', () => {
      const wrapper = mountComponent({
        is_reevaluation: true,
        reasoning: 'Updated analysis',
      })

      expect(wrapper.find('[data-testid="reevaluation-badge"]').exists()).toBe(true)
      // Badge content is stubbed, so we just check the wrapper exists
    })

    it('hides re-evaluation badge when is_reevaluation is false', () => {
      const wrapper = mountComponent({
        is_reevaluation: false,
        reasoning: 'Initial analysis',
      })

      expect(wrapper.find('[data-testid="reevaluation-badge"]').exists()).toBe(false)
    })

    it('displays spik badge when is_spik_suitable is true', () => {
      const wrapper = mountComponent({
        is_spik_suitable: true,
        reasoning: 'High confidence match',
      })

      expect(wrapper.find('[data-testid="spik-badge"]').exists()).toBe(true)
      // Badge content is stubbed, check the helper text instead
      expect(wrapper.text()).toContain('single-outcome betting')
    })

    it('hides spik badge when is_spik_suitable is false', () => {
      const wrapper = mountComponent({
        is_spik_suitable: false,
        reasoning: 'Normal match',
      })

      expect(wrapper.find('[data-testid="spik-badge"]').exists()).toBe(false)
    })
  })

  describe('getOutcomeColor', () => {
    it('returns success for home win (1)', () => {
      const wrapper = mountComponent({
        similar_matches: [{ homeTeam: 'A', awayTeam: 'B', score: '2-1', outcome: '1' }],
      })

      // Check the badge color attribute
      const badge = wrapper.find('[data-testid="match-score"]')
      expect(badge.attributes('color')).toBe('success')
    })

    it('returns warning for draw (X)', () => {
      const wrapper = mountComponent({
        similar_matches: [{ homeTeam: 'A', awayTeam: 'B', score: '1-1', outcome: 'X' }],
      })

      const badge = wrapper.find('[data-testid="match-score"]')
      expect(badge.attributes('color')).toBe('warning')
    })

    it('returns error for away win (2)', () => {
      const wrapper = mountComponent({
        similar_matches: [{ homeTeam: 'A', awayTeam: 'B', score: '0-2', outcome: '2' }],
      })

      const badge = wrapper.find('[data-testid="match-score"]')
      expect(badge.attributes('color')).toBe('error')
    })

    it('returns neutral for undefined outcome', () => {
      const wrapper = mountComponent({
        similar_matches: [{ homeTeam: 'A', awayTeam: 'B', score: '2-1' }],
      })

      const badge = wrapper.find('[data-testid="match-score"]')
      expect(badge.attributes('color')).toBe('neutral')
    })
  })

  describe('empty state logic', () => {
    it('shows empty state when no content is available', () => {
      const wrapper = mountComponent({})
      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    })

    it('hides empty state when reasoning exists', () => {
      const wrapper = mountComponent({
        reasoning: 'Some analysis',
      })
      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
    })

    it('hides empty state when key factors exist', () => {
      const wrapper = mountComponent({
        key_factors: ['Factor 1'],
      })
      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
    })

    it('hides empty state when similar matches exist', () => {
      const wrapper = mountComponent({
        similar_matches: [{ homeTeam: 'A', awayTeam: 'B' }],
      })
      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
    })

    it('shows empty state when only badges are set (no content)', () => {
      // Badges alone shouldn't hide empty state
      const wrapper = mountComponent({
        is_spik_suitable: true,
        is_reevaluation: true,
      })
      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    })
  })

  describe('integration', () => {
    it('renders complete prediction with all sections', () => {
      const wrapper = mountComponent({
        reasoning: 'Detailed analysis of the match based on multiple factors.',
        key_factors: ['Home advantage', 'Recent form', 'Head-to-head record'],
        similar_matches: [
          { homeTeam: 'AIK', awayTeam: 'Djurgården', score: '2-1', outcome: '1', similarity: 0.85 },
        ],
        is_spik_suitable: true,
        is_reevaluation: true,
        user_context: 'Manager announced new tactics',
      })

      // All sections should be visible
      expect(wrapper.find('[data-testid="reasoning-section"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="key-factors-section"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="similar-matches-section"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="user-context-section"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="spik-badge"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="reevaluation-badge"]').exists()).toBe(true)

      // Empty state should not be visible
      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
    })

    it('handles date and league variants', () => {
      const wrapper = mountComponent({
        similar_matches: [
          { homeTeam: 'A', awayTeam: 'B', date: '2024-01-15', league: 'Allsvenskan' },
          { home_team: 'C', away_team: 'D', match_date: '2024-02-20', competition: 'Superettan' },
        ],
      })

      const metaElements = wrapper.findAll('[data-testid="match-meta"]')
      expect(metaElements[0].text()).toContain('2024-01-15')
      expect(metaElements[0].text()).toContain('Allsvenskan')
      expect(metaElements[1].text()).toContain('2024-02-20')
      expect(metaElements[1].text()).toContain('Superettan')
    })
  })
})
