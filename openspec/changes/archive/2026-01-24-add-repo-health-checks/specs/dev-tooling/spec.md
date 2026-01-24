## ADDED Requirements

### Requirement: Unified Health Check Script
The system SHALL provide a single script to run all code quality checks.

#### Scenario: Developer runs all checks before commit
- **WHEN** developer runs `yarn check:all`
- **THEN** lint, typecheck, format check, and prisma validate run sequentially
- **AND** the script exits with non-zero code if any check fails

### Requirement: Quick Test Feedback
The system SHALL provide a fast test command for development iteration.

#### Scenario: Developer runs quick tests
- **WHEN** developer runs `yarn test:quick`
- **THEN** only unit tests run without coverage
- **AND** execution completes in under 5 seconds for typical test suites
