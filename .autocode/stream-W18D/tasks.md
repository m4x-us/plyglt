# Stream W18D Task State

### Task #441: Fix code-quality: isSpecialtyPackCode's name promises registration but its implementation also checks readiness

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
isSpecialtyPackCode's name promises "is this a specialty pack code" (registration membership), but the implementation is `sp.code===s && sp.ready` — a registered-but-unshipped code returns false, indistinguishable from an unregistered/garbage code. store/migrations.ts and lib/importBackup.ts both had to hand-roll a separate check specifically to route around what the function's name implies it checks — this contract mismatch is the root cause driving Task #407/F001's 5-file duplication. at lib/langRegistry.ts:isSpecialtyPackCode:103.

**Acceptance Criteria:**
- [ ] Either rename isSpecialtyPackCode to reflect that it also checks readiness (e.g. isReadySpecialtyPackCode, noting the prior alias of that exact name was deleted under Task #380 for being redundant — a fresh naming decision is needed here, not a revival), or split it into a registration-only predicate plus a readiness check
- [ ] Task #407 (the 5-file duplication) should be sequenced together with or after this task, since this is its root cause

**Source:** Audit finding F074 — severity 4 — code-quality

**NOTE (added post-Wave-17):** Task #407 already landed in Wave 17 — it added a sibling
`isRegisteredSpecialtyCode` function rather than modifying `isSpecialtyPackCode`. See the
brief for how this changes the remaining scope of this task.

---

### Task #419: Fix edge-case: isKnownCode has no recovery path for a ready-but-unpurchased specialty code

**File:** hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
isKnownCode (hooks/useLangPack.ts:78-80) treats any registered-and-ready specialty code as "known" regardless of purchase state; the #339 repair effect only fires for !isKnownCode. A user pinned (via persisted LANG_PAIR_KEY) to a ready-but-unpurchased specialty code gets a permanent "Add-on not purchased." state with no in-hook recovery path. Currently latent only because it-medical is ready:false. at hooks/useLangPack.ts:isKnownCode:78.

**Acceptance Criteria:**
- [ ] A ready-but-unpurchased specialty code stuck in LANG_PAIR_KEY gets an in-hook recovery path (e.g. falls back to the base language) rather than a permanent error state
- [ ] Test covering this scenario with a mocked ready specialty pack

**Source:** Audit finding F019 — severity 4 — edge-case

---

### Task #425: Fix documentation-trust: getLanguageConfig's hyphenated-fallback signal is weaker than its own doc comment claims

**File:** lib/language.ts, tests/language.test.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
getLanguageConfig's hyphenated-code fallback branch cannot check SPECIALTY_PACKS membership (documented circular-import constraint), so "it-typo" or any garbage suffix sharing a valid 2-letter prefix takes the identical silent-success path (console.warn + base config) as a genuinely registered code like "it-medical" — a weaker signal (warn, not error) than the no-hyphen branch despite the doc comment's claim that "the error signal prevents silent masking." No test covers "valid prefix, garbage suffix." at lib/language.ts:getLanguageConfig:842.

**Acceptance Criteria:**
- [ ] Doc comment corrected to accurately describe the hyphenated-fallback signal strength, or the signal is strengthened to match the claim
- [ ] Test: a garbage suffix on a valid prefix (e.g. "it-typo") is covered explicitly

**Source:** Audit finding F026 — severity 4 — documentation-trust

---
