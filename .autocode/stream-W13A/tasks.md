# Stream W13A Task State

### Task #342: Fix security: Restoring a backup calls setEntitlement({...result.entitlement, licenseKey, instanceId}), 

**File:** hooks/useExportImport.ts:78-81 + store/entitlementStore.ts:82-100,146
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope type-contract fix — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
Restoring a backup calls setEntitlement({...result.entitlement, licenseKey, instanceId}), which includes purchasedAddOns; setEntitlement blindly spreads it into state with no purchaseAddOn/verify_addon_receipt call. Bounded by the honour-system entitlement model (CLAUDE.md Section 5) and purchaseAddOn's currently-dormant stub status (Task #295), but a real consistency gap worth closing before specialty content ships. at hooks/useExportImport.ts:78-81 + store/entitlementStore.ts:82-100,146:setEntitlement (backup restore path).
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at hooks/useExportImport.ts:78-81 + store/entitlementStore.ts:82-100,146:setEntitlement (backup restore path)
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useExportImport.ts

**Source:** Audit finding F015 — severity 5 — security

---

---

### Task #343: Fix code-quality: setEntitlement's declared parameter type omits purchasedAddOns entirely even though the on

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
setEntitlement's declared parameter type omits purchasedAddOns entirely even though the only call site (hooks/useExportImport.ts) passes it via object spread -- the declared contract is narrower than actual runtime behavior. at store/entitlementStore.ts:setEntitlement (type signature):82.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:setEntitlement (type signature):82
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F016 — severity 4 — code-quality

---

---

### Task #340: Fix architecture: Repeated, still-unfixed violation of CLAUDE.md Section 3 (localStorage must route through 

**File:** lib/constants.ts:16-34 + hooks/useExportImport.ts:25,67
**Complexity:** ⚡ Direct — 2 files, no package boundary, mechanical fix following the existing createPlatformStorage pattern — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14

**What:**
Repeated, still-unfixed violation of CLAUDE.md Section 3 (localStorage must route through lib/storage.ts) -- first flagged in the original 2026-07-09 Batch 12 audit. A second, previously-undetected instance found this cycle in hooks/useExportImport.ts, indicating the violation is systemic rather than contained to one file. at lib/constants.ts:16-34 + hooks/useExportImport.ts:25,67:getTargetLangCode/setTargetLangCode.
NEW

**Acceptance Criteria:**
- [ ] Fix architecture issue at lib/constants.ts:16-34 + hooks/useExportImport.ts:25,67:getTargetLangCode/setTargetLangCode
- [ ] Audit passes: bash scripts/deep-audit.sh lib/constants.ts

**Source:** Audit finding F013 — severity 6 — architecture

---

---

### Task #364: Fix code-quality: clearEntitlement is a public store action reachable from anywhere; two concurrent invocati

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
clearEntitlement is a public store action reachable from anywhere; two concurrent invocations redundantly compute and evict the same base langs, relying on an undocumented idempotency assumption. at store/entitlementStore.ts:clearEntitlement:155.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:clearEntitlement:155
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F037 — severity 4 — code-quality

---

---

### Task #338: Fix documentation-trust: clearEntitlement's final-sweep comment claims clearSpecialtyCache() handles the case of a 

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
clearEntitlement's final-sweep comment claims clearSpecialtyCache() handles the case of a specialty pack whose registry entry was removed between merge and deactivation -- false; that orphaned base language is also excluded from affectedBaseLangs (its SPECIALTY_PACKS.find() returns undefined), so evictPack never runs for it either. The memCache-eviction guarantee that is the entire point of Task #326 does not extend to this case, though the comment implies it does. at store/entitlementStore.ts:clearEntitlement:188.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at store/entitlementStore.ts:clearEntitlement:188
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F011 — severity 5 — documentation-trust

---

---

### Task #351: Fix error-handling: evictPack(...).catch() swallows failure and clearEntitlement's returned Promise always res

