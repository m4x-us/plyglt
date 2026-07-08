# Stream W4C Task State

### Task #237: Fix tests: commitSession's "atomicity" test doesn't test atomicity

**File:** tests/commitSession.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
"all three slices are consistent — no partial application" (tests/commitSession.test.ts:36-47) claims to prove `commitSession`'s atomic single-`set()`-call contract (documented in store/srsStore.ts:72-74) but only checks final-state values. It would pass identically if `commitSession` made three sequential `set()` calls instead of one. `tests/seam_studyLoop.test.ts:93-129` already has the correct pattern (subscribe + snapshot-count) for the sibling `rateCardAndSaveSession` function — the same pattern was not applied here. Found independently by Agents K and V.

**Acceptance Criteria:**
- [ ] Rewrite the test to subscribe to the store and assert exactly 1 snapshot fires for a single `commitSession` call, matching the pattern already used in `tests/seam_studyLoop.test.ts`

**Done when:** The rewritten test would fail if `commitSession` were changed to call `set()` more than once. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 6 — tests — converged independently by Agents K and V.

---

### Task #238: Fix tests: useLangPack.test.ts's error-message enumeration omits base_pack_not_loaded

**File:** tests/useLangPack.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
The `RAW_DISCRIMINANTS`/`EXPECTED_MESSAGES` enumeration added by Task #227 (tests/useLangPack.test.ts:84-103) omits `base_pack_not_loaded` — 1 of 5 `LoadPackResult` error discriminants (defined lib/packTypes.ts:41-46, copy in hooks/useLangPack.ts:18) is never tested. A Rule 16 enumeration gap in a fixture explicitly built to enumerate all discriminants. Found by Agent K.

**Acceptance Criteria:**
- [ ] Add `base_pack_not_loaded` to `RAW_DISCRIMINANTS` and its exact expected copy to `EXPECTED_MESSAGES`

**Done when:** All 5 `LoadPackResult` error discriminants are covered by the enumeration test. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 6 — tests — found by Agent K.

---

### Task #239: Fix tests: packLoader stale-cache fallback has no semantic-corruption test

**File:** tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
No test in tests/packLoader.test.ts exercises syntactically-valid-but-semantically-malformed cached JSON (e.g. non-array `units`) reaching the offline stale-cache-fallback path (lib/packLoader.ts:210-235). That path skips the shape validation the happy-path download branch performs, so a truncated/corrupted cache write (plausible per the file's own atomic-write comment) could leak an invalid `Pack` as `ok:true`. Found by Agent K.

**Acceptance Criteria:**
- [ ] Add a test that seeds a cached pack with a non-array `units` field, forces the offline-fallback path, and asserts the result is either rejected or validated before being returned

**Done when:** A test with semantically-malformed cached JSON asserts the stale-cache fallback path does not silently return an invalid Pack as `ok:true`. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 5 — tests — found by Agent K.
