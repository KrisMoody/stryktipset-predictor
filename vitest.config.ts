import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: [
      'tests/unit/**/*.test.ts',
      'tests/components/**/*.test.ts',
    ],
    exclude: [
      'node_modules',
      'tests/e2e/**',
      'tests/integration/**',
      'tests/accessibility/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'server/services/**/*.ts',
        'server/utils/**/*.ts',
        'utils/**/*.ts',
        'composables/**/*.ts',
        'components/**/*.vue',
      ],
      exclude: [
        'node_modules',
        'tests/**',
        '**/*.d.ts',
        'server/plugins/**',
        '.nuxt/**',
      ],
      thresholds: {
        // Overall threshold
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      },
    },
    mockReset: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, '.'),
      '@': resolve(__dirname, '.'),
      '#imports': resolve(__dirname, '.nuxt/imports.d.ts'),
    },
  },
})