**File:** store/entitlementStore.ts:clearEntitlement:182-193 + hooks/useLicenseActivation.ts:84-85
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope fix — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
evictPack(...).catch() swallows failure and clearEntitlement's returned Promise always resolves; handleDeactivate awaits it then unconditionally reports successful deactivation even if the underlying memCache eviction failed. at store/entitlementStore.ts:clearEntitlement:182-193 + hooks/useLicenseActivation.ts:84-85:clearEntitlement / handleDeactivate.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at store/entitlementStore.ts:clearEntitlement:182-193 + hooks/useLicenseActivation.ts:84-85:clearEntitlement / handleDeactivate
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F024 — severity 5 — error-handling

---

---

### Task #362: Fix error-handling: useLangPack's useState initializer calls seedMemCache("it", ...) exactly once at mount wit

**File:** hooks/useLangPack.ts:73-84 + store/entitlementStore.ts:171-193
**Complexity:** 🔧 Full — kept Full 2026-07-13 by /advance Complexity Audit despite only 2 files: no clean fix pattern exists yet — either clearEntitlement must stop evicting the currently-active language's base memCache entry (no "unmerge specialty units only" primitive exists), or useLangPack needs a re-seed/recovery mechanism after eviction. Real architectural decision, not a mechanical fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14

**What:**
useLangPack's useState initializer calls seedMemCache("it", ...) exactly once at mount with no re-seed mechanism; clearEntitlement's evictPack can wipe memCache["it"] out from under a still-mounted component. Any specialty-pack load attempted afterward in the same session permanently fails with base_pack_not_loaded until a full page reload, with nothing signaling why. at hooks/useLangPack.ts:73-84 + store/entitlementStore.ts:171-193:useLangPack useState initializer / clearEntitlement.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at hooks/useLangPack.ts:73-84 + store/entitlementStore.ts:171-193:useLangPack useState initializer / clearEntitlement
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F035 — severity 6 — error-handling

---

---

### Task #363: Fix error-handling: useEntitlementStore.persist.rehydrate() is not wrapped in try/catch; a synchronous throw l

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
useEntitlementStore.persist.rehydrate() is not wrapped in try/catch; a synchronous throw leaves _rehydrateInFlight stuck true forever, permanently and silently disabling cross-tab sync for that tab. at store/entitlementStore.ts:_handleCrossTabStorageEvent:298.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at store/entitlementStore.ts:_handleCrossTabStorageEvent:298
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F036 — severity 5 — error-handling

---

---

### Task #347: Fix async: Drops any storage event arriving while a rehydrate is in flight and never re-triggers rehy

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
Drops any storage event arriving while a rehydrate is in flight and never re-triggers rehydrate() once it settles -- a second cross-tab write mid-rehydrate is never picked up until an unrelated future set() call happens to observe fresh state. at store/entitlementStore.ts:_handleCrossTabStorageEvent:293.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at store/entitlementStore.ts:_handleCrossTabStorageEvent:293
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F020 — severity 5 — async

---

---

### Task #336: Fix tests: Task #322's empty-receiptToken rejection has zero test coverage anywhere in tests/entitlem

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
Task #322's empty-receiptToken rejection has zero test coverage anywhere in tests/entitlement.test.ts -- deleting the guard breaks nothing. at store/entitlementStore.ts:purchaseAddOn:228.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at store/entitlementStore.ts:purchaseAddOn:228
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F009 — severity 5 — tests

---

---

### Task #349: Fix error-handling: receiptToken is validated only via .trim() non-empty check -- no max length or charset all

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
receiptToken is validated only via .trim() non-empty check -- no max length or charset allowlist, unlike the structurally identical license-key input in hooks/useLicenseActivation.ts which caps length and enforces a regex before any IPC call. at store/entitlementStore.ts:purchaseAddOn:232.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at store/entitlementStore.ts:purchaseAddOn:232
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F022 — severity 3 — error-handling

---

---

### Task #357: Fix requirements: purchaseAddOn has no check that licenseType === "subscription" before persisting a purchas

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** DEFERRED — see completion.md for rationale

