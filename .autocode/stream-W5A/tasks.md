# Stream W5A Task State

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
