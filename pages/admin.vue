<template>
  <UContainer class="py-8">
    <!-- Loading state -->
    <div v-if="profileLoading" class="flex justify-center py-16">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>

    <!-- Access Denied -->
    <div v-else-if="accessDenied" class="text-center py-16">
      <UIcon name="i-heroicons-shield-exclamation" class="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h1 class="text-2xl font-bold mb-2">Access Denied</h1>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        You don't have permission to access this page.
      </p>
      <UButton to="/" color="primary">Go to Home</UButton>
    </div>

    <!-- Admin Content -->
    <template v-else>
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-4xl font-bold mb-2">Admin Control Panel</h1>
        <p class="text-gray-600 dark:text-gray-400">System health, actions, and monitoring</p>
      </div>

      <!-- Schedule Window Status Banner -->
      <USkeleton v-if="loadingScheduleStatus" class="h-16 w-full mb-6" />
      <UAlert
        v-else-if="scheduleStatus"
        :color="scheduleStatus.isActive ? 'success' : 'warning'"
        :icon="scheduleStatus.isActive ? 'i-heroicons-check-circle' : 'i-heroicons-clock'"
        class="mb-6"
      >
        <template #title>
          {{ scheduleStatus.isActive ? 'Active Betting Window' : 'Outside Betting Window' }}
        </template>
        <template #description>
          <p class="text-sm">
            {{ scheduleStatus.reason }}
          </p>
          <p
            v-if="scheduleStatus.isActive && scheduleStatus.minutesUntilClose"
            class="text-xs mt-1 opacity-80"
          >
            Spelstopp in {{ formatDuration(scheduleStatus.minutesUntilClose) }}
          </p>
          <p
            v-if="!scheduleStatus.isActive && scheduleStatus.minutesUntilOpen"
            class="text-xs mt-1 opacity-80"
          >
            Window opens in {{ formatDuration(scheduleStatus.minutesUntilOpen) }}
          </p>
        </template>
      </UAlert>

      <!-- Admin Override Toggle (only shown outside window) -->
      <div
        v-if="scheduleStatus && !scheduleStatus.isActive"
        class="flex items-center gap-3 mb-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
      >
        <USwitch id="admin-override" v-model="adminOverride" aria-label="Admin Override" />
        <label for="admin-override" class="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          Admin Override (enable actions outside betting window)
        </label>
      </div>

      <!-- User Management Section -->
      <div class="mb-8">
        <h2 class="text-2xl font-semibold mb-4">User Management</h2>
        <UCard>
          <AdminUserManagement />
        </UCard>
      </div>

      <!-- Health Status Cards -->
      <div class="mb-8">
        <h2 class="text-2xl font-semibold mb-4">System Health</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Scraper Health -->
          <UCard>
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold">AI Scraper</h3>
              <UBadge :color="getHealthColor(scraperHealth?.health?.status)" variant="subtle">
                {{ scraperHealth?.health?.status || 'Unknown' }}
              </UBadge>
            </div>
            <div v-if="loadingScraperHealth" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="scraperHealth?.success" class="text-sm space-y-1">
              <p class="text-gray-600 dark:text-gray-400">
                Queue: {{ scraperHealth.health?.queueSize || 0 }} pending
              </p>
              <p class="text-gray-600 dark:text-gray-400">
                Processed: {{ scraperHealth.health?.totalProcessed || 0 }}
              </p>
            </div>
            <div v-else class="text-sm text-red-600">
              {{ scraperHealth?.error || 'Failed to fetch' }}
            </div>
            <UButton
              size="xs"
              variant="ghost"
              icon="i-heroicons-arrow-path"
              class="mt-3"
              :loading="loadingScraperHealth"
              @click="checkScraperHealth"
            >
              Refresh
            </UButton>
          </UCard>

          <!-- Svenska Spel Health -->
          <UCard>
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold">Svenska Spel API</h3>
              <UBadge :color="getHealthColor(svenskaSpelHealth?.status)" variant="subtle">
                {{ svenskaSpelHealth?.status || 'Unknown' }}
              </UBadge>
            </div>
            <div v-if="loadingSvenskaSpelHealth" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="svenskaSpelHealth?.success" class="text-sm space-y-1">
              <p class="text-gray-600 dark:text-gray-400">
                Response: {{ svenskaSpelHealth.responseTime }}
              </p>
              <p class="text-gray-600 dark:text-gray-400">
                Draws available: {{ svenskaSpelHealth.drawsAvailable }}
              </p>
            </div>
            <div v-else class="text-sm text-red-600">
              {{ svenskaSpelHealth?.error || 'Failed to fetch' }}
            </div>
            <UButton
              size="xs"
              variant="ghost"
              icon="i-heroicons-arrow-path"
              class="mt-3"
              :loading="loadingSvenskaSpelHealth"
              @click="checkSvenskaSpelHealth"
            >
              Refresh
            </UButton>
          </UCard>

          <!-- Failed Writes Queue -->
          <UCard>
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold">Failed Writes Queue</h3>
              <UBadge
                :color="(failedWrites?.queueStatus?.count || 0) > 0 ? 'warning' : 'success'"
                variant="subtle"
              >
                {{ failedWrites?.queueStatus?.count || 0 }} pending
              </UBadge>
            </div>
            <div v-if="loadingFailedWrites" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="failedWrites?.success" class="text-sm space-y-1">
              <p class="text-gray-600 dark:text-gray-400">
                Last checked: {{ formatTime(failedWrites.timestamp) }}
              </p>
            </div>
            <div class="flex gap-2 mt-3">
              <UButton
                size="xs"
                variant="ghost"
                icon="i-heroicons-arrow-path"
                :loading="loadingFailedWrites"
                @click="checkFailedWrites"
              >
                Refresh
              </UButton>
              <UButton
                v-if="(failedWrites?.queueStatus?.count || 0) > 0"
                size="xs"
                color="warning"
                variant="soft"
                :loading="retryingWrites"
                @click="retryFailedWrites"
              >
                Retry All
              </UButton>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Actions -->
      <div class="mb-8">
        <h2 class="text-2xl font-semibold mb-4">Actions</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Sync Draws -->
          <UCard>
            <h3 class="font-semibold mb-2">Sync Draws</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Fetch latest draws from Svenska Spel and update the database.
            </p>
            <UTooltip
              :text="
                !isActionAllowed
                  ? 'Disabled outside betting window. Enable admin override to proceed.'
                  : 'Sync draws from Svenska Spel'
              "
            >
              <UButton
                icon="i-heroicons-arrow-path"
                :loading="syncing"
                :disabled="!isActionAllowed"
                @click="syncDraws"
              >
                Sync Now
              </UButton>
            </UTooltip>
            <div
              v-if="syncResult"
              class="mt-4 p-3 rounded-lg"
              :class="
                syncResult.success
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
              "
            >
              <p
                class="text-sm font-medium"
                :class="
                  syncResult.success
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400'
                "
              >
                {{ syncResult.success ? 'Sync completed' : 'Sync failed' }}
              </p>
              <p v-if="syncResult.success" class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Draws: {{ syncResult.drawsProcessed }} | Matches: {{ syncResult.matchesProcessed }}
              </p>
              <p v-else class="text-xs text-red-600 dark:text-red-400 mt-1">
                {{ syncResult.error }}
              </p>
            </div>
          </UCard>

          <!-- Backfill Season -->
          <UCard>
            <h3 class="font-semibold mb-2">Backfill Season</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Backfill historical draw data for a date range.
            </p>
            <div class="flex gap-2 mb-4">
              <UInput v-model="backfillStartDate" type="date" size="sm" placeholder="Start date" />
              <UInput v-model="backfillEndDate" type="date" size="sm" placeholder="End date" />
            </div>
            <UTooltip
              :text="
                !isActionAllowed
                  ? 'Disabled outside betting window. Enable admin override to proceed.'
                  : 'Start backfill operation'
              "
            >
              <UButton
                icon="i-heroicons-archive-box"
                :loading="backfilling"
                :disabled="!backfillStartDate || !backfillEndDate || !isActionAllowed"
                @click="startBackfill"
              >
                Start Backfill
              </UButton>
            </UTooltip>
            <div
              v-if="backfillResult"
              class="mt-4 p-3 rounded-lg"
              :class="
                backfillResult.success
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
              "
            >
              <p
                class="text-sm font-medium"
                :class="
                  backfillResult.success
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400'
                "
              >
                {{ backfillResult.success ? 'Backfill started' : 'Backfill failed' }}
              </p>
              <p
                v-if="backfillResult.success"
                class="text-xs text-gray-600 dark:text-gray-400 mt-1"
              >
                Operation ID: {{ backfillResult.operationId }}
              </p>
              <p v-else class="text-xs text-red-600 dark:text-red-400 mt-1">
                {{ backfillResult.error }}
              </p>
            </div>
          </UCard>

          <!-- Clear Cache -->
          <UCard>
            <h3 class="font-semibold mb-2">Clear Cache</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Flush the server-side cache to resolve stale data issues.
            </p>
            <div v-if="cacheStats" class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <p>Cached keys: {{ cacheStats.keys }}</p>
              <p v-if="cacheStats.inflightRequests > 0">
                In-flight requests: {{ cacheStats.inflightRequests }}
              </p>
            </div>
            <UButton
              icon="i-heroicons-trash"
              color="warning"
              :loading="clearingCache"
              @click="clearCache"
            >
              Clear Cache
            </UButton>
            <div
              v-if="clearCacheResult"
              class="mt-4 p-3 rounded-lg"
              :class="
                clearCacheResult.success
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
              "
            >
              <p
                class="text-sm font-medium"
                :class="
                  clearCacheResult.success
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400'
                "
              >
                {{ clearCacheResult.success ? 'Cache cleared' : 'Clear failed' }}
              </p>
              <p
                v-if="clearCacheResult.success"
                class="text-xs text-gray-600 dark:text-gray-400 mt-1"
              >
                Cleared {{ clearCacheResult.cleared?.keysCleared || 0 }} keys
              </p>
              <p v-else class="text-xs text-red-600 dark:text-red-400 mt-1">
                {{ clearCacheResult.error }}
              </p>
            </div>
          </UCard>

          <!-- Draw Lookup -->
          <UCard>
            <h3 class="font-semibold mb-2">Draw Lookup</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Look up any draw by number, or fetch it from Svenska Spel API.
            </p>
            <div class="flex gap-2 mb-4">
              <UInput
                v-model="lookupDrawNumber"
                type="number"
                size="sm"
                placeholder="Draw number"
                class="w-28"
                :disabled="lookupLoading || fetchingFromApi"
              />
              <USelect
                v-model="lookupGameType"
                size="sm"
                aria-label="Game type"
                :items="[
                  { value: 'stryktipset', label: 'Stryktipset' },
                  { value: 'europatipset', label: 'Europatipset' },
                  { value: 'topptipset', label: 'Topptipset' },
                ]"
                :disabled="lookupLoading || fetchingFromApi"
              />
            </div>
            <div class="flex gap-2">
              <UButton
                icon="i-heroicons-magnifying-glass"
                :loading="lookupLoading"
                :disabled="!lookupDrawNumber || fetchingFromApi"
                @click="lookupDraw"
              >
                Lookup
              </UButton>
              <UButton
                v-if="lookupResult && !lookupResult.found"
                icon="i-heroicons-cloud-arrow-down"
                color="primary"
                variant="soft"
                :loading="fetchingFromApi"
                :disabled="lookupLoading"
                @click="fetchDrawFromApi"
              >
                Fetch from API
              </UButton>
            </div>
            <div v-if="lookupError" class="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
              <p class="text-sm text-red-700 dark:text-red-400">{{ lookupError }}</p>
            </div>
            <div
              v-if="lookupResult && !lookupResult.found && !lookupError"
              class="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20"
            >
              <p class="text-sm text-yellow-700 dark:text-yellow-400">
                Draw not found locally. Click "Fetch from API" to retrieve it.
              </p>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Draw Management -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-semibold">Draw Management</h2>
          <UButton
            size="xs"
            variant="ghost"
            icon="i-heroicons-arrow-path"
            :loading="loadingCurrentDraws"
            @click="loadCurrentDraws"
          >
            Refresh
          </UButton>
        </div>
        <UCard>
          <div v-if="loadingCurrentDraws" class="flex justify-center py-8">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
          </div>
          <div v-else-if="currentDraws?.draws?.length" class="space-y-3">
            <div
              v-for="draw in currentDraws.draws"
              :key="draw.draw_number"
              class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div class="flex items-center gap-4">
                <div>
                  <p class="font-medium">Draw #{{ draw.draw_number }}</p>
                  <p class="text-xs text-gray-500">
                    {{ formatDateShort(draw.draw_date) }}
                  </p>
                </div>
                <UBadge :color="getStatusColor(draw.status)" variant="subtle" size="sm">
                  {{ draw.status }}
                </UBadge>
                <span class="text-xs text-gray-500">
                  Results: {{ draw.matchesWithResults }}/{{ draw.totalMatches }}
                </span>
              </div>
              <UButton
                size="xs"
                color="warning"
                variant="soft"
                icon="i-heroicons-archive-box"
                @click="openArchiveModal(draw)"
              >
                Archive
              </UButton>
            </div>
          </div>
          <div v-else class="text-center py-8 text-gray-500">No current draws found</div>
        </UCard>
      </div>

      <!-- Archive Confirmation Modal -->
      <UModal v-model:open="archiveModalOpen">
        <template #content>
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-archive-box" class="w-5 h-5 text-warning-500" />
                <h3 class="font-semibold">Archive Draw #{{ drawToArchive?.draw_number }}</h3>
              </div>
            </template>

            <div class="space-y-4">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Are you sure you want to archive this draw? This will:
              </p>
              <ul class="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                <li>Set the draw as historic (not current)</li>
                <li>Change scraping URLs to use historic endpoints</li>
                <li>Remove it from current draws list</li>
              </ul>

              <div
                v-if="drawToArchive?.status !== 'Completed'"
                class="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
              >
                <p class="text-sm text-yellow-700 dark:text-yellow-400">
                  <strong>Warning:</strong> This draw has status "{{ drawToArchive?.status }}" (not
                  "Completed").
                </p>
              </div>

              <div class="flex items-center gap-2">
                <UCheckbox id="force-archive" v-model="forceArchive" />
                <label
                  for="force-archive"
                  class="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
                >
                  Force archive (bypass status validation)
                </label>
              </div>
            </div>

            <template #footer>
              <div class="flex justify-end gap-2">
                <UButton variant="ghost" @click="archiveModalOpen = false"> Cancel </UButton>
                <UButton
                  color="warning"
                  :loading="archiving"
                  :disabled="drawToArchive?.status !== 'Completed' && !forceArchive"
                  @click="archiveDraw"
                >
                  Archive Draw
                </UButton>
              </div>
            </template>
          </UCard>
        </template>
      </UModal>

      <!-- Manual Game Entry Modal -->
      <AdminManualGameEntryModal
        v-if="manualEntryData"
        v-model:open="manualEntryModalOpen"
        :draw-id="manualEntryData.drawId"
        :draw-number="manualEntryData.drawNumber"
        :match-number="manualEntryData.matchNumber"
        :game-type="manualEntryData.gameType"
        @submitted="onManualEntrySubmitted"
      />

      <!-- Draw Details Modal -->
      <AdminDrawDetailsModal
        v-model:open="drawDetailsModalOpen"
        :draw="lookupResult?.draw"
        :refreshing="fetchingFromApi"
        @refresh="refreshDrawFromApi"
      />

      <!-- Draw Finalization Section -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-semibold">Draw Finalization</h2>
          <div class="flex gap-2">
            <UButton
              size="xs"
              variant="ghost"
              icon="i-heroicons-arrow-path"
              :loading="loadingPendingFinalization"
              @click="loadPendingFinalization"
            >
              Refresh
            </UButton>
            <UButton
              v-if="pendingFinalization?.counts?.ready > 0"
              size="sm"
              color="primary"
              icon="i-heroicons-check-circle"
              :loading="finalizingAll"
              @click="finalizeAllDraws"
            >
              Finalize All ({{ pendingFinalization.counts.ready }})
            </UButton>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Ready for Finalization -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-success-500" />
                <h3 class="font-semibold">Ready for Finalization</h3>
                <UBadge color="success" variant="subtle" size="sm">
                  {{ pendingFinalization?.counts?.ready || 0 }}
                </UBadge>
              </div>
            </template>

            <div v-if="loadingPendingFinalization" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="pendingFinalization?.readyForFinalization?.length" class="space-y-2">
              <div
                v-for="draw in pendingFinalization.readyForFinalization"
                :key="`${draw.game_type}-${draw.draw_number}`"
                class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
              >
                <div>
                  <p class="font-medium text-sm">#{{ draw.draw_number }} ({{ draw.game_type }})</p>
                  <p class="text-xs text-gray-500">
                    {{ draw.matchesWithResults }}/{{ draw.totalMatches }} results
                  </p>
                </div>
                <UButton
                  size="xs"
                  color="success"
                  variant="soft"
                  icon="i-heroicons-archive-box"
                  @click="openArchiveModal(draw)"
                >
                  Finalize
                </UButton>
              </div>
            </div>
            <div v-else class="text-center py-4 text-gray-500 text-sm">
              No draws ready for finalization
            </div>
          </UCard>

          <!-- Not Ready -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-clock" class="w-5 h-5 text-warning-500" />
                <h3 class="font-semibold">Pending Completion</h3>
                <UBadge color="warning" variant="subtle" size="sm">
                  {{ pendingFinalization?.counts?.notReady || 0 }}
                </UBadge>
              </div>
            </template>

            <div v-if="loadingPendingFinalization" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="pendingFinalization?.notReady?.length" class="space-y-2">
              <div
                v-for="draw in pendingFinalization.notReady"
                :key="`${draw.game_type}-${draw.draw_number}`"
                class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
              >
                <div>
                  <p class="font-medium text-sm">#{{ draw.draw_number }} ({{ draw.game_type }})</p>
                  <p class="text-xs text-gray-500">{{ draw.finalizationReason }}</p>
                </div>
                <UBadge :color="getStatusColor(draw.status)" variant="subtle" size="sm">
                  {{ draw.status }}
                </UBadge>
              </div>
            </div>
            <div v-else class="text-center py-4 text-gray-500 text-sm">All draws are ready</div>
          </UCard>
        </div>
      </div>

      <!-- Incomplete Draws / Failed Games Section -->
      <div
        v-if="
          failedGamesData?.counts?.pendingGames > 0 || failedGamesData?.counts?.incompleteDraws > 0
        "
        class="mb-8"
      >
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-semibold">Incomplete Draws</h2>
          <UButton
            size="xs"
            variant="ghost"
            icon="i-heroicons-arrow-path"
            :loading="loadingFailedGames"
            @click="loadFailedGames"
          >
            Refresh
          </UButton>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Incomplete Draws Summary -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-warning-500" />
                <h3 class="font-semibold">Draws Missing Games</h3>
                <UBadge color="warning" variant="subtle" size="sm">
                  {{ failedGamesData?.counts?.incompleteDraws || 0 }}
                </UBadge>
              </div>
            </template>

            <div v-if="loadingFailedGames" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="failedGamesData?.incompleteDraws?.length" class="space-y-3">
              <div
                v-for="draw in failedGamesData.incompleteDraws"
                :key="`incomplete-${draw.gameType}-${draw.drawNumber}`"
                class="p-3 bg-gray-50 dark:bg-gray-800 rounded"
              >
                <div class="flex items-center justify-between mb-2">
                  <div>
                    <p class="font-medium text-sm">#{{ draw.drawNumber }} ({{ draw.gameType }})</p>
                    <p class="text-xs text-gray-500">
                      {{ draw.actualGames }}/{{ draw.expectedGames }} games
                    </p>
                  </div>
                </div>
                <!-- Per-match actions -->
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="matchNum in draw.missingMatchNumbers"
                    :key="`missing-${draw.drawId}-${matchNum}`"
                    class="flex items-center gap-1 p-1.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                  >
                    <span class="text-xs font-medium text-gray-600 dark:text-gray-300 mr-1"
                      >#{{ matchNum }}</span
                    >
                    <UButton
                      size="xs"
                      color="primary"
                      variant="soft"
                      icon="i-heroicons-arrow-path"
                      :loading="fetchingMatch === `${draw.drawId}-${matchNum}`"
                      @click="fetchMissingMatch(draw.drawId, matchNum, draw.gameType)"
                    >
                      Fetch
                    </UButton>
                    <UButton
                      size="xs"
                      color="warning"
                      variant="soft"
                      icon="i-heroicons-pencil"
                      @click="
                        openManualEntry(draw.drawId, draw.drawNumber, matchNum, draw.gameType)
                      "
                    >
                      Manual
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-4 text-gray-500 text-sm">All draws are complete</div>
          </UCard>

          <!-- Failed Games List -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between w-full">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-x-circle" class="w-5 h-5 text-error-500" />
                  <h3 class="font-semibold">Failed Games</h3>
                  <UBadge color="error" variant="subtle" size="sm">
                    {{ failedGamesData?.counts?.pendingGames || 0 }}
                  </UBadge>
                </div>
                <span v-if="failedGamesLastUpdated" class="text-xs text-gray-500">
                  Updated {{ failedGamesTimeAgo }}
                </span>
              </div>
            </template>

            <div v-if="loadingFailedGames" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="failedGamesData?.failedGames?.length" class="space-y-2">
              <div
                v-for="game in failedGamesData.failedGames.slice(0, 10)"
                :key="game.id"
                class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
              >
                <div class="flex-1 min-w-0 mr-2">
                  <p class="font-medium text-sm">
                    Match #{{ game.matchNumber }} - Draw {{ game.drawId }}
                  </p>
                  <p class="text-xs text-gray-500 truncate">
                    {{ game.failureReason }}: {{ game.errorMessage || 'Unknown error' }}
                  </p>
                </div>
                <div class="flex gap-1">
                  <UButton
                    size="xs"
                    color="primary"
                    variant="soft"
                    icon="i-heroicons-arrow-path"
                    :loading="retryingGameId === game.id"
                    @click="retryFailedGame(game.id)"
                  >
                    Retry
                  </UButton>
                  <UButton
                    size="xs"
                    color="warning"
                    variant="soft"
                    icon="i-heroicons-pencil"
                    @click="
                      openManualEntryForFailedGame(game.drawId, game.matchNumber, game.gameType)
                    "
                  >
                    Manual
                  </UButton>
                </div>
              </div>
              <p
                v-if="failedGamesData.failedGames.length > 10"
                class="text-xs text-gray-500 text-center pt-2"
              >
                ... and {{ failedGamesData.failedGames.length - 10 }} more
              </p>
            </div>
            <div v-else class="text-center py-4 text-gray-500 text-sm">No failed games</div>
          </UCard>
        </div>
      </div>

      <!-- Backfill Operations -->
      <div v-if="backfillOperations.length > 0" class="mb-8">
        <h2 class="text-2xl font-semibold mb-4">Active Backfill Operations</h2>
        <UCard>
          <div class="space-y-4">
            <div
              v-for="op in backfillOperations"
              :key="op.id"
              class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div>
                <p class="font-medium">Operation {{ op.id }}</p>
                <p class="text-xs text-gray-500">
                  {{ op.processed_draws || 0 }}/{{ op.total_draws || '?' }} draws processed
                </p>
              </div>
              <div class="flex items-center gap-3">
                <UBadge :color="getBackfillStatusColor(op.status)" variant="subtle">
                  {{ op.status }}
                </UBadge>
                <UButton
                  size="xs"
                  variant="ghost"
                  icon="i-heroicons-arrow-path"
                  aria-label="Refresh backfill status"
                  @click="refreshBackfillStatus(op.id)"
                />
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UContainer>
</template>

