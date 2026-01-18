# Betting Games Specification

This specification documents the three Swedish pool betting games supported by the system: Stryktipset, Europatipset, and Topptipset.

---

## ADDED Requirements

### Requirement: Game Type Definitions

The system SHALL support three distinct pool betting game types operated by Svenska Spel:

| Game | Matches | Stake | Payout | Prize Tiers |
|------|---------|-------|--------|-------------|
| Stryktipset | 13 | 1 SEK | 65% | 10-13 rätt |
| Europatipset | 13 | 1 SEK | 65% | 10-13 rätt |
| Topptipset | 8 | 1-10 SEK | 70% | 8 rätt only |

#### Scenario: Stryktipset game configuration
- **WHEN** the system loads Stryktipset configuration
- **THEN** matchCount SHALL be 13
- **AND** payoutPercentage SHALL be 65
- **AND** stakesOptions SHALL be [1]
- **AND** prizeTiers SHALL include 10, 11, 12, and 13 rätt

#### Scenario: Europatipset game configuration
- **WHEN** the system loads Europatipset configuration
- **THEN** matchCount SHALL be 13
- **AND** payoutPercentage SHALL be 65
- **AND** stakesOptions SHALL be [1]
- **AND** prizeTiers SHALL include 10, 11, 12, and 13 rätt

#### Scenario: Topptipset game configuration
- **WHEN** the system loads Topptipset configuration
- **THEN** matchCount SHALL be 8
- **AND** payoutPercentage SHALL be 70
- **AND** stakesOptions SHALL be [1, 2, 3, 5, 10]
- **AND** prizeTiers SHALL include only 8 rätt (all-or-nothing)

---

### Requirement: Stryktipset Game Rules

The system SHALL implement Stryktipset as Sweden's oldest football pool game (since 1934) where players predict outcomes (1/X/2) for 13 English football matches.

**Match Selection:**
- Primarily from English Premier League and Championship
- May include Scottish leagues or Swedish Allsvenskan
- Matches played on Saturday afternoons (typically)

**Prize Distribution:**
| Prize Tier | Pool Share |
|------------|------------|
| 13 rätt | 40% |
| 12 rätt | 15% |
| 11 rätt | 12% |
| 10 rätt | 25% |
| Guarantee Fund | 8% |

**Special Rules:**
- 10 million SEK guaranteed jackpot for sole winner with 13 rätt
- Minimum payout threshold: 15 SEK (below this, amount rolls to next draw)
- Jackpot advertised as minimum prize pool guarantee (not additional funds)

#### Scenario: Prize distribution for 13 rätt
- **WHEN** a player achieves 13 rätt
- **THEN** the player SHALL receive a share of 40% of the prize pool
- **AND** if sole winner, SHALL receive minimum 10 million SEK

#### Scenario: Minimum payout rule
- **WHEN** calculated payout per winner is below 15 SEK
- **THEN** the amount SHALL roll over to the next draw's prize pool

---

### Requirement: Europatipset Game Rules

The system SHALL implement Europatipset following the same structure as Stryktipset but MUST feature matches from major European leagues.

**Match Selection:**
- Premier League (England)
- La Liga (Spain)
- Serie A (Italy)
- Bundesliga (Germany)
- Ligue 1 (France)
- Other top European leagues

**Prize Distribution:**
| Prize Tier | Pool Share |
|------------|------------|
| 13 rätt | 40% |
| 12 rätt | 23% |
| 11 rätt | 12% |
| 10 rätt | 25% |

**Key Differences from Stryktipset:**
- Different prize pool percentage for 12 rätt (23% vs 15%)
- No guarantee fund allocation
- Typically 2 draws per week (varies by schedule)

#### Scenario: Europatipset prize structure
- **WHEN** a player achieves 12 rätt in Europatipset
- **THEN** the player SHALL receive a share of 23% of the prize pool

---

### Requirement: Topptipset Game Rules

The system SHALL implement Topptipset as a simplified 8-match variant with variable stakes and all-or-nothing payout.

**Match Selection:**
- First 8 matches from Stryktipset or Europatipset coupon
- Can also include worldwide matches
- Multiple draws per week (sometimes daily)

**Stake Options:**
- 1, 2, 3, 5, or 10 SEK per row
- Winnings multiplied by stake factor

**Prize Structure:**
- Only 8 rätt wins (all matches correct)
- 70% of pool returned to winners
- Higher payout percentage than Stryktipset/Europatipset

