# Stream W14C Task State

### Task #392: Fix edge-case: hasValidUnitsArray validates a narrower shape than what downstream UI code unconditionally dereferences

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Validates unit id/name/cards and card id/type/prompt/accepted/tags/tier but not unit.level/theme/emoji/prerequisiteUnits, all non-optional on Unit. components/LevelSection.tsx:55 and app/study/page.tsx:43 unconditionally dereference unit.prerequisiteUnits.every(...) with no guard — a pack passing sha256 and this validator but missing prerequisiteUnits would crash the UI on first render rather than fail at load. The offline authoring-time validator (scripts/validatePack.ts) already checks this field; the runtime guard is strictly weaker than its own mirror. at lib/packTypes.ts:hasValidUnitsArray:61.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/packTypes.ts:hasValidUnitsArray:61
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F016 — severity 6 — edge-case

---

### Task #391: Fix data-loss: useExportImport silently leaves entitlement state untouched when a backup lacks licenseKey/instanceId

**File:** hooks/useExportImport.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
When a backup's entitlement fields are null/falsy, the import branch silently skips setEntitlement entirely — the current session's entitlement state is left completely untouched with no reset, merge, or flag — while the success message still reports "Restored N card(s) of progress" with no indication entitlement restoration did nothing. at hooks/useExportImport.ts:handleImport:82.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at hooks/useExportImport.ts:handleImport:82
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useExportImport.ts

**Source:** Audit finding F015 — severity 5 — data-loss

---

### Task #396: Fix async: PackMemCacheImpl.write()'s fire-and-forget storage cleanup can delete a concurrent specialty merge's just-written keys

**File:** lib/packCache.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
write() fires its specialty-storage-key cleanup fire-and-forget (not awaited). A base-pack replace racing a concurrent loadSpecialtyPack merge that is persisting its own storage keys can have its just-written keys silently deleted by the trailing cleanup, while loadedAddOns/memCache still report the add-on merged in memory — an unlocked, untested race. at lib/packCache.ts:PackMemCacheImpl.write:118.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at lib/packCache.ts:PackMemCacheImpl.write:118
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F020 — severity 5 — async

---

### Task #387: Fix error-handling: readCacheMeta/readCacheData still omit lang from their error ref IDs despite this batch's rewrite

**File:** lib/packCache.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Rule 8 violation, repeat/unfixed across a rewrite. readCacheMeta's and readCacheData's catch blocks still log ref IDs without the lang argument, even though this file was substantially rewritten and extracted from packLoader.ts in this batch (Task #275). A cache-read failure for Spanish vs Italian remains indistinguishable in production logs. at lib/packCache.ts:readCacheMeta:161.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/packCache.ts:readCacheMeta:161
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F011 — severity 4 — error-handling

---