<script setup lang="ts">
import type { ScheduleWindowStatus } from '~/types'
import { useUserProfile } from '~/composables/useUserProfile'
import { useIntervalFn, useDocumentVisibility, useTimeAgo } from '@vueuse/core'

const toast = useToast()

definePageMeta({})

useHead({
  title: 'Admin Control Panel - Stryktipset AI Predictor',
})

// Admin access check
const { isAdmin, fetchProfile, loading: profileLoading } = useUserProfile()
const accessDenied = ref(false)

// Schedule window states
const scheduleStatus = ref<ScheduleWindowStatus | null>(null)
const loadingScheduleStatus = ref(true)
const adminOverride = ref(false)

// Computed property for action buttons
const isActionAllowed = computed(() => {
  if (!scheduleStatus.value) return true // Allow if status not loaded yet
  return scheduleStatus.value.isActive || adminOverride.value
})

// Health check states
const loadingScraperHealth = ref(false)
const loadingSvenskaSpelHealth = ref(false)
const loadingFailedWrites = ref(false)
const retryingWrites = ref(false)

/* eslint-disable @typescript-eslint/no-explicit-any -- Admin API responses have dynamic shapes */
const scraperHealth = ref<any>(null)
const svenskaSpelHealth = ref<any>(null)
const failedWrites = ref<any>(null)

