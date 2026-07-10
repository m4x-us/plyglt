# Stream W10C Task State

### Task #283: Fix tests: LanguageGrid.test.tsx's specialty-pack tests inject hasAddOn as a directly-controlled mock

**File:** components/LanguageGrid.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
LanguageGrid.test.tsx's specialty-pack tests inject hasAddOn as a directly-controlled mock prop; they never drive the real entitlementStore or the real loadPack chain. Would not catch a regression that deleted the UI lock entirely, nor the absence of data-layer enforcement. at components/LanguageGrid.test.tsx:specialty-pack test suite:1.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at components/LanguageGrid.test.tsx:specialty-pack test suite:1
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.test.tsx

**Source:** Audit finding F023 — severity 5 — tests

---
