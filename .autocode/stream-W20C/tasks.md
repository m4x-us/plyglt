# Stream W20C Task State

### Task #456: Fix documentation: security.md S1/S3 citations and generationGuard.ts's header are stale again, broken by this same wave's #447 file split

**File:** .autocode/agents/security.md, lib/generationGuard.ts
**Complexity:** ⚡ Direct — 2 files, single-scope doc fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
security.md's "Resolved Findings — S1/S3" note (added by Task #451, this same wave) cites `store/entitlementAddOns.ts:96` (actual: line 127) and `lib/specialtyPackLoader.ts:59/122/177` (actual: `createGenerationGuard()` at line 68; the two `isStale` checks moved entirely to `lib/specialtyPackMerge.ts:64` and `:119` via Task #447, landed in the identical wave). Separately, `lib/generationGuard.ts`'s own header doc comment still falsely claims `specialtyPackLoader.ts`'s adoption of the guard is "tracked as a carry-forward" — that adoption completed and was independently confirmed this cycle. Both are the same root failure: a same-wave sibling task (#447) silently invalidated a precise file:line claim in an unrelated doc. at .autocode/agents/security.md:60.

**Acceptance Criteria:**
- [ ] security.md's S1/S3 citations updated to their real current locations (post-#447 split)
- [ ] lib/generationGuard.ts's header updated to state specialtyPackLoader.ts's adoption is complete, not pending
- [ ] No behavior/code change — documentation only

**Source:** Cycle-6 audit finding F2 — severity 6 — convergence 5/8 (Agents A, B, S, V, K) plus F11 (Agent W, generationGuard.ts header) — documentation accuracy / stale citation.

---

### Task #458: Fix race condition: useLangPack's hydration-timeout fallback can still permanently persist an unconfirmed redirect

**File:** hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
Task #442 fixed the common case of `unpurchasedSpecialty` being computed before entitlement hydration completes, by gating on `(entitlementHydrated || hydrationGraceExpired)`. Two independent reviewers (Security Agent S and naive-reader Agent N, with no shared context) found a narrower residual: when hydration is genuinely stuck — not just slow — and `hydrationGraceExpired` fires as a timeout fallback, that branch can still write a redirect that was never actually confirmed against real entitlement data. The fix narrowed the bug's trigger window (slow hydration is now handled) but did not close it for the true-timeout path. at hooks/useLangPack.ts:140.

**Acceptance Criteria:**
- [ ] The `hydrationGraceExpired` branch does not permanently persist a redirect/localStorage write when it cannot confirm real entitlement state
- [ ] A test forces genuine hydration failure (not just slowness) and asserts no unconfirmed redirect is persisted
- [ ] Deletion Test: reverting the fix causes the new test to fail

**Source:** Cycle-6 audit finding F4 — severity 6 — convergence 2/8 (Agents S and N, independently) — race condition / correctness, LIVE.

---

### Task #459: Fix CI drift: scripts/validatePack.ts still not synced with lib/packTypes.ts's hasValidUnitsArray (two divergences, open across 2 audit cycles)

**File:** scripts/validatePack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope sync
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
`lib/packTypes.ts`'s own doc comment mandates scripts/validatePack.ts's `validateUnit`/`validateCard` stay in sync with `hasValidUnitsArray`. Two concrete divergences confirmed by two independent reviewers across two consecutive audit cycles: (1) Task #443's `card.prerequisites` array-of-strings check has no counterpart in `validateCard` — a pack with `prerequisites: "c0"` (a truthy non-array) passes CI and only crashes at runtime via `lib/srs.ts:207`'s unguarded `.every()` against the live shipped Italian pack's FSRS queue. (2) Task #418's `unitCount`/`cardCount` cross-check (declared count must equal real array length) has no counterpart in `validatePack` — it only echoes `cardCount` in a log line, never validates it. A pack with internally inconsistent counts passes CI and silently corrupts `lib/specialtyPackMerge.ts`'s merge arithmetic downstream. at scripts/validatePack.ts:33.

**Acceptance Criteria:**
- [ ] validateCard rejects a present-but-non-array-of-strings `prerequisites` field, matching hasValidUnitsArray
- [ ] validatePack rejects a pack whose declared unitCount/cardCount doesn't match real array lengths, matching hasValidUnitsArray
- [ ] A regression test in the validator's own test coverage (or a new one) enumerates both gaps and fails without the fix

**Source:** Cycle-6 audit finding F5 — severity 6 — convergence 2/8 (Agent K originally; Agent W independently reconfirmed plus found the second divergence) — CI/tooling drift, recurring debt (also flagged in cycle 5). Supersedes the 2026-07-28 debt.md row logged by Task #443/W19A.

---
