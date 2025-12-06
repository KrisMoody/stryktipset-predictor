// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      htmlAttrs: {
        lang: 'en',
      },
    },
  },

  modules: ['@nuxt/ui', '@nuxt/icon', '@nuxt/eslint'],

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

    // Public keys (client-side accessible)
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      supabaseKey: process.env.SUPABASE_ANON_KEY,
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
      // Only scan these specific directories, exclude everything else including services/
      entries: [
        '.nuxt/**/*',
        'pages/**/*',
        'components/**/*',
        'composables/**/*',
        'plugins/**/*',
        'server/api/**/*',
        'server/plugins/**/*',
        'server/services/**/*',
        'server/utils/**/*',
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
