import type { BrowserContext, Cookie } from 'playwright'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * Manages browser cookies for persistent sessions
 */
export class CookieManager {
  private cookieFile: string

  constructor(cookieFile: string = 'cookies-storage.json') {
    this.cookieFile = path.join(process.cwd(), cookieFile)
  }

  /**
   * Save cookies from context to file
   */
  async saveCookies(context: BrowserContext): Promise<void> {
    try {
      const cookies = await context.cookies()
      await fs.writeFile(this.cookieFile, JSON.stringify(cookies, null, 2))
      console.log(`[Cookie Manager] Saved ${cookies.length} cookies to ${this.cookieFile}`)
    }
    catch (error) {
      console.error('[Cookie Manager] Error saving cookies:', error)
    }
  }

  /**
   * Load cookies from file into context
   */
  async loadCookies(context: BrowserContext): Promise<boolean> {
    try {
      const data = await fs.readFile(this.cookieFile, 'utf-8')
      const cookies: Cookie[] = JSON.parse(data)

      if (cookies && cookies.length > 0) {
        await context.addCookies(cookies)
        console.log(`[Cookie Manager] Loaded ${cookies.length} cookies from ${this.cookieFile}`)
        return true
      }

      return false
    }
    catch {
      // File doesn't exist or is invalid - this is fine for first run
      console.log('[Cookie Manager] No existing cookies found, will create new session')
      return false
    }
  }

  /**
   * Clear saved cookies
   */
  async clearCookies(): Promise<void> {
    try {
      await fs.unlink(this.cookieFile)
      console.log('[Cookie Manager] Cleared saved cookies')
    }
    catch {
      // File doesn't exist - this is fine
    }
  }

  /**
   * Check if cookies exist
   */
  async hasCookies(): Promise<boolean> {
    try {
      await fs.access(this.cookieFile)
      return true
    }
    catch {
      return false
    }
  }
}

// Export singleton instance
export const cookieManager = new CookieManager()
