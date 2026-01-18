<template>
  <UTooltip :text="tooltipText" :popper="{ placement: 'top' }">
    <slot />
  </UTooltip>
</template>

<script setup lang="ts">
interface TeamRatings {
  elo: number
  attack: number
  defense: number
  matchesPlayed: number
  confidence: 'low' | 'medium' | 'high'
  lastMatchDate: string | null
}

const props = defineProps<{
  teamId: number
  teamName: string
  preloadedRatings?: TeamRatings | null
}>()

const ratings = ref<TeamRatings | null>(props.preloadedRatings ?? null)
const fetched = ref(false)

// Tooltip text computed from ratings
const tooltipText = computed(() => {
  if (!ratings.value) return 'Loading ratings...'

  const r = ratings.value
  return `${props.teamName}\nElo: ${r.elo.toFixed(0)} (${r.confidence})\nAttack: ${r.attack.toFixed(2)} | Defense: ${r.defense.toFixed(2)}\nBased on ${r.matchesPlayed} matches`
})

// Fetch ratings on mount if not preloaded
async function fetchRatings() {
  if (fetched.value || ratings.value) return

  fetched.value = true

  try {
    const response = await $fetch<{
      success: boolean
      data: TeamRatings | null
    }>(`/api/teams/${props.teamId}/ratings`)

    if (response.success && response.data) {
      ratings.value = response.data
    }
  } catch (err) {
    console.error('Error fetching team ratings:', err)
  }
}

// Fetch on mount if not preloaded
onMounted(() => {
  if (!props.preloadedRatings) {
    fetchRatings()
  }
})

// Update ratings if preloaded prop changes
watch(
  () => props.preloadedRatings,
  newRatings => {
    if (newRatings) {
      ratings.value = newRatings
    }
  }
)
</script>
