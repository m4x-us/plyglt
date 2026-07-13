# Stream W12B Task State

### Task #297: Fix code-quality: The header states 'the structure is in place for when content arrives', without disclosing

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The header states 'the structure is in place for when content arrives', without disclosing that the Italian early-return means loadPack('it',...) is never called in the running app, so the described structure cannot function for the base language every documented specialty-pack example targets. Violates Rule 2. at lib/packLoader.ts:module header:24.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packLoader.ts:module header:24
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F003 — severity 6 — code-quality

---

---

### Task #302: Fix error-handling: Once a specialty code becomes the active target language, this logs a false-positive [ERR-

**File:** lib/language.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Once a specialty code becomes the active target language, this logs a false-positive [ERR-LANG-CONFIG-UNKNOWN] error on every render for a legitimately registered specialty pack code. at lib/language.ts:getLanguageConfig:117.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/language.ts:getLanguageConfig:117
- [ ] Audit passes: bash scripts/deep-audit.sh lib/language.ts

**Source:** Audit finding F008 — severity 3 — error-handling

---

---

### Task #309: Fix security: _mergeFromJson persists data then meta as separate awaits in one try/catch; a partial-writ

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
_mergeFromJson persists data then meta as separate awaits in one try/catch; a partial-write failure can leave orphaned data-without-meta on disk. A later load with no manifest entry available merges the orphaned cachedData with zero hash verification anywhere in the call path. at lib/specialtyPackLoader.ts:_doLoad (_mergeFromJson persistence):241.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at lib/specialtyPackLoader.ts:_doLoad (_mergeFromJson persistence):241
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F015 — severity 7 — security

---

---

### Task #319: Fix edge-case: Doc comment claims an evicted base pack can never have its merge state left dangling; fals

**File:** Multiple — see What (lib/packCache.ts's clearPackCache needs to also clear each pruned specialty code's own persisted storage keys, which requires a new or extended export from lib/specialtyPackLoader.ts to enumerate specialty codes pruned by clearSpecialtyPacksForLang)
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Doc comment claims an evicted base pack can never have its merge state left dangling; false with respect to platform storage. Each specialty pack has its own persisted storage keys separate from the in-memory merge, and clearPackCache never clears them. at lib/packCache.ts:clearPackCache:129.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/packCache.ts:clearPackCache:129
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F025 — severity 5 — edge-case

---
