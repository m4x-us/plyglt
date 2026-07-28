# Stream W18A Task State

### Task #436: Fix concurrency: basePackLoader's eviction-generation guard is a single global counter, not per-language

**File:** lib/basePackLoader.ts
**Complexity:** ⚡ Direct — 1 file, key the guard by language
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
lib/basePackLoader.ts:52-64's evictionGuard is a single global generation counter, not per-language: evictPack("es") bumps the generation and causes an unrelated, already in-flight loadPack("it") (a second concurrently-mounted useLangPack instance) to skip its own cache write — "it" still returns correct data this call but is silently forced to re-download on every subsequent load until the next successful write. at lib/basePackLoader.ts:evictionGuard:52.

**Acceptance Criteria:**
- [ ] The eviction guard is keyed per-language, so evicting one language's cache doesn't invalidate an unrelated in-flight load for a different language
- [ ] Test: concurrent loads for two different languages, one evicted mid-flight, only the evicted language's write is skipped

**Source:** Audit finding F063 — severity 4 — concurrency

---

### Task #432: Fix requirements: loadPack never threads forceRedownload into loadSpecialtyPack

**File:** lib/packLoader.ts, lib/specialtyPackLoader.ts, lib/basePackLoader.ts
**Complexity:** 🔧 Full — 3 files, extend loadSpecialtyPack's signature
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
loadPack never threads options?.forceRedownload into loadSpecialtyPack, whose signature has no force parameter at all — a caller believing it forced a fresh specialty download silently gets the cached/merged copy with no error and no way to detect the no-op. LoadPackOptions.forceRedownload is documented as applying "to BASE packs only" yet is declared once and threaded as a single flat option bag for both base and specialty lang values, with no signal to a reader that it's a no-op for specialty codes. at lib/packLoader.ts:loadPack:158.

**Acceptance Criteria:**
- [ ] loadSpecialtyPack accepts and honors a forceRedownload option, or LoadPackOptions' doc comment/type makes the specialty no-op impossible to miss (e.g. a distinct options type per branch)
- [ ] Test: forceRedownload:true on a specialty code either forces a fresh fetch or is provably documented/typed as a no-op

**Source:** Audit finding F059 — severity 4 — requirements

---

### Task #431: Fix security: isValidManifestShape never validates sha256 is a well-formed hex digest

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
isValidManifestShape (lib/packLoader.ts:81-96) only checks version/sha256 are typeof string; never validates that sha256 is a well-formed 64-char hex digest. A manifest entry with sha256:"" or "x" passes shape validation, degrading to "checksum never matches" instead of a clear rejection at the validation boundary. at lib/packLoader.ts:isValidManifestShape:81.

**Acceptance Criteria:**
- [ ] isValidManifestShape validates sha256 as a 64-char hex string, not just typeof string
- [ ] Test: a malformed sha256 value in a manifest entry is rejected at shape-validation time, with a distinct error/log from a checksum mismatch

**Source:** Audit finding F058 — severity 3 — security (promoted despite sub-4 severity: direct validator-hardening fix, cheap to bundle with Task #430/#410's related work)

---

### Task #416: Fix tests: basePackLoader's second-generation-check race fix has no regression test

**File:** tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
lib/basePackLoader.ts:223-230's documented "second generation check" race fix (an eviction landing during the post-download writeCacheMeta/writeCacheData awaits) has no regression test — tests/packLoader.test.ts's #378 cycle-2 block covers the cache-hit race and offline-stale-fallback race but not this path. Deletion Test: delete lines 223-229, no test fails. at lib/basePackLoader.ts:loadBasePackFromStorageOrNetwork:223.

**Acceptance Criteria:**
- [ ] A test forces an eviction during the post-download storage-write window and asserts the write is rejected/discarded correctly
- [ ] Deleting lines 223-229 causes the new test to fail

**Source:** Audit finding F016 — severity 4 — tests

---

### Task #428: Fix documentation-trust: basePackLoader's "USED BY: packLoader.ts ONLY" header is false, and its own enforcement test contradicts its name

**File:** lib/basePackLoader.ts, tests/packLoader.test.ts, CLAUDE.md
**Complexity:** ⚡ Direct — 3 files, no package boundary — mechanical header/test-name correction
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
lib/basePackLoader.ts's header and CLAUDE.md Section 1 both claim "USED BY: lib/packLoader.ts ONLY" — false, since lib/packResolver.ts:23 also imports LoadPackOptions from it. The poka-yoke test at tests/packLoader.test.ts:1879-1900 is itself named "imported ONLY by lib/packLoader.ts" but its assertion expects exactly TWO importers — the test's own body contradicts its own name and the header it exists to enforce. Also, bumpEvictionGeneration is called from 3 sites in packLoader.ts, not just evictPack, per the same stale header. at lib/basePackLoader.ts:module-header:15.

**Acceptance Criteria:**
- [ ] Header and CLAUDE.md corrected to name both real importers (packLoader.ts, packResolver.ts)
- [ ] Test renamed to match its actual assertion (two legal importers), or the invariant is tightened to genuinely mean one importer if that was the real intent
- [ ] bumpEvictionGeneration's caller list in the header corrected

**Source:** Audit finding F029 — severity 4 — documentation-trust

---

### Task #429: Fix tests: path-traversal/invalid-lang tests are shadowed by a later entitlement gate, not proving the allowlist guard works

**File:** tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
tests/packLoader.test.ts:441,450,470,479,488,739,750,953 (path-traversal and invalid-lang tests) would still pass because a separate, later entitlement gate independently produces the identical invalid_lang result regardless of whether the allowlist guard under test exists (entitlement-gate shadowing) — meaning the security-relevant path-traversal allowlist guard itself has no test proving it specifically works. at tests/packLoader.test.ts:441.

**Acceptance Criteria:**
- [ ] At least one test isolates the allowlist/path-traversal guard from the entitlement gate (e.g. a free, ready, non-existent code that clears entitlement but should still fail the allowlist)
- [ ] Deletion Test: removing the allowlist guard specifically (not the entitlement gate) now fails the new test

**Source:** Audit finding F041 — severity 4 — tests

---
