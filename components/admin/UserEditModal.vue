<template>
  <UModal v-model:open="isOpen" :title="modalTitle" :ui="{ content: 'sm:max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <!-- User Info -->
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Editing: <span class="font-medium text-gray-900 dark:text-white">{{ user?.email }}</span>
        </div>

        <!-- Cost Cap Form -->
        <div v-if="mode === 'cap'">
          <UFormField label="Weekly Cost Cap (USD)" name="costCap">
            <UInput
              v-model="costCapValue"
              type="number"
              step="0.01"
              min="0"
              placeholder="1.00"
              class="w-full"
            >
              <template #leading>
                <span class="text-gray-500">$</span>
              </template>
            </UInput>
          </UFormField>
          <p class="text-xs text-gray-500 mt-2">
            Current spending: ${{ formatCost(user?.currentWeekSpending || 0) }} this week
          </p>
        </div>

        <!-- Bypass Form -->
        <div v-else>
          <UFormField label="Bypass Duration" name="bypassHours">
            <USelect v-model="bypassHours" :items="bypassOptions" class="w-full" />
          </UFormField>
          <p class="text-xs text-gray-500 mt-2">
            Bypass allows the user to exceed their cost cap temporarily.
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" :disabled="saving" @click="close"> Cancel </UButton>
        <UButton color="primary" :loading="saving" @click="save"> Save </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { UserWithSpending } from './UserTable.vue'

const props = defineProps<{
  user: UserWithSpending | null
  mode: 'cap' | 'bypass'
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  saved: []
}>()

const toast = useToast()

// State
const saving = ref(false)
const costCapValue = ref('')
const bypassHours = ref('24')

const bypassOptions = [
  { label: '1 hour', value: '1' },
  { label: '6 hours', value: '6' },
  { label: '12 hours', value: '12' },
  { label: '24 hours', value: '24' },
  { label: '48 hours', value: '48' },
  { label: '1 week', value: '168' },
]

const modalTitle = computed(() => {
  return props.mode === 'cap' ? 'Edit Cost Cap' : 'Set Temporary Bypass'
})

// Reset form when user changes
watch(
  () => props.user,
  user => {
    if (user) {
      costCapValue.value = user.costCapUsd.toString()
      bypassHours.value = '24'
    }
  },
  { immediate: true }
)

function formatCost(cost: number): string {
  if (cost >= 1) return cost.toFixed(2)
  if (cost >= 0.01) return cost.toFixed(3)
  return cost.toFixed(4)
}

function close() {
  isOpen.value = false
}

async function save() {
  if (!props.user) return

  saving.value = true

  try {
    if (props.mode === 'cap') {
      const newCap = parseFloat(costCapValue.value)
      if (isNaN(newCap) || newCap < 0) {
        toast.add({
          title: 'Invalid value',
          description: 'Please enter a valid cost cap',
          color: 'error',
        })
        return
      }

      await $fetch(`/api/admin/users/${props.user.userId}/cap`, {
        method: 'PATCH',
        body: { costCapUsd: newCap },
      })

      toast.add({
        title: 'Cost cap updated',
        description: `Cost cap set to $${newCap.toFixed(2)} for ${props.user.email}`,
        color: 'success',
      })
    } else {
      const hours = parseInt(bypassHours.value)

      await $fetch(`/api/admin/users/${props.user.userId}/bypass`, {
        method: 'POST',
        body: { hours },
      })

      toast.add({
        title: 'Bypass set',
        description: `${hours} hour bypass set for ${props.user.email}`,
        color: 'success',
      })
    }

    emit('saved')
  } catch (err) {
    toast.add({
      title: 'Failed to save',
      description: err instanceof Error ? err.message : 'Unknown error',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
