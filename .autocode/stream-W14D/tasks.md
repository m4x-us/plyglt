# Stream W14D Task State

### Task #399: Fix tests: articles-regex test only proves RegExp instance type, not the correct regex per language

**File:** tests/langRegistry.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status: COMPLETE — 2026-07-16**
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE

**What:**
Rule 18 (B7) gap. "every ready language has an articles regex" only proves articles is a RegExp instance, not that it is the correct regex for that language — a swapped wrong regex (e.g. Italian's articles regex substituted for Spanish's) would still pass this assertion. at tests/langRegistry.test.ts:35.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/langRegistry.test.ts:35
- [ ] Audit passes: bash scripts/deep-audit.sh tests/langRegistry.test.ts

**Source:** Audit finding F023 — severity 3 — tests

---

### Task #404: Fix code-quality: app/settings/page.tsx still uses the deprecated ALL_KNOWN_PACKS export instead of ALL_PACK_CODES

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status: COMPLETE — 2026-07-16**
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE

**What:**
store/entitlementStore.ts re-exports ALL_PACK_CODES as ALL_KNOWN_PACKS with an explicit @deprecated tag directing callers to use ALL_PACK_CODES from @/lib/langRegistry directly. app/settings/page.tsx still imports and uses the deprecated ALL_KNOWN_PACKS name instead — the deprecation notice is unenforced at its one call site. at app/settings/page.tsx:module:1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at app/settings/page.tsx:module:1
- [ ] Audit passes: bash scripts/deep-audit.sh app/settings/page.tsx

**Source:** Audit finding F028 — severity 2 — code-quality

---

