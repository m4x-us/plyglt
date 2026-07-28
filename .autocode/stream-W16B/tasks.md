# Stream W16B Task State

### Task #415: Fix error-handling: evictPack can never reject; clearEntitlement's defensive catch and re-throw are dead code

**File:** lib/packCache.ts, lib/packLoader.ts, store/entitlementStore.ts
**Complexity:** 🔧 Full — 3 files, decide whether evictPack should genuinely reject on failure or the dead branches should be removed
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Every eviction failure path in lib/packCache.ts's clearPackCache and _clearSpecialtyStorageKeys is console.error-only and uses Promise.allSettled internally, so evictPack can never reject. lib/packLoader.ts's own doc comment (~lines 312-321) asserts clearEntitlement's defensive .catch "remains live, not dead code" while the same block claims the returned promise "ALWAYS resolves" — a direct self-contradiction. store/entitlementStore.ts:231-234's .catch around evictPack(baseLang) is therefore unreachable, evictionErrors can never populate, and the `if (evictionErrors.length > 0) throw` block (248-252, attributed to Task #351) is dead code; hooks/useLicenseActivation.ts:87-93's "Deactivated. Restart the app to clear cached content." message can never fire. Separately, the sole production caller never inspects the `.evicted` discriminant Task #398's EvictPackResult fix exists to provide. at lib/packCache.ts:clearPackCache:235.

**Acceptance Criteria:**
- [ ] Decide and implement: either evictPack genuinely surfaces a real eviction failure (making the existing catch/re-throw/user-message chain live), or the dead catch/re-throw/message chain is removed and the doc comment corrected
- [ ] clearEntitlement's caller inspects EvictPackResult's `.evicted` discriminant if the fix is to have any real consumer
- [ ] doc comment at lib/packLoader.ts:evictPack no longer makes a self-contradicting claim
- [ ] Test proving whichever behavior is chosen (a genuine failure path is now observable, or the dead code is gone and nothing regresses)

**Source:** Audit finding F015 — severity 6 — error-handling (4-way independent auditor convergence)

---

### Task #420: Fix security: isProEnabled never checks subscription expiry unlike its sibling isPackUnlocked

**File:** lib/featureFlags.ts, store/entitlementStore.ts, components/LanguageGrid.tsx, app/stats/page.tsx
**Complexity:** 🔧 Full — 4 files, all 3 real call sites need to move to an expiry-aware check
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
isProEnabled (lib/featureFlags.ts:26) never checks subscription expiry, unlike its sibling store/entitlementStore.ts:126-151 isPackUnlocked, which enforces validUntil+grace. components/EntitlementValidator.tsx deliberately never resets licenseType on failed validation, relying entirely on isPackUnlocked's expiry check — but three real, live call sites use isProEnabled instead: store/entitlementStore.ts:302 (purchaseAddOn), components/LanguageGrid.tsx:50, and app/stats/page.tsx:17. A lapsed or cancelled subscriber who never manually deactivates stays Pro-gated-in indefinitely for add-on purchases and analytics, while correctly losing access to paid base packs. This gap is live TODAY, regardless of pack readiness (unlike Task #414/F013, which is currently dormant). at lib/featureFlags.ts:isProEnabled:26.

**Acceptance Criteria:**
- [ ] isProEnabled (or its 3 call sites) becomes expiry-aware, consistent with isPackUnlocked
- [ ] Test: a subscription past validUntil+grace is denied at all 3 call sites (purchaseAddOn, LanguageGrid, stats page)
- [ ] No regression to a currently-active subscription's Pro access

**Source:** Audit finding F020 — severity 6 — security

---

### Task #430: Fix security: hand-crafted unsigned backup import grants paid access without contacting the license server

**File:** hooks/useExportImport.ts, lib/importBackup.ts, store/entitlementStore.ts
**Complexity:** 🔧 Full — 3 files, cross-cutting import/entitlement boundary
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
A hand-crafted, unsigned backup JSON with arbitrary non-empty licenseKey/instanceId, licenseType:"subscription", unlockedPacks:["it","es"], validUntil:null passes parseBackup and is fed straight into setEntitlement, which never contacts the real license server. setEntitlement also stamps lastValidated:Date.now(), so needsValidation() returns false for the full 7-day SUBSCRIPTION_GRACE_PERIOD_MS, and validUntil:null is treated as "no expiry." Weighed explicitly against the owner-confirmed honour-system baseline (2026-06-24): a technically-savvy user can already grant themselves identical or greater access by editing their own persisted entitlement store directly, so this is not a new access ceiling — but it packages the exploit behind a legitimate, zero-skill in-app affordance (Settings > Import Backup) rather than requiring devtools access, dropping the skill floor to near zero and making the exploit a shareable file. at hooks/useExportImport.ts:readFile:81.

**Acceptance Criteria:**
- [ ] A restored backup's entitlement fields trigger re-validation against the real license server on next app foreground, rather than stamping lastValidated at import time (closing the free grace-period window)
- [ ] Test: importing a backup with an arbitrary licenseKey does not grant a full grace period before the next validation check
- [ ] Explicit product/owner sign-off recorded if the decision is to accept this as within the honour-system model rather than fix it (given entitlement is intentionally client-only by design)

**Source:** Audit finding F057 — severity 6 — security

---

### Task #411: Fix code-quality: purchased-but-since-unready specialty pack shows a "buy" CTA instead of its owned state

**File:** components/LanguageGrid.tsx, components/LanguageGrid.test.tsx
**Complexity:** ⚡ Direct — 2 files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
components/LanguageGrid.tsx:141-142 decides which button to render via `purchased && sp.ready`: if a user owns a specialty pack that later becomes unready, they fall into the unowned branch — shown "Coming soon" plus a PRICING.annual buy CTA (wired to onUpgradeClick) despite already having paid. This contradicts the codebase's own stated "readiness gates purchasing/loading, not retention" policy (Task #384, encoded in store/migrations.ts and lib/importBackup.ts). The pack's visibility gate (line 62-64) already respects the policy; only the button/CTA selection doesn't. No test exercises purchased+unready. at components/LanguageGrid.tsx:render:141.

**Acceptance Criteria:**
- [ ] A purchased pack that has gone unready shows an owned/no-purchase-needed state, never the buy CTA
- [ ] Test: purchased+unready renders distinctly from unpurchased+unready
- [ ] Product decision on the exact copy/behavior for this state may be needed — flag to owner if ambiguous

**Source:** Audit finding F008 — severity 6 — code-quality

---
