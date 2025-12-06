import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

// MSW Server setup for API mocking
export const server = setupServer(...handlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

// Mock Nuxt auto-imports
vi.stubGlobal('useRuntimeConfig', () => ({
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  anthropicApiKey: 'test-anthropic-key',
  openaiApiKey: 'test-openai-key',
  svenskaSpelApiBaseUrl: 'https://api.spela.svenskaspel.se/draw/1/stryktipset',
  enableScraperV3: false,
  enableAiScraper: false,
  aiScraperUrl: 'http://localhost:8000',
  public: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    supabaseKey: 'test-anon-key',
  },
}))

vi.stubGlobal('useNuxtApp', () => ({
  $supabase: null,
}))

// Mock Nuxt server utilities
vi.stubGlobal('defineEventHandler', (handler: (...args: unknown[]) => unknown) => handler)
vi.stubGlobal('readBody', vi.fn())
vi.stubGlobal(
  'getQuery',
  vi.fn(() => ({}))
)
vi.stubGlobal('getRouterParam', vi.fn())
vi.stubGlobal('createError', (opts: { statusCode?: number; message: string }) => {
  const error = new Error(opts.message) as Error & { statusCode?: number }
  error.statusCode = opts.statusCode
  return error
})

// Mock Vue reactivity for composables
vi.stubGlobal('ref', <T>(val: T) => ({ value: val }))
vi.stubGlobal('computed', <T>(fn: () => T) => ({ value: fn() }))
vi.stubGlobal('readonly', <T>(val: T) => val)
vi.stubGlobal('isRef', () => false)
vi.stubGlobal('unref', <T>(val: T) => val)
vi.stubGlobal('toRef', <T>(val: T) => ({ value: val }))
vi.stubGlobal('toRefs', <T extends object>(obj: T) => {
  const refs: Record<string, { value: unknown }> = {}
  for (const key in obj) {
    refs[key] = { value: obj[key] }
  }
  return refs
})

// Mock Vue lifecycle hooks
vi.stubGlobal('onMounted', vi.fn())
vi.stubGlobal('onUnmounted', vi.fn())
vi.stubGlobal('onBeforeMount', vi.fn())
vi.stubGlobal('onBeforeUnmount', vi.fn())
vi.stubGlobal(
  'getCurrentInstance',
  vi.fn(() => null)
)

// Mock Nuxt composables
vi.stubGlobal(
  'useRoute',
  vi.fn(() => ({ path: '/', params: {}, query: {} }))
)
vi.stubGlobal(
  'useRouter',
  vi.fn(() => ({ push: vi.fn(), replace: vi.fn() }))
)
vi.stubGlobal('useFetch', vi.fn())
vi.stubGlobal('useAsyncData', vi.fn())
vi.stubGlobal('watch', vi.fn())
vi.stubGlobal('watchEffect', vi.fn())

// Mock console methods to reduce noise in tests (optional)
// vi.spyOn(console, 'log').mockImplementation(() => {})
// vi.spyOn(console, 'warn').mockImplementation(() => {})