// Action states
const syncing = ref(false)
const syncResult = ref<any>(null)

const backfilling = ref(false)
const backfillStartDate = ref('')
const backfillEndDate = ref('')
const backfillResult = ref<any>(null)
const backfillOperations = ref<any[]>([])

// Cache states
const clearingCache = ref(false)
const cacheStats = ref<{ keys: number; inflightRequests: number } | null>(null)
const clearCacheResult = ref<any>(null)

// Draw Management states
const loadingCurrentDraws = ref(false)
const currentDraws = ref<any>(null)
const archiveModalOpen = ref(false)
const drawToArchive = ref<any>(null)
const forceArchive = ref(false)
const archiving = ref(false)

// Draw Finalization states
const loadingPendingFinalization = ref(false)
const finalizingAll = ref(false)
const pendingFinalization = ref<any>(null)

// Incomplete Draws / Failed Games states
const loadingFailedGames = ref(false)
const retryingGameId = ref<number | null>(null)
const failedGamesData = ref<any>(null)
const failedGamesLastUpdated = ref<Date | null>(null)
const failedGamesTimeAgoDate = computed(() => failedGamesLastUpdated.value ?? new Date())
const failedGamesTimeAgo = useTimeAgo(failedGamesTimeAgoDate)
const visibility = useDocumentVisibility()

