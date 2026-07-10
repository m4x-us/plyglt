# Stream W9D Task State

### Task #294: Fix requirements: getTargetLangCode's return type is declared string, implying round-trip fidelity with setT

**File:** lib/constants.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
getTargetLangCode's return type is declared string, implying round-trip fidelity with setTargetLangCode. For hyphenated codes it silently returns a truncated substring with no type-level or runtime failure signal -- a contract-lie framing distinct from F002's functional-bug framing. at lib/constants.ts:getTargetLangCode:19.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at lib/constants.ts:getTargetLangCode:19
- [ ] Audit passes: bash scripts/deep-audit.sh lib/constants.ts

**Source:** Audit finding F034 — severity 6 — requirements

---

### Task #293: Fix edge-case: hasValidUnitsArray validates only Array.isArray(pack.units); it does not cross-check unitC

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
hasValidUnitsArray validates only Array.isArray(pack.units); it does not cross-check unitCount/cardCount against units.length, and does not validate individual unit or card element shapes. at lib/packTypes.ts:hasValidUnitsArray:1.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/packTypes.ts:hasValidUnitsArray:1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F033 — severity 5 — edge-case

---
