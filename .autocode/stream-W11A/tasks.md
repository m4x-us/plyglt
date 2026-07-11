# Stream W11A Task State

### Task #296: Fix requirements: The early return for STATIC_PACKS[targetLang] means loadPack is never invoked for lang 'it

**File:** hooks/useLangPack.ts
**Complexity:** 🔧 Full — 3+ files and an architectural decision: either route Italian's static content through loadPack/memCache (touches hooks/useLangPack.ts, lib/packLoader.ts, and how content/index.ts's bundled data enters memCache), or redesign loadSpecialtyPack's precondition so it doesn't require the base pack to be in memCache for statically-bundled languages (lib/specialtyPackLoader.ts + lib/packLoader.ts) — not a single-file fix either way
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
The early return for STATIC_PACKS[targetLang] means loadPack is never invoked for lang 'it' in production because Italian is served from bundled content, so memCache is never populated with an 'it' entry via any real call path. loadSpecialtyPack's precondition can never be satisfied through the real useLangPack entry point, so any it-* specialty pack always returns base_pack_not_loaded for a real user. at hooks/useLangPack.ts:useLangPack effect:69.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useLangPack.ts:useLangPack effect:69
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F002 — severity 8 — requirements

---

### Task #325: Fix error-handling: Silently accepts any specialty code as a no-op with only a console.warn; the function sign

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Silently accepts any specialty code as a no-op with only a console.warn; the function signature implies eviction always occurs, but for a specialty code it never evicts anything and still resolves successfully. at lib/packLoader.ts:evictPack:249.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/packLoader.ts:evictPack:249
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F031 — severity 3 — error-handling

---

### Task #323: Fix error-handling: getTargetLangCode can return an arbitrary hyphen-suffix string from a corrupted stored val

**File:** hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
getTargetLangCode can return an arbitrary hyphen-suffix string from a corrupted stored value; getLanguageConfig falls back to ITALIAN and logs on every render where targetLang changes, producing continuous console-error spam rather than a one-time repair. at hooks/useLangPack.ts:LOAD_PACK_ERROR_MESSAGES usage / getLanguageConfig:16.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at hooks/useLangPack.ts:LOAD_PACK_ERROR_MESSAGES usage / getLanguageConfig:16
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F029 — severity 5 — error-handling

---

### Task #324: Fix error-handling: invalid_lang is now returned for two semantically unrelated conditions: an unregistered/un

**File:** hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
invalid_lang is now returned for two semantically unrelated conditions: an unregistered/unready pack code, and a registered ready unpurchased specialty pack. Both surface identically as 'Pack not available'. at hooks/useLangPack.ts:LOAD_PACK_ERROR_MESSAGES:16.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at hooks/useLangPack.ts:LOAD_PACK_ERROR_MESSAGES:16
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F030 — severity 5 — error-handling

---
