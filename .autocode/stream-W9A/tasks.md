# Stream W9A Task State

### Task #261: Fix auth: Entitlement is enforced nowhere in the data layer for specialty packs. lib/packLoader.ts:l

**File:** lib/specialtyPackLoader.ts
**Complexity:** 🔧 Full — 3 files (loadSpecialtyPack signature change in lib/specialtyPackLoader.ts requires coordinated updates to its caller lib/packLoader.ts:loadPack and the ultimate call site hooks/useLangPack.ts:68, which currently passes no entitlement argument at all)
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
Entitlement is enforced nowhere in the data layer for specialty packs. lib/packLoader.ts:loadPack and lib/specialtyPackLoader.ts:loadSpecialtyPack:67 never read purchasedAddOns or call hasAddOn; the only gate is the onClick wiring decision in components/LanguageGrid.tsx:109. hooks/useLangPack.ts:68 calls loadPack(targetLang, manifest) with no entitlement argument at all. Independently found by all 7 auditors. at lib/specialtyPackLoader.ts:loadSpecialtyPack:67.
NEW

**Acceptance Criteria:**
- [ ] Fix auth issue at lib/specialtyPackLoader.ts:loadSpecialtyPack:67
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F001 — severity 8 — auth

---

### Task #266: Fix code-quality: isSpecialtyPackCode has zero production callers; lib/packLoader.ts:269 reimplements the sa

**File:** Multiple — see What (lib/langRegistry.ts is the anchor; the fix requires editing lib/packLoader.ts:269 to call the real function instead of reimplementing it inline — corrected during Wave 9 planning)
**Complexity:** ⚡ Direct — 2 files (lib/langRegistry.ts, lib/packLoader.ts), no package boundary, single call-site swap
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
isSpecialtyPackCode has zero production callers; lib/packLoader.ts:269 reimplements the same check inline instead of calling it. Independently found by 4 of 7 auditors. Rule 6 (duplication) and Rule 20b (zero callers outside tests) violation. at lib/langRegistry.ts:isSpecialtyPackCode:88.
Note (Wave 9 planning, 2026-07-09): Task #280 (Wave 8, complete) added `isReadySpecialtyPackCode`
to lib/langRegistry.ts specifically as the .ready-checking counterpart this call site needs —
lib/packLoader.ts:269's inline `SPECIALTY_PACKS.some(sp => sp.code === lang && sp.ready)` should
be replaced with a call to `isReadySpecialtyPackCode(lang)`, not `isSpecialtyPackCode(lang)` (which
does not check .ready and would silently change behavior for not-yet-ready specialty codes).
NEW

**Acceptance Criteria:**
- [ ] Replace the inline reimplementation at lib/packLoader.ts:269 with a call to isReadySpecialtyPackCode(lang) from lib/langRegistry.ts
- [ ] Fix code-quality issue at lib/langRegistry.ts:isSpecialtyPackCode:88
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts lib/packLoader.ts

**Source:** Audit finding F006 — severity 5 — code-quality

---

### Task #268: Fix requirements: evictPack guards on isValidPackCode (PackCode = 'it'|'es', base-only) and cannot evict a s

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
evictPack guards on isValidPackCode (PackCode = 'it'|'es', base-only) and cannot evict a specialty code. Its doc comment 'any registered code can be evicted... e.g. after purchase reversal' is false for specialty packs. Independently found by 6 of 7 auditors. at lib/packLoader.ts:evictPack:415.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at lib/packLoader.ts:evictPack:415
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F008 — severity 5 — requirements

---

### Task #272: Fix error-handling: An unchecked non-null assertion on .find()! is safe only because the sole caller pre-check

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
An unchecked non-null assertion on .find()! is safe only because the sole caller pre-checks; it would throw a raw TypeError if ever invoked without that pre-check, unlike every other path in the function, which returns typed LoadPackResult errors. Independently found by 3 of 7 auditors. at lib/specialtyPackLoader.ts:loadSpecialtyPack:67.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/specialtyPackLoader.ts:loadSpecialtyPack:67
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F012 — severity 4 — error-handling

---
