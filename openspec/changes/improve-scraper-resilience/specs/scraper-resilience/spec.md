# Spec: Scraper Resilience

## Overview
Replaces the fragile Topptipset scraper with the reliable datepicker API for draw discovery.

## ADDED Requirements

### Requirement: Topptipset Draw Discovery via Datepicker API
The system SHALL use the datepicker API instead of web scraping for Topptipset draw discovery.

#### Scenario: Discover open draws from datepicker
- **Given** a request to fetch current Topptipset draws
- **When** the system queries the datepicker API for the current month
- **Then** draws with `drawState === "Open"` are identified
- **And** each open draw is fetched via the standard draw endpoint

#### Scenario: Handle month boundary
- **Given** a request to fetch current Topptipset draws
- **When** the current date is near the end of a month
- **Then** the system queries both current and next month datepicker
- **And** draw numbers are deduplicated before fetching

#### Scenario: Handle year boundary
- **Given** the current month is December
- **When** calculating the next month for datepicker query
- **Then** the system queries January of the following year

#### Scenario: No open draws available
- **Given** a request to fetch current Topptipset draws
- **When** the datepicker API returns no draws with `drawState === "Open"`
- **Then** an empty array is returned
- **And** the system logs that no open draws were found

## REMOVED Requirements

### Requirement: Topptipset Scraper (Deprecated)
The system no longer requires the AI Scraper service for Topptipset draw discovery.

#### Scenario: Scraper code retained but unused
- **Given** the topptipset-draw-numbers.ts file exists
- **When** Topptipset draws are synced
- **Then** the scraper code is not called
- **And** the code remains available for potential future use
