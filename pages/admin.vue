<template>
  <UContainer class="py-8">
    <AppBreadcrumb />

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
      <UAlert
        v-if="scheduleStatus"
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
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      <!-- AI Metrics Section -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-semibold">AI Metrics</h2>
          <div class="flex gap-2">
            <USelect
              v-model="aiMetricsPreset"
              :items="datePresetOptions"
              size="sm"
              class="w-36"
              aria-label="Select date range"
            />
            <UButton
              size="xs"
              variant="ghost"
              icon="i-heroicons-arrow-path"
              :loading="loadingAiMetrics"
              @click="loadAiMetrics"
            >
              Refresh
            </UButton>
            <UButton
              size="xs"
              variant="soft"
              icon="i-heroicons-arrow-down-tray"
              :loading="exportingMetrics"
              @click="exportAiMetrics"
            >
              Export
            </UButton>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <!-- Overview Card -->
          <UCard>
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold text-sm">Overview</h3>
            </div>
            <div v-if="loadingAiMetrics" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="aiMetricsOverview?.success" class="text-sm space-y-1">
              <p class="text-2xl font-bold text-primary-600 dark:text-primary-400">
                ${{ aiMetricsOverview.data?.totalCost?.toFixed(4) || '0.00' }}
              </p>
              <p class="text-gray-600 dark:text-gray-400">
                {{ aiMetricsOverview.data?.totalRequests || 0 }} requests
              </p>
              <p class="text-gray-600 dark:text-gray-400">
                {{ formatTokens(aiMetricsOverview.data?.totalTokens || 0) }} tokens
              </p>
            </div>
            <div v-else class="text-sm text-red-600">
              {{ aiMetricsOverview?.error || 'Failed to load' }}
            </div>
          </UCard>

          <!-- Budget Card -->
          <UCard>
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold text-sm">Budget</h3>
              <UBadge :color="getBudgetColor(aiMetricsBudget?.data?.percentUsed)" variant="subtle">
                {{ aiMetricsBudget?.data?.percentUsed?.toFixed(0) || 0 }}% used
              </UBadge>
            </div>
            <div v-if="loadingAiMetrics" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="aiMetricsBudget?.success" class="text-sm space-y-1">
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                <div
                  class="h-2 rounded-full"
                  :class="getBudgetBarColor(aiMetricsBudget.data?.percentUsed)"
                  :style="{ width: `${Math.min(aiMetricsBudget.data?.percentUsed || 0, 100)}%` }"
                />
              </div>
              <p class="text-gray-600 dark:text-gray-400">
                ${{ aiMetricsBudget.data?.spent?.toFixed(2) || '0.00' }} / ${{
                  aiMetricsBudget.data?.limit?.toFixed(2) || '0.00'
                }}
              </p>
              <p class="text-gray-600 dark:text-gray-400">
                Remaining: ${{ aiMetricsBudget.data?.remaining?.toFixed(2) || '0.00' }}
              </p>
            </div>
            <div v-else class="text-sm text-red-600">
              {{ aiMetricsBudget?.error || 'Failed to load' }}
            </div>
          </UCard>

          <!-- Efficiency Card -->
          <UCard>
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold text-sm">Efficiency</h3>
            </div>
            <div v-if="loadingAiMetrics" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="aiMetricsEfficiency?.success" class="text-sm space-y-1">
              <p class="text-gray-600 dark:text-gray-400">
                Avg tokens/request:
                {{ aiMetricsEfficiency.data?.avgTokensPerRequest?.toFixed(0) || 0 }}
              </p>
              <p class="text-gray-600 dark:text-gray-400">
                Avg cost/request: ${{
                  aiMetricsEfficiency.data?.avgCostPerRequest?.toFixed(4) || '0.00'
                }}
              </p>
              <p class="text-gray-600 dark:text-gray-400">
                Success rate: {{ aiMetricsEfficiency.data?.successRate?.toFixed(1) || 0 }}%
              </p>
            </div>
            <div v-else class="text-sm text-red-600">
              {{ aiMetricsEfficiency?.error || 'Failed to load' }}
            </div>
          </UCard>

          <!-- Costs Breakdown Card -->
          <UCard>
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold text-sm">Cost by Model</h3>
            </div>
            <div v-if="loadingAiMetrics" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="aiMetricsCosts?.success" class="text-sm space-y-1">
              <div
                v-for="model in aiMetricsCosts.data?.byModel || []"
                :key="model.model"
                class="flex justify-between"
              >
                <span class="text-gray-600 dark:text-gray-400 truncate">{{ model.model }}</span>
                <span class="font-medium">${{ model.cost?.toFixed(4) || '0.00' }}</span>
              </div>
              <p v-if="!aiMetricsCosts.data?.byModel?.length" class="text-gray-500">
                No data available
              </p>
            </div>
            <div v-else class="text-sm text-red-600">
              {{ aiMetricsCosts?.error || 'Failed to load' }}
            </div>
          </UCard>
        </div>

        <!-- Trends & Recommendations Row -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Trends Card -->
          <UCard>
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold">Cost Trends (7 days)</h3>
            </div>
            <div v-if="loadingAiMetrics" class="flex justify-center py-8">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div
              v-else-if="aiMetricsTrends?.success && aiMetricsTrends.data?.length"
              class="space-y-2"
            >
              <div
                v-for="trend in aiMetricsTrends.data.slice(0, 7)"
                :key="trend.date"
                class="flex items-center gap-2"
              >
                <span class="text-xs text-gray-500 w-20">{{ formatDate(trend.date) }}</span>
                <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    class="bg-primary-500 h-2 rounded-full"
                    :style="{ width: `${getTrendWidth(trend.cost, aiMetricsTrends.data)}%` }"
                  />
                </div>
                <span class="text-xs font-medium w-16 text-right"
                  >${{ trend.cost?.toFixed(4) || '0.00' }}</span
                >
              </div>
            </div>
            <p v-else class="text-sm text-gray-500 py-4 text-center">No trend data available</p>
          </UCard>

          <!-- Recommendations Card -->
          <UCard>
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold">Optimization Recommendations</h3>
            </div>
            <div v-if="loadingAiMetrics" class="flex justify-center py-8">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div
              v-else-if="aiMetricsRecommendations?.success && aiMetricsRecommendations.data?.length"
              class="space-y-3"
            >
              <div
                v-for="(rec, index) in aiMetricsRecommendations.data.slice(0, 5)"
                :key="index"
                class="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div class="flex items-start gap-2">
                  <UIcon
                    :name="getRecommendationIcon(rec.type)"
                    :class="getRecommendationColor(rec.priority)"
                    class="mt-0.5"
                  />
                  <div>
                    <p class="text-sm font-medium">
                      {{ rec.title }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ rec.description }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-gray-500 py-4 text-center">
              No recommendations at this time
            </p>
          </UCard>
        </div>
      </div>

      <!-- Scraper Metrics Section -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-semibold">Scraper Metrics</h2>
          <UButton
            size="xs"
            variant="ghost"
            icon="i-heroicons-arrow-path"
            :loading="loadingScraperMetrics"
            @click="loadScraperMetrics"
          >
            Refresh
          </UButton>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Total Costs -->
          <UCard>
            <h3 class="font-semibold mb-2">30-Day Costs</h3>
            <div v-if="loadingScraperMetrics" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="scraperMetrics?.success" class="text-sm space-y-1">
              <p class="text-2xl font-bold text-primary-600 dark:text-primary-400">
                ${{ scraperMetrics.data?.totalCosts?.last30Days?.toFixed(4) || '0.00' }}
              </p>
              <p class="text-gray-600 dark:text-gray-400">
                Est. monthly: ${{
                  scraperMetrics.data?.totalCosts?.estimatedMonthly?.toFixed(4) || '0.00'
                }}
              </p>
            </div>
            <div v-else class="text-sm text-red-600">
              {{ scraperMetrics?.error || 'Failed to load' }}
            </div>
          </UCard>

          <!-- Success Rates -->
          <UCard>
            <h3 class="font-semibold mb-2">Success Rates by Type</h3>
            <div v-if="loadingScraperMetrics" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="scraperMetrics?.success" class="text-sm space-y-2">
              <div
                v-for="rate in scraperMetrics.data?.successRates || []"
                :key="rate.dataType"
                class="flex items-center justify-between"
              >
                <span class="text-gray-600 dark:text-gray-400">{{ rate.dataType }}</span>
                <UBadge
                  :color="
                    rate.successRate >= 90
                      ? 'success'
                      : rate.successRate >= 70
                        ? 'warning'
                        : 'error'
                  "
                  variant="subtle"
                >
                  {{ rate.successRate?.toFixed(1) }}%
                </UBadge>
              </div>
            </div>
            <div v-else class="text-sm text-red-600">
              {{ scraperMetrics?.error || 'Failed to load' }}
            </div>
          </UCard>

          <!-- AI vs DOM Comparison -->
          <UCard>
            <h3 class="font-semibold mb-2">AI vs DOM Success</h3>
            <div v-if="loadingScraperMetrics" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
            <div v-else-if="scraperMetrics?.success" class="text-sm space-y-2">
              <div
                v-for="comp in scraperMetrics.data?.aiVsDomComparison || []"
                :key="comp.dataType"
                class="text-xs"
              >
                <p class="font-medium mb-1">
                  {{ comp.dataType }}
                </p>
                <div class="flex gap-2">
                  <span class="text-gray-500"
                    >AI: {{ comp.ai?.successRate?.toFixed(0) || 0 }}%</span
                  >
                  <span class="text-gray-500"
                    >DOM: {{ comp.dom?.successRate?.toFixed(0) || 0 }}%</span
                  >
                </div>
              </div>
            </div>
            <div v-else class="text-sm text-red-600">
              {{ scraperMetrics?.error || 'Failed to load' }}
            </div>
          </UCard>
        </div>
      </div>

      <!-- AI Usage Metrics (In-Memory) -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-semibold">AI Usage Metrics (Session)</h2>
          <UButton
            size="xs"
            variant="ghost"
            icon="i-heroicons-arrow-path"
            :loading="loadingAiUsageMetrics"
            @click="loadAiUsageMetrics"
          >
            Refresh
          </UButton>
        </div>

        <UCard>
          <div v-if="loadingAiUsageMetrics" class="flex justify-center py-8">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
          </div>
          <div v-else-if="aiUsageMetrics?.success" class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Total Requests</p>
              <p class="text-xl font-bold">
                {{ aiUsageMetrics.metrics?.totalRequests || 0 }}
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Total Tokens</p>
              <p class="text-xl font-bold">
                {{ formatTokens(aiUsageMetrics.metrics?.totalTokens || 0) }}
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Total Cost</p>
              <p class="text-xl font-bold">
                ${{ aiUsageMetrics.metrics?.totalCost?.toFixed(4) || '0.00' }}
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Avg Latency</p>
              <p class="text-xl font-bold">
                {{ aiUsageMetrics.metrics?.avgLatency?.toFixed(0) || 0 }}ms
              </p>
            </div>
          </div>
          <div v-else class="text-sm text-red-600 py-4 text-center">
            {{ aiUsageMetrics?.error || 'Failed to load metrics' }}
          </div>
        </UCard>
      </div>
    </template>
  </UContainer>
