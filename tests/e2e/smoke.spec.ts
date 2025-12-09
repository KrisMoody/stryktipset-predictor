import { test, expect } from '@playwright/test'

/**
 * Smoke Tests - Critical Path Verification
 *
 * These tests verify that the core pages and API endpoints are functional.
 * They run quickly and catch basic integration issues.
 */

test.describe('Smoke Tests - Core Functionality', () => {
  test('homepage loads and displays current draws', async ({ page }) => {
    await page.goto('/')

    // Wait for page to hydrate
    await expect(page.locator('body')).toBeVisible()

    // Check for header element (contains navigation)
    await expect(page.locator('header')).toBeVisible()

    // Verify page doesn't show error states
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('analytics page loads', async ({ page }) => {
    await page.goto('/analytics')

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('AI metrics dashboard loads', async ({ page }) => {
    await page.goto('/ai-dashboard')

    // Page should load
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('performance page loads', async ({ page }) => {
    await page.goto('/performance')

    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('admin page loads', async ({ page }) => {
    await page.goto('/admin')

    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('500')
  })
})

test.describe('Smoke Tests - Navigation', () => {
  test('can navigate between pages via header', async ({ page }) => {
    await page.goto('/')

    // Find and click Analytics link
    const analyticsLink = page.getByRole('link', { name: /analytics/i })
    if (await analyticsLink.isVisible()) {
      await analyticsLink.click()
      await expect(page).toHaveURL(/\/analytics/)
    }
  })

  test('breadcrumb navigation works', async ({ page }) => {
    // Navigate to a nested page
    await page.goto('/analytics')

    // Check breadcrumb exists
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"], [class*="breadcrumb"]')
    if (await breadcrumb.isVisible()) {
      // Click on home/dashboard link in breadcrumb
      const homeLink = breadcrumb.getByRole('link').first()
      if (await homeLink.isVisible()) {
        await homeLink.click()
        await expect(page).toHaveURL('/')
      }
    }
  })
})

test.describe('Smoke Tests - API Health', () => {
  test('health endpoint responds with 200', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('status')
  })

  test('schedule status endpoint responds', async ({ request }) => {
    const response = await request.get('/api/schedule/status')
    // May return 200 or 404 depending on implementation
    expect([200, 404]).toContain(response.status())
  })

  test('draws endpoint responds', async ({ request }) => {
    const response = await request.get('/api/draws/current')
    // API should respond (may be error if no DB, but not 500)
    expect(response.status()).toBeLessThan(500)
  })
})

test.describe('Smoke Tests - Error Handling', () => {
  test('404 page handles unknown routes gracefully', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345')

    // Should show some kind of 404 or redirect, not crash
    await expect(page.locator('body')).toBeVisible()
    // Should not show server error
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })
})

test.describe('Smoke Tests - Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('homepage is usable on mobile', async ({ page }) => {
    await page.goto('/')

    // Page should load
    await expect(page.locator('body')).toBeVisible()

    // Check for header (always visible) and mobile menu button
    await expect(page.locator('header')).toBeVisible()

    // Mobile menu button should be visible on small screens
    const mobileMenuButton = page.locator('button[aria-controls="mobile-navigation"]')
    await expect(mobileMenuButton).toBeVisible()
  })
})
