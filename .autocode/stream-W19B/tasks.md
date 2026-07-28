# Stream W19B Task State

### Task #442: Fix correctness: unpurchased-specialty redirect fires before entitlement-store hydration completes, permanently corrupting the persisted language selection

**File:** hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 1 file, gate the render-body computation and repair effect on the same entitlementHydrated flag already used elsewhere in this file
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
`unpurchasedSpecialty` is computed in the render body from `purchasedAddOns` with no gate on `entitlementHydrated` — that flag only gates a separate dynamic-load effect. Before the entitlement store finishes async hydration, `purchasedAddOns` is the Zustand default `[]`. If the persisted `LANG_PAIR_KEY` is a genuinely-owned ready specialty code, this computes `unpurchasedSpecialty` as truthy, and the repair effect immediately calls `setTargetLangCode(targetLang)`, permanently overwriting the user's real paid selection in persistent storage — since the effect's own guard is `rawTargetLang===targetLang`, once the fallback is persisted the bug never self-corrects even after real hydration completes with the true ownership data. Currently dormant (no specialty pack is `ready:true` yet) but will hit real paying customers the moment one ships, especially on Tauri (async IPC store) or slow web hydration. This is the same "fix the named instance, miss the sibling" pattern as Task #414, which fixed the identical hydration-gating omission for a different piece of entitlement state in this same file. at hooks/useLangPack.ts:useLangPack:110.

**Acceptance Criteria:**
- [ ] The render-body `unpurchasedSpecialty` computation and its repair effect are gated on `entitlementHydrated` (or `hydrationGraceExpired`), mirroring the existing dynamic-load effect's gate
- [ ] Test: a genuinely-owned ready specialty code in `LANG_PAIR_KEY`, with the entitlement store not yet hydrated, is NOT redirected/persisted away from the owned pack — only redirected once hydration confirms non-ownership
- [ ] The repair effect's log message (line 191) no longer asserts a confident permanent diagnosis when the underlying read may be pre-hydration

**Source:** Audit finding F001 — severity 6 — correctness/data-integrity (2-way independent auditor convergence)

---

### Task #449: Fix security: createPurchaseAddOn has no post-await deactivation-guard re-check

**File:** store/entitlementAddOns.ts
**Complexity:** ⚡ Direct — 1 file, mirror the existing deactivationGuard pattern from lib/specialtyPackLoader.ts
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The Pro/entitlement gate (isProEnabled) is checked once at function entry, then the function awaits a network round-trip (verify_addon_receipt IPC) before unconditionally appending code to purchasedAddOns via a functional set() — with no generation/deactivation-guard re-check after the await, unlike the sibling specialty-pack-load path (lib/specialtyPackLoader.ts's deactivationGuard, added specifically for this exact class of bug per Task #394/#409). If clearEntitlement() resolves while a purchaseAddOn IPC call is in flight, the functional set() reads the current (post-deactivation, reset-to-[]) state and re-adds code to it, silently resurrecting a purchase record after the license was cleared. Dormant since purchaseAddOn is an intentional stub (#295), but the gate gap is real and structurally asymmetric with an established pattern in this same codebase. at store/entitlementAddOns.ts:createPurchaseAddOn:120.

**Acceptance Criteria:**
- [ ] createPurchaseAddOn re-checks a deactivation/generation guard (mirroring lib/specialtyPackLoader.ts's pattern) immediately before the functional set() that appends the purchased code
- [ ] Test: a clearEntitlement() resolving while a purchaseAddOn IPC call is in flight does not resurrect the purchase record

**Source:** Audit finding F022 — severity 5 — security/rule-19b-symmetry

---

### Task #446: Fix correctness: getLangPair's repair doesn't actually match getTargetLangCode's, risking a silently corrupted storage key

**File:** lib/constants.ts, tests/constants.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
getLangPair's doc comment claims parity with getTargetLangCode's malformed-value repair, but getLangPair only checks indexOf("-")===-1, missing the empty-tail case — a stored "en-" has a hyphen so it skips repair and is returned unrepaired and unlogged. This feeds directly into store/srsStore.ts's persisted storage key (srs-${_activeLangPair}), producing a malformed key like "srs-en-" instead of "srs-en-it". tests/constants.test.ts has an "en-" case for getTargetLangCode but not for getLangPair — the same gap exists in both code and test. at lib/constants.ts:getLangPair:82.

**Acceptance Criteria:**
- [ ] getLangPair repairs an empty-tail value ("en-") the same way getTargetLangCode does, with a logged fallback
- [ ] Test: a stored "en-" value is repaired and logged, matching the existing getTargetLangCode test for the same shape of input

**Source:** Audit finding F008 — severity 6 — correctness/rule-22d-parity

---
