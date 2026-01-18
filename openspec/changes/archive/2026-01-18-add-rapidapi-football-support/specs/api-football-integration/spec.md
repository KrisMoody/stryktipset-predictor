## MODIFIED Requirements

### Requirement: API-Football Client
The system SHALL provide an HTTP client for API-Football with rate limiting, caching, retry logic, and support for both direct API and RapidAPI authentication methods.

#### Scenario: Rate limiting prevents quota exhaustion
- **GIVEN** multiple requests are queued
- **WHEN** requests are sent to API-Football
- **THEN** the client SHALL enforce a maximum of 2 requests per minute with 500ms delays

#### Scenario: Retry with exponential backoff on transient errors
- **GIVEN** API-Football returns a 5xx error
- **WHEN** the request fails
- **THEN** the client SHALL retry up to 3 times with exponential backoff (1s, 2s, 4s)

#### Scenario: Handle rate limit responses
- **GIVEN** API-Football returns 429 Too Many Requests
- **WHEN** the response is received
- **THEN** the client SHALL wait with longer backoff (30s, 60s, 120s) before retrying

#### Scenario: Direct API authentication
- **GIVEN** `API_FOOTBALL_API_KEY` is configured
- **WHEN** making requests to the direct API endpoint
- **THEN** the client SHALL use the `x-apisports-key` header for authentication

#### Scenario: RapidAPI authentication
- **GIVEN** `RAPID_API_KEY` is configured and `API_FOOTBALL_API_KEY` is not
- **WHEN** making requests to the RapidAPI endpoint
- **THEN** the client SHALL use `X-RapidAPI-Key` and `X-RapidAPI-Host` headers for authentication

#### Scenario: Direct API takes precedence
- **GIVEN** both `API_FOOTBALL_API_KEY` and `RAPID_API_KEY` are configured
- **WHEN** the client initializes
- **THEN** the client SHALL use the direct API configuration