// Manual entry modal state
const manualEntryModalOpen = ref(false)
const manualEntryData = ref<{
  drawId: number
  drawNumber: number
  matchNumber: number
  gameType: string
} | null>(null)
const fetchingMatch = ref<string | null>(null)

// Draw Lookup states
const lookupDrawNumber = ref('')
const lookupGameType = ref<'stryktipset' | 'europatipset' | 'topptipset'>('stryktipset')
const lookupLoading = ref(false)
const lookupError = ref('')
const lookupResult = ref<any>(null)
const drawDetailsModalOpen = ref(false)
const fetchingFromApi = ref(false)
/* eslint-enable @typescript-eslint/no-explicit-any */

// Schedule status
async function loadScheduleStatus() {
  try {
    const result = await $fetch<{ success: boolean; status?: ScheduleWindowStatus }>(
      '/api/schedule/status'
    )
    if (result.success && result.status) {
      scheduleStatus.value = result.status
    }
  } catch (error) {
    console.error('Error loading schedule status:', error)
  } finally {
    loadingScheduleStatus.value = false
  }
}

// Load health on mount
onMounted(async () => {
  // Check admin access first
  await fetchProfile()
  if (!isAdmin.value) {
    accessDenied.value = true
    return
  }

  await Promise.all([
    loadScheduleStatus(),
    checkScraperHealth(),
    checkSvenskaSpelHealth(),
    checkFailedWrites(),
    loadCurrentDraws(),
    loadPendingFinalization(),
    loadFailedGames(),
    loadCacheStats(),
  ])

  // Refresh schedule status every minute
  setInterval(loadScheduleStatus, 60000)
})