**No Official Systems:**
- Svenska Spel does not provide R/U-systems for Topptipset
- Custom T-systems can be generated mathematically

#### Scenario: Topptipset stake multiplication
- **WHEN** a player wins with 5 SEK stake per row
- **THEN** the base prize SHALL be multiplied by 5

#### Scenario: Topptipset all-or-nothing payout
- **WHEN** a player has 7 or fewer correct predictions
- **THEN** the player SHALL receive no payout

---

### Requirement: Outcome Types (1/X/2)

All three games SHALL use the same outcome notation:
- **1** = Home team win (hemmaseger)
- **X** = Draw (oavgjort)
- **2** = Away team win (bortaseger)

#### Scenario: Valid outcome notation
- **WHEN** a prediction is submitted
- **THEN** each match outcome SHALL be one of: "1", "X", or "2"

---

### Requirement: R-System (Reducerade System)

The system SHALL support R-systems as pre-computed reduced betting systems that provide coverage with fewer rows than full mathematical systems.

**Naming Convention:** `R-{helg}-{halvg}-{rows}-{guarantee}`
- `helg` = Number of helgarderingar (full hedges)
- `halvg` = Number of halvgarderingar (half hedges)
- `rows` = Total rows in system
- `guarantee` = Minimum correct if all selections hit

**Hedge Definitions:**
- **Spik** (single): One outcome selected (e.g., "1")
- **Halvgardering** (half hedge): Two outcomes selected (e.g., "1X", "X2", "12")
- **Helgardering** (full hedge): All three outcomes selected ("1X2")

**Key Properties:**
- Guarantee only applies when ALL selections are correct
- Reduced row count compared to mathematical equivalent
- Fixed row patterns (key rows) determined by covering theory

**Official Svenska Spel R-Systems (29 total):**

| System ID | Helg | Halvg | Rows | Guarantee | Math Equiv | 13R Chance |
|-----------|------|-------|------|-----------|------------|------------|
| R-0-7-16-12 | 0 | 7 | 16 | 12 | 128 | 12.5% |
| R-4-0-9-12 | 4 | 0 | 9 | 12 | 81 | 11.1% |
| R-3-3-24-12 | 3 | 3 | 24 | 12 | 216 | 11.1% |
| R-4-4-144-12 | 4 | 4 | 144 | 12 | 1296 | 11.1% |
| R-2-5-12-11 | 2 | 5 | 12 | 11 | 288 | 4.2% |
| R-5-0-18-11 | 5 | 0 | 18 | 11 | 243 | 7.4% |
| R-4-4-24-11 | 4 | 4 | 24 | 11 | 1296 | 1.85% |
| R-5-3-36-11 | 5 | 3 | 36 | 11 | 1944 | 1.85% |
| R-4-5-48-11 | 4 | 5 | 48 | 11 | 2592 | 1.85% |
| R-4-6-72-11 | 4 | 6 | 72 | 11 | 5184 | 1.4% |
| R-5-5-108-11 | 5 | 5 | 108 | 11 | 7776 | 1.4% |
| R-4-7-144-11 | 4 | 7 | 144 | 11 | 10368 | 1.4% |
| R-6-3-72-11 | 6 | 3 | 72 | 11 | 5832 | 1.2% |
| R-7-2-108-11 | 7 | 2 | 108 | 11 | 8748 | 1.2% |
| R-7-0-36-11 | 7 | 0 | 36 | 11 | 2187 | 1.6% |
| R-8-0-81-11 | 8 | 0 | 81 | 11 | 6561 | 1.2% |
| R-9-0-222-11 | 9 | 0 | 222 | 11 | 19683 | 1.1% |
| R-9-0-243-11 | 9 | 0 | 243 | 11 | 19683 | 1.2% |
| R-10-0-567-11 | 10 | 0 | 567 | 11 | 59049 | 1.0% |
| R-11-0-729-11 | 11 | 0 | 729 | 11 | 177147 | 0.4% |
| R-0-11-16-10 | 0 | 11 | 16 | 10 | 2048 | 0.8% |
| R-6-3-24-10 | 6 | 3 | 24 | 10 | 5832 | 0.4% |
| R-4-6-24-10 | 4 | 6 | 24 | 10 | 5184 | 0.5% |
| R-4-7-48-10 | 4 | 7 | 48 | 10 | 10368 | 0.5% |
| R-6-4-44-10 | 6 | 4 | 44 | 10 | 11664 | 0.4% |

