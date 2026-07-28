# Stream W20B Task State

### Task #457: Fix code-quality: getLangPair duplicates getTargetLangCode's derivation logic instead of sharing it

**File:** lib/constants.ts
**Complexity:** ⚡ Direct — 1 file, single-scope extraction
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Task #446 fixed `getLangPair`'s "en-" bug by making its `sepIdx`/`slice` derivation byte-identical to `getTargetLangCode`'s — but as a copy-paste, not a shared function. This reproduces the exact defect class that caused #446 in the first place: two independent copies of the same derivation can silently drift apart again on a future edit. The code comment at lib/constants.ts:87-88 claims the two are "structurally impossible to drift apart again," which overclaims — duplication is not structural prevention. at lib/constants.ts:89-91.

**Acceptance Criteria:**
- [ ] getLangPair and getTargetLangCode share one extracted derivation function/constant, not two independent copies
- [ ] Existing tests for both functions continue to pass unmodified in behavior
- [ ] The misleading "structurally impossible to drift apart" comment is corrected or removed

**Source:** Cycle-6 audit finding F3 — severity 5 — convergence 1/8 (Agent K) — root-cause durability / DRY violation.

---

### Task #463: Fix Rule 1: store/entitlementStore.ts and lib/packLoader.ts have crept back over the 400-line cap

**File:** store/entitlementStore.ts, lib/packLoader.ts
**Complexity:** 🔧 Full — 2 files, extraction work
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Two independent reviewers (Agents A and B) confirmed store/entitlementStore.ts is now 403 lines and lib/packLoader.ts is now 402 lines — both over the Rule 1 400-line cap, after this wave's edits. This is the same extraction pattern already applied twice this batch (entitlementAddOns.ts split from entitlementStore.ts in Wave 18; specialtyPackMerge.ts split from specialtyPackLoader.ts in Wave 19) — both files need another narrow, non-circular extraction. at store/entitlementStore.ts:1.

**Acceptance Criteria:**
- [ ] Both files reduced to at or under 400 lines via a narrow extraction following the established pattern (parameter-typed interfaces, no circular imports)
- [ ] No behavior change; existing tests pass unmodified

**Source:** Cycle-6 audit finding F9 — severity 4 — convergence 2/8 (Agents A and B, independently) — Rule 1 cap regression, LIVE.

---

### Task #464: Fix defensive-depth gap: fetch timeout relies solely on AbortController with no independent backstop

**File:** lib/basePackLoader.ts, lib/specialtyPackLoader.ts, lib/packLoader.ts
**Complexity:** 🔧 Full — 3 files, same pattern across all
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Task #445's fetch timeout fix relies entirely on `AbortController` and the assumption that `fetch()` honors the abort signal. Red Agent R (CHAOS lens) found no independent `Promise.race`/`setTimeout` backstop exists — a hypothetical non-conformant fetch implementation that ignores the abort signal would still hang forever, reproducing the original bug under a narrower trigger condition. at lib/basePackLoader.ts:194.

**Acceptance Criteria:**
- [ ] All 3 fetch call sites have an independent timeout backstop (e.g. Promise.race against a setTimeout) that does not rely solely on the fetch implementation honoring AbortController
- [ ] A test simulates a fetch that never settles and never honors abort, and asserts the call still resolves to a timeout error within bounded time

**Source:** Cycle-6 audit finding F18 — severity 4 — convergence 1/8 (Red Agent R, CHAOS lens) — defensive-depth gap, LIVE.

---

### Task #465: Fix Poka-Yoke violation: FETCH_TIMEOUT_MS declared independently in 3 files by this same wave's own fix

**File:** lib/basePackLoader.ts, lib/specialtyPackLoader.ts, lib/packLoader.ts, lib/constants.ts
**Complexity:** 🔧 Full — 4 files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Task #445 declared `FETCH_TIMEOUT_MS = 20_000` independently in 3 separate files rather than one shared constant — a fresh instance of the "parallel constant, not single source of truth" anti-pattern already tracked elsewhere in this codebase (the 200-char length constants across entitlementAddOns.ts/useLicenseActivation.ts/importBackup.ts). AGENTS.md explicitly Stop-the-Lines this exact pattern: "Any hardcoded string that belongs in a named constant" / "Any parallel list/array that should be derived from a single source of truth." Notable because it was introduced brand-new by this wave's own fix, not inherited debt. at lib/basePackLoader.ts:194.

**Acceptance Criteria:**
- [ ] FETCH_TIMEOUT_MS declared once (e.g. in lib/constants.ts) and imported by all 3 call sites
- [ ] A test asserts numeric equality can never drift (either by sharing the import directly, or an explicit cross-check test if a shared import isn't feasible)

**Source:** Cycle-6 audit finding F19 — severity 4 — convergence 1/8 (Red Agent R, DECAY lens) — Poka-Yoke / parallel-constant anti-pattern, freshly reproduced, LIVE.

---
