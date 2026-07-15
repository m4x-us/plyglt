# Stream W13B Task State

### Task #328: Fix architecture: Genuine circular ES-module dependency between two lib/ files (packCache imports clearSpeci

**File:** lib/packCache.ts:18 + lib/specialtyPackLoader.ts:14-21
**Complexity:** 🔧 Full — Multiple files/locations, see What
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14

**What:**
Genuine circular ES-module dependency between two lib/ files (packCache imports clearSpecialtyPacksForLang from specialtyPackLoader; specialtyPackLoader imports 5 symbols from packCache). Violates Rule 3 (Layers Down Only) and Rule 6 (Extract Ready) -- neither module can be extracted independently. Neither file's header acknowledges the cycle. at lib/packCache.ts:18 + lib/specialtyPackLoader.ts:14-21:module-level imports.
NEW

**Acceptance Criteria:**
- [x] Fix architecture issue at lib/packCache.ts:18 + lib/specialtyPackLoader.ts:14-21:module-level imports
- [x] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F001 — severity 6 — architecture

---

---

### Task #374: Fix documentation-trust: "Called by" claim omits lib/packCache.ts (imports clearSpecialtyPacksForLang) and store/en

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
"Called by" claim omits lib/packCache.ts (imports clearSpecialtyPacksForLang) and store/entitlementStore.ts (imports clearSpecialtyCache). at lib/specialtyPackLoader.ts:module header:5.
NEW

**Acceptance Criteria:**
- [x] Fix documentation-trust issue at lib/specialtyPackLoader.ts:module header:5
- [x] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F047 — severity 3 — documentation-trust

---

---

### Task #329: Fix documentation-trust: Header claims '@internal Used by lib/packLoader.ts. Not part of the module's external publ

**File:** lib/packCache.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
Header claims '@internal Used by lib/packLoader.ts. Not part of the module's external public API' -- false as of this batch; lib/specialtyPackLoader.ts also imports readCacheMeta/writeCacheMeta/readCacheData/writeCacheData/clearPackCache directly. at lib/packCache.ts:module header:14.
NEW

**Acceptance Criteria:**
- [x] Fix documentation-trust issue at lib/packCache.ts:module header:14
- [x] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F002 — severity 5 — documentation-trust

---

---

### Task #346: Fix code-quality: write() prunes in-memory add-on tracking via clearSpecialtyPacksForLang but never removes 

**File:** lib/packCache.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14

**What:**
write() prunes in-memory add-on tracking via clearSpecialtyPacksForLang but never removes that code's own persisted storage keys, unlike clearPackCache which pairs the identical prune with storage-key removal -- a 5th instance of the exact bug class clearPackCache's own doc comment says 4 prior tasks (#250, #251, #253, #259) already forgot. at lib/packCache.ts:PackMemCacheImpl.write:51.
NEW

**Acceptance Criteria:**
- [x] Fix code-quality issue at lib/packCache.ts:PackMemCacheImpl.write:51
- [x] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F019 — severity 6 — code-quality

---

---

### Task #367: Fix code-quality: The function's own doc comment documents 4 prior remediation tasks that each independently

**File:** lib/packCache.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
The function's own doc comment documents 4 prior remediation tasks that each independently forgot to pair cleanup logic; this batch's #319 extends the same function with a third bolted-on responsibility rather than a composable pattern, continuing the accretion its own history warns against. at lib/packCache.ts:clearPackCache:118.
NEW

**Acceptance Criteria:**
- [x] Fix code-quality issue at lib/packCache.ts:clearPackCache:118
- [x] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F040 — severity 3 — code-quality

---

---

### Task #358: Fix async: clearPackCache awaits Promise.allSettled for storage removal BEFORE memCache.delete(lang);

**File:** lib/packCache.ts:clearPackCache:137-173 vs cacheAndReturn:189-192
**Complexity:** ⚡ Direct — 1 file (both cited functions are within lib/packCache.ts) — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
clearPackCache awaits Promise.allSettled for storage removal BEFORE memCache.delete(lang); a concurrent loadPack(lang) can complete its own memCache.write in that window and then have its freshly-loaded entry wiped -- no in-flight lock for base-pack loads analogous to specialtyPackLoader's inFlight Map. at lib/packCache.ts:clearPackCache:137-173 vs cacheAndReturn:189-192:clearPackCache.
NEW

**Acceptance Criteria:**
- [x] Fix async issue at lib/packCache.ts:clearPackCache:137-173 vs cacheAndReturn:189-192:clearPackCache
- [x] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F031 — severity 5 — async

---

---

### Task #348: Fix edge-case: hasValidUnitsArray never checks that pack.unitCount/cardCount are numbers; _mergeFromJson 

**File:** lib/packTypes.ts:58-81 + lib/specialtyPackLoader.ts:117-122
**Complexity:** ⚡ Direct — 1 file (lib/packTypes.ts's hasValidUnitsArray; specialtyPackLoader.ts is cited only as the downstream consumer showing impact, needs no edit) — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
hasValidUnitsArray never checks that pack.unitCount/cardCount are numbers; _mergeFromJson computes unitCount/cardCount sums directly from these unvalidated fields -- a non-numeric value passes shape validation and silently string-concatenates instead of summing. at lib/packTypes.ts:58-81 + lib/specialtyPackLoader.ts:117-122:hasValidUnitsArray / _mergeFromJson.
NEW

**Acceptance Criteria:**
- [x] Fix edge-case issue at lib/packTypes.ts:58-81 + lib/specialtyPackLoader.ts:117-122:hasValidUnitsArray / _mergeFromJson
- [x] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F021 — severity 4 — edge-case

---

---

### Task #375: Fix documentation-trust: "Imported by" claim omits lib/packCache.ts, which also imports hasValidUnitsArray, Pack, L

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
"Imported by" claim omits lib/packCache.ts, which also imports hasValidUnitsArray, Pack, LoadPackResult, PackMemCache from this module. at lib/packTypes.ts:module header:5.
NEW

**Acceptance Criteria:**
- [x] Fix documentation-trust issue at lib/packTypes.ts:module header:5
- [x] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F048 — severity 2 — documentation-trust

---

---

### Task #365: Fix documentation-trust: Doc comment claims p1===p2 holds via loadPack's return for concurrent same-code loads -- f

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
Doc comment claims p1===p2 holds via loadPack's return for concurrent same-code loads -- false; loadPack is declared async and always wraps its return in a fresh Promise, so this is only true for direct loadSpecialtyPack calls. A contradicting comment in tests/packLoader.test.ts added in the same batch disagrees with this exact claim. at lib/specialtyPackLoader.ts:loadSpecialtyPack doc comment:269.
NEW

**Acceptance Criteria:**
- [x] Fix documentation-trust issue at lib/specialtyPackLoader.ts:loadSpecialtyPack doc comment:269
- [x] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F038 — severity 5 — documentation-trust

---
