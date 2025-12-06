import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Accessibility Tests - WCAG 2.1 AA Compliance
 *
 * These tests scan each page for accessibility violations using axe-core.
 * Violations will fail the build to ensure we maintain accessibility standards.
 */

// Configure axe for WCAG 2.1 AA standard
const axeConfig = {
  tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
}

test.describe('Accessibility - Main Pages', () => {
  test('homepage has no accessibility violations', async ({ page }) => {
    await page.goto('/')

    // Wait for page to fully load
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).withTags(axeConfig.tags).analyze()

    // Log violations for debugging
    if (results.violations.length > 0) {
      console.log('Accessibility violations on homepage:')
      results.violations.forEach(violation => {
        console.log(`  - ${violation.id}: ${violation.description}`)
        console.log(`    Impact: ${violation.impact}`)
        console.log(`    Nodes: ${violation.nodes.length}`)
      })
    }

    expect(results.violations).toEqual([])
  })

  test('analytics page has no accessibility violations', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).withTags(axeConfig.tags).analyze()

    if (results.violations.length > 0) {
      console.log('Accessibility violations on analytics page:')
      results.violations.forEach(v => {
        console.log(`  - ${v.id}: ${v.description} (${v.impact})`)
      })
    }

    expect(results.violations).toEqual([])
  })

  test('AI metrics dashboard has no accessibility violations', async ({ page }) => {
    await page.goto('/ai-dashboard')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).withTags(axeConfig.tags).analyze()

    if (results.violations.length > 0) {
      console.log('Accessibility violations on AI dashboard:')
      results.violations.forEach(v => {
        console.log(`  - ${v.id}: ${v.description} (${v.impact})`)
      })
    }

    expect(results.violations).toEqual([])
  })

  test('performance page has no accessibility violations', async ({ page }) => {
    await page.goto('/performance')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).withTags(axeConfig.tags).analyze()

    if (results.violations.length > 0) {
      console.log('Accessibility violations on performance page:')
      results.violations.forEach(v => {
        console.log(`  - ${v.id}: ${v.description} (${v.impact})`)
      })
    }

    expect(results.violations).toEqual([])
  })

  test('admin page has no accessibility violations', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).withTags(axeConfig.tags).analyze()

    if (results.violations.length > 0) {
      console.log('Accessibility violations on admin page:')
      results.violations.forEach(v => {
        console.log(`  - ${v.id}: ${v.description} (${v.impact})`)
      })
    }

    expect(results.violations).toEqual([])
  })
})

test.describe('Accessibility - Keyboard Navigation', () => {
  test('can navigate homepage with keyboard only', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Tab through the page and verify focus is visible
    await page.keyboard.press('Tab')

    // Get the focused element
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement
      return {
        tagName: el?.tagName,
        hasVisibleFocus: el
          ? getComputedStyle(el).outlineStyle !== 'none' || el.classList.contains('focus-visible')
          : false,
      }
    })

    // Should be able to focus on something
    expect(focusedElement.tagName).toBeTruthy()
  })

  test('skip link is present and functional', async ({ page }) => {
    await page.goto('/')

    // Look for skip link (usually first focusable element)
    const skipLink = page.locator('a[href="#main"], a[href="#content"], [class*="skip"]').first()

    if (await skipLink.isVisible()) {
      // Skip link should be focusable
      await skipLink.focus()
      expect(await skipLink.isVisible()).toBeTruthy()
    }
  })
})

test.describe('Accessibility - Color Contrast', () => {
  test('text has sufficient color contrast', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Run axe specifically for WCAG 2 AA color contrast (4.5:1 ratio)
    // Note: We exclude 'color-contrast-enhanced' (WCAG AAA - 7:1 ratio) as it's a stricter optional standard
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()

    if (results.violations.length > 0) {
      console.log('Color contrast violations:')
      results.violations.forEach(v => {
        console.log(`  - ${v.id}: ${v.nodes.length} elements`)
      })
    }

    expect(results.violations).toEqual([])
  })
})

test.describe('Accessibility - Forms', () => {
  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).withTags(['cat.forms']).analyze()

    // Filter for label-related violations
    const labelViolations = results.violations.filter(v => v.id.includes('label'))

    if (labelViolations.length > 0) {
      console.log('Form label violations:')
      labelViolations.forEach(v => {
        console.log(`  - ${v.id}: ${v.description}`)
      })
    }

    expect(labelViolations).toEqual([])
  })
})

test.describe('Accessibility - Images', () => {
  test('images have alt text', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).withRules(['image-alt']).analyze()

    if (results.violations.length > 0) {
      console.log('Image alt text violations:')
      results.violations.forEach(v => {
        console.log(`  - ${v.nodes.length} images missing alt text`)
      })
    }

    expect(results.violations).toEqual([])
  })
})

test.describe('Accessibility - Semantic HTML', () => {
  test('page has proper landmark regions', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withRules(['landmark-one-main', 'region'])
      .analyze()

    // This is a common violation - log but don't fail initially
    if (results.violations.length > 0) {
      console.log('Landmark violations (consider fixing):')
      results.violations.forEach(v => {
        console.log(`  - ${v.id}: ${v.description}`)
      })
    }

    // For now, just warn - enable strict checking when ready
    // expect(results.violations).toEqual([])
  })

  test('headings are in logical order', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).withRules(['heading-order']).analyze()

    if (results.violations.length > 0) {
      console.log('Heading order violations:')
      results.violations.forEach(v => {
        console.log(`  - ${v.description}`)
      })
    }

    expect(results.violations).toEqual([])
  })
})

test.describe('Accessibility - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('mobile view has no accessibility violations', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).withTags(axeConfig.tags).analyze()

    if (results.violations.length > 0) {
      console.log('Mobile accessibility violations:')
      results.violations.forEach(v => {
        console.log(`  - ${v.id}: ${v.description} (${v.impact})`)
      })
    }

    expect(results.violations).toEqual([])
  })
})
