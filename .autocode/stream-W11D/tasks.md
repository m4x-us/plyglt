# Stream W11D Task State

### Task #300: Fix code-quality: lib/entitlement.ts's hasAddOn doc comment directs this action to delegate rather than dupl

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
lib/entitlement.ts's hasAddOn doc comment directs this action to delegate rather than duplicate; instead it independently reimplements the identical check. lib/entitlement.ts's own hasAddOn has zero callers outside tests/. at store/entitlementStore.ts:hasAddOn:157.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:hasAddOn:157
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F006 — severity 3 — code-quality

---

### Task #305: Fix tests: The real production addEventListener('storage', ...) registration is never exercised by an

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The real production addEventListener('storage', ...) registration is never exercised by any test; all tests call the handler directly as a plain function and never dispatch a real StorageEvent on window. Violates Rule 20a. at store/entitlementStore.ts:_handleCrossTabStorageEvent:216.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at store/entitlementStore.ts:_handleCrossTabStorageEvent:216
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F011 — severity 4 — tests

---

### Task #306: Fix feature-flag: NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS bypasses the canonical lib/featureFlags.ts module: not a

**File:** Multiple — see What (lib/featureFlags.ts needs the new flag added to FeatureFlags/getFeatureFlags(); components/LanguageGrid.tsx needs to call the canonical parseFlag-based accessor instead of its ad hoc inline check)
**Complexity:** ⚡ Direct — 2 files (lib/featureFlags.ts, components/LanguageGrid.tsx), no package boundary, single-scope flag-wiring fix
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

### Task #327: Fix edge-case: The langPair restore regex was not updated for hyphenated specialty codes even though the 

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The langPair restore regex was not updated for hyphenated specialty codes even though the sibling parser getTargetLangCode was specifically fixed for this same truncation bug in this batch. A backup restore for a user with an active specialty-pack selection silently resets to en-it with no console.error. at lib/importBackup.ts:parseBackup (langPair restore):128.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/importBackup.ts:parseBackup (langPair restore):128
- [ ] Audit passes: bash scripts/deep-audit.sh lib/importBackup.ts

**Source:** Audit finding F033 — severity 6 — edge-case

---
