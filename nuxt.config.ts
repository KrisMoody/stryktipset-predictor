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
    redirect: true,
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

    // Public keys are now handled by @nuxtjs/supabase module
    // It reads SUPABASE_URL and SUPABASE_KEY automatically
    public: {},
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
