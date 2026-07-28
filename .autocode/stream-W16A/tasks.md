# Stream W16A Task State

### Task #409: Fix concurrency: specialtyPackLoader's hand-rolled generation guard is asymmetrically hardened vs basePackLoader's shared primitive

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, migrate to createGenerationGuard() and move the check to bracket the storage writes
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
lib/specialtyPackLoader.ts:42-51 hand-rolls a generation counter instead of using lib/generationGuard.ts's createGenerationGuard(), already adopted by lib/basePackLoader.ts. Beyond style duplication, the hand-rolled check in _mergeFromJson (114-117) happens before memCache.merge and well before its own writeCacheMeta/writeCacheData awaits — an asymmetric hardening of the identical race class that lib/basePackLoader.ts:223-230 was specifically fixed to close (a second generation check bracketing the post-download storage writes). lib/generationGuard.ts:12-13 names this outright as a tracked, not-yet-closed carry-forward. at lib/specialtyPackLoader.ts:_mergeFromJson:114.

**Acceptance Criteria:**
- [ ] specialtyPackLoader.ts's deactivationGeneration replaced with createGenerationGuard()
- [ ] A second generation check brackets the post-write storage awaits, mirroring basePackLoader.ts:223-230
- [ ] Test: an eviction landing during the post-download storage writes is rejected, mirroring the existing basePackLoader regression test for the same race

**Source:** Audit finding F004 — severity 6 — concurrency (ESCALATE — ran 4 prior cycles unresolved as a duplication note before this cycle identified the live race)

---

### Task #410: Fix security: specialty pack offline/no-manifest fallback never re-verifies sha256 against the recorded cache hash

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, mirror basePackLoader's staleBytesMatchRecordedHash pattern
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
lib/specialtyPackLoader.ts:_doLoad's four offline/no-manifest fallback branches (~lines 224, 237-239, 250, 256) call _mergeFromJson with manifestEntry=null and zero verification against the sha256 recorded in cachedMeta at cache time — asymmetric with lib/basePackLoader.ts's staleBytesMatchRecordedHash() fix, added specifically so the module's "verifies" promise holds on the offline path too. This is security.md's tracked S2 finding (security.md's stated reason was stale/inaccurate — add-on packs DO have their own storage keys since Task #269; the real gap is missing re-verification of an existing cache, not an absent one). Currently dormant (SPECIALTY_PACKS's sole entry is ready:false) but must close before any specialty pack ships ready:true. at lib/specialtyPackLoader.ts:_doLoad:224.

**Acceptance Criteria:**
- [ ] All four offline/no-manifest branches call a shared staleBytesMatchRecordedHash-equivalent before merging cached bytes
- [ ] Test: stale specialty-pack bytes that no longer match their recorded hash are refused, mirroring the base-pack regression test
- [ ] security.md's S2 entry corrected to name the actual gap and cite the fix

**Source:** Audit finding F007 — severity 6 — security

---