</template>

<script setup lang="ts">
import type { ScheduleWindowStatus } from '~/types'
import { useUserProfile } from '~/composables/useUserProfile'

useHead({
  title: 'Admin Control Panel - Stryktipset AI Predictor',
})

// Admin access check
const { isAdmin, fetchProfile, loading: profileLoading } = useUserProfile()
const accessDenied = ref(false)

// Schedule window states
const scheduleStatus = ref<ScheduleWindowStatus | null>(null)
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

// AI Metrics states
const loadingAiMetrics = ref(false)
const exportingMetrics = ref(false)
const aiMetricsPreset = ref('30days')
const aiMetricsOverview = ref<any>(null)
const aiMetricsBudget = ref<any>(null)
const aiMetricsEfficiency = ref<any>(null)
const aiMetricsCosts = ref<any>(null)
const aiMetricsTrends = ref<any>(null)
const aiMetricsRecommendations = ref<any>(null)
/* eslint-enable @typescript-eslint/no-explicit-any */

const datePresetOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7days' },
  { label: 'Last 30 days', value: '30days' },
  { label: 'This month', value: 'thisMonth' },
  { label: 'Last month', value: 'lastMonth' },
]

// Scraper Metrics states
const loadingScraperMetrics = ref(false)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin API responses have dynamic shapes
const scraperMetrics = ref<any>(null)

