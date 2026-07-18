# Stream W14A Task State

### Task #377: Fix requirements: loadPack's non-free base-pack entitlement gate (unlockedLangs) has zero production callers

**File:** hooks/useLangPack.ts:111 + lib/packLoader.ts:126
**Complexity:** ⚡ Direct — 2 files, no package boundary, mechanical wire-through mirroring the already-correct purchasedAddOns pattern in the same call (thread useEntitlementStore's unlockedPacks into the existing loadPack call)
**Owner:** Adam (W14A)
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-16 (commit afae4f9)

**What:**
Rule 20b (orphan-caller) violation. loadPack's non-free base-pack entitlement gate at lib/packLoader.ts:126 checks `(options?.unlockedLangs ?? []).includes(lang)`, but the only production caller, hooks/useLangPack.ts:111, calls `loadPack(targetLang, manifest, { purchasedAddOns })` and never passes unlockedLangs. Dormant only because READY_PACK_CODES currently contains just "it", which is also free. The moment a second base pack ships ready:true, every legitimately-subscribed user hits invalid_lang forever. hooks/useLangPack.test.ts asserts against the broken call signature, so no test would fail if this gap persists. Independently found by 6 of 7 scored auditors plus the naive-reader lane — the strongest convergence in this audit. at hooks/useLangPack.ts:111 + lib/packLoader.ts:126:loadPack / useLangPack.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useLangPack.ts:111 + lib/packLoader.ts:126:loadPack / useLangPack
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F001 — severity 8 — requirements

---

### Task #378: Fix requirements: selecting a specialty pack never seeds its base pack, so loadSpecialtyPack permanently fails

**File:** hooks/useLangPack.ts:73 + components/LanguageGrid.tsx:137 + app/page.tsx:33-37
**Complexity:** 🔧 Full — 3 files and a real design decision (does handleSelect/useLangPack detect a specialty code and seed+load its base pack first, or does useLangPack's STATIC_PACKS-keyed seeding logic need to resolve a specialty code to its baseLang before checking STATIC_PACKS) — not a mechanical fix
**Owner:** Adam (W14A)
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-17 (commit 8f6c634; audit PASS 2 cycles; WorldClass 95/100 cycle 4)

**What:**
The useState initializer in useLangPack only seeds memCache via STATIC_PACKS[targetLang], which has exactly one key ("it"). Selecting a specialty pack tile calls components/LanguageGrid.tsx:137's onSelect(sp.code), routed through app/page.tsx:33-37's handleSelect to a full-reload navigation with the specialty code as targetLang. The base pack is never seeded in that case, so loadSpecialtyPack's memCache.has(baseLang) precondition (lib/specialtyPackLoader.ts:269) permanently fails with base_pack_not_loaded. Dormant only because SPECIALTY_PACKS' one entry has ready:false; the UI path that triggers it (LanguageGrid's Add-ons section) already exists and is live. at hooks/useLangPack.ts:73 + components/LanguageGrid.tsx:137 + app/page.tsx:33-37:useLangPack useState initializer / handleSelect.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useLangPack.ts:73 + components/LanguageGrid.tsx:137 + app/page.tsx:33-37:useLangPack useState initializer / handleSelect
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F002 — severity 7 — requirements

---

### Task #379: Fix security: fetchManifest's !res.ok branch has zero logging and the manifest has no shape validation

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Adam (W14A)
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-17 (commit 97224ff; spot check WARN, all sev<=2 resolved or debt-logged)

**What:**
Rule 8 (Log Everything) violation. The `if (!res.ok) return null;` branch at fetchManifest:74 has zero logging, unlike the catch block below it which logs MANIFEST_FETCH_FAIL. Additionally the parsed manifest has no structural shape validation anywhere in the codebase. A CDN error envelope returned as HTTP 200 with a malformed JSON body would be treated as "no manifest available" and silently skip sha256 verification on every fresh pack download, with zero operator-visible log signal. at lib/packLoader.ts:fetchManifest:74.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at lib/packLoader.ts:fetchManifest:74
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F003 — severity 6 — security

---

### Task #389: Fix code-quality: app/page.tsx calls window.localStorage directly, violating lib/constants.ts's sole-authorized-caller rule

**File:** app/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Adam (W14A)
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-17 (commit below; hasStoredLangPair added — getLangPair() itself would have broken first-run redirect semantics)

**What:**
Direct window.localStorage.getItem(LANG_PAIR_KEY) call instead of getLangPair(), violating lib/constants.ts's own documented invariant that it is "the SOLE AUTHORIZED CALLER of window.localStorage for LANG_PAIR_KEY." A live, non-dormant rule violation caught by the unprimed naive-reader lane, missed by all 7 scored auditors. at app/page.tsx:LanguagePicker:29.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at app/page.tsx:LanguagePicker:29
- [ ] Audit passes: bash scripts/deep-audit.sh app/page.tsx

**Source:** Audit finding F013 — severity 4 — code-quality

---

### Task #380: Fix code-quality: isReadySpecialtyPackCode/isSpecialtyPackCode naming split still unresolved (Task #361 never executed)

**File:** lib/langRegistry.ts + lib/packLoader.ts + hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 3 files, no package boundary — kept Direct despite mechanically qualifying as Full (3 files) by /advance Complexity Audit: purely a rename-to-canonical + delete-alias, no design decision, all 3 call sites already identified above
**Owner:** Adam (W14A)
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-17 (commit 4713d33; alias deleted, 5 mocks re-keyed, 2 shared-file fixes uncommitted for owning streams)

**What:**
isReadySpecialtyPackCode is a bare alias for isSpecialtyPackCode; its own doc comment calls for migration via Task #361, which was never executed. lib/packLoader.ts:38,105 and hooks/useLangPack.ts:9,123 still import and call the deprecated alias while store/entitlementStore.ts, lib/importBackup.ts, and store/migrations.ts use the canonical name. Two names for one function with no behavioral difference. at lib/langRegistry.ts:isReadySpecialtyPackCode:99.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/langRegistry.ts:isReadySpecialtyPackCode:99
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F004 — severity 3 — code-quality

---

### Task #398: Fix error-handling: evictPack's specialty/garbage-code no-op is indistinguishable from success at the call site

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Adam (W14A)
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-17 (typed EvictPackResult; #402 double-log resolved as a consequence)

**What:**
evictPack's doc comment accurately states the returned Promise for specialty/garbage-code inputs "ALWAYS resolves — no throw, no rejection" — but for those inputs the function is a no-op after logging, indistinguishable from a successful eviction at the call site unless the caller inspects console output. at lib/packLoader.ts:evictPack:299.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/packLoader.ts:evictPack:299
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F022 — severity 3 — error-handling

---

### Task #403: Fix code-quality: LanguageGrid's Add-ons section visibility check redundantly re-verifies an already-folded flag

**File:** components/LanguageGrid.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Adam (W14A)
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-17 (commit e43adea; audit premise was half-wrong — flag folded into the list instead, preserving the load-bearing owned+flag-off case)

**What:**
`specialtyPacksEnabled && specialtyPacks.length > 0` re-checks a flag already folded into specialtyPacks' own filter: specialtyPacks filters by `hasAddOn(sp.code) || (isPro && isPackUnlocked(sp.baseLang))`, and isPro is itself `isProEnabled(specialtyPacksEnabled, licenseType)`. The redundant check is easy to misread as an independent gate. at components/LanguageGrid.tsx:128.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at components/LanguageGrid.tsx:128
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F027 — severity 2 — code-quality

---


### CARRY-FORWARD (W14A → next wave, needs global task number at consolidation): Fix error-handling: unguarded sha256Hex in lib/specialtyPackLoader.ts

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, wrap two await sha256Hex sites in try/catch with ref-ID log + typed checksum_mismatch return
**Owner:** — (MUST go to the stream owning lib/specialtyPackLoader.ts — off-limits to W14A)
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
#378 audit F028 (severity 5): sha256Hex calls at lib/specialtyPackLoader.ts:198 (cached-copy verify) and :252 (fresh add-on verify) are outside any try/catch — a crypto.subtle failure rejects the shared in-flight promise for every concurrent specialty requester instead of returning the typed { ok:false } contract every other branch honors. Exact sibling of the base-loader defect fixed in Task #378 cycle 2 (lib/basePackLoader.ts SHA_VERIFY_FAIL pattern) — copy that fix shape.

**Acceptance Criteria:**
- [ ] Both sha256Hex sites wrapped; failure logs a ref-ID and returns { ok:false, error:"checksum_mismatch" }
- [ ] Test proving a throwing crypto.subtle surfaces as a typed error, not a rejection

**Source:** Audit finding F028 (Task #378 cycle 1) — severity 5 — error-handling

---

### CARRY-FORWARD (W14A → next wave, needs global task number at consolidation): Fix async: useIsHydrated hydration-completion race + no-finish-on-failure hang (lib/storage.ts)

**File:** lib/storage.ts
**Complexity:** ⚡ Direct — 1 file: re-check store.persist.hasHydrated() inside the effect before subscribing, and document/handle the zustand persist behavior where hydration NEVER finishes when storage.getItem rejects
**Owner:** — (lib/storage.ts is outside W14A ownership)
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
#378 cycle-2 findings N1/F-C2-3/F-C2-2 (severity 5 combined): (a) useIsHydrated snapshots hasHydrated() at render and subscribes to onFinishHydration in an effect — hydration completing in that window strands hydrated=false forever (onFinishHydration does not fire for already-finished hydration); (b) zustand persist's failure path (storage.getItem rejection) never sets hasHydrated and never fires onFinishHydration, so useIsHydrated can NEVER become true after a hydration failure. hooks/useLangPack.ts now depends on this hook for its entitlement gate — it carries a 3s grace-timeout fallback (HYDRATION_GRACE_MS) as a local mitigation, but every OTHER useIsHydrated consumer (app/learn/page.tsx gating on useSRSStore, etc.) is exposed to a permanent false. Fix at root in useIsHydrated: re-check hasHydrated() inside the effect before subscribing; consider surfacing hydration failure explicitly.

**Acceptance Criteria:**
- [ ] Effect re-checks hasHydrated() before subscribing (closes the subscribe race)
- [ ] Behavior on hydration FAILURE is explicit and tested (documented terminal state, not a silent forever-false)
- [ ] Test that completes hydration between render and effect and asserts hydrated flips true

**Source:** Audit findings N1 + F-C2-2/F-C2-3 (Task #378 cycle 2) — severity 5 — async

---
