# Stream W20D Task State

### Task #460: Fix data-integrity: importBackup.ts's normalizeCardProgress doesn't clamp difficulty/retrievability on restore

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
`normalizeCardProgress` restores backup data without range-clamping the FSRS `difficulty`/`retrievability` numeric fields. A crafted or corrupted backup file can inject out-of-range values that the scheduler was never designed to receive. This is a pre-existing gap, not introduced by Wave 19, found by an unbriefed naive-reader agent reading the restore path fresh. at lib/importBackup.ts:1.

**Acceptance Criteria:**
- [ ] difficulty and retrievability are clamped to their valid FSRS ranges during restore, matching whatever bounds lib/srs.ts already assumes elsewhere
- [ ] A test supplies an out-of-range value in a backup fixture and asserts the restored value is clamped, not passed through

**Source:** Cycle-6 audit finding F6 — severity 5 — convergence 1/8 (Agent N) — data integrity, LIVE.

---

### Task #461: Fix test-coverage: lib/specialtyPackMerge.ts has no dedicated test file

**File:** tests/specialtyPackMerge.test.ts (new)
**Complexity:** ⚡ Direct — 1 new file, single-scope addition
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
`lib/specialtyPackMerge.ts` — the highest-risk brand-new extraction this cycle (Task #447), owning the parse-verify-merge-persist "commit" step for specialty pack purchases — has no test file of its own. It is exercised only indirectly through `tests/specialtyPackLoader.test.ts`'s call chains into the shared `loadSpecialtyPack` entry point. Its own documented invariants (meta-written-before-data crash-safety ordering; the two independent `deactivationGuard.isStale()` re-checks bracketing storage writes) are proven only incidentally by whatever the caller's test suite happens to construct, not by tests scoped to the unit doing the risky work. at lib/specialtyPackMerge.ts:1.

**Acceptance Criteria:**
- [ ] tests/specialtyPackMerge.test.ts exists, directly calling mergeSpecialtyPackFromJson
- [ ] Covers the meta-before-data write ordering and both deactivation-guard isStale re-check points directly, not just via the caller
- [ ] Existing tests/specialtyPackLoader.test.ts coverage is not duplicated, only supplemented

**Source:** Cycle-6 audit finding F7 — severity 4 — convergence 1/8 (Agent W) — test coverage, DORMANT (specialty packs not yet ready:true).

---

### Task #462: Fix incomplete root-cause: parseFlag still resolves any non-conforming truthy env value to enabled=true

**File:** lib/featureFlags.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Task #448 fixed `parseFlag` to fall through to `defaultEnabled` for `undefined` and `""` env values. Agent V found this only closes those two specific cases: any OTHER unrecognized-but-truthy value (e.g. a typo'd env var that isn't `"true"`/`"1"`/`""`/undefined) still resolves to `enabled=true` regardless of `defaultEnabled` — meaning a malformed env value could unintentionally enable a Pro-gated feature. Same shape as #446/#442: the reported repro case was fixed, a nearby variant of the same bug was not. at lib/featureFlags.ts:31.

**Acceptance Criteria:**
- [ ] parseFlag treats any value that isn't a recognized truthy signal ("true"/"1") as falling through to defaultEnabled, not defaulting to true
- [ ] A test supplies a garbage-but-non-empty env value against both a default-off and default-on flag and asserts defaultEnabled wins in both cases

**Source:** Cycle-6 audit finding F8 — severity 5 — convergence 1/8 (Agent V) — incomplete root-cause fix, LIVE (gates isProEnabled broadly, not specialty-pack-specific).

---
