"""
Playwright hooks for handling Svenska Spel cookie consent and other browser behaviors.
"""

from playwright.async_api import Page, BrowserContext


async def handle_cookie_consent(page: Page, context: BrowserContext, **kwargs):
    """
    Automatically handle Svenska Spel cookie consent banner.
    Called via on_page_context_created hook.
    """
    try:
        # Wait a bit for banner to appear
        await page.wait_for_timeout(1000)
        
        # Try multiple possible selectors for accept button
        selectors = [
            'button:has-text("Acceptera")',
            'button:has-text("Accept")',
            'button:has-text("Godkänn")',
            '[id*="cookie"][class*="accept"]',
            '[class*="cookie"][class*="accept"]',
            'button[class*="cookie"]',
            '#onetrust-accept-btn-handler'
        ]
        
        for selector in selectors:
            try:
                if await page.locator(selector).is_visible(timeout=2000):
                    await page.click(selector, timeout=3000)
                    print("[HOOK] ✅ Cookie consent accepted")
                    await page.wait_for_timeout(500)
                    break
            except:
                continue
                
    except Exception as e:
        # Not critical if this fails
        print(f"[HOOK] ⚠️  Cookie consent handling: {e}")
    
    return page

