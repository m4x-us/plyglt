# Stream W7A — Wave 7 — Completion

**Agent:** Adam  
**Wave:** 7  
**Date:** 2026-07-08  
**Tasks:** #258

---

## Tasks Closed

| Task | Status | Notes |
|------|--------|-------|
| #258 | COMPLETE | Correct answer in `recordIntroductionResult`'s catch block now also resets `phaseStartDate = today`, repairing the root cause and allowing the card to rejoin `getIntroductionDueCardIds` at Day-1 intensity |

Tasks NOT completed: none

Debt entries logged: 0

Carry-forward tasks generated: 0

---

## Files Changed

- `store/srsStore.ts` — `recordIntroductionResult`'s corrupt-date catch block: expanded the `if (correct)` branch to also update `phaseStartDate: today` in the same `set()` call that clears `strandedAcrossDays`; wrong-answer branch unchanged (no repair)
- `CLAUDE.md` §7 — "Reset and pause mechanism" expanded to mention Task #254/#258 full repair behavior; invariant "can never permanently disappear from both queues" updated to be precisely scoped to the due queue and to describe the repair path; key invariant bullet updated to mention `phaseStartDate` repair on correct answer
- `tests/srsStore.test.ts` — renamed/extended `#254` test to `#254/#258`, adding `phaseStartDate` repair assertion and `getIntroductionDueCardIds` inclusion assertion; existing wrong-answer test unchanged

---

## Verification Gate

- `npx tsc --noEmit` — 0 errors ✓
- `npm test` — 1028/1028 passing ✓ (+3 vs Wave 6)
- `npm run lint` — 0 errors (1 pre-existing warning in unrelated file) ✓
- Assertion quality grep gate — clean ✓

---

## Key Design Note

**Why option (a) works here:** The corrupt-phaseStartDate scenario that Task #258 addresses is a record that was visible to the user before the corruption (e.g., via migration from a pre-#240 build that stored an invalid date). The user saw the card, got triple-wrong (setting `strandedAcrossDays: true`), and then the corrupt date was introduced. The user encounters the #254 self-heal path when they review their study session (the stranded card appears because it was still in-memory when the corruption happened, or via the block-clearing path). The correct answer in that session now both unblocks `canIntroduceNewCard` (Task #254) AND repairs `phaseStartDate` (Task #258), allowing the card to rejoin the due queue on the next call.

**Wrong-answer branch:** Unchanged — `phaseStartDate` is not repaired and `strandedAcrossDays` is not cleared on a wrong answer. BRAND.md requires an actual correct retrieval for recovery.

**CLAUDE.md accuracy:** Updated the "Reset and pause mechanism" description and the `getDayOfPhase` invariant bullet to accurately describe both the corrupt-date catch path behavior and the fact that a correct answer fully heals the record.
