# Stream W8D Task State

### Task #273: Fix data-loss: The v2->v3 entitlement migration validates Array.isArray(purchasedAddOns) but not element

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The v2->v3 entitlement migration validates Array.isArray(purchasedAddOns) but not element type or shape. Independently found by 3 of 7 auditors; exploitability currently low but flagged as a fix-before-load-bearing item. at store/migrations.ts:ENTITLEMENT_MIGRATIONS[2] (v2->v3):153.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at store/migrations.ts:ENTITLEMENT_MIGRATIONS[2] (v2->v3):153
- [ ] Audit passes: bash scripts/deep-audit.sh store/migrations.ts

**Source:** Audit finding F013 — severity 5 — data-loss

---

### Task #277: Fix tests: Tests mock getSpecialtyPacks/isSpecialtyPackCode/SPECIALTY_PACKS rather than exercising th

**File:** tests/langRegistry.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Tests mock getSpecialtyPacks/isSpecialtyPackCode/SPECIALTY_PACKS rather than exercising the real filter logic against a populated registry; the test file additionally reimplements a mock version rather than exercising the real export. at tests/langRegistry.test.ts:getSpecialtyPacks mocks:1.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/langRegistry.test.ts:getSpecialtyPacks mocks:1
- [ ] Audit passes: bash scripts/deep-audit.sh tests/langRegistry.test.ts

**Source:** Audit finding F017 — severity 4 — tests

---

### Task #279: Fix error-handling: LANGUAGE_MAP[code] ?? ITALIAN silently falls back to Italian's display config for any unre

**File:** lib/language.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
LANGUAGE_MAP[code] ?? ITALIAN silently falls back to Italian's display config for any unrecognized code (e.g. a future 'es-cooking' specialty pack), with zero error signal. A second independent silent-fallback break beyond the F002 constants.ts bug, currently masked by it. Independently found by 2 auditors. at lib/language.ts:getLanguageConfig:111.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/language.ts:getLanguageConfig:111
- [ ] Audit passes: bash scripts/deep-audit.sh lib/language.ts

**Source:** Audit finding F019 — severity 6 — error-handling

---

### Task #292: Fix code-quality: The header claims to be the 'single source of truth' for Pack, PackMeta, Manifest, and Loa

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The header claims to be the 'single source of truth' for Pack, PackMeta, Manifest, and LoadPackResult, but the file also exports hasValidUnitsArray and PackMemCache, used by both packLoader.ts and specialtyPackLoader.ts. Rule 16: Enumerate Before You Assert, applied to documentation completeness. at lib/packTypes.ts:N/A (file header):1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packTypes.ts:N/A (file header):1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F032 — severity 3 — code-quality

---
