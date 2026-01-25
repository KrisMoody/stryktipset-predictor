## ADDED Requirements

### Requirement: Admin API Type Definitions
The system SHALL provide TypeScript interfaces for all admin API response types to enable compile-time type checking.

#### Scenario: Scraper health response typed
- **WHEN** the admin page fetches scraper health status
- **THEN** the response SHALL be typed as `ScraperHealthResponse`
- **AND** all properties SHALL be accessible without type assertions

#### Scenario: Draw management responses typed
- **WHEN** the admin page fetches current draws or archive status
- **THEN** the response SHALL be typed with specific interfaces
- **AND** modal functions SHALL accept properly typed parameters

### Requirement: Test Mock Type Safety
The system SHALL provide typed mock utilities for test files to reduce reliance on `any` types in test code.

#### Scenario: Prisma mock types available
- **WHEN** a test file mocks Prisma client methods
- **THEN** mock return values SHALL be typed according to Prisma's generated types
- **AND** test data factories SHALL produce correctly typed objects

#### Scenario: API response mocks typed
- **WHEN** a test file creates mock API responses
- **THEN** the mock data SHALL conform to the corresponding interface types

### Requirement: Component Data Narrowing
Vue components SHALL use type guards or discriminated unions instead of `any` casts when handling data with multiple possible shapes.

#### Scenario: HeadToHead data format detection
- **WHEN** the HeadToHead component receives scraped data
- **THEN** it SHALL use a type guard to determine if data is API-Football or web-scraped format
- **AND** subsequent access SHALL be type-safe without `as any` assertions

### Requirement: Justified ESLint Disables
Any remaining `eslint-disable` comments for `@typescript-eslint/no-explicit-any` SHALL include a comment explaining why the disable is necessary.

#### Scenario: Browser API manipulation justified
- **WHEN** code manipulates browser APIs (e.g., fingerprint injection)
- **THEN** the eslint-disable comment SHALL include a reason such as "Browser fingerprint injection requires dynamic types"

#### Scenario: External API responses justified
- **WHEN** code handles responses from undocumented external APIs
- **THEN** the eslint-disable comment SHALL reference the external system and explain the limitation
