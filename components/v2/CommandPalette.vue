<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="command-palette-backdrop" @click="$emit('update:open', false)">
        <div class="command-palette" @click.stop>
          <!-- Search Input -->
          <div class="relative">
            <UIcon
              name="i-heroicons-magnifying-glass"
              class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="command-palette__input pl-12"
              placeholder="Search or type a command..."
              @keydown.down.prevent="selectNext"
              @keydown.up.prevent="selectPrev"
              @keydown.enter.prevent="executeSelected"
              @keydown.escape="$emit('update:open', false)"
            />
          </div>

          <!-- Results -->
          <div class="command-palette__results">
            <div v-if="filteredCommands.length === 0" class="px-4 py-8 text-center text-gray-500">
              No results found
            </div>
            <div v-else>
              <div v-for="(group, groupIndex) in groupedCommands" :key="group.label" class="py-2">
                <div
                  class="px-4 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase"
                >
                  {{ group.label }}
                </div>
                <div
                  v-for="(cmd, cmdIndex) in group.items"
                  :key="cmd.id"
                  class="command-palette__item"
                  :class="{ 'command-palette__item--selected': isSelected(groupIndex, cmdIndex) }"
                  @click="executeCommand(cmd)"
                  @mouseenter="setSelected(groupIndex, cmdIndex)"
                >
                  <UIcon :name="cmd.icon" class="w-5 h-5 text-gray-400" />
                  <div class="flex-1">
                    <div class="text-sm text-gray-900 dark:text-white">{{ cmd.label }}</div>
                    <div v-if="cmd.description" class="text-xs text-gray-500 dark:text-gray-400">
                      {{ cmd.description }}
                    </div>
                  </div>
                  <kbd
                    v-if="cmd.shortcut"
                    class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded"
                  >
                    {{ cmd.shortcut }}
                  </kbd>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-500"
          >
            <span class="flex items-center gap-1">
              <kbd class="px-1 bg-gray-100 dark:bg-gray-700 rounded">↵</kbd> to select
            </span>
            <span class="flex items-center gap-1">
              <kbd class="px-1 bg-gray-100 dark:bg-gray-700 rounded">↑↓</kbd> to navigate
            </span>
            <span class="flex items-center gap-1">
              <kbd class="px-1 bg-gray-100 dark:bg-gray-700 rounded">esc</kbd> to close
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const selectedGroup = ref(0)
const selectedItem = ref(0)

interface Command {
  id: string
  label: string
  description?: string
  icon: string
  shortcut?: string
  action: () => void
  group: string
}

const colorMode = useColorMode()

const commands: Command[] = [
  // Navigation
  {
    id: 'go-dashboard',
    label: 'Go to Dashboard',
    icon: 'i-heroicons-home',
    group: 'Navigation',
    action: () => navigateTo('/'),
  },
  {
    id: 'go-analytics',
    label: 'Go to Analytics',
    icon: 'i-heroicons-chart-bar',
    group: 'Navigation',
    action: () => navigateTo('/analytics'),
  },
  {
    id: 'go-ai-metrics',
    label: 'Go to AI Metrics',
    icon: 'i-heroicons-cpu-chip',
    group: 'Navigation',
    action: () => navigateTo('/ai-dashboard'),
  },
  {
    id: 'go-admin',
    label: 'Go to Admin',
    icon: 'i-heroicons-cog-6-tooth',
    group: 'Navigation',
    action: () => navigateTo('/admin'),
  },
  // Game Types
  {
    id: 'switch-stryktipset',
    label: 'Switch to Stryktipset',
    icon: 'i-heroicons-trophy',
    group: 'Game Type',
    action: () => {
      const route = useRoute()
      navigateTo({ query: { ...route.query, gameType: 'stryktipset' } })
    },
  },
  {
    id: 'switch-europatipset',
    label: 'Switch to Europatipset',
    icon: 'i-heroicons-trophy',
    group: 'Game Type',
    action: () => {
      const route = useRoute()
      navigateTo({ query: { ...route.query, gameType: 'europatipset' } })
    },
  },
  {
    id: 'switch-topptipset',
    label: 'Switch to Topptipset',
    icon: 'i-heroicons-trophy',
    group: 'Game Type',
    action: () => {
      const route = useRoute()
      navigateTo({ query: { ...route.query, gameType: 'topptipset' } })
    },
  },
  // Actions
  {
    id: 'toggle-dark-mode',
    label: 'Toggle Dark Mode',
    icon: 'i-heroicons-moon',
    group: 'Actions',
    action: () => {
      colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
    },
  },
]

const filteredCommands = computed(() => {
  if (!query.value) return commands
  const q = query.value.toLowerCase()
  return commands.filter(
    cmd => cmd.label.toLowerCase().includes(q) || cmd.group.toLowerCase().includes(q)
  )
})

const groupedCommands = computed(() => {
  const groups: { label: string; items: Command[] }[] = []
  const groupMap = new Map<string, Command[]>()

  for (const cmd of filteredCommands.value) {
    if (!groupMap.has(cmd.group)) {
      groupMap.set(cmd.group, [])
    }
    groupMap.get(cmd.group)!.push(cmd)
  }

  for (const [label, items] of groupMap) {
    groups.push({ label, items })
  }

  return groups
})

function isSelected(groupIndex: number, itemIndex: number): boolean {
  return selectedGroup.value === groupIndex && selectedItem.value === itemIndex
}

function setSelected(groupIndex: number, itemIndex: number) {
  selectedGroup.value = groupIndex
  selectedItem.value = itemIndex
}

function selectNext() {
  const group = groupedCommands.value[selectedGroup.value]
  if (!group) return
  if (selectedItem.value < group.items.length - 1) {
    selectedItem.value++
  } else if (selectedGroup.value < groupedCommands.value.length - 1) {
    selectedGroup.value++
    selectedItem.value = 0
  }
}

function selectPrev() {
  if (selectedItem.value > 0) {
    selectedItem.value--
  } else if (selectedGroup.value > 0) {
    selectedGroup.value--
    const prevGroup = groupedCommands.value[selectedGroup.value]
    selectedItem.value = prevGroup ? prevGroup.items.length - 1 : 0
  }
}

function executeSelected() {
  const group = groupedCommands.value[selectedGroup.value]
  const cmd = group?.items[selectedItem.value]
  if (cmd) {
    executeCommand(cmd)
  }
}

function executeCommand(cmd: Command) {
  cmd.action()
  emit('update:open', false)
  query.value = ''
}

// Focus input when opened
watch(
  () => props.open,
  open => {
    if (open) {
      nextTick(() => {
        inputRef.value?.focus()
      })
      selectedGroup.value = 0
      selectedItem.value = 0
      query.value = ''
    }
  }
)
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
