## Context

The system calculates extensive match statistics (Dixon-Coles probabilities, rest days, form metrics) and stores expert/public betting data, but the UI only displays a subset. Users making betting decisions lack visibility into valuable signals that are already available.

The rest days calculation can return unrealistic values (1000+ days) when a team hasn't played in the system recently, which could mislead both the AI and users.

## Goals / Non-Goals

**Goals:**
- Fix rest days to return meaningful values only
- Surface high-value data that aids prediction decisions
- Keep UI clean and not overwhelming

**Non-Goals:**
- Complete overhaul of match card design
- Adding new data sources
- Changing how predictions are generated

## Decisions

### Decision 1: Rest Days Maximum Cap

**What:** Cap rest days at 90 days, return `null` if exceeded

**Why:**
- 90 days covers typical off-season/preseason breaks
- Values above this indicate the team is new to the system or hasn't been in recent pools
- `null` is more honest than a misleading large number
- The AI prompt already handles null gracefully (omits the section)

**Alternatives considered:**
- No cap, show actual days: Rejected - 1000+ days is meaningless and misleading
- Different cap (30, 60, 120 days): 90 days balances capturing real rest vs noise

### Decision 2: UI Placement for New Data

**What:** Add data to existing components rather than creating new pages

**Why:**
- Users already navigate to match details for prediction info
- Keeps information contextually relevant
- Avoids UI complexity

**Placement:**
- Svenska Folket & Tio Tidningars Tips: In OddsTicker or adjacent to odds display
- Expected Goals & Rest Days: In a "Model Analysis" tab within DataTabs
- Elo Ratings: Alongside team names or in statistics section

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| UI clutter | Progressive disclosure - show key metrics, expand for details |
| Missing data | Graceful fallback - hide sections when data unavailable |
| Breaking changes | All changes are additive to existing UI |

## Design Decisions (User Input)

- **Rest days when null**: Hide the section entirely (don't show "Unknown")
- **Svenska Folket display**: Stacked bar chart with numbers
