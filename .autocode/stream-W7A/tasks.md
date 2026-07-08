# Stream W7A Task State

### Task #258: Fix requirements: Task #254's self-heal clears strandedAcrossDays but never repairs the corrupt phaseStartDate, so the card permanently vanishes from the due queue

**File:** store/srsStore.ts, CLAUDE.md, tests/srsStore.test.ts
**Complexity:** 🔧 Full — 3 files
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
Task #254's fix (store/srsStore.ts:recordIntroductionResult's corrupt-date catch block) clears `strandedAcrossDays` on a correct answer, unblocking `canIntroduceNewCard` globally — but it never repairs the record's own `phaseStartDate`, which remains calendar-invalid. Every subsequent call for that same card re-throws in `getDayOfPhase`, so `getIntroductionDueCardIds`'s catch block (store/srsStore.ts) filters the card out of the due set on every calendar day, forever — its own catch-and-exclude runs before the day-22+ rescue check is ever reached, so the rescue path never applies to this state either. The card is "healed" in the sense that it no longer blocks other cards, but is itself permanently orphaned — unreachable for review or graduation. This directly contradicts CLAUDE.md's just-rewritten §7 claim (Task #255, same cycle) that a non-graduated card "can never permanently disappear from both queues." Converged independently by 6 of 8 cycle-5 audit agents (A, B, Red R, W, K, V).

**Acceptance Criteria:**
- [ ] Decide the repair path: either (a) have the corrupt-date catch path in `recordIntroductionResult` also reset `phaseStartDate` to `today` when clearing `strandedAcrossDays` (fully repairing the record, not just unblocking the global gate), or (b) extend `getIntroductionDueCardIds`'s rescue-path check to also apply to a record whose `getDayOfPhase` call throws, so a corrupt-but-healed record still surfaces at least once per day like the day-22+ case does
- [ ] Update CLAUDE.md §7 so its claim about the rescue path accurately reflects the chosen fix — the doc must not state an invariant the code doesn't actually enforce for this specific state
- [ ] Add a test: a record with a corrupt `phaseStartDate`, after being "healed" via a correct answer, must still be able to appear in `getIntroductionDueCardIds` (or the doc must be corrected to disclose this as a known, deliberate limitation instead of an invariant)
- [ ] Rename or extend the existing "#254: correct answer clears strandedAcrossDays... (self-heal path)" test so its name and assertions match what the fix actually delivers — don't let "self-heal" imply full recovery if only the block is lifted

**Done when:** Either the record can rejoin the due queue after being healed, or CLAUDE.md explicitly documents this as a known permanent-exclusion edge case rather than asserting an invariant the code doesn't hold. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 5, 2026-07-08) — severity 5 — requirements — converged independently by Agents A, B, Red R, W, K, V (6 of 8).
