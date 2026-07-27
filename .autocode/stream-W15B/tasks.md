# Stream W15B Task State

### Task #383: Fix data-loss: v0->v1 unlockedPacks migration lacks the registration check its v3 sibling has

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The v0->v1 unlockedPacks migration filters elements to typeof==="string" only — it does not check pack-code registration. The sibling v2->v3 purchasedAddOns migration three entries later (Task #344) was explicitly hardened to also require isSpecialtyPackCode(item), and lib/importBackup.ts's equivalent unlockedPacks filter uses isValidPackCode. The v1 migration also logs nothing on drop, unlike importBackup.ts's IMPORT-SKIP-PACKS warning. Same "one call site hardened, sibling left exposed" pattern (Rule 19b) this team has previously logged as recurring. at store/migrations.ts:ENTITLEMENT_MIGRATIONS[1]:137.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at store/migrations.ts:ENTITLEMENT_MIGRATIONS[1]:137
- [ ] Audit passes: bash scripts/deep-audit.sh store/migrations.ts

**Source:** Audit finding F007 — severity 5 — data-loss

---

### Task #406: Fix async: useIsHydrated hydration-completion race + no-finish-on-failure hang (lib/storage.ts)

**File:** lib/storage.ts
**Complexity:** ⚡ Direct — 1 file: re-check store.persist.hasHydrated() inside the effect before subscribing, and document/handle the zustand persist behavior where hydration NEVER finishes when storage.getItem rejects
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Two combined findings from Task #378 cycle 2 (a) useIsHydrated snapshots hasHydrated() at render and subscribes to onFinishHydration in an effect — hydration completing in that window strands hydrated=false forever (onFinishHydration does not fire for already-finished hydration); (b) zustand persist's failure path (storage.getItem rejection) never sets hasHydrated and never fires onFinishHydration, so useIsHydrated can NEVER become true after a hydration failure. hooks/useLangPack.ts now depends on this hook for its entitlement gate — it carries a 3s grace-timeout fallback (HYDRATION_GRACE_MS) as a local mitigation, but every OTHER useIsHydrated consumer (app/learn/page.tsx gating on useSRSStore, etc.) is exposed to a permanent false. Fix at root in useIsHydrated: re-check hasHydrated() inside the effect before subscribing; consider surfacing hydration failure explicitly.

**Acceptance Criteria:**
- [ ] Effect re-checks hasHydrated() before subscribing (closes the subscribe race)
- [ ] Behavior on hydration FAILURE is explicit and tested (documented terminal state, not a silent forever-false)
- [ ] Test that completes hydration between render and effect and asserts hydrated flips true

**Source:** Carry-forward from Task #378 (Wave 14, Stream W14A) — Audit findings N1 + F-C2-2/F-C2-3 — severity 5 — async

---

