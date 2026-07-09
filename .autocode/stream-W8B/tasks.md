# Stream W8B Task State

### Task #270: Fix data-loss: evictPack never calls clearSpecialtyPacksForLang directly when evicting a base pack while

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
evictPack never calls clearSpecialtyPacksForLang directly when evicting a base pack while a specialty add-on for that language is loaded; only reached internally via clearPackCache. Evicting a base pack this way orphans the add-on's code in loadedAddOns; getLoadedAddOns() continues reporting it as active after the data it depends on has been wiped. at lib/packLoader.ts:evictPack:415.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at lib/packLoader.ts:evictPack:415
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F010 — severity 6 — data-loss

---

### Task #271: Fix error-handling: evictPack's name implies universal pack eviction; when given a specialty code it silently

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
evictPack's name implies universal pack eviction; when given a specialty code it silently returns 'evicted nothing' with no error, log entry, or distinguishing return value to signal the no-op. Rule 8: Log Everything violation. at lib/packLoader.ts:evictPack:415.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/packLoader.ts:evictPack:415
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F011 — severity 5 — error-handling

---

### Task #276: Fix feature-flag: No feature flag gates the specialty-pack UI section in components/LanguageGrid.tsx or load

**File:** components/LanguageGrid.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
No feature flag gates the specialty-pack UI section in components/LanguageGrid.tsx or loadPack's specialty branch in lib/packLoader.ts. at components/LanguageGrid.tsx:LanguageGrid:109.
NEW

**Acceptance Criteria:**
- [ ] Fix feature-flag issue at components/LanguageGrid.tsx:LanguageGrid:109
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F016 — severity 4 — feature-flag

---

### Task #278: Fix edge-case: components/LanguageGrid.tsx assumes, undocumented, that a user cannot own a specialty add-

**File:** components/LanguageGrid.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
components/LanguageGrid.tsx assumes, undocumented, that a user cannot own a specialty add-on without owning its base language; true only because Italian is always free/unlocked, not structurally enforced anywhere. at components/LanguageGrid.tsx:LanguageGrid:109.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at components/LanguageGrid.tsx:LanguageGrid:109
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F018 — severity 4 — edge-case

---