// AI Usage Metrics states
const loadingAiUsageMetrics = ref(false)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin API responses have dynamic shapes
const aiUsageMetrics = ref<any>(null)

// Draw Management states
const loadingCurrentDraws = ref(false)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin API responses have dynamic shapes
const currentDraws = ref<any>(null)
const archiveModalOpen = ref(false)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin API responses have dynamic shapes
const drawToArchive = ref<any>(null)
const forceArchive = ref(false)
const archiving = ref(false)

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
    loadAiMetrics(),
    loadScraperMetrics(),
    loadAiUsageMetrics(),
    loadCurrentDraws(),
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

function formatTime(timestamp: string): string {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleTimeString('sv-SE')
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

// AI Metrics functions
async function loadAiMetrics() {
  loadingAiMetrics.value = true
  try {
    const [overview, budget, efficiency, costs, trends, recommendations] = await Promise.all([
      $fetch(`/api/admin/ai-metrics/overview?preset=${aiMetricsPreset.value}`),
      $fetch('/api/admin/ai-metrics/budget'),
      $fetch(`/api/admin/ai-metrics/efficiency?preset=${aiMetricsPreset.value}`),
      $fetch(`/api/admin/ai-metrics/costs?preset=${aiMetricsPreset.value}`),
      $fetch(`/api/admin/ai-metrics/trends?preset=${aiMetricsPreset.value}`),
      $fetch(`/api/admin/ai-metrics/recommendations?preset=${aiMetricsPreset.value}`),
    ])
    aiMetricsOverview.value = overview
    aiMetricsBudget.value = budget
    aiMetricsEfficiency.value = efficiency
    aiMetricsCosts.value = costs
    aiMetricsTrends.value = trends
    aiMetricsRecommendations.value = recommendations
  } catch (error) {
    console.error('Error loading AI metrics:', error)
  } finally {
    loadingAiMetrics.value = false
  }
}

async function exportAiMetrics() {
  exportingMetrics.value = true
  try {
    const data = await $fetch<{ success: boolean; data?: unknown[] }>(
      `/api/admin/ai-metrics/export?preset=${aiMetricsPreset.value}`
    )
    if (data.success && data.data) {
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-metrics-${aiMetricsPreset.value}-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error('Error exporting AI metrics:', error)
  } finally {
    exportingMetrics.value = false
  }
}

// Scraper Metrics functions
async function loadScraperMetrics() {
  loadingScraperMetrics.value = true
  try {
    scraperMetrics.value = await $fetch('/api/admin/scraper-metrics')
  } catch (error) {
    console.error('Error loading scraper metrics:', error)
    scraperMetrics.value = { success: false, error: 'Failed to load' }
  } finally {
    loadingScraperMetrics.value = false
  }
}

// AI Usage Metrics functions
async function loadAiUsageMetrics() {
  loadingAiUsageMetrics.value = true
  try {
    aiUsageMetrics.value = await $fetch('/api/admin/ai-usage-metrics')
  } catch (error) {
    console.error('Error loading AI usage metrics:', error)
    aiUsageMetrics.value = { success: false, error: 'Failed to load' }
  } finally {
    loadingAiUsageMetrics.value = false
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
      body: { force: forceArchive.value },
    })

    if (result.success) {
      archiveModalOpen.value = false
      drawToArchive.value = null
      // Reload the draws list
      await loadCurrentDraws()
    }
  } catch (error) {
    console.error('Error archiving draw:', error)
  } finally {
    archiving.value = false
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

function formatDateShort(date: string): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('sv-SE')
}

// Helper functions for AI metrics
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

function formatDate(date: string): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
}