// Health check functions
async function checkScraperHealth() {
  loadingScraperHealth.value = true
  try {
    scraperHealth.value = await $fetch('/api/admin/scraper-health')
  } catch {
    scraperHealth.value = { success: false, error: 'Failed to connect' }
  } finally {
    loadingScraperHealth.value = false
  }
}

async function checkSvenskaSpelHealth() {
  loadingSvenskaSpelHealth.value = true
  try {
    svenskaSpelHealth.value = await $fetch('/api/admin/svenska-spel-health')
  } catch {
    svenskaSpelHealth.value = { success: false, error: 'Failed to connect' }
  } finally {
    loadingSvenskaSpelHealth.value = false
  }
}

async function checkFailedWrites() {
  loadingFailedWrites.value = true
  try {
    failedWrites.value = await $fetch('/api/admin/failed-writes')
  } catch {
    failedWrites.value = { success: false, error: 'Failed to fetch' }
  } finally {
    loadingFailedWrites.value = false
  }
}

async function retryFailedWrites() {
  retryingWrites.value = true
  try {
    await $fetch('/api/admin/failed-writes?action=retry')
    await checkFailedWrites()
  } catch (error) {
    console.error('Error retrying failed writes:', error)
  } finally {
    retryingWrites.value = false
  }
}

