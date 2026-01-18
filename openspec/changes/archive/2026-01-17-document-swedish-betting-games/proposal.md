# Change: Document Swedish Betting Games (Stryktipset, Europatipset, Topptipset)

## Why

The system supports three Swedish pool betting games but lacks comprehensive documentation of their rules, system betting mechanics, and prize structures. This knowledge is essential for:
- Onboarding new developers/contributors
- AI prompt engineering (providing context to Claude)
- UI/UX decisions around system betting
- Business logic validation
- **Ensuring AI and coupon optimizer handle game-specific differences correctly**

## What Changes

- Create comprehensive specification documenting all three games
- Document R-system and U-system betting mechanics in detail
- Document matematiska garderingar (MG) combination rules
- Establish terminology glossary for Swedish betting concepts
- **Define game-aware AI prediction requirements**
- **Define game-aware coupon optimization strategies**
- **Specify system availability by game type**
- **Document Topptipset vs Stryktipset strategy differences**

## Impact

- Affected specs: New `betting-games` capability
- Affected code: May require updates to prediction-service.ts and coupon-optimizer.ts for full compliance
- Risk: Low - primarily documentation with some behavioral requirements
