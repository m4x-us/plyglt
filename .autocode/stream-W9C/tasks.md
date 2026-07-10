# Stream W9C Task State

### Task #274: Fix data-loss: The same shallow Array.isArray-only validation gap identified in F013 recurs a third time

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The same shallow Array.isArray-only validation gap identified in F013 recurs a third time at store/migrations.ts:133, the v1 unlockedPacks guard -- a repeating pattern within the same file, not a first occurrence. at store/migrations.ts:ENTITLEMENT_MIGRATIONS[1] (v1 unlockedPacks guard):133.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at store/migrations.ts:ENTITLEMENT_MIGRATIONS[1] (v1 unlockedPacks guard):133
- [ ] Audit passes: bash scripts/deep-audit.sh store/migrations.ts

**Source:** Audit finding F014 — severity 4 — data-loss

---

### Task #289: Fix data-loss: Backup/restore has no purchasedAddOns field at all. Fails closed (a legitimate purchaser l

**File:** Multiple — see What (corrected during Wave 9 planning: lib/entitlement.ts does not contain the backup/restore path; the real serialization lives in lib/exportBackup.ts and lib/importBackup.ts, which defines BackupEntitlement)
**Complexity:** ⚡ Direct — 2 files (lib/exportBackup.ts, lib/importBackup.ts), no package boundary, single-scope field addition
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Backup/restore has no purchasedAddOns field at all. Fails closed (a legitimate purchaser loses add-on entitlement on restore) rather than open -- not a security flaw but a real data-loss defect for a paying user. at lib/importBackup.ts:BackupEntitlement interface (line 25) and its construction at line 107; lib/exportBackup.ts:13/26-31 serializes entitlementState without a purchasedAddOns field.
NEW

**Acceptance Criteria:**
- [ ] Add `purchasedAddOns: string[]` to the `BackupEntitlement` interface in lib/importBackup.ts
- [ ] lib/exportBackup.ts includes `purchasedAddOns` in the serialized entitlement object
- [ ] lib/importBackup.ts validates/sanitizes restored purchasedAddOns using the same element-shape filter pattern Task #273 introduced in store/migrations.ts (Array.isArray check + per-element typeof === "string" filter)
- [ ] Audit passes: bash scripts/deep-audit.sh lib/exportBackup.ts lib/importBackup.ts

**Source:** Audit finding F029 — severity 4 — data-loss

---
