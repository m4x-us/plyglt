# Stream W10A Task State

### Task #269: Fix data-loss: Specialty packs are never given their own persisted storage key at all; loadSpecialtyPack

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Specialty packs are never given their own persisted storage key at all; loadSpecialtyPack never calls writeCacheData/writeCacheMeta for the specialty code itself, merging directly into the base pack's in-memory entry only. There is no separate cache entry to evict or independently re-verify even in principle, beyond the evictPack type-guard bug (F008). at lib/specialtyPackLoader.ts:loadSpecialtyPack:67.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at lib/specialtyPackLoader.ts:loadSpecialtyPack:67
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F009 — severity 6 — data-loss

---
