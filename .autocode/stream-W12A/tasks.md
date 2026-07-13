# Stream W12A Task State

### Task #295: Fix requirements: purchaseAddOn calls invoke('verify_addon_receipt', {code, receiptToken}); that Tauri comma

**File:** store/entitlementStore.ts
**Complexity:** 🔧 Full — needs an owner decision before any fix: either implement the real verify_addon_receipt Tauri command (new src-tauri Rust code + generate_handler! registration), or leave the backend unbuilt and instead wire a real frontend purchase path (BuyModal/LanguageGrid changes) so purchaseAddOn has an actual caller
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
purchaseAddOn calls invoke('verify_addon_receipt', {code, receiptToken}); that Tauri command does not exist anywhere in src-tauri's generate_handler! list or license.rs. No runtime can ever return {ok:true}. Also has zero callers outside tests/ -- LanguageGrid's locked specialty-tile CTA opens the generic BuyModal with no per-add-on code or receipt-delivery mechanism. Violates Rule 20. at store/entitlementStore.ts:purchaseAddOn:163.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at store/entitlementStore.ts:purchaseAddOn:163
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F001 — severity 8 — requirements

---

---

### Task #322: Fix security: receiptToken is forwarded to invoke() with zero format, length, or non-empty validation be

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
receiptToken is forwarded to invoke() with zero format, length, or non-empty validation before the IPC call; there is no established input-sanitization boundary for it. at store/entitlementStore.ts:purchaseAddOn:163.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at store/entitlementStore.ts:purchaseAddOn:163
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F028 — severity 3 — security

---

---

### Task #300: Fix code-quality: lib/entitlement.ts's hasAddOn doc comment directs this action to delegate rather than dupl

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
lib/entitlement.ts's hasAddOn doc comment directs this action to delegate rather than duplicate; instead it independently reimplements the identical check. lib/entitlement.ts's own hasAddOn has zero callers outside tests/. at store/entitlementStore.ts:hasAddOn:157.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:hasAddOn:157
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F006 — severity 3 — code-quality

---

---

### Task #303: Fix code-quality: The cross-tab race mitigation defends against two browser tabs both completing a purchase,

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The cross-tab race mitigation defends against two browser tabs both completing a purchase, a scenario that per F001 cannot occur today because purchaseAddOn cannot succeed in any runtime. at store/entitlementStore.ts:_handleCrossTabStorageEvent:199.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:_handleCrossTabStorageEvent:199
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F009 — severity 2 — code-quality

---

---

### Task #304: Fix async: The cross-tab fix fires rehydrate() fire-and-forget with no lock or serialization against 

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The cross-tab fix fires rehydrate() fire-and-forget with no lock or serialization against a concurrent purchaseAddOn set() call, so the doc comment's guarantee against a lost-write race is not actually met. Tests only assert rehydrate is called, never that the race itself is closed. at store/entitlementStore.ts:_handleCrossTabStorageEvent:209.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at store/entitlementStore.ts:_handleCrossTabStorageEvent:209
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F010 — severity 6 — async

---
