# Design: Swedish Betting Games Documentation

## Context

The ST-Predictor system supports three Swedish pool betting games but lacks formal specification of their rules. This documentation establishes a canonical reference for:
- Game rules and prize structures
- System betting mechanics (R-system, U-system, MG)
- Terminology standardization

## Goals / Non-Goals

### Goals
- Document all three game types comprehensively
- Explain R-system and U-system mechanics in detail
- Establish terminology glossary for consistency
- Provide reference for AI prompt engineering

### Non-Goals
- No code changes in this proposal
- No UI/UX changes
- No database schema modifications

## Research Summary

### Information Sources

1. **Svenska Spel Official Documentation**
   - System folder PDF (systemfolder_stryktipset_181121.pdf)
   - Game rules PDF (spelregler-stryktips-europatips-maltips-topptips-joker-180321.pdf)

2. **Third-Party Analysis**
   - stryktips.nu - Comprehensive system guides
   - betting.com/sv - Game comparisons
   - dagensbastaspel.se - U-system explanations
   - tvmatchen.nu - Topptipset specifics

3. **Existing Codebase**
   - server/constants/game-configs.ts
   - server/constants/betting-systems.json
   - types/game-types.ts
   - server/services/system-generator.ts

### Key Findings

#### Game Comparison Matrix

| Aspect | Stryktipset | Europatipset | Topptipset |
|--------|-------------|--------------|------------|
| Matches | 13 | 13 | 8 |
| Stake | 1 SEK fixed | 1 SEK fixed | 1-10 SEK variable |
| Payout % | 65% | 65% | 70% |
| Min Win | 10 rätt | 10 rätt | 8 rätt only |
| Official Systems | Yes (29) | Yes (same as Stryktipset) | No |
| 13R Prize | 40% | 40% | N/A |
| 12R Prize | 15% | 23% | N/A |
| 11R Prize | 12% | 12% | N/A |
| 10R Prize | 25% | 25% | N/A |
| Jackpot Guarantee | 10M SEK | No | No |
| Match Source | English leagues | European leagues | Any/First 8 |

#### R-System Mechanics

R-systems use **covering design theory** to reduce the number of rows while maintaining a guarantee property:

```
Mathematical system: 3^helg × 2^halvg rows
R-system: Reduced subset with coverage guarantee

Example: R-4-0-9-12
- Math equivalent: 3^4 = 81 rows
- R-system: 9 rows (89% reduction)
- Guarantee: If all selections correct, at least 12 rätt
- 13 rätt chance: ~11.1% (1 in 9)
```

The guarantee means: "If every hedged match contains the correct outcome, you are guaranteed at least N correct." It does NOT mean you will always get N correct.

#### U-System Enhancement

U-systems add **utgångstecken** (base selections) that weight outcomes within hedges:

```
R-system: Match hedged with 1X, both equally distributed
U-system: Match hedged with 1X, but "1" marked as primary (utgångstecken)

Effect: More rows contain the utgångstecken outcome
Strategy: Mark the most likely outcome as utgångstecken
```

#### MG (Matematiska Garderingar)

MG expands base systems mathematically:

```
Base: R-4-0-9 = 9 rows
+ 1 halvgardering: 9 × 2 = 18 rows
+ 1 helgardering: 9 × 3 = 27 rows
+ 1 halvg + 1 helg: 9 × 2 × 3 = 54 rows
```

Maximum M-system: 41,472 rows (practical limit for Svenska Spel submission)

## Decisions

### Decision 1: Specification-Only Change
- **What**: This proposal creates documentation only, no code changes
- **Why**: The codebase already implements these games correctly
- **Alternatives**: Could have updated code comments inline, but centralized spec is more maintainable

### Decision 2: Include Full R-System Table
- **What**: Document all 25+ official R-systems with specifications
- **Why**: Essential reference for system selection algorithms
- **Alternatives**: Could link to external sources, but offline availability is important

### Decision 3: Swedish Terminology Priority
- **What**: Use Swedish terms (helgardering, halvgardering, spik) as primary
- **Why**: Matches Svenska Spel UI and user expectations
- **Alternatives**: English terms would be more accessible to international developers

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rules may change | Low | Svenska Spel rarely changes core rules; periodic review recommended |
| Missing edge cases | Medium | Will be discovered through usage and updated incrementally |
| Translation accuracy | Low | Native Swedish speakers should review terminology |

## Open Questions

1. Should we document the jackpot rollover mechanics in more detail?
2. Should we include historical payout statistics?
3. Should this spec be exposed in user-facing documentation?
