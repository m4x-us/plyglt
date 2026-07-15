# Stream W13D Task State

### Task #355: Fix tests: Every onUpgradeClick assertion checks only toHaveBeenCalled(), never toHaveBeenCalledWith(

**File:** components/LanguageGrid.test.tsx:129,143,159,203,232
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Every onUpgradeClick assertion checks only toHaveBeenCalled(), never toHaveBeenCalledWith(...) -- including the specialty-tile test specifically covering Task #308's onUpgradeClick(sp.code) call. Proves the type change was never validated to actually matter (test-side half of F007). at components/LanguageGrid.test.tsx:129,143,159,203,232:onUpgradeClick assertions.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at components/LanguageGrid.test.tsx:129,143,159,203,232:onUpgradeClick assertions
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.test.tsx

**Source:** Audit finding F028 — severity 6 — tests

---

---

### Task #353: Fix tests: The banned-weak-assertion grep gate is hard-scoped to tests/ --include=*.test.* only, but 

**File:** AGENTS.md Verification Gate + components/LanguageGrid.test.tsx
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope fix (widen grep scope + fix the specific assertions it now catches) — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The banned-weak-assertion grep gate is hard-scoped to tests/ --include=*.test.* only, but Rule 14 mandates co-located component tests -- components/LanguageGrid.test.tsx contains 12+ banned-pattern assertions with no existence-check comments that are structurally invisible to the automated gate. at AGENTS.md Verification Gate + components/LanguageGrid.test.tsx:weak-assertion grep gate.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at AGENTS.md Verification Gate + components/LanguageGrid.test.tsx:weak-assertion grep gate
- [ ] Audit passes: bash scripts/deep-audit.sh AGENTS.md

**Source:** Audit finding F026 — severity 6 — tests

---

---

### Task #333: Fix code-quality: Mock still defines getSpecialtyPacks: () => [] though the real module no longer exports it

**File:** components/LanguageGrid.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Mock still defines getSpecialtyPacks: () => [] though the real module no longer exports it -- stale mock left behind after removal. at components/LanguageGrid.test.tsx:vi.mock("@/lib/langRegistry"):49.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at components/LanguageGrid.test.tsx:vi.mock("@/lib/langRegistry"):49
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.test.tsx

**Source:** Audit finding F006 — severity 4 — code-quality

---

---

### Task #332: Fix code-quality: isSpecialtyPackCode and isReadySpecialtyPackCode are byte-identical implementations under 

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
isSpecialtyPackCode and isReadySpecialtyPackCode are byte-identical implementations under two different names with different call sites -- duplicated logic that will silently diverge. Highest-convergence finding in the batch -- 5 independent auditors (A, K, N, Red R, V) flagged this identical issue. at lib/langRegistry.ts:isSpecialtyPackCode/isReadySpecialtyPackCode:88.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/langRegistry.ts:isSpecialtyPackCode/isReadySpecialtyPackCode:88
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F005 — severity 6 — code-quality

---

---

### Task #331: Fix documentation-trust: USED BY header omits hooks/useLangPack.ts, which imports isValidPackCode, SPECIALTY_PACKS,

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
USED BY header omits hooks/useLangPack.ts, which imports isValidPackCode, SPECIALTY_PACKS, isReadySpecialtyPackCode directly. at lib/langRegistry.ts:module header:10.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/langRegistry.ts:module header:10
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F004 — severity 5 — documentation-trust

---

---

### Task #330: Fix documentation-trust: CLAUDE.md states lib/langRegistry.ts exports getSpecialtyPacks(lang); this export does not

**File:** CLAUDE.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
CLAUDE.md states lib/langRegistry.ts exports getSpecialtyPacks(lang); this export does not exist in the current file (deleted this batch by Task #301). at CLAUDE.md:Section 6:0.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at CLAUDE.md:Section 6:0
- [ ] Audit passes: bash scripts/deep-audit.sh CLAUDE.md

**Source:** Audit finding F003 — severity 5 — documentation-trust

---

---

### Task #335: Fix tests: Never mocks a SPECIALTY_PACKS entry with ready:false, so isSpecialtyPackCode's && sp.ready

**File:** tests/langRegistry.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Never mocks a SPECIALTY_PACKS entry with ready:false, so isSpecialtyPackCode's && sp.ready clause is never exercised against a real conditional -- deleting it breaks no test (Rule 18 violation). at tests/langRegistry.test.ts:SpecialtyPack registry describe block:70.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/langRegistry.test.ts:SpecialtyPack registry describe block:70
- [ ] Audit passes: bash scripts/deep-audit.sh tests/langRegistry.test.ts

**Source:** Audit finding F008 — severity 5 — tests

---

---

### Task #352: Fix edge-case: 'All languages unlocked' is derived from unlockedPacks.length >= ALL_KNOWN_PACKS.length --

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
'All languages unlocked' is derived from unlockedPacks.length >= ALL_KNOWN_PACKS.length -- a length comparison, not a membership check. A hand-edited or migrated state with duplicate entries could trigger this incorrectly with no test coverage. at app/settings/page.tsx:SettingsPage:130.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at app/settings/page.tsx:SettingsPage:130
- [ ] Audit passes: bash scripts/deep-audit.sh app/settings/page.tsx

**Source:** Audit finding F025 — severity 3 — edge-case

---

---

### Task #359: Fix code-quality: The hyphen-split fallback is a third, weakest independent implementation of "is this a spe

**File:** lib/language.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The hyphen-split fallback is a third, weakest independent implementation of "is this a specialty code" logic (alongside langRegistry.ts's two functions) -- accepts any hyphenated string with a matching registered base-language prefix regardless of whether the suffix is a real SPECIALTY_PACKS entry, and logs nothing on that path, contrary to the adjacent comment's claim of preventing silent masking. at lib/language.ts:getLanguageConfig:122.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/language.ts:getLanguageConfig:122
- [ ] Audit passes: bash scripts/deep-audit.sh lib/language.ts

**Source:** Audit finding F032 — severity 5 — code-quality

---

---

### Task #369: Fix documentation-trust: USED BY header omits app/stats/page.tsx, which imports getFeatureFlags/isProEnabled direct

**File:** lib/featureFlags.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
USED BY header omits app/stats/page.tsx, which imports getFeatureFlags/isProEnabled directly. at lib/featureFlags.ts:module header:4.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/featureFlags.ts:module header:4
- [ ] Audit passes: bash scripts/deep-audit.sh lib/featureFlags.ts

**Source:** Audit finding F042 — severity 3 — documentation-trust

---

---

### Task #376: Fix tests: Every hasAddOn test checks only behavioral output (true/false), identical whether the stor

**File:** tests/entitlement.test.ts:1049,1060,1065,1324-1341
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Every hasAddOn test checks only behavioral output (true/false), identical whether the store delegates to libHasAddOn or reverts to inline duplicated logic -- the Task #300 delegation itself is completely unproven by any test (Rule 18 violation). at tests/entitlement.test.ts:1049,1060,1065,1324-1341:hasAddOn tests.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/entitlement.test.ts:1049,1060,1065,1324-1341:hasAddOn tests
- [ ] Audit passes: bash scripts/deep-audit.sh tests/entitlement.test.ts

**Source:** Audit finding F049 — severity 6 — tests

---
