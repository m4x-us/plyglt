# Stream W11B Task State

### Task #299: Fix code-quality: Reimplements lib/packCache.ts's cache I/O layer nearly line-for-line with identical store 

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Reimplements lib/packCache.ts's cache I/O layer nearly line-for-line with identical store name and key prefixes, even though packCache.ts's functions are already generic and work unmodified for specialty codes. This is the duplication anti-pattern packCache.ts (Task #275) was extracted to eliminate. at lib/specialtyPackLoader.ts:getStorage/readCacheMeta/writeCacheMeta/readCacheData/writeCacheData:21.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/specialtyPackLoader.ts:getStorage/readCacheMeta/writeCacheMeta/readCacheData/writeCacheData:21
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F005 — severity 7 — code-quality

---

### Task #298: Fix error-handling: 9 error log call sites omit Date.now() from their ref IDs, violating Rule 8's timestamp fo

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
9 error log call sites omit Date.now() from their ref IDs, violating Rule 8's timestamp format. The sibling files lib/packCache.ts and lib/packLoader.ts both timestamp every equivalent error. at lib/specialtyPackLoader.ts:multiple error-log call sites:45.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/specialtyPackLoader.ts:multiple error-log call sites:45
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F004 — severity 3 — error-handling

---

### Task #310: Fix async: A non-null assertion on memCache.get(baseLang) is reachable after multiple awaits inside _

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
A non-null assertion on memCache.get(baseLang) is reachable after multiple awaits inside _doLoad. Concurrent eviction during that window makes the assertion lie and throws a TypeError that propagates through the inFlight-chained promise, failing any other specialty load chained behind it. at lib/specialtyPackLoader.ts:_mergeFromJson:152.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at lib/specialtyPackLoader.ts:_mergeFromJson:152
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F016 — severity 7 — async

---

### Task #320: Fix code-quality: The header's Inputs list omits the purchasedAddOns parameter that loadSpecialtyPack actual

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The header's Inputs list omits the purchasedAddOns parameter that loadSpecialtyPack actually receives and depends on. at lib/specialtyPackLoader.ts:module header:3.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/specialtyPackLoader.ts:module header:3
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F026 — severity 3 — code-quality

---