// Actions
async function syncDraws() {
  syncing.value = true
  syncResult.value = null
  try {
    syncResult.value = await $fetch('/api/admin/sync', {
      method: 'POST',
      body: { adminOverride: adminOverride.value },
    })
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; message?: string }
    syncResult.value = {
      success: false,
      error: err?.data?.message || err?.message || 'Unknown error',
    }
  } finally {
    syncing.value = false
  }
}

async function startBackfill() {
  backfilling.value = true
  backfillResult.value = null
  try {
    const result = await $fetch('/api/admin/backfill-season', {
      method: 'POST',
      body: {
        startDate: backfillStartDate.value,
        endDate: backfillEndDate.value,
      },
    })
    backfillResult.value = result

    if (result.success && result.operationId) {
      backfillOperations.value.push({
        id: result.operationId,
        status: 'running',
        processed_draws: 0,
        total_draws: null,
      })
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; message?: string }
    backfillResult.value = {
      success: false,
      error: err?.data?.message || err?.message || 'Unknown error',
    }
  } finally {
    backfilling.value = false
  }
}

async function refreshBackfillStatus(operationId: string) {
  try {
    const result = await $fetch(`/api/admin/backfill-status/${operationId}`)
    const index = backfillOperations.value.findIndex(op => op.id === operationId)
    if (index !== -1 && 'success' in result && result.success && 'operation' in result) {
      backfillOperations.value[index] = result.operation
    }
  } catch (error) {
    console.error('Error fetching backfill status:', error)
  }
}

