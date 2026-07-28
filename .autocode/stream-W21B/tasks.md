# Stream W21B Task State

### Task #469: Fix test-coverage: store/entitlementCrossTabSync.ts has no dedicated test file for its concurrency-safety logic

**File:** tests/entitlementCrossTabSync.test.ts (new)
**Complexity:** ⚡ Direct — 1 new file, single-scope addition
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
No test file in the repo imports store/entitlementCrossTabSync.ts by name. Its 72.72%/62.5% stmt/branch coverage is 100% incidental fallout from entitlementStore's own tests. The dedup-in-flight path (Task #304), the requeue-after-in-flight-settles path (Task #347, lines ~68), and the synchronous-throw catch-recovery path (Task #363, lines ~79-83) — the exact concurrency-safety guarantees this module's own header comment claims — are never directly exercised by any test. The same wave's Task #461 gave a structurally identical sibling extraction (lib/specialtyPackMerge.ts) a full dedicated test file specifically because it was flagged "highest-risk"; this module, carrying comparable concurrency-safety logic, did not get the same treatment. This is the highest-convergence finding of cycle 7 — 5 of 8 independent reviewers found it via 5 different methods. at store/entitlementCrossTabSync.ts:1.

**Acceptance Criteria:**
- [ ] tests/entitlementCrossTabSync.test.ts exists, calling createCrossTabSync directly with a fake rehydrate function
- [ ] Covers: concurrent/rapid storage events while a rehydrate is in flight (the requeue path), and a rehydrate() that throws synchronously (the catch-recovery path that resets rehydrateInFlight rather than locking it true forever)
- [ ] Existing indirect coverage via tests/entitlement.test.ts / tests/entitlementStoreEventWiring.test.ts is not duplicated, only supplemented

**Source:** Cycle-7 audit finding F03 — severity 5 — convergence 5/8 (Agents A, B, K, W, Red R — highest convergence this cycle) — LIVE, this sync mechanism runs in production web builds today, not gated behind specialty-pack readiness.

---