function getBudgetColor(percent: number | undefined): 'success' | 'warning' | 'error' | 'neutral' {
  if (percent === undefined) return 'neutral'
  if (percent >= 90) return 'error'
  if (percent >= 70) return 'warning'
  return 'success'
}

function getBudgetBarColor(percent: number | undefined): string {
  if (percent === undefined) return 'bg-gray-400'
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 70) return 'bg-yellow-500'
  return 'bg-green-500'
}

function getTrendWidth(cost: number, trends: Array<{ cost: number }>): number {
  if (!trends || trends.length === 0) return 0
  const maxCost = Math.max(...trends.map(t => t.cost || 0))
  if (maxCost === 0) return 0
  return (cost / maxCost) * 100
}

function getRecommendationIcon(type: string): string {
  switch (type) {
    case 'cost':
      return 'i-heroicons-currency-dollar'
    case 'performance':
      return 'i-heroicons-bolt'
    case 'efficiency':
      return 'i-heroicons-chart-bar'
    case 'warning':
      return 'i-heroicons-exclamation-triangle'
    default:
      return 'i-heroicons-light-bulb'
  }
}

function getRecommendationColor(priority: string): string {
  switch (priority) {
    case 'high':
      return 'text-red-600'
    case 'medium':
      return 'text-yellow-500'
    case 'low':
      return 'text-blue-500'
    default:
      return 'text-gray-500'
  }
}

// Watch for preset changes
watch(aiMetricsPreset, () => {
  loadAiMetrics()
})
</script>
