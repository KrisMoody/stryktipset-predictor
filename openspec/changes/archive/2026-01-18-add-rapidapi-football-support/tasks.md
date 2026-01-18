# Tasks

## 1. Configuration
- [x] 1.1 Add RapidAPI environment variables to `nuxt.config.ts`
- [x] 1.2 Update `ApiFootballConfig` type to include RapidAPI fields

## 2. Implementation
- [x] 2.1 Add provider detection logic to `ApiFootballClient` constructor
- [x] 2.2 Update `fetchWithRetry` to use correct headers based on provider
- [x] 2.3 Update `isConfigured()` to check either API key type

## 3. Testing
- [ ] 3.1 Test with RapidAPI credentials
- [ ] 3.2 Verify fallback to direct API when RapidAPI not configured
- [ ] 3.3 Verify existing direct API functionality unchanged
