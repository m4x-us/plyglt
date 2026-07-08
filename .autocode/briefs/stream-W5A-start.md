# Adam — Stream W5A — Wave 5 — 2026-07-08

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W5A | #246 #247 #249

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #246 — Fix canIntroduceNewCard's strandedAcrossDays pause being defeated by any same-day review
2. /task #247 — Fix recordIntroductionResult having no try/catch around getDayOfPhase
3. /task #249 — Fix vacuous NaN-equality tautology in srsStore.test.ts

**Why this order:** #246 and #247 are the two substantive fixes from this cycle's re-audit; #249 is a trivial one-line test cleanup in the same file, run last to avoid merge noise ahead of the real fixes. A semantic-coupling check confirmed #246 and #247 touch disjoint code paths within store/srsStore.ts (a persisted-field guard vs. a corrupt-date defense) — there is no functional dependency between them, they're just co-located by file.

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W5A
[✓] #246 — Fix strandedAcrossDays pause defeat   ← done
[→] #247 — Fix recordIntroductionResult uncaught throw   ← starting now
[ ] #249 — Fix vacuous NaN tautology

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
store/srsStore.ts
lib/introduction.ts
tests/srsStore.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/packLoader.ts
tests/packLoader.test.ts

## Task Definitions

### Task #246: Fix requirements: canIntroduceNewCard's strandedAcrossDays pause is defeated by any same-day review, not just a correct one

**File:** store/srsStore.ts, lib/introduction.ts, tests/srsStore.test.ts
**Complexity:** 🔧 Full — 3 files
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1

**What:**
Task #228 fixed the cross-day pause from being fully dead code, but the guard in `canIntroduceNewCard` (store/srsStore.ts:274) is `r.strandedAcrossDays && r.lastSeenDate !== today`. Since `recordResult`'s wrong-but-not-triple branch (lib/introduction.ts:144) always writes `lastSeenDate: today` via `base` regardless of whether the answer was correct, reviewing the stranded card again on any later day — even with another WRONG answer that does not stabilize it — updates `lastSeenDate` to today and silently lifts the pause for the rest of that day. Confirmed via direct reproduction: triple-wrong on day 1 → blocked on day 2 (correct) → one more wrong answer on day 2 → `canIntroduceNewCard` incorrectly returns `true` later the same day. BRAND.md's "pause until this one stabilizes" is only honored on calendar days the card isn't reviewed at all, not until an actual correct answer. Given the proactive interruption model runs 6-10 sessions/day, this is reachable in ordinary use. Converged independently by Agents W and B, confirmed by the orchestrating CTO's own repro script.

**Acceptance Criteria:**
- [ ] Change the pause condition so it is lifted only by an actual correct answer (which already clears `strandedAcrossDays` to `false` per lib/introduction.ts:125-127), not merely by `lastSeenDate` advancing — e.g. drop the `lastSeenDate !== today` clause entirely from the `canIntroduceNewCard` guard (since `strandedAcrossDays` itself is already the authoritative signal and is correctly cleared only on a correct answer), while preserving the existing behavior that the pause does not block new intros on the very day the triple-wrong reset happens (verify the existing seam test for that scenario still passes)
- [ ] Add a test: triple-wrong on day 1 → blocked day 2 → WRONG answer again on day 2 → still blocked later that same day and on day 3
- [ ] Verify the existing "correct answer clears it" seam test still passes unmodified

**Done when:** A test drives a stranded card through a same-day WRONG (non-stabilizing) review and asserts `canIntroduceNewCard` still returns `false` afterward — only a real correct answer lifts the pause. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit, 2026-07-08) — severity 6 — requirements — converged independently by Agents W, B, plus the orchestrating CTO's own reproduction.

---

### Task #247: Fix error-handling: recordIntroductionResult still has no try/catch around getDayOfPhase (Task #234's sibling call site)

**File:** store/srsStore.ts, tests/srsStore.test.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
Task #234 wrapped `getDayOfPhase` in a try/catch inside `getIntroductionDueCardIds` because an uncaught throw there aborted due-card computation for every card. `recordIntroductionResult` (store/srsStore.ts:239) calls the identical `getDayOfPhase(record.phaseStartDate, today)` with no try/catch — and this is the higher-traffic call site: it's invoked directly and uncaught from `app/study/page.tsx:147`'s `onRate` handler, hit on every single card rating. The app has zero `ErrorBoundary`/`componentDidCatch` anywhere, so a corrupted persisted record would crash the whole session on the user's next rating action, not just silently drop one card from a queue computation. Converged independently by Agents S, K, A, W (4 of 8 re-audit agents).

**Acceptance Criteria:**
- [ ] Wrap the `getDayOfPhase` call in `recordIntroductionResult` in the same try/catch pattern used in `getIntroductionDueCardIds` — log a ref ID with the cardId and bad value, and decide a safe fallback (e.g. skip the update for that card) instead of letting the exception propagate into the click handler
- [ ] Add a test asserting `recordIntroductionResult` does not throw when called on a record with a corrupt `phaseStartDate`

**Done when:** A test calls `recordIntroductionResult` on a record with a calendar-invalid `phaseStartDate` and asserts no exception propagates. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit, 2026-07-08) — severity 6 — error-handling — converged independently by Agents S, K, A, W.

---

### Task #249: Fix tests: vacuous NaN-equality tautology in srsStore.test.ts

**File:** tests/srsStore.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
`expect(n + 1).toBe(n + 1)` (tests/srsStore.test.ts:647, commented "NaN + 1 !== NaN + 1 (NaN propagation check)") is a self-referential tautology: Vitest's `.toBe()` uses `Object.is()` semantics, and `Object.is(NaN, NaN)` is `true`, so this line passes for any value of `n` including `NaN` — it proves nothing and directly contradicts its own comment. The real check is the preceding `expect(isNaN(n)).toBe(false)` line, which is correct. Converged independently by Agents N, A, K, V, B (5 of 8 re-audit agents).

**Acceptance Criteria:**
- [ ] Delete the vacuous `expect(n + 1).toBe(n + 1)` line, or replace it with a real assertion (e.g. `expect(n).toBe(<specific expected number>)`) if there's additional value to assert beyond the `isNaN` check

**Done when:** No vacuous self-referential `.toBe()` assertions remain in the affected test. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit, 2026-07-08) — severity 4 — tests — converged independently by Agents N, A, K, V, B.

## Agent Memories

## Architecture Agent Memory (relevant excerpt)

This is the third remediation pass on the introduction engine this batch. Both prior passes (Task #180, then Tasks #228/#234) fixed the letter of a finding but left a sibling instance of the same bug class unfixed — the recurring failure mode this team keeps hitting in this exact file. Before closing #247, grep store/srsStore.ts for every `getDayOfPhase(` call site and confirm ALL of them (not just this one) have equivalent protection — don't leave a third sibling unfixed.

For #246: the intended contract (per content/types.ts:59) is "strandedAcrossDays: true blocks canIntroduceNewCard until a correct answer clears it" — the fix should make the code match that contract exactly, using `strandedAcrossDays` alone as the signal rather than layering a `lastSeenDate` comparison on top of it.

## When You Finish
Write your completion summary to .autocode/stream-W5A/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W5A | #246 #247 #249
