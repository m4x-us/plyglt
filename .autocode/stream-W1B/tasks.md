# Stream W1B Task State

### Task #180 | correctness | severity 7
**What:** Wire variety rule, close spec gaps, and add rescue path in `store/srsStore.ts`:
- F03: Import `getNextCardType` from `@/lib/introduction`. Call it at the end of `recordIntroductionResult`, passing `record.lastSeenType` and the available card types for this card. Write the returned CardType back to `record.lastSeenType` before persisting. This wires the variety rule (BRAND.md: "each encounter uses a different retrieval angle") which currently has zero runtime enforcement.
- F10: `canIntroduceNewCard`: add cross-day failure check — if any `IntroductionRecord` has `consecutiveWrongToday >= CONSECUTIVE_WRONG_RESET` and `lastSeenDate !== today`, return false. This implements the BRAND.md spec "wrong across multiple days → pause new card introductions until this one stabilizes" which is currently absent.
- F12: `getIntroductionDueCardIds`: add rescue branch — if `getDayOfPhase(record.phaseStartDate, today) >= 22` and `!record.graduated`, include the card with `shouldAppearToday` returning true (1 appearance/day). Without this, cards reaching day 22 without 15 consecutive correct answers disappear from both queues permanently.
- F13: `introduceCard`: change guard from `if (existing && !existing.graduated) return` to `if (existing) return` — a graduated card must not be silently re-introduced with reset history.
**Why:** F10 (sev:7) and F12 (sev:7) are stop-the-line spec gaps. F03 (sev:5) — variety rule is fully implemented in lib but has zero runtime callers. F13 (sev:6) — graduated card re-introduction destroys all historical progress silently.
**File:** `store/srsStore.ts`, `tests/srsStore.test.ts`
**Severity:** 7 | **DoD Tier:** 3
**Complexity:** 🔧 Full — 2 files, 4 behavior fixes
**Blocked by:** #178 (COMPLETE) | **Blocks:** #181
**Test required:** Yes — one test per fix: (1) `lastSeenType` updates after `recordIntroductionResult`; (2) `canIntroduceNewCard` returns false when cross-day wrong streak exists; (3) `getIntroductionDueCardIds` includes a day-22+ non-graduated card; (4) `introduceCard` does not overwrite a graduated card.
**Done when:** `grep -n "getNextCardType" store/srsStore.ts` shows an import and a call site. All 4 new tests pass and assert specific values. Verification gate green.
**Owner:** Architecture Agent
