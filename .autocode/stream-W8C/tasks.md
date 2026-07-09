# Stream W8C Task State

### Task #262: Fix edge-case: setTargetLangCode('it-medical') stores 'en-it-medical'; getTargetLangCode's .split('-')[1]

**File:** lib/constants.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
setTargetLangCode('it-medical') stores 'en-it-medical'; getTargetLangCode's .split('-')[1] returns 'it', discarding '-medical'. The entire specialty-pack selection flow is unreachable from the real UI, deterministically, for any hyphenated code. Independently found by 5 of 7 auditors. Does NOT mitigate F001 -- fixing this alone exposes the entitlement gap through the primary UI with zero further code change. at lib/constants.ts:getTargetLangCode/setTargetLangCode:19.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/constants.ts:getTargetLangCode/setTargetLangCode:19
- [ ] Audit passes: bash scripts/deep-audit.sh lib/constants.ts

**Source:** Audit finding F002 — severity 8 — edge-case

---

### Task #267: Fix code-quality: lib/entitlement.ts:208 hasAddOn (pure function) has zero production callers; its own modul

**File:** lib/entitlement.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
lib/entitlement.ts:208 hasAddOn (pure function) has zero production callers; its own module doc comment states it exists 'for use outside React' -- purpose-built specifically to close the F001 entitlement gap and never wired in. store/entitlementStore.ts:133 duplicates the same logic instead of delegating, breaking the in-file pattern the file's own Rule-15 comment documents. Independently found by 5 of 7 auditors. at lib/entitlement.ts:hasAddOn:208.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/entitlement.ts:hasAddOn:208
- [ ] Audit passes: bash scripts/deep-audit.sh lib/entitlement.ts

**Source:** Audit finding F007 — severity 6 — code-quality

---

### Task #280: Fix requirements: isValidPackCode and isSpecialtyPackCode do not agree on what they validate: isSpecialtyPac

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
isValidPackCode and isSpecialtyPackCode do not agree on what they validate: isSpecialtyPackCode does not check .ready, while packLoader.ts's inline reimplementation (F006) does. A future developer would reasonably assume isValidPackCode covers any loadable pack code; it does not, and nothing in naming or types signals this. at lib/langRegistry.ts:isSpecialtyPackCode vs isValidPackCode:88.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at lib/langRegistry.ts:isSpecialtyPackCode vs isValidPackCode:88
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F020 — severity 5 — requirements

---

### Task #291: Fix code-quality: The 'USED BY' header omits components/LanguageGrid.tsx despite it directly importing LANGU

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The 'USED BY' header omits components/LanguageGrid.tsx despite it directly importing LANGUAGE_REGISTRY and getSpecialtyPacks. at lib/langRegistry.ts:N/A (file header):1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/langRegistry.ts:N/A (file header):1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F031 — severity 3 — code-quality

---
