# Stream W17A Task State

### Task #407: Fix code-quality: registered-specialty-pack-code check hand-rolled in 5 files with no shared function

**File:** lib/langRegistry.ts, lib/importBackup.ts, store/migrations.ts, store/entitlementStore.ts, lib/packLoader.ts
**Complexity:** 🔧 Full — 5 files (relabeled by /advance Complexity Audit: 3+ files mechanically qualifies as Full)
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The registered-specialty-pack-code predicate (SPECIALTY_PACKS.some/find(sp => sp.code === X)) is independently reimplemented in lib/importBackup.ts:138, store/migrations.ts:181/186, store/entitlementStore.ts:200, and lib/packLoader.ts:328, each with a "keep in sync" comment instead of a shared import. Root cause is Task #74-class: isSpecialtyPackCode's name promises registration but checks registration+ready (see Task #421), which is why nothing already exports the registration-only predicate these 5 sites need. Add `isRegisteredSpecialtyCode(code)` to lib/langRegistry.ts and swap all 5 call sites to import it. at lib/langRegistry.ts:module-level:1.

**Acceptance Criteria:**
- [ ] `isRegisteredSpecialtyCode` exported from lib/langRegistry.ts, registration-only (no ready check)
- [ ] All 5 hand-rolled call sites replaced with the shared import
- [ ] Existing tests for each of the 5 call sites still pass unchanged in behavior

**Source:** Audit finding F001 — severity 5 — code-quality

---

### Task #408: Fix error-handling: getLangPair doesn't repair malformed values; getTargetLangCode's repair never persists

**File:** lib/constants.ts, hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
getLangPair() (lib/constants.ts:46-49) uses `??`, which only substitutes on null/undefined — a stored value of "" or hyphen-less garbage passes through unrepaired and unlogged, contradicting hasStoredLangPair's doc comment claiming "downstream getters repair malformed values with a logged fallback." Separately, getTargetLangCode()'s own repair is read-time-only and never persisted: Task #339's persist-repair effect in hooks/useLangPack.ts only fires when isKnownCode is false, but getTargetLangCode already silently substituted "it" by the time that effect reads it, so the repair never persists — console.error fires on every render forever for a tampered no-hyphen LANG_PAIR_KEY, and getLangPair() (consumed by hooks/useExportImport.ts) returns the raw corrupt string forever, permanently blocking backup restore. at lib/constants.ts:getLangPair:46.

**Acceptance Criteria:**
- [ ] getLangPair repairs a malformed stored value the same way getTargetLangCode does, with a logged fallback
- [ ] getTargetLangCode's repair is persisted (calls setTargetLangCode), not just returned
- [ ] Test: a no-hyphen corrupted LANG_PAIR_KEY is repaired once and does not re-log on every subsequent call

**Source:** Audit finding F002 — severity 5 — error-handling

---

### Task #414: Fix requirements: loader-level base-pack entitlement gate is expiry-blind

**File:** lib/packLoader.ts, hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 2 files, thread isPackUnlocked's computed result instead of the raw unlockedPacks array
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
lib/packLoader.ts:189-192's base-pack entitlement gate is a pure array-membership check on unlockedLangs; hooks/useLangPack.ts threads the raw persisted unlockedPacks array into it, not the computed isPackUnlocked() result (which applies validUntil+SUBSCRIPTION_GRACE_PERIOD_MS expiry logic). isPackUnlocked currently runs only inside components/LanguageGrid.tsx's render; app/page.tsx redirects returning users away from the picker once hasStoredLangPair() is true, so isPackUnlocked never runs again for them, and app/learn/page.tsx, app/study/page.tsx, hooks/useStatsData.ts never call it at all. unlockedPacks is never pruned on expiry. Currently fully unreachable (READY_PACK_CODES=[it], Italian is free) but code comments explicitly anticipate a second ready base pack. at lib/packLoader.ts:loadPack:189.

**Acceptance Criteria:**
- [ ] loadPack's entitlement gate for base packs is expiry-aware (routes through isPackUnlocked's logic, or unlockedPacks is pruned on lapse)
- [ ] Test: a lapsed-beyond-grace subscription is denied on the actual loader call path, not just in LanguageGrid's render
- [ ] No regression to the currently-passing free-pack path

**Source:** Audit finding F013 — severity 5 — requirements

---

### Task #424: Fix security: restored licenseKey/instanceId validated only by typeof, no length or charset check

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
lib/importBackup.ts:148 validates restored licenseKey/instanceId with only `typeof === "string"` — no length cap, no charset check — while hooks/useLicenseActivation.ts:25's format guard sits only in front of manual entry. A crafted backup JSON with an oversized or non-charset-conforming licenseKey bypasses the guard entirely via the restore path. at lib/importBackup.ts:parseBackup:148.

**Acceptance Criteria:**
- [ ] Restored licenseKey/instanceId are validated against the same format/length rule used at manual entry (shared constant/regex, see Task #423)
- [ ] Test: an oversized or invalid-charset licenseKey in a backup is rejected or sanitized on restore

**Source:** Audit finding F025 — severity 5 — security

---
