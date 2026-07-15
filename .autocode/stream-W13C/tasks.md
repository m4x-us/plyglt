# Stream W13C Task State

### Task #337: Fix code-quality: seedMemCache takes an unvalidated lang:string and writes directly to the memCache singleto

**File:** lib/packLoader.ts:250-266 + :270-275
**Complexity:** ⚡ Direct — 1 file (both locations are within lib/packLoader.ts), relabeled 2026-07-13 by /advance Complexity Audit — original label over-counted line-range citations as separate files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
seedMemCache takes an unvalidated lang:string and writes directly to the memCache singleton with no isValidPackCode/READY_PACK_CODES check, silently invalidating getInstalledPacks' documented invariant that memCache is only ever populated via validated writes. at lib/packLoader.ts:250-266 + :270-275:seedMemCache / getInstalledPacks.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packLoader.ts:250-266 + :270-275:seedMemCache / getInstalledPacks
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F010 — severity 5 — code-quality

---

---

### Task #341: Fix error-handling: A fully garbage/unregistered code (neither a valid base pack code nor a registered special

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
A fully garbage/unregistered code (neither a valid base pack code nor a registered specialty pack) silently no-ops with zero console output -- no warn, no error -- violating Rule 8 (Log Everything). at lib/packLoader.ts:evictPack:294.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/packLoader.ts:evictPack:294
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F014 — severity 4 — error-handling

---

---

### Task #350: Fix security: The base-pack branch of loadPack has no entitlement check at all -- isPackUnlocked is enfo

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The base-pack branch of loadPack has no entitlement check at all -- isPackUnlocked is enforced only at the UI layer (LanguageGrid.tsx, app/page.tsx), unlike the specialty-pack branch which independently re-checks purchasedAddOns inside specialtyPackLoader.ts. Real asymmetric defense-in-depth between the two pack types. at lib/packLoader.ts:loadPack:92.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at lib/packLoader.ts:loadPack:92
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F023 — severity 5 — security

---

---

### Task #360: Fix code-quality: Zero callers outside its own export list and tests/packLoader.test.ts -- Rule 20b orphan-f

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Zero callers outside its own export list and tests/packLoader.test.ts -- Rule 20b orphan-function violation. at lib/packLoader.ts:getInstalledPacks:273.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packLoader.ts:getInstalledPacks:273
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F033 — severity 3 — code-quality

---

---

### Task #373: Fix documentation-trust: DEPENDS ON omits @/lib/specialtyPackLoader, @/lib/utils, @/lib/packTypes; USED BY omits st

**File:** lib/packLoader.ts:7-9,30
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
DEPENDS ON omits @/lib/specialtyPackLoader, @/lib/utils, @/lib/packTypes; USED BY omits store/entitlementStore.ts, which imports evictPack and getLoadedAddOns from this module. at lib/packLoader.ts:7-9,30:module header.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/packLoader.ts:7-9,30:module header
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F046 — severity 3 — documentation-trust

---

---

### Task #344: Fix security: The v2->v3 migration filters purchasedAddOns to string-typed elements only with no isSpeci

**File:** store/migrations.ts:159-163 vs lib/importBackup.ts:119-124
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The v2->v3 migration filters purchasedAddOns to string-typed elements only with no isSpecialtyPackCode registration/ready check, while lib/importBackup.ts validates both type AND registration for the identical field -- a real enforcement asymmetry between two code paths writing the same security-sensitive field. at store/migrations.ts:159-163 vs lib/importBackup.ts:119-124:ENTITLEMENT_MIGRATIONS v2->v3 / parseBackup.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at store/migrations.ts:159-163 vs lib/importBackup.ts:119-124:ENTITLEMENT_MIGRATIONS v2->v3 / parseBackup
- [ ] Audit passes: bash scripts/deep-audit.sh store/migrations.ts

**Source:** Audit finding F017 — severity 5 — security

---

---

### Task #354: Fix data-loss: unlockedPacks/purchasedAddOns entries that fail validation are silently dropped via .filte

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
unlockedPacks/purchasedAddOns entries that fail validation are silently dropped via .filter() with no log, no user-facing warning, and no counter analogous to validCardCount/skippedCardCount computed for cards two blocks above -- violates the stop-the-line rule against silently corrupting persisted user data. at lib/importBackup.ts:parseBackup:113.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at lib/importBackup.ts:parseBackup:113
- [ ] Audit passes: bash scripts/deep-audit.sh lib/importBackup.ts

**Source:** Audit finding F027 — severity 6 — data-loss

---

---

### Task #366: Fix code-quality: if (!LANG_PAIR_RE.test(rawLangPair) && rawLangPair !== "en-it") -- since LANG_PAIR_RE matc

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
if (!LANG_PAIR_RE.test(rawLangPair) && rawLangPair !== "en-it") -- since LANG_PAIR_RE matches "en-it" unconditionally, the second clause can never be false when the first is true; dead/redundant conditional. at lib/importBackup.ts:parseBackup:130.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/importBackup.ts:parseBackup:130
- [ ] Audit passes: bash scripts/deep-audit.sh lib/importBackup.ts

**Source:** Audit finding F039 — severity 3 — code-quality

---

---

### Task #372: Fix documentation-trust: USED BY names app/settings/page.tsx, which does not import this module directly; the real 

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
USED BY names app/settings/page.tsx, which does not import this module directly; the real direct importer, hooks/useExportImport.ts, is not named anywhere. at lib/importBackup.ts:module header:9.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/importBackup.ts:module header:9
- [ ] Audit passes: bash scripts/deep-audit.sh lib/importBackup.ts

**Source:** Audit finding F045 — severity 3 — documentation-trust

---
