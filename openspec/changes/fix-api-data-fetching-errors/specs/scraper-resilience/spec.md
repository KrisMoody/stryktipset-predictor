## ADDED Requirements

### Requirement: AI Scraper Health Check
The system SHALL verify AI scraper service health before attempting batch scraping operations to fail fast when the service is unavailable.

#### Scenario: Health check before scraping
- **GIVEN** a scrape request for a match
- **WHEN** AI scraping is enabled and the service URL is configured
- **THEN** it SHALL call the health endpoint before starting scrape operations
- **AND** if unhealthy, skip AI scraping and log a warning

#### Scenario: Skip health check when circuit breaker is open
- **GIVEN** the AI scraper circuit breaker is open
- **WHEN** a scrape request is received
- **THEN** it SHALL skip the health check
- **AND** immediately fall through to DOM fallback or return partial results

---

### Requirement: AI Scraper Error Categorization
The system SHALL categorize AI scraper errors to distinguish between transient failures and service-level issues.

#### Scenario: Detect browser lifecycle errors
- **GIVEN** an AI scraper request returns an error
- **WHEN** the error contains "Browser.new_context" or "browser has been closed"
- **THEN** it SHALL categorize the error as a service-level failure
- **AND** mark the circuit breaker to open after fewer consecutive failures (2 instead of 3)

#### Scenario: Treat network timeouts as transient
- **GIVEN** an AI scraper request times out
- **WHEN** the error is categorized
- **THEN** it SHALL treat it as a transient failure
- **AND** allow normal retry behavior

#### Scenario: Log error categories for observability
- **GIVEN** an AI scraper error occurs
- **WHEN** the error is categorized
- **THEN** it SHALL log the error category (transient vs service-level)
- **AND** include the original error message for debugging
