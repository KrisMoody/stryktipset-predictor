## ADDED Requirements

### Requirement: Typed Scraped Data Access
The system SHALL provide type-safe access to match scraped data entries through discriminated union types and accessor functions.

#### Scenario: Accessing xStats data with type safety
- **WHEN** a developer accesses xStats scraped data via `getScrapedData(match, 'xStats')`
- **THEN** TypeScript infers the return type as `XStatsData | null`
- **AND** autocomplete shows valid `XStatsData` properties

#### Scenario: Invalid data type access prevented
- **WHEN** a developer accesses a property not on the inferred type
- **THEN** TypeScript emits a compile-time error

### Requirement: Playwright Page Typing
The system SHALL use Playwright's `Page` type for all page object parameters instead of `any`.

#### Scenario: Scraper methods accept Page type
- **WHEN** a scraper method receives a Playwright page object
- **THEN** the parameter is typed as `Page` from `playwright` or `playwright-core`
- **AND** TypeScript validates method calls on the page object

### Requirement: Prisma Result Typing
The system SHALL use Prisma-generated types for database query result mapping functions.

#### Scenario: Mapping function receives typed record
- **WHEN** a mapping function like `mapToFailedGame` receives a database record
- **THEN** the parameter type matches the Prisma query return type
- **AND** accessing invalid properties causes a compile-time error

### Requirement: Service Function Parameter Typing
The system SHALL provide explicit types for all service function parameters that currently use `any`.

#### Scenario: Coupon optimizer receives typed prediction
- **WHEN** `calculateExpectedValues` receives prediction and odds parameters
- **THEN** parameters are typed with `PredictionData` and `MatchOdds` interfaces
- **AND** TypeScript validates property access within the function

### Requirement: API Response Type Extension
The system SHALL extend existing API response interfaces rather than using `any` for optional return values.

#### Scenario: Svenska Spel API returns typed jackpot
- **WHEN** `getDrawData` returns a jackpot alongside draw data
- **THEN** the jackpot is typed as `JackpotData | undefined`
- **AND** not as `any`

### Requirement: Accumulator Object Typing
The system SHALL use explicit record types for accumulator objects instead of `any`.

#### Scenario: Analytics rates object is typed
- **WHEN** a rates accumulator is created in scraper analytics
- **THEN** it is typed as `Record<string, number>` or a more specific interface
- **AND** invalid value assignments cause compile-time errors
