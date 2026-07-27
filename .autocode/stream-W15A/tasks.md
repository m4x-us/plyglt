# Stream W15A Task State

### Task #405: Fix error-handling: unguarded sha256Hex in lib/specialtyPackLoader.ts

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, wrap two await sha256Hex sites in try/catch with ref-ID log + typed checksum_mismatch return
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
sha256Hex calls at lib/specialtyPackLoader.ts:198 (cached-copy verify) and :252 (fresh add-on verify) are outside any try/catch — a crypto.subtle failure rejects the shared in-flight promise for every concurrent specialty requester instead of returning the typed { ok:false } contract every other branch honors. Exact sibling of the base-loader defect fixed in Task #378 cycle 2 (lib/basePackLoader.ts SHA_VERIFY_FAIL pattern) — copy that fix shape.

**Acceptance Criteria:**
- [ ] Both sha256Hex sites wrapped; failure logs a ref-ID and returns { ok:false, error:"checksum_mismatch" }
- [ ] Test proving a throwing crypto.subtle surfaces as a typed error, not a rejection

**Source:** Carry-forward from Task #378 (Wave 14, Stream W14A) — Audit finding F028 — severity 5 — error-handling

---

### Task #400: Fix tests: malformed-add-on-pack test doesn't prove delegation to the shared hasValidUnitsArray helper

**File:** tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Rule 18 (B7) gap, conceded by the test's own comment. "rejects malformed add-on pack" does not prove delegation to the shared hasValidUnitsArray helper specifically — a reverted inline duplicate shape-check would pass this test identically, defeating the single-source-of-truth guarantee the shared helper is meant to provide. at tests/packLoader.test.ts:1034.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/packLoader.test.ts:1034
- [ ] Audit passes: bash scripts/deep-audit.sh tests/packLoader.test.ts

**Source:** Audit finding F024 — severity 3 — tests

---

