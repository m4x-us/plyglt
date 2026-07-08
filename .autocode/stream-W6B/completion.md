Tasks closed: #254
Tasks NOT completed: none
Debt entries logged: 0
Carry-forward tasks generated: 0

## Summary

**Task #254 — Fix stranded+corrupt-date self-heal path**

**Root cause:** `recordIntroductionResult` (store/srsStore.ts) has a try/catch around `getDayOfPhase` (added Task #247) that returns early on a corrupt `phaseStartDate`. `strandedAcrossDays` is cleared only inside `recordResult` — which never ran in the catch path. A record with both flags set (strandedAcrossDays:true AND corrupt phaseStartDate) was permanently stuck: `canIntroduceNewCard` returned false forever with no recovery except a manual store reset.

**Recovery path chosen: option (a)** — in the corrupt-date catch path, if the answer is correct and `strandedAcrossDays === true`, clear the flag before returning. The `dayOfPhase`-dependent parts of `recordResult` (encounter counts, consecutive counters) are still skipped — only the stranded flag is cleared. A wrong answer does NOT clear it, preserving the BRAND.md invariant that an actual correct answer is required to unblock.

**Changes:**

- `store/srsStore.ts`: In the corrupt-date catch block of `recordIntroductionResult`, added a guard: `if (correct && record.strandedAcrossDays === true)` → calls `set()` to write `strandedAcrossDays: false` on the record before returning. No change to lib/introduction.ts (the fix is in the store layer that composes the pure function, not in the pure function itself).

- `tests/srsStore.test.ts`: Added two tests in the stranded-card section:
  - `#254: correct answer clears strandedAcrossDays even when phaseStartDate is corrupt` — seeds a record with `phaseStartDate: "not-a-date"` and `strandedAcrossDays: true`, calls `recordIntroductionResult(..., true, ...)`, asserts `strandedAcrossDays` is `false`, asserts `canIntroduceNewCard` returns `true`.
  - `#254: wrong answer does NOT clear strandedAcrossDays when phaseStartDate is corrupt` — same setup, calls with `correct: false`, asserts `strandedAcrossDays` remains `true`, asserts `canIntroduceNewCard` remains `false`.

Verification gate: tsc --noEmit ✓ | npm test 1027/1027 ✓ | npm run lint 0 errors ✓ | assert grep gate ✓
