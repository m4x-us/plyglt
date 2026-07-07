# Barry — W1B — Completion Summary
Date: 2026-07-07

---

## Wave 1 — 2026-07-07 (#180) — Barry

**Status: COMPLETE**
**Files modified: 2**

### Tasks closed
- **#180** — Wire variety rule, close spec gaps, and add rescue path in store/srsStore.ts — COMPLETE

### What was built

**`store/srsStore.ts`** — Four behavior fixes:

**F03 (variety rule):** Added `getNextCardType` import from `@/lib/introduction`. Added `ALL_CARD_TYPES: CardType[]` constant and `CardType` import. In `recordIntroductionResult`, after `recordResult`, calls `getNextCardType(record.lastSeenType, ALL_CARD_TYPES)` and writes the result to `lastSeenType` before persisting. This gives the introduction engine a rotating type on every encounter.

**F10 (cross-day failure check):** Added `CONSECUTIVE_WRONG_RESET = 3` constant. `canIntroduceNewCard` now also returns false if any IntroductionRecord has `consecutiveWrongToday >= 3` AND `lastSeenDate !== today` — implements BRAND.md "wrong across multiple days → pause new card introductions".

**F12 (rescue path):** `getIntroductionDueCardIds` now includes a rescue branch: if a card is at day >= 22 and not graduated, it appears once per day (appearances < 1). Without this, day-22+ non-graduates disappear permanently from both queues since `maxAppearancesToday(22) = 0`.

**F13 (graduated card guard):** Changed `introduceCard` guard from `if (existing && !existing.graduated) return` to `if (existing) return`. A graduated card's history must never be silently overwritten.

**`tests/srsStore.test.ts`** — Added 4 tests (one per fix):
- F03: asserts `lastSeenType` advances to "recognize" then "produce" after two consecutive `recordIntroductionResult` calls — uses specific `toBe()` assertions
- F10: manually seeds a `consecutiveWrongToday=3 / lastSeenDate="2026-06-24"` record, then asserts `canIntroduceNewCard("2026-06-25")` returns false
- F12: seeds a card with `phaseStartDate="2026-06-01"` (day 22 on "2026-06-22"), asserts it appears in due list; then seeds `appearancesToday=1` and asserts it no longer appears
- F13: graduates a card via 15 consecutive corrects, calls `introduceCard` again, asserts `graduated` remains true and `introducedDate` is unchanged

### Verification results
- `npm test` → 968/968 ✓ (up 12 from 956 at start of session)
- `npx tsc --noEmit` → clean ✓
- `npm run lint` → 0 errors (pre-existing warning in hooks/useExportImport.test.ts, not Barry's file)
- `grep -n "getNextCardType" store/srsStore.ts` → import (line 8) + call site (line 243) ✓

### Notable observations
The F10 condition (`consecutiveWrongToday >= 3 AND lastSeenDate !== today`) cannot be reached through normal `recordIntroductionResult` flow: when the counter reaches 3, `recordResult` immediately resets it to 0 with `lastSeenDate = today`. The condition guards against corrupted/migrated state and is tested by manually seeding the store. This is documented via the test's setup comment.

### Debt entries logged: 0
### Carry-forward tasks generated: 0
