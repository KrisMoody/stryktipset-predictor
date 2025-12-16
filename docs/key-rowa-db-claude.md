# Claude Code Guide: Stryktipset Key Rows Integration

## 🎯 What This Guide Is For

This README is your companion for using **Claude Code** to work with the Stryktipset precomputed key rows system. It provides ready-to-use prompts, coding scenarios, and best practices for delegating tasks to Claude Code.

## 📋 Prerequisites

Before using Claude Code with this system:

1. **Claude Code installed**: `npm install -g @anthropic-ai/claude-code`
2. **Database migrated**: 1.95M key rows in Supabase
3. **Environment variables set**:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```
4. **Project structure**:
   ```
   your-project/
   ├── server/
   │   └── constants/
   │       └── betting-systems-with-keyrows.json  # Local fallback
   ├── scripts/
   │   ├── precompute-key-rows-optimized.ts
   │   └── migrate-keyrows-to-supabase.ts
   └── docs/
       └── INTEGRATION-GUIDE-COMPREHENSIVE.md     # Technical reference
   ```

---

## 🚀 Quick Start Scenarios

### Scenario 1: Basic Query Implementation

**What you need:** Fetch system metadata and key rows from Supabase

**Prompt for Claude Code:**

```
Create a TypeScript function that:
1. Connects to Supabase using @supabase/supabase-js
2. Fetches a betting system by ID (e.g., "R-4-4-144-12")
3. Includes the system's key rows in the response
4. Returns a typed object with system metadata and key_rows array
5. Handles errors gracefully

Use these tables:
- betting_systems (id, type, helgarderingar, halvgarderingar, rows, guarantee)
- system_key_rows (system_id, row_index, row_data)

Add JSDoc comments and proper TypeScript types.
```

**Expected Output:**
```typescript
import { createClient } from '@supabase/supabase-js'

interface BettingSystem {
  id: string
  type: 'R' | 'U'
  helgarderingar: number
  halvgarderingar: number
  rows: number
  guarantee: number | null
}

interface KeyRow {
  row_index: number
  row_data: number[]
}

interface SystemWithKeyRows extends BettingSystem {
  key_rows: KeyRow[]
}

/**
 * Fetches a betting system with its precomputed key rows
 * @param systemId - The system ID (e.g., "R-4-4-144-12")
 * @returns System metadata with key rows, or null if not found
 */
export async function getSystemWithKeyRows(
  systemId: string
): Promise<SystemWithKeyRows | null> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  )
  
  const { data, error } = await supabase
    .from('betting_systems')
    .select(`
      *,
      key_rows:system_key_rows(row_index, row_data)
    `)
    .eq('id', systemId)
    .single()
  
  if (error) {
    console.error(`Error fetching system ${systemId}:`, error.message)
    return null
  }
  
  return data as SystemWithKeyRows
}
```

**Follow-up tasks:**
- "Add unit tests for this function"
- "Create a React hook that uses this function"
- "Add caching with a 1-hour TTL"

---

### Scenario 2: Row Expansion Algorithm

**What you need:** Convert compact key rows into full 13-match betting rows

**Prompt for Claude Code:**

```
I have precomputed key rows that need to be expanded to full betting rows.

Context:
- Each draw has 13 football matches
- Each match has outcomes: '1' (home win), 'X' (draw), '2' (away win)
- Key rows only contain variable positions (helg + halv)
- Helg positions: values 0/1/2 map to '1'/'X'/'2'
- Halv positions: values 0/1 map to first/second choice
- Single predictions are constant across all rows

Input structure:
interface UserSelection {
  systemId: string
  helgMatches: number[]              // [0-12] indices
  halvMatches: Array<{
    matchIndex: number
    outcomes: ['1' | 'X' | '2', '1' | 'X' | '2']
  }>
  singlePredictions: Record<number, '1' | 'X' | '2'>
}

Create a function expandKeyRow(keyRow: number[], selection: UserSelection): string[]
that returns a 13-element array of outcomes.

