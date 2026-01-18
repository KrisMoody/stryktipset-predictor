# Change: Add RapidAPI Football Support

## Why
The API-Football service is available through two endpoints with different authentication methods:
1. **Direct API** (`v3.football.api-sports.io`) - uses `x-apisports-key` header
2. **RapidAPI** (`api-football-v1.p.rapidapi.com`) - uses `X-RapidAPI-Key` and `X-RapidAPI-Host` headers

Users may have subscriptions through RapidAPI rather than the direct API, so the client needs to support both authentication methods.

## What Changes
- Extend `ApiFootballClient` to detect and use RapidAPI authentication when configured
- Add new environment variables for RapidAPI configuration:
  - `RAPID_API_FOOTBALL_BASE_URL` (defaults to `https://api-football-v1.p.rapidapi.com/v3`)
  - `RAPID_API_FOOTBALL_HOST` (defaults to `api-football-v1.p.rapidapi.com`)
  - `RAPID_API_KEY` (API key for RapidAPI)
- Auto-detect provider based on which keys are present (prefer direct API if both configured)
- Update runtime config to include RapidAPI settings

## Impact
- Affected specs: `api-football-integration`
- Affected code:
  - `server/services/api-football/client.ts` - Add RapidAPI header support
  - `nuxt.config.ts` - Add RapidAPI environment variables

## Backwards Compatibility
Fully backwards compatible - existing direct API configuration continues to work unchanged.
