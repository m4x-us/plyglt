# Stream W12C Task State

### Task #306: Fix feature-flag: NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS bypasses the canonical lib/featureFlags.ts module: not a

**File:** Multiple — see What (lib/featureFlags.ts needs the new flag added to FeatureFlags/getFeatureFlags(); components/LanguageGrid.tsx needs to call the canonical parseFlag-based accessor instead of its ad hoc inline check)
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope flag-wiring fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS bypasses the canonical lib/featureFlags.ts module: not added to FeatureFlags/getFeatureFlags(), and parses the raw env var inline instead of the shared parseFlag(), which treats 'false'/'0'/'off'/'no' as disabled. Setting this flag to 'off' or '0' silently does nothing. at components/LanguageGrid.tsx:specialtyPacksEnabled:29.
NEW

**Acceptance Criteria:**
- [ ] Fix feature-flag issue at components/LanguageGrid.tsx:specialtyPacksEnabled:29
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F012 — severity 6 — feature-flag

---

---

### Task #307: Fix code-quality: Comment claims a kill switch without requiring a deploy, but next.config.ts sets output:'e

**File:** components/LanguageGrid.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Comment claims a kill switch without requiring a deploy, but next.config.ts sets output:'export' (fully static build, no server); Next.js inlines NEXT_PUBLIC_* env vars at build time, so there is no running process whose env var can be flipped post-deploy. at components/LanguageGrid.tsx:specialtyPacksEnabled:33.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at components/LanguageGrid.tsx:specialtyPacksEnabled:33
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F013 — severity 6 — code-quality

---

---

### Task #308: Fix requirements: onUpgradeClick takes zero arguments; sp.code is in scope in the same closure and correctly

**File:** components/LanguageGrid.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
onUpgradeClick takes zero arguments; sp.code is in scope in the same closure and correctly used for onSelect/hasAddOn, but the locked-tile handler discards it. Even if a future caller wires purchaseAddOn to this callback, the signature cannot identify which specialty pack triggered it. at components/LanguageGrid.tsx:LanguageGrid Props:23.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/LanguageGrid.tsx:LanguageGrid Props:23
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F014 — severity 6 — requirements

---

---

### Task #316: Fix edge-case: Validates only that units is an array, each unit is an object, unit.id is a string, and un

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Validates only that units is an array, each unit is an object, unit.id is a string, and unit.cards is an array. Downstream code accesses many more fields never checked, and card array elements' shapes are never validated at all. at lib/packTypes.ts:hasValidUnitsArray:57.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/packTypes.ts:hasValidUnitsArray:57
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F022 — severity 5 — edge-case

---

---

### Task #321: Fix tests: Deleting the same-code in-flight short-circuit does not fail this test, because the indepe

**File:** tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Deleting the same-code in-flight short-circuit does not fail this test, because the independently-present cross-code serialization mechanism produces the identical observable result even with the same-code check deleted. at tests/packLoader.test.ts:#264 same-code: two concurrent loads issue only one fetch:1019.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/packLoader.test.ts:#264 same-code: two concurrent loads issue only one fetch:1019
- [ ] Audit passes: bash scripts/deep-audit.sh tests/packLoader.test.ts

**Source:** Audit finding F027 — severity 6 — tests

---
