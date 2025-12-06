import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for E2E and Accessibility tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI for stability
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL for navigation
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for E2E and accessibility testing
  projects: [
    // E2E Tests - run in multiple browsers
    {
      name: 'chromium',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Safari'] },
    },

    // Accessibility Tests - Chromium only (AxeBuilder)
    {
      name: 'accessibility',
      testDir: './tests/accessibility',
      use: { ...devices['Desktop Chrome'] },
    },

    // Mobile viewports for responsive testing
    {
      name: 'mobile-chrome',
      testDir: './tests/e2e',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      testDir: './tests/e2e',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run local dev server before starting the tests
  // Use 'preview' in CI (after build) or 'dev' locally
  webServer: {
    command: process.env.CI ? 'yarn preview' : 'yarn dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
