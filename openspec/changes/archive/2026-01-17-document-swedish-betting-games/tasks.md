# Tasks: Document Swedish Betting Games

## 1. Specification Review

- [ ] 1.1 Review specification for accuracy against Svenska Spel official rules
- [ ] 1.2 Verify all R-system specifications match betting-systems.json
- [ ] 1.3 Confirm prize tier percentages are current
- [ ] 1.4 Validate Topptipset stake options (1,2,3,5,10 vs 1,2,5,10)

## 2. Implementation Alignment

- [ ] 2.1 Verify game-configs.ts matches specification
- [ ] 2.2 Verify types/game-types.ts matches specification
- [ ] 2.3 Review system-generator.ts for specification compliance
- [ ] 2.4 Review prediction-service.ts for game-aware context
- [ ] 2.5 Review coupon-optimizer.ts for game-specific strategies

## 3. AI Integration

- [ ] 3.1 Ensure AI prompts include game type context
- [ ] 3.2 Verify AI is informed of prize tier structure per game
- [ ] 3.3 Confirm spik threshold differs by game type
- [ ] 3.4 Add game-aware stake recommendations for Topptipset

## 4. System Availability

- [ ] 4.1 Verify R/U-systems restricted to Stryktipset/Europatipset
- [ ] 4.2 Verify T-systems only available for Topptipset
- [ ] 4.3 Test system selection validation per game type

## 5. Documentation Updates

- [ ] 5.1 Update CLAUDE.md with reference to betting-games spec
- [ ] 5.2 Consider adding user-facing documentation in docs/

## 6. Validation

- [ ] 6.1 Run openspec validate to ensure spec format is correct
- [ ] 6.2 Review with domain expert if available
