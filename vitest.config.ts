import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [vue() as any],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.ts', 'tests/api/**/*.test.ts'],
    exclude: ['node_modules', 'tests/e2e/**', 'tests/integration/**', 'tests/accessibility/**'],
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
      exclude: ['node_modules', 'tests/**', '**/*.d.ts', 'server/plugins/**', '.nuxt/**'],
      thresholds: {
        lines: 1,
        functions: 70,
        branches: 20,
        statements: 1,
      },
    },
    mockReset: true,
    restoreMocks: true,
    projects: [
      {
        resolve: {
          alias: {
            '~': resolve(__dirname, '.'),
            '@': resolve(__dirname, '.'),
            '#imports': resolve(__dirname, '.nuxt/imports.d.ts'),
          },
        },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'happy-dom',
        },
      },
      {
        resolve: {
          alias: {
            '~': resolve(__dirname, '.'),
            '@': resolve(__dirname, '.'),
            '#imports': resolve(__dirname, '.nuxt/imports.d.ts'),
          },
        },
        test: {
          name: 'components',
          include: ['tests/components/**/*.test.ts'],
          environment: 'happy-dom',
        },
      },
      {
        resolve: {
          alias: {
            '~': resolve(__dirname, '.'),
            '@': resolve(__dirname, '.'),
            '#imports': resolve(__dirname, '.nuxt/imports.d.ts'),
          },
        },
        test: {
          name: 'api',
          include: ['tests/api/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, '.'),
      '@': resolve(__dirname, '.'),
      '#imports': resolve(__dirname, '.nuxt/imports.d.ts'),
    },
  },
})