**What:**
purchaseAddOn has no check that licenseType === "subscription" before persisting a purchase, unlike app/stats/page.tsx (the other Pro-gated call site) which correctly routes through isProEnabled(flag, licenseType) as CLAUDE.md/AGENTS.md mandate for all Pro-gated features. at store/entitlementStore.ts:purchaseAddOn:221.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at store/entitlementStore.ts:purchaseAddOn:221
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F030 — severity 5 — requirements

---

---

### Task #356: Fix requirements: BRAND.md states specialty packs are sold as add-ons within the Pro tier, but the Add-ons s

**File:** components/LanguageGrid.tsx:29-42 + store/entitlementStore.ts:110
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope fix (add a licenseType/isProEnabled check to the existing visibility gate) — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
BRAND.md states specialty packs are sold as add-ons within the Pro tier, but the Add-ons section's visibility gate (isPackUnlocked(sp.baseLang) || hasAddOn(sp.code)) has no licenseType check at all -- once SPECIALTY_PACKS gains a ready entry, every it-* add-on becomes visible/purchasable to a user who has never held Pro. at components/LanguageGrid.tsx:29-42 + store/entitlementStore.ts:110:specialtyPacks visibility gate / isPackUnlocked.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/LanguageGrid.tsx:29-42 + store/entitlementStore.ts:110:specialtyPacks visibility gate / isPackUnlocked
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F029 — severity 5 — requirements

---

---

### Task #334: Fix requirements: Task #308 widened onUpgradeClick to (code?: string) => void and LanguageGrid calls onUpgra

**File:** components/LanguageGrid.tsx:24,135 + app/page.tsx:79
**Complexity:** 🔧 Full — kept Full 2026-07-13 by /advance Complexity Audit despite only 2 files: this is a real product/architecture decision (does the code param wire to a real purchase flow via BuyModal, or get documented as an intentional no-op like #295?), not a mechanical fix — highest-severity (7), 5-auditor-convergence finding in this re-audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14

**What:**
Task #308 widened onUpgradeClick to (code?: string) => void and LanguageGrid calls onUpgradeClick(sp.code), but the only production caller (app/page.tsx:79) discards the argument entirely via a zero-arg closure -- Rule 20 violation (type-signature-only fix, no real caller wired). Five independent auditors (A, K, N, Red R, V) converged on this. at components/LanguageGrid.tsx:24,135 + app/page.tsx:79:onUpgradeClick.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/LanguageGrid.tsx:24,135 + app/page.tsx:79:onUpgradeClick
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F007 — severity 7 — requirements

---

---

### Task #339: Fix code-quality: console.error and setTargetLangCode (a localStorage write) execute directly in the hook's 

**File:** hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
console.error and setTargetLangCode (a localStorage write) execute directly in the hook's render body rather than inside a useEffect -- impure render function; under double-invoked renders (StrictMode) this can fire more than once, contradicting the adjacent comment's claim of 'at most once per corrupt value.' at hooks/useLangPack.ts:useLangPack:58.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useLangPack.ts:useLangPack:58
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F012 — severity 4 — code-quality

---

---

### Task #370: Fix documentation-trust: USED BY header is affirmatively false -- names app/learn/page.tsx and app/study/page.tsx a

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
USED BY header is affirmatively false -- names app/learn/page.tsx and app/study/page.tsx as importers though neither imports this module directly, while omitting six real direct importers (app/page.tsx, app/stats/page.tsx, hooks/useLangPack.ts, hooks/useExportImport.ts, hooks/useLicenseActivation.ts, components/EntitlementValidator.tsx). at store/entitlementStore.ts:module header:10.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at store/entitlementStore.ts:module header:10
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F043 — severity 5 — documentation-trust

---

---

### Task #371: Fix documentation-trust: DEPENDS ON header omits @/lib/specialtyPackLoader, @/lib/tauri, @/lib/licenseTypes despite

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14

**What:**
DEPENDS ON header omits @/lib/specialtyPackLoader, @/lib/tauri, @/lib/licenseTypes despite all three being actually imported. at store/entitlementStore.ts:module header:8.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at store/entitlementStore.ts:module header:8
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F044 — severity 3 — documentation-trust

---