// Cache functions
async function loadCacheStats() {
  try {
    const result = await $fetch<{
      success: boolean
      stats?: { keys: number; inflightRequests: number }
    }>('/api/admin/cache/stats')
    if (result.success && result.stats) {
      cacheStats.value = result.stats
    }
  } catch (error) {
    console.error('Error loading cache stats:', error)
  }
}

async function clearCache() {
  clearingCache.value = true
  clearCacheResult.value = null
  try {
    clearCacheResult.value = await $fetch('/api/admin/cache/clear', {
      method: 'POST',
    })
    // Refresh stats after clearing
    await loadCacheStats()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; message?: string }
    clearCacheResult.value = {
      success: false,
      error: err?.data?.message || err?.message || 'Unknown error',
    }
  } finally {
    clearingCache.value = false
  }
}

// Draw Management functions
async function loadCurrentDraws() {
  loadingCurrentDraws.value = true
  try {
    currentDraws.value = await $fetch('/api/admin/draws/current')
  } catch (error) {
    console.error('Error loading current draws:', error)
    currentDraws.value = { success: false, error: 'Failed to load' }
  } finally {
    loadingCurrentDraws.value = false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin API responses have dynamic shapes
function openArchiveModal(draw: any) {
  drawToArchive.value = draw
  forceArchive.value = false
  archiveModalOpen.value = true
}

async function archiveDraw() {
  if (!drawToArchive.value) return

  archiving.value = true
  try {
    const result = await $fetch(`/api/admin/draws/${drawToArchive.value.draw_number}/archive`, {
      method: 'PATCH',
      body: { force: forceArchive.value, gameType: drawToArchive.value.game_type },
    })

    if (result.success) {
      archiveModalOpen.value = false
      drawToArchive.value = null
      // Reload draws lists
      await Promise.all([loadCurrentDraws(), loadPendingFinalization()])
    }
  } catch (error) {
    console.error('Error archiving draw:', error)
  } finally {
    archiving.value = false
  }
}

// Draw Finalization functions
async function loadPendingFinalization() {
  loadingPendingFinalization.value = true
  try {
    pendingFinalization.value = await $fetch('/api/admin/draws/pending-finalization')
  } catch (error) {
    console.error('Error loading pending finalization:', error)
    pendingFinalization.value = { success: false, error: 'Failed to load' }
  } finally {
    loadingPendingFinalization.value = false
  }
}

async function finalizeAllDraws() {
  finalizingAll.value = true
  try {
    const result = await $fetch('/api/admin/draws/finalize-all', {
      method: 'POST',
    })
    if (result.success) {
      // Reload both lists after finalization
      await Promise.all([loadCurrentDraws(), loadPendingFinalization()])
    }
  } catch (error) {
    console.error('Error finalizing draws:', error)
  } finally {
    finalizingAll.value = false
  }
}

// Failed Games / Incomplete Draws functions
async function loadFailedGames() {
  loadingFailedGames.value = true
  try {
    failedGamesData.value = await $fetch('/api/admin/draws/failed-games')
    failedGamesLastUpdated.value = new Date()
  } catch (error) {
    console.error('Error loading failed games:', error)
    failedGamesData.value = { success: false, error: 'Failed to load' }
  } finally {
    loadingFailedGames.value = false
  }
}

// Auto-refresh failed games every 30 seconds (pause when tab hidden or retry in progress)
useIntervalFn(
  async () => {
    if (retryingGameId.value || visibility.value === 'hidden' || accessDenied.value) return
    await loadFailedGames()
  },
  30000,
  { immediate: false }
)

async function retryFailedGame(gameId: number) {
  retryingGameId.value = gameId
  try {
    const result = await $fetch<{
      success: boolean
      alreadyResolved?: boolean
      message?: string
      error?: string
      matchId?: number
    }>(`/api/admin/draws/failed-games/${gameId}/retry`, {
      method: 'POST',
    })

    if (result.success) {
      // Reload failed games and draws after successful retry
      await Promise.all([loadFailedGames(), loadCurrentDraws()])

      toast.add({
        title: result.alreadyResolved ? 'Already Resolved' : 'Retry Successful',
        description: result.message || 'Match processed successfully',
        color: result.alreadyResolved ? 'info' : 'success',
      })
    } else {
      toast.add({
        title: 'Retry Failed',
        description: result.error || 'Unknown error',
        color: 'error',
      })
    }
  } catch (error) {
    console.error('Error retrying failed game:', error)
    toast.add({
      title: 'Retry Failed',
      description: error instanceof Error ? error.message : 'Network error',
      color: 'error',
    })
  } finally {
    retryingGameId.value = null
  }
}

async function fetchMissingMatch(drawId: number, matchNumber: number, gameType: string) {
  const key = `${drawId}-${matchNumber}`
  fetchingMatch.value = key
  try {
    const result = await $fetch<{ success: boolean; error?: string; alreadyExists?: boolean }>(
      `/api/admin/draws/${drawId}/fetch-match/${matchNumber}`,
      {
        method: 'POST',
        body: { gameType },
      }
    )
    if (result.success) {
      // Reload data after successful fetch
      await Promise.all([loadFailedGames(), loadCurrentDraws()])
    } else {
      console.error('Failed to fetch match:', result.error)
    }
  } catch (error) {
    console.error('Error fetching missing match:', error)
  } finally {
    fetchingMatch.value = null
  }
}

function openManualEntry(
  drawId: number,
  drawNumber: number,
  matchNumber: number,
  gameType: string
) {
  manualEntryData.value = { drawId, drawNumber, matchNumber, gameType }
  manualEntryModalOpen.value = true
}

async function openManualEntryForFailedGame(drawId: number, matchNumber: number, gameType: string) {
  // For failed games, we need to look up the draw number
  const draw = failedGamesData.value?.incompleteDraws?.find(
    (d: { drawId: number }) => d.drawId === drawId
  )
  const drawNumber = draw?.drawNumber || 0
  openManualEntry(drawId, drawNumber, matchNumber, gameType)
}

async function onManualEntrySubmitted() {
  manualEntryModalOpen.value = false
  manualEntryData.value = null
  // Reload data after successful manual entry
  await Promise.all([loadFailedGames(), loadCurrentDraws()])
}

// Draw Lookup functions
async function lookupDraw() {
  if (!lookupDrawNumber.value) return

  lookupLoading.value = true
  lookupError.value = ''
  lookupResult.value = null

  try {
    const result = await $fetch<{
      success: boolean
      found: boolean
      draw?: Record<string, unknown>
      message?: string
    }>('/api/admin/draws/lookup', {
      query: {
        drawNumber: lookupDrawNumber.value,
        gameType: lookupGameType.value,
      },
    })

    lookupResult.value = result

    if (result.found && result.draw) {
      // Open the modal to show draw details
      drawDetailsModalOpen.value = true
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; message?: string }
    lookupError.value = err?.data?.message || err?.message || 'Failed to lookup draw'
  } finally {
    lookupLoading.value = false
  }
}

async function fetchDrawFromApi() {
  if (!lookupDrawNumber.value) return

  fetchingFromApi.value = true
  lookupError.value = ''

  try {
    const result = await $fetch<{
      success: boolean
      action: string
      draw?: Record<string, unknown>
    }>(`/api/admin/draws/${lookupDrawNumber.value}/fetch`, {
      method: 'POST',
      body: {
        gameType: lookupGameType.value,
      },
    })

    if (result.success && result.draw) {
      lookupResult.value = {
        success: true,
        found: true,
        draw: result.draw,
      }
      drawDetailsModalOpen.value = true
      // Also refresh current draws list if we fetched a new draw
      await loadCurrentDraws()
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; message?: string }
    lookupError.value = err?.data?.message || err?.message || 'Failed to fetch draw from API'
  } finally {
    fetchingFromApi.value = false
  }
}

async function refreshDrawFromApi() {
  if (!lookupResult.value?.draw) return
  await fetchDrawFromApi()
}

// Helpers
function getHealthColor(status: string | undefined): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status?.toLowerCase()) {
    case 'healthy':
    case 'idle':
    case 'ready':
      return 'success'
    case 'busy':
    case 'processing':
      return 'warning'
    case 'unhealthy':
    case 'error':
      return 'error'
    default:
      return 'neutral'
  }
}

function getBackfillStatusColor(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'completed':
      return 'success'
    case 'running':
      return 'warning'
    case 'failed':
      return 'error'
    default:
      return 'neutral'
  }
}

function getStatusColor(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'Open':
      return 'success'
    case 'Closed':
      return 'warning'
    case 'Completed':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function formatTime(timestamp: string): string {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleTimeString('sv-SE')
}

function formatDateShort(date: string): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('sv-SE')
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}
</script>