Include validation and error handling.
```

**Expected output:** Complete `expandKeyRow` function with validation

**Follow-up tasks:**
- "Add comprehensive test cases for edge cases"
- "Optimize for performance with 1000+ rows"
- "Add TypeScript strict mode compliance"

---

### Scenario 3: System Recommendation Engine

**What you need:** Recommend systems based on user preferences

**Prompt for Claude Code:**

```
Build a system recommendation function that suggests betting systems based on:
- Maximum budget (max number of rows)
- Minimum guarantee level (R-systems only)
- Preferred number of helg/halv matches
- Type preference (R or U)

Database schema:
- betting_systems table with: id, type, helgarderingar, halvgarderingar, rows, guarantee

Requirements:
1. Query Supabase with filters
2. Sort by rows (ascending) - cheapest first
3. Return top 10 matches
4. Include full system size calculation (3^helg × 2^halv)
5. Include reduction percentage
6. Type the response properly

Add JSDoc with examples.
```

**Follow-up tasks:**
- "Add fuzzy matching for 'close enough' systems"
- "Create a scoring algorithm based on user preferences"
- "Add unit tests with mock Supabase client"

---

### Scenario 4: Validation Layer

**What you need:** Validate user selections before generating rows

**Prompt for Claude Code:**

```
Create a comprehensive validation function for user selections.

