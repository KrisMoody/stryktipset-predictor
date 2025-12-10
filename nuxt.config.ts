// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      htmlAttrs: {
        lang: 'en',
      },
    },
  },

  modules: ['@nuxt/ui', '@nuxt/icon', '@nuxt/eslint', '@nuxtjs/supabase'],

  supabase: {
    // Disable database types - we use Prisma for database operations,
    // Supabase is only used for auth and realtime subscriptions
    types: false,
    // Disable redirect in test mode to allow E2E tests to access pages
    redirect: process.env.TEST_MODE !== 'true',
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: [],
    },
  },

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Private keys (server-side only)
    databaseUrl: process.env.DATABASE_URL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    svenskaSpelApiBaseUrl:
      process.env.SVENSKA_SPEL_API_BASE_URL ||
      'https://api.spela.svenskaspel.se/draw/1/stryktipset',

    // Scraper configuration
    enableScraperV3: process.env.ENABLE_SCRAPER_V3 === 'true',
    enableAiScraper: process.env.ENABLE_AI_SCRAPER === 'true',
    aiScraperUrl: process.env.AI_SCRAPER_URL || 'http://localhost:8000',

    // Auth configuration
    allowedEmails: process.env.ALLOWED_EMAILS || '',
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || '',

    // Bugsnag configuration (server-side)
    bugsnagApiKey: process.env.BUGSNAG_API_KEY || '',
    bugsnagReleaseStage: process.env.BUGSNAG_RELEASE_STAGE || 'production',
    bugsnagAppVersion:
      process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || '1.0.0',

    // Public keys are now handled by @nuxtjs/supabase module
    // It reads SUPABASE_URL and SUPABASE_KEY automatically
    public: {
      // Test mode - bypasses auth for E2E tests
      testMode: process.env.TEST_MODE === 'true',

      // Auth redirect URL - set to http://localhost:3000 for local development
      // If not set, falls back to window.location.origin
      authRedirectUrl: process.env.AUTH_REDIRECT_URL || '',

      // Bugsnag configuration (client-side)
      bugsnagApiKey: process.env.BUGSNAG_API_KEY || '',
      bugsnagReleaseStage: process.env.BUGSNAG_RELEASE_STAGE || 'production',
      bugsnagAppVersion:
        process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || '1.0.0',
      supabaseUrl: process.env.SUPABASE_URL || '',
    },
  },
  compatibilityDate: '2024-11-01',
  nitro: {
    experimental: {
      tasks: true,
    },
  },
  vite: {
    optimizeDeps: {
      // Fix for @supabase/postgrest-js ESM issue in Nuxt 4
      include: ['@supabase/postgrest-js'],
      // Only scan client-side directories for dependency optimization
      // Server directories should NOT be included here as it causes cross-boundary import errors
      entries: [
        '.nuxt/**/*',
        'pages/**/*',
        'components/**/*',
        'composables/**/*',
        'plugins/**/*',
        'app.vue',
      ],
    },
    server: {
      watch: {
        // Exclude Python venv from file watching
        ignored: ['**/services/ai-scraper/**', '**/*.pyc'],
      },
    },
    build: {
      // Generate source maps for production (hidden = not referenced in output)
      // These are uploaded to Bugsnag for better stack traces
      sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
    },
  },
  typescript: {
    strict: true,
  },
  eslint: {
    config: {
      stylistic: false,
    },
  },
})