#### Scenario: R-system guarantee interpretation
- **WHEN** playing R-4-0-9-12
- **AND** all 4 helgarderingar contain the correct outcome
- **AND** all 9 spik matches are correct
- **THEN** the player is guaranteed at least 12 rätt
- **AND** has approximately 11.1% chance of 13 rätt

#### Scenario: R-system does not guarantee minimum correct
- **WHEN** playing any R-system
- **AND** one or more selections do NOT contain the correct outcome
- **THEN** no minimum correct prediction is guaranteed

---

### Requirement: U-System (System med Utgångsrad)

The system SHALL support U-systems that extend R-systems with an "utgångsrad" (base row) that influences outcome weighting within hedged matches.

**Naming Convention:** `U-{helg}-{halvg}-{rows}-{guarantee}`
- Same structure as R-systems
- Requires additional utgångstecken (base selections)

**Key Concepts:**
- **Utgångsrad**: A complete row of 13 predictions indicating preferred outcomes
- **Utgångstecken**: The specific outcome marked as primary within each hedge

**How U-systems differ from R-systems:**
1. Player specifies which outcome in each hedge is "primary"
2. More control over outcome distribution
3. Better if you have strong opinions on hedged matches
4. Same row patterns as R-systems but different probability weighting

**Strategy Guidance:**
- Don't mix favorites and underdogs as utgångstecken
- Aim for 3-4 correct utgångstecken in hedges
- Place utgångstecken only on hedged matches (not spiks)

#### Scenario: U-system utgångstecken assignment
- **WHEN** using U-0-7-10-12 system
- **AND** match 3 is halvgarderad with "1X"
- **THEN** player SHALL specify utgångstecken as either "1" or "X"

---

### Requirement: Matematiska Garderingar (MG)

The system SHALL support MG (Matematiska Garderingar) to allow expanding R/U-system base patterns with additional mathematical hedges.

**Cost Calculation:**
- Base system cost × halvgardering multiplier × helgardering multiplier
- Halvgardering: ×2 per match
- Helgardering: ×3 per match

**Examples:**
- R-4-0-9 + 1 halvgardering = 9 × 2 = 18 rows
- R-4-0-9 + 1 helgardering = 9 × 3 = 27 rows
- R-4-0-9 + 2 halvgarderingar = 9 × 2 × 2 = 36 rows
- R-3-3-24 + 1 helgardering = 24 × 3 = 72 rows

**Maximum Rows:**
- M-system maximum: 41,472 rows (4 helg + 9 halvg)
- Full hedge (13 matches): 3^13 = 1,594,323 rows

**Usage Pattern:**
1. Select base R/U-system
2. Assign hedges to fill required slots
3. Choose additional matches for MG expansion
4. MG matches are fully mathematical (not reduced)

#### Scenario: MG cost calculation
- **WHEN** R-4-0-9 system is selected (9 rows base)
- **AND** 2 additional halvgarderingar are applied as MG
- **THEN** total rows SHALL be 9 × 2 × 2 = 36 rows
- **AND** cost SHALL be 36 SEK

---

### Requirement: Hedge Assignment Rules

The system SHALL enforce correct hedge assignment when generating system coupons.

**Constraints:**
- Spik matches: Exactly 13 - helg - halvg (for Stryktipset/Europatipset)
- Cannot exceed system's defined hedge slots
- Each match assigned to exactly one category

**Assignment Types:**
| Type | Outcomes | Cost Multiplier |
|------|----------|-----------------|
| Spik | 1 | ×1 |
| Halvgardering | 2 (1X, X2, or 12) | ×2 |
| Helgardering | 3 (1X2) | ×3 |

#### Scenario: Valid hedge assignment for R-4-0-9
- **WHEN** generating coupon for R-4-0-9
- **THEN** exactly 4 matches SHALL be helgarderingar
- **AND** exactly 0 matches SHALL be halvgarderingar
- **AND** exactly 9 matches SHALL be spiks

#### Scenario: Invalid hedge assignment rejected
- **WHEN** attempting to assign 5 helgarderingar to R-4-0-9
- **THEN** the system SHALL reject the assignment
- **AND** return an appropriate error message

---

### Requirement: Key Row Generation

The system SHALL use pre-computed "key rows" based on covering design theory for R/U-systems.