Rules to validate:
1. System exists in database
2. helgMatches.length === system.helgarderingar
3. halvMatches.length === system.halvgarderingar
4. All match indices are 0-12 (valid range)
5. No duplicate match indices across helg/halv/singles
6. Exactly 13 matches covered total
7. All outcomes are '1', 'X', or '2'
8. Halv outcomes are different (can't be ['1', '1'])

Return type:
interface ValidationResult {
  valid: boolean
  errors: string[]      // Blocking issues
  warnings: string[]    // Non-blocking suggestions
}

Include helpful error messages that guide the user to fix issues.
```

**Follow-up tasks:**
- "Add internationalization support (Swedish & English)"
- "Create a validation middleware for Express"
- "Add suggestions for fixing common errors"

---

### Scenario 5: Streaming Large Systems

**What you need:** Handle systems with 100k+ rows efficiently

**Prompt for Claude Code:**

```
Create a streaming generator for large betting systems.

Requirements:
1. Use async generator syntax (async function*)
2. Fetch key rows from Supabase in batches of 1000
3. Expand each batch to full betting rows
4. Yield batches to avoid memory issues
5. Handle errors gracefully (continue on batch failure)
6. Add progress tracking

System U-13-0-105 has 1,594,323 rows - this should handle it without memory issues.

Use Supabase's range() for pagination.
```

**Follow-up tasks:**
- "Add cancellation support using AbortSignal"
- "Create a progress bar UI component"
- "Add retry logic for failed batches"

---

### Scenario 6: React Hook Integration

**What you need:** Create React hooks for easy component integration

**Prompt for Claude Code:**

```
Create React hooks for the Stryktipset system:

1. useSystem(systemId) - Fetch system metadata
2. useSystemsList(filters) - List systems with filtering
3. useBettingRows(selection) - Generate betting rows
4. useValidation(selection) - Validate user selection

Requirements:
- Use React Query for caching and automatic refetching
- Include loading, error, and data states
- Add TypeScript types
- Include JSDoc with usage examples
- Handle edge cases (null/undefined)

Follow React best practices and hooks rules.
```

**Follow-up tasks:**
- "Add optimistic updates for better UX"
- "Create Storybook stories for each hook"
- "Add error boundary integration"

---

### Scenario 7: Export Functionality

**What you need:** Export betting rows to various formats

**Prompt for Claude Code:**

```
Create an export utility that supports multiple formats:
- CSV (for Excel/Sheets)
- JSON (for API consumption)
- TXT (human readable)
- Svenska Spel format (if you know the spec)

Requirements:
1. Take betting rows (string[][]) as input
2. Format according to chosen type
3. Return a Blob ready for download
4. Include headers/metadata where appropriate
5. Handle large files efficiently (streaming if needed)

Add a browser download helper function too.
```

**Follow-up tasks:**
- "Add PDF export with formatting"
- "Create a preview before export"
- "Add clipboard copy functionality"

---

### Scenario 8: Testing Suite

**What you need:** Comprehensive tests for the system

**Prompt for Claude Code:**

```
Create a test suite using Vitest for:

1. Row expansion algorithm
   - Edge case: Only helg (no halv)
   - Edge case: Only halv (no helg)
   - Edge case: Maximum system size
   - Correctness: Singles are constant
   - Correctness: Helg/halv vary correctly

2. Validation logic
   - Invalid match indices
   - Duplicate matches
   - Missing matches
   - Invalid outcomes

3. Database queries (use mock client)
   - System not found
   - Key rows incomplete
   - Network errors

Use describe/test blocks with clear names.
Include setup/teardown if needed.
```

**Follow-up tasks:**
- "Add integration tests with real Supabase"
- "Create E2E tests with Playwright"
- "Add performance benchmarks"

---

### Scenario 9: API Endpoints

**What you need:** REST API for the system

**Prompt for Claude Code:**

```
Create Express.js API endpoints:

GET /api/systems
  - Query params: type, maxRows, minGuarantee
  - Returns: Array of systems

GET /api/systems/:id
  - Returns: System with metadata

GET /api/systems/:id/rows
  - Query params: page, pageSize (for pagination)
  - Returns: Paginated key rows

POST /api/generate
  - Body: UserSelection
  - Returns: Generated betting rows
  - Add validation middleware
  - Add rate limiting (10 requests per minute)

Use TypeScript, proper error handling, and JSDoc.
```

**Follow-up tasks:**
- "Add OpenAPI/Swagger documentation"
- "Create Postman collection"
- "Add authentication with JWT"

---

### Scenario 10: CLI Tool

**What you need:** Command-line interface for developers/power users

**Prompt for Claude Code:**

```
Create a CLI tool using Commander.js:

Commands:
- list-systems [--type R|U] [--max-rows N]
  → List available systems
  
- show-system <id>
  → Show system details

- generate <system-id> <config.json>
  → Generate betting rows from config file
  → Save to output.csv

- validate <config.json>
  → Validate a selection config

- export <system-id> <config.json> [--format csv|json|txt]
  → Generate and export in one command

Add colors with chalk, progress bars with ora.
Include --help for all commands.
```

**Follow-up tasks:**
- "Add interactive mode with inquirer"
- "Create bash completion script"
- "Add verbose/debug modes"

---

## 🏗️ Architecture Scenarios

### Scenario 11: Service Layer

**Prompt for Claude Code:**

```
Create a service layer that abstracts the business logic:

Create BettingSystemService class with methods:
- getSystem(id): Promise<System | null>
- listSystems(filters): Promise<System[]>
- generateRows(selection): Promise<Outcome[][]>
- validateSelection(selection): Promise<ValidationResult>
- exportRows(rows, format): Promise<Blob>

Use dependency injection for Supabase client.
Add comprehensive error handling.
Include logging with winston or pino.
Make it testable with interfaces.
```

**Follow-up tasks:**
- "Add caching layer with Redis"
- "Create service layer tests"
- "Add metrics/observability"

---

### Scenario 12: Repository Pattern

**Prompt for Claude Code:**

```
Implement repository pattern for database access:

Create:
- BettingSystemRepository
  - findById(id)
  - findAll(filters)
  - exists(id)
  
- KeyRowRepository  
  - findBySystemId(systemId, options?)
  - findBySystemIdPaginated(systemId, page, pageSize)
  - count(systemId)

Abstract Supabase behind these repositories.
Use interfaces for easy mocking.
Add transaction support if needed.
```

**Follow-up tasks:**
- "Add query builder pattern"
- "Create in-memory repository for testing"
- "Add database migration support"

---

### Scenario 13: Event System

**Prompt for Claude Code:**

```
Create an event-driven system for tracking generation:

Events:
- GenerationStarted { systemId, timestamp }
- GenerationProgress { systemId, progress, total }
- GenerationCompleted { systemId, rowCount, duration }
- GenerationFailed { systemId, error }

Implement EventEmitter or use a library.
Add event logging.
Create hooks for UI to subscribe to events.
Include examples of usage.
```

**Follow-up tasks:**
- "Integrate with WebSocket for real-time updates"
- "Add event persistence"
- "Create analytics dashboard"

---

### Scenario 14: Error Handling

**Prompt for Claude Code:**

```
Create comprehensive error handling:

Custom errors:
- SystemNotFoundError
- ValidationError
- DatabaseError
- NetworkError

Create error handler middleware for Express.
Create error boundary for React.
Add error logging with context.
Include user-friendly error messages (Swedish & English).
Add retry logic where appropriate.
```

**Follow-up tasks:**
- "Add Sentry integration"
- "Create error recovery strategies"
- "Add error analytics"

---

### Scenario 15: Performance Monitoring

**Prompt for Claude Code:**

```
Add performance monitoring:

Measure:
- Database query time
- Row expansion time
- API endpoint response time
- Memory usage for large systems

Use:
- console.time/timeEnd for development
- Performance API for production
- Add timing headers to API responses

Create a PerformanceMonitor class.
Add configurable logging levels.
Include suggestions for optimization.
```

**Follow-up tasks:**
- "Integrate with DataDog/New Relic"
- "Create performance dashboards"
- "Add automated performance tests"

---

## 🎨 UI/UX Scenarios

### Scenario 16: System Comparison UI

**Prompt for Claude Code:**

```
Create a React component for comparing systems side-by-side:

Features:
- Show 2-4 systems in columns
- Display: ID, type, rows, guarantee, cost
- Calculate: full system size, reduction %
- Highlight differences
- Add "Select" button
- Responsive design with Tailwind CSS

Include TypeScript types.
Use React best practices.
Add loading states.
```

**Follow-up tasks:**
- "Add sorting/filtering"
- "Create mobile-optimized view"
- "Add sharing functionality"

---

### Scenario 17: Match Selection UI

**Prompt for Claude Code:**

```
Create an interactive match selection component:

Features:
- 13 match cards (0-12)
- For each match:
  - Radio: Single/Helg/Halv
  - If Single: Dropdown ('1', 'X', '2')
  - If Halv: Two checkboxes for outcomes
  - If Helg: Show "All 3" indicator
  
- Show live validation
- Show counters: X helg, Y halv, Z singles
- Disable submit until valid

Use React Hook Form for state management.
Add animations with Framer Motion.
```

**Follow-up tasks:**
- "Add drag-and-drop reordering"
- "Add keyboard shortcuts"
- "Add save/load functionality"

---

### Scenario 18: Row Visualization

**Prompt for Claude Code:**

```
Create a component to display generated betting rows:

Features:
- Virtual scrolling for 1000+ rows (use @tanstack/react-virtual)
- Grid layout: 13 columns (one per match)
- Color coding: '1' = green, 'X' = yellow, '2' = red
- Row numbers
- Search/filter rows
- Export button
- Pagination option for smaller systems

Optimize for performance.
Add keyboard navigation.
```

**Follow-up tasks:**
- "Add row comparison view"
- "Add statistics (most common outcomes per match)"
- "Create heatmap visualization"

---

### Scenario 19: Form Wizard

**Prompt for Claude Code:**

```
Create a multi-step wizard:

Steps:
1. Select system (with recommendations)
2. Configure helg matches
3. Configure halv matches
4. Configure single predictions
5. Review & generate

Features:
- Progress indicator
- Validation per step
- Back/Next navigation
- Save progress to localStorage
- Summary at the end

Use React Context for state.
Add smooth transitions.
```

**Follow-up tasks:**
- "Add templates/presets"
- "Add guided mode with explanations"
- "Add undo/redo functionality"

---

### Scenario 20: Cost Calculator

**Prompt for Claude Code:**

```
Create a cost calculator component:

Inputs:
- Cost per row (configurable)
- System selection
- Optional: Multiple systems for bulk

Display:
- Individual system costs
- Total cost
- Potential winnings (if you have odds)
- ROI calculator

Include formatting (SEK currency).
Add tooltips with explanations.
Responsive design.
```

**Follow-up tasks:**
- "Add historical data integration"
- "Create budget planner"
- "Add breakeven analysis"

---

## 🔧 Utility Scenarios

### Scenario 21: Type Generator

**Prompt for Claude Code:**

```
Create a script that generates TypeScript types from database schema:

Read from:
- betting_systems table schema
- system_key_rows table schema

Generate:
- Interface for each table
- Zod schemas for validation
- Type guards (isBettingSystem, etc.)
- Helper types (SystemId, Outcome, etc.)

Output to: src/types/database.ts

Make it runnable as: npm run generate:types
```

**Follow-up tasks:**
- "Add automatic generation on schema changes"
- "Create migration validator"
- "Add GraphQL schema generation"

---

### Scenario 22: Seed Data Generator

**Prompt for Claude Code:**

```
Create seed data for testing:

Generate:
- 10 realistic user selections
- For various system types/sizes
- Include edge cases
- Save as JSON fixtures

Create function to load fixtures in tests.
Add faker.js for realistic data.
Include documentation of what each fixture tests.
```

**Follow-up tasks:**
- "Add database seeding script"
- "Create E2E test data"
- "Add data anonymization"

---

### Scenario 23: Migration Helper

**Prompt for Claude Code:**

```
Create utilities to help with database migrations:

Functions:
- verifyMigration() - Check all systems have key rows
- compareCounts() - Compare expected vs actual row counts
- findMissingSystems() - Find systems with incomplete data
- repairSystem(systemId) - Re-migrate a single system

Add CLI interface for these utilities.
Include progress reporting.
Add dry-run mode.
```

**Follow-up tasks:**
- "Add backup/restore functionality"
- "Create rollback support"
- "Add data integrity checks"

---

### Scenario 24: Documentation Generator

**Prompt for Claude Code:**

```
Create a script that generates API documentation:

From:
- TypeScript types
- JSDoc comments
- Function signatures

Generate:
- Markdown documentation
- OpenAPI spec
- Type documentation with examples

Output to: docs/ directory

Use TypeDoc or similar.
Include interactive examples.
Add search functionality.
```

**Follow-up tasks:**
- "Add live playground"
- "Create video tutorials"
- "Add multilingual support"

---

### Scenario 25: Debug Utilities

**Prompt for Claude Code:**

```
Create debugging utilities:

Functions:
- visualizeKeyRow(keyRow, selection) - ASCII visualization
- explainSystem(systemId) - Detailed explanation
- compareRows(row1, row2) - Highlight differences
- validateDatabase() - Check data integrity
- benchmarkSystem(systemId) - Performance test

Add to debug.ts module.
Include CLI commands.
Add color coding with chalk.
```

**Follow-up tasks:**
- "Add Chrome DevTools extension"
- "Create debugging dashboard"
- "Add remote debugging support"

---

## 📚 Best Practices for Using Claude Code

### 1. Be Specific with Context

**Good prompt:**
```
Create a TypeScript function that expands key rows to full betting rows.
Context: Key rows are integer arrays where positions 0-(helg-1) use ternary 
encoding (0/1/2 → '1'/'X'/'2') and positions helg-(helg+halv-1) use binary 
encoding (0/1 → first/second choice).
```

**Bad prompt:**
```
Make the row thing work
```

### 2. Request Types and Documentation

Always ask for:
- TypeScript types
- JSDoc comments
- Error handling
- Usage examples

**Example:**
```
Include TypeScript types, JSDoc with @param and @returns, error handling 
for null/undefined, and 2-3 usage examples in comments.
```

### 3. Specify Testing Requirements

**Example:**
```
Add unit tests using Vitest. Include:
- Happy path test
- Edge case: empty array
- Edge case: invalid input
- Error case: database failure
Mock Supabase client using vi.mock()
```

### 4. Request Iteration Support

**Example:**
```
Create this function, and also add:
- A wrapper with loading states
- A React hook version
- Error boundary integration
```

### 5. Ask for Optimization

**Example:**
```
Optimize this for:
- Memory efficiency (handle 100k+ rows)
- Speed (target <100ms for 1k rows)
- Bundle size (use tree-shaking)
```

---

## 🎯 Common Workflows

### Workflow 1: New Feature Development

```bash
# 1. Start with service layer
claude-code "Create BettingSystemService with getSystem method"

# 2. Add repository
claude-code "Create SystemRepository using the service"

# 3. Add validation
claude-code "Add validation for user selections"

# 4. Create API endpoint
claude-code "Create Express endpoint GET /api/systems/:id using service"

# 5. Add tests
claude-code "Create unit tests for BettingSystemService"

# 6. Create React component
claude-code "Create React component that uses the API endpoint"
```

### Workflow 2: Debugging Issues

```bash
# 1. Add logging
claude-code "Add debug logging to expandKeyRow function"

# 2. Create test case
claude-code "Create failing test case for the bug with helg-only systems"

# 3. Fix and verify
claude-code "Fix the bug and verify all tests pass"

# 4. Add regression test
claude-code "Add regression test to prevent this bug in future"
```

### Workflow 3: Performance Optimization

```bash
# 1. Add benchmarks
claude-code "Create benchmark for row generation with 1k, 10k, 100k rows"

# 2. Profile
claude-code "Add performance profiling to identify bottlenecks"

# 3. Optimize
claude-code "Optimize the slowest function based on profiling results"

# 4. Verify improvement
claude-code "Run benchmarks again and compare results"
```

---

## 🚨 Common Pitfalls & Solutions

### Pitfall 1: Not Validating Input

**Problem:** Users submit invalid selections

**Solution:**
```
claude-code "Add comprehensive validation with helpful error messages 
before any database queries"
```

### Pitfall 2: Loading Large Systems Into Memory

**Problem:** Browser freezes with 100k+ row systems

**Solution:**
```
claude-code "Implement streaming with async generators and process 
in batches of 1000 rows"
```

### Pitfall 3: Poor Error Messages

**Problem:** Users get generic "Error" messages

**Solution:**
```
claude-code "Create custom error classes with user-friendly messages 
in Swedish and English"
```

### Pitfall 4: No Loading States

**Problem:** UI appears frozen during generation

**Solution:**
```
claude-code "Add loading states, progress indicators, and estimated 
time remaining for all async operations"
```

### Pitfall 5: Not Caching

**Problem:** Repeated database queries for same data

**Solution:**
```
claude-code "Implement caching layer with 1-hour TTL for system 
metadata and React Query for component caching"
```

---

## 📖 Quick Reference

### File Structure Created by Claude Code

```
src/
├── types/
│   ├── database.ts          # Auto-generated from schema
│   ├── betting.ts           # Business logic types
│   └── api.ts               # API types
├── services/
│   ├── BettingSystemService.ts
│   ├── RowExpansionService.ts
│   └── ValidationService.ts
├── repositories/
│   ├── SystemRepository.ts
│   └── KeyRowRepository.ts
├── api/
│   ├── routes/
│   │   ├── systems.ts
│   │   └── generate.ts
│   └── middleware/
│       ├── validation.ts
│       └── errorHandler.ts
├── hooks/
│   ├── useSystem.ts
│   ├── useBettingRows.ts
│   └── useValidation.ts
├── components/
│   ├── SystemSelector.tsx
│   ├── MatchSelection.tsx
│   ├── RowVisualization.tsx
│   └── CostCalculator.tsx
├── utils/
│   ├── expansion.ts         # Core algorithm
│   ├── validation.ts
│   ├── export.ts
│   └── debug.ts
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

### Key Functions Reference

| Function | Purpose | Prompt Keyword |
|----------|---------|----------------|
| `getSystemWithKeyRows()` | Fetch system + rows | "fetch system with key rows" |
| `expandKeyRow()` | Convert key row → full row | "expand key row" |
| `validateUserSelection()` | Validate input | "validate selection" |
| `generateBettingRows()` | Main generation | "generate betting rows" |
| `recommendSystems()` | Find matching systems | "recommend systems" |
| `exportRows()` | Export to file | "export rows" |

### Common Data Structures

```typescript
// System
interface BettingSystem {
  id: string              // "R-4-4-144-12"
  type: 'R' | 'U'
  helgarderingar: number  // 0-13
  halvgarderingar: number // 0-13
  rows: number            // Number of key rows
  guarantee: number | null
}

// User Selection
interface UserSelection {
  systemId: string
  helgMatches: number[]
  halvMatches: Array<{
    matchIndex: number
    outcomes: [Outcome, Outcome]
  }>
  singlePredictions: Record<number, Outcome>
}

// Outcome
type Outcome = '1' | 'X' | '2'
```

---

## 🎓 Learning Path

### Beginner Tasks (30 min each)

1. Fetch and display a system
2. Validate user input
3. Expand a single key row
4. Create a simple React component

### Intermediate Tasks (1-2 hours each)

1. Build complete generation flow
2. Add pagination for large systems
3. Create API endpoints
4. Add comprehensive testing

### Advanced Tasks (3-4 hours each)

1. Implement streaming for massive systems
2. Build complete UI with wizard
3. Add performance monitoring
4. Create CLI tool

---

## 💡 Pro Tips

1. **Always start with types**
   ```
   claude-code "Define all TypeScript types before implementing logic"
   ```

2. **Test as you go**
   ```
   claude-code "After implementing X, create tests that verify Y"
   ```

3. **Iterate incrementally**
   ```
   # Don't: "Build entire betting system"
   # Do: "Implement system fetching", then "Add validation", etc.
   ```

4. **Use examples from database**
   ```
   claude-code "Test with system R-4-4-144-12 which has 144 rows"
   ```

5. **Reference the comprehensive guide**
   ```
   claude-code "Follow the patterns in INTEGRATION-GUIDE-COMPREHENSIVE.md"
   ```

---

## 🆘 Getting Help

### If Claude Code isn't generating what you need:

1. **Be more specific**
   - Add concrete examples
   - Reference exact types
   - Show desired input/output

2. **Break it down**
   - Split large requests into smaller ones
   - Build incrementally

3. **Provide context files**
   ```
   claude-code "Use the types from src/types/betting.ts to create X"
   ```

4. **Reference working code**
   ```
   claude-code "Create a function similar to expandKeyRow but for X"
   ```

### Common Issues

**Issue:** "Generated code doesn't match database schema"
**Solution:** Share schema or reference existing repository

**Issue:** "Types don't match"
**Solution:** Regenerate types from database first

**Issue:** "Tests failing"
**Solution:** Ask Claude Code to fix tests: "Fix failing tests in X.test.ts"

---

## 🎉 Success Metrics

You'll know the integration is complete when:

- ✅ All 54 systems can be fetched from database
- ✅ Row expansion works for all system types
- ✅ Validation catches all invalid inputs
- ✅ Large systems (100k+ rows) stream efficiently
- ✅ UI is responsive and shows loading states
- ✅ Tests cover edge cases
- ✅ Error messages are helpful
- ✅ Performance is acceptable (<1s for 1k rows)

---

## 📞 Support

For integration issues:
1. Check INTEGRATION-GUIDE-COMPREHENSIVE.md for technical details
2. Review database migration status
3. Verify environment variables
4. Check Supabase RLS policies

For Claude Code usage:
1. Try rephrasing your prompt
2. Break complex tasks into smaller ones
3. Provide more context/examples
4. Reference existing code patterns

---

**Happy coding! 🚀**

Remember: Claude Code is most effective when given clear, specific prompts with proper context. Start small, iterate, and build up to complex features.