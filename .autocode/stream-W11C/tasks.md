# Stream W11C Task State

### Task #301: Fix requirements: Became orphaned after Task #278 rewrote LanguageGrid.tsx to filter SPECIALTY_PACKS directl

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Became orphaned after Task #278 rewrote LanguageGrid.tsx to filter SPECIALTY_PACKS directly instead of calling this function; zero callers outside tests/. at lib/langRegistry.ts:getSpecialtyPacks:83.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at lib/langRegistry.ts:getSpecialtyPacks:83
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F007 — severity 2 — requirements

---

### Task #313: Fix code-quality: Comment frames packLoader's inline check as a delegation not yet performed, but packLoader

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Comment frames packLoader's inline check as a delegation not yet performed, but packLoader.ts already performed that delegation in this same diff under Task #266. at lib/langRegistry.ts:isReadySpecialtyPackCode:99.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/langRegistry.ts:isReadySpecialtyPackCode:99
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F019 — severity 2 — code-quality

---

### Task #317: Fix edge-case: Validates registration only, not the .ready flag; purchaseAddOn uses this as its only code

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Validates registration only, not the .ready flag; purchaseAddOn uses this as its only code-validity gate before persisting into purchasedAddOns, a field with no removal path. at lib/langRegistry.ts:isSpecialtyPackCode:91.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/langRegistry.ts:isSpecialtyPackCode:91
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F023 — severity 3 — edge-case

---

### Task #318: Fix code-quality: The USED BY list names three app pages that grep confirms do not import from lib/langRegis

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The USED BY list names three app pages that grep confirms do not import from lib/langRegistry directly, and omits lib/specialtyPackLoader.ts which does directly import SPECIALTY_PACKS. at lib/langRegistry.ts:module header:1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/langRegistry.ts:module header:1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F024 — severity 5 — code-quality

---
