# Stream W15D Task State

### Task #382: Fix code-quality: "SPECIALTY_PACKS is currently empty" claim is stale in three remaining files

**File:** tests/purchaseAddOnGuards.test.ts + hooks/useLangPack.test.ts + .autocode/agents/security.md
**Complexity:** ⚡ Direct — 3 files, no package boundary — kept Direct despite mechanically qualifying as Full (3 files) by /advance Complexity Audit: identical one-line comment fix repeated verbatim at each site, no design decision
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Rule 2 (Human Headers) violation. Originally 4 files; lib/packLoader.ts's copy was independently corrected during Task #378's remediation (audit F008) and now explicitly cross-references this task for the rest — verified 2026-07-18, no longer in scope here. The stale claim ("SPECIALTY_PACKS is currently empty" / "is Object.freeze([])" — false; lib/langRegistry.ts registers one live entry, it-medical, ready:false) remains in tests/purchaseAddOnGuards.test.ts:12, hooks/useLangPack.test.ts:49, and .autocode/agents/security.md. at tests/purchaseAddOnGuards.test.ts:12 + hooks/useLangPack.test.ts:49 + .autocode/agents/security.md.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at tests/purchaseAddOnGuards.test.ts:12 + hooks/useLangPack.test.ts:49 + .autocode/agents/security.md
- [ ] Audit passes: bash scripts/deep-audit.sh tests/purchaseAddOnGuards.test.ts

**Source:** Audit finding F006 — severity 3 — code-quality

---