**Key Row Properties:**
- Fixed patterns that guarantee coverage
- Determined by combinatorial mathematics
- Same patterns for Stryktipset and Europatipset
- Stored in database for efficient lookup

**System Application:**
1. Load key rows for selected system
2. Map hedge assignment to key row positions
3. Expand key row patterns to full 13-match rows
4. Apply MG extensions if specified

#### Scenario: Key row expansion
- **WHEN** R-4-0-9-12 system is applied
- **AND** matches 1,4,7,10 are assigned as helgarderingar
- **THEN** 9 rows SHALL be generated
- **AND** each row SHALL contain valid 1/X/2 values
- **AND** the guarantee property SHALL be preserved

---

### Requirement: T-System (Custom Topptipset Systems)

Since Svenska Spel provides no official systems for Topptipset, the system SHALL generate custom T-systems mathematically.

**Naming Convention:** `T-{helg}-{halvg}-{rows}-{guarantee}`

**Generation Algorithm:**
- Uses covering code theory
- Targets 8-match configuration
- Always guarantee = 8 (all correct required)

**Constraints:**
- Maximum 7 helgarderingar (one match must be spik or halvg)
- Maximum system size: 3^7 × 2^1 = 4,374 rows

#### Scenario: T-system generation
- **WHEN** generating T-3-2-X system for Topptipset
- **THEN** the system SHALL produce a valid 8-match covering design
- **AND** rows SHALL cover the hedge configuration optimally

---

### Requirement: Terminology Glossary

The system SHALL use consistent Swedish betting terminology:

| Swedish Term | English Equivalent | Definition |
|--------------|-------------------|------------|
| Stryktipset | "Strike betting" | 13-match English football pool |
| Europatipset | "Europe betting" | 13-match European football pool |
| Topptipset | "Top betting" | 8-match all-or-nothing pool |
| Spik | Spike/Single | Match with one outcome selected |
| Halvgardering | Half hedge | Match with two outcomes selected |
| Helgardering | Full hedge | Match with all three outcomes |
| Gardering | Hedge/Cover | General term for multiple selections |
| Reducerat system | Reduced system | System with fewer rows than mathematical |
| Matematiskt system | Mathematical system | Full combination system |
| Utgångsrad | Base row | Primary prediction row in U-system |
| Utgångstecken | Base selection | Primary outcome within a hedge |
| Rätt | Correct | Number of correct predictions |
| Rad | Row | Single complete prediction |
| Insats | Stake | Amount bet per row |
| Utdelning | Payout | Prize distribution |
| Jackpott | Jackpot | Accumulated prize pool |
| Garantifond | Guarantee fund | Reserve for 10M SEK guarantee |

#### Scenario: Terminology consistency
- **WHEN** displaying hedge options in the UI
- **THEN** the system SHALL use "Helgardering" (not "full hedge")
- **AND** SHALL use "Halvgardering" (not "half hedge")
- **AND** SHALL use "Spik" (not "single")

---

### Requirement: Game-Aware AI Predictions

The AI prediction service SHALL adapt its strategy recommendations based on the specific game type being played.

**Stryktipset/Europatipset Strategy Considerations:**
- Optimize for probability of reaching prize tiers (10+ rätt)
- Balance between maximizing 13 rätt chance and securing 10-12 rätt
- Consider that partial success (10-12 rätt) still yields prizes
- Spik recommendations should account for multi-tier payout structure

**Topptipset Strategy Considerations:**
- All-or-nothing optimization (only 8 rätt wins)
- Higher risk tolerance acceptable due to higher payout percentage (70%)
- Fewer spiks recommended (need all 8 correct)
- Higher hedge coverage justified for uncertain matches
- Stake recommendations based on confidence level

**AI Prompt Context Requirements:**
The AI MUST be informed of:
1. Game type being predicted
2. Number of matches required
3. Prize tier structure
4. Whether partial success yields prizes
5. Payout percentage

#### Scenario: AI prediction for Stryktipset
- **WHEN** generating predictions for Stryktipset
- **THEN** the AI SHALL be informed that 10-13 rätt all yield prizes
- **AND** SHALL optimize for consistent prize tier achievement
- **AND** MAY recommend more conservative hedging to secure 10+ rätt

#### Scenario: AI prediction for Topptipset
- **WHEN** generating predictions for Topptipset
- **THEN** the AI SHALL be informed that only 8 rätt wins
- **AND** SHALL optimize for maximum probability of all-correct
- **AND** SHALL recommend broader hedging on uncertain matches
- **AND** MAY suggest higher stakes when confidence is high

