# Stream W18C Task State

### Task #422: Fix code-quality: BackupEntitlement's purchasedAddOns validation is dead wiring — no production caller destructures it

**File:** lib/importBackup.ts, hooks/useExportImport.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
lib/importBackup.ts validates and logs purchasedAddOns into BackupEntitlement, but the sole production caller, hooks/useExportImport.ts:81, never destructures it — 4 tests verify a value with no live effect on any real restore path. This is intentional by design (add-ons cannot be restored from an unsigned backup, see Task #422's sibling F069 below) but the validation logic itself is currently dead wiring. Either document this explicitly as intentional dead code with a comment at the validation site, or remove the unused validation. at lib/importBackup.ts:parseBackup:130.

**Acceptance Criteria:**
- [ ] A comment at lib/importBackup.ts's purchasedAddOns validation explicitly states it is validated-but-intentionally-unused (cross-referencing the security rationale), or the validation is removed
- [ ] No change to the actual restore behavior (purchasedAddOns still cannot be restored from a backup)

**Source:** Audit finding F023 — severity 4 — code-quality

---

### Task #437: Fix async: no guard against concurrent backup imports

**File:** hooks/useExportImport.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
hooks/useExportImport.ts:readFile:48-106 has no guard against concurrent imports — two rapid handleImportFile/readFile calls run independent FileReader instances with no in-flight lock; final SRS/entitlement state is whichever FileReader resolves last, and the displayed dataStatus can describe the wrong import. at hooks/useExportImport.ts:readFile:48.

**Acceptance Criteria:**
- [ ] A second import call while one is in flight is either queued, rejected with a clear message, or otherwise made safe
- [ ] Test: two rapid concurrent import calls produce a deterministic, correctly-attributed final state

**Source:** Audit finding F064 — severity 4 — async

---

### Task #439: Fix code-quality: PackMemCache.write is typed synchronous/void but performs hidden async storage I/O

**File:** lib/packCache.ts, lib/packTypes.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
write(lang, pack):void (lib/packTypes.ts's PackMemCache interface, implemented at lib/packCache.ts:113-122) is typed as synchronous/void, but the concrete implementation also fires _clearSpecialtyStorageKeys, an async function performing platform-storage removeItem I/O — a caller relying on the interface contract has no signal that write() triggers disk/Tauri-store mutations as a side effect. at lib/packCache.ts:PackMemCacheImpl.write:113.

**Acceptance Criteria:**
- [ ] write()'s type signature or doc comment makes the hidden async I/O side effect visible to callers
- [ ] No behavior change required — this is a contract-honesty fix, not a functional one

**Source:** Audit finding F068 — severity 4 — code-quality

---