#### Scenario: AI spik recommendation varies by game
- **WHEN** the AI evaluates a match with 60% confidence for one outcome
- **AND** game type is Stryktipset
- **THEN** the match MAY be recommended as spik
- **BUT WHEN** game type is Topptipset
- **THEN** the match SHOULD be hedged (halvgardering) for safety

---

### Requirement: Game-Aware Coupon Optimization

The coupon optimizer SHALL apply different optimization strategies based on game type characteristics.

**Stryktipset/Europatipset Optimization:**
- Target minimum 10 rätt coverage
- Optimize EV across all prize tiers
- System selection considers 12-rätt guarantee value
- Budget allocation weighted toward consistent returns

**Topptipset Optimization:**
- Maximize P(8 rätt) within budget
- Higher tolerance for hedging (2x/3x multipliers)
- Cost per row varies with stake (1/2/3/5/10 SEK)
- Recommend stake level based on confidence

**Optimization Parameters:**
| Parameter | Stryktipset/Europatipset | Topptipset |
|-----------|--------------------------|------------|
| Match count | 13 | 8 |
| Cost per row | 1 SEK | 1-10 SEK |
| Target | Maximize EV across tiers | Maximize P(all correct) |
| Spik threshold | 70%+ confidence | 80%+ confidence |
| Max hedges | Based on budget | Broader due to fewer matches |

#### Scenario: Coupon optimization for Stryktipset
- **WHEN** optimizing a Stryktipset coupon with 100 SEK budget
- **THEN** the optimizer SHALL consider all 13 matches
- **AND** SHALL balance spiks vs hedges for 10+ rätt coverage
- **AND** SHALL calculate cost at 1 SEK per row

#### Scenario: Coupon optimization for Topptipset with stake
- **WHEN** optimizing a Topptipset coupon with 100 SEK budget
- **AND** stake is set to 5 SEK per row
- **THEN** maximum rows SHALL be 100/5 = 20 rows
- **AND** optimizer SHALL hedge more aggressively than Stryktipset
- **AND** winnings potential SHALL be multiplied by stake factor

#### Scenario: Topptipset stake recommendation
- **WHEN** AI confidence is high across all 8 Topptipset matches
- **THEN** the system SHOULD recommend higher stake (5-10 SEK)
- **BUT WHEN** confidence is moderate
- **THEN** the system SHOULD recommend lower stake (1-2 SEK)

---

### Requirement: System Availability by Game Type

The system SHALL enforce correct system availability based on game type.

**System Availability Matrix:**
| System Type | Stryktipset | Europatipset | Topptipset |
|-------------|-------------|--------------|------------|
| R-systems | Yes (official) | Yes (same as Stryktipset) | No |
| U-systems | Yes (official) | Yes (same as Stryktipset) | No |
| T-systems | No | No | Yes (custom) |
| M-systems | Yes | Yes | Yes |
| AI-generated | Yes | Yes | Yes |

#### Scenario: R-system not available for Topptipset
- **WHEN** user selects R-system for Topptipset
- **THEN** the system SHALL reject the selection
- **AND** SHALL suggest T-system or AI-generated coupon instead

#### Scenario: T-system only for Topptipset
- **WHEN** user selects T-system for Stryktipset
- **THEN** the system SHALL reject the selection
- **AND** SHALL suggest R-system or U-system instead

---

### Requirement: Topptipset-Stryktipset Match Correlation

When Topptipset and Stryktipset draws share matches, the system SHALL maintain prediction consistency.

**Correlation Rules:**
- Topptipset uses first 8 matches of Stryktipset/Europatipset
- Predictions for shared matches MUST be consistent
- Different optimization strategies MAY yield different selections for same match

#### Scenario: Shared match predictions
- **WHEN** match 3 appears in both Stryktipset draw 1234 and Topptipset draw 5678
- **THEN** the underlying prediction data SHALL be identical
- **BUT** coupon selections MAY differ based on game-specific optimization

#### Scenario: Topptipset derived from Stryktipset coupon
- **WHEN** generating Topptipset coupon from existing Stryktipset analysis
- **THEN** the system SHALL use predictions for matches 1-8
- **AND** SHALL re-optimize hedge assignments for 8-match all-or-nothing structure
