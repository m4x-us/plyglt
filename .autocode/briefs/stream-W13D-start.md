# Derek — Stream W13D — Wave 13 — 2026-07-14

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Derek | W13D | #355 #353 #333 #332 #331 #330 #335 #352 #359 #369 #376

You are Derek, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

**Note on #355 and #353** — both touch the exact same lines in
`components/LanguageGrid.tsx.test.tsx`'s `onUpgradeClick` assertions. #355 is specifically
about tightening `toHaveBeenCalled()` to `toHaveBeenCalledWith(...)`; #353's own scope
explicitly says it also covers "the actual banned assertions #355 identifies." Do #355
first as one complete fix to those assertions — then #353 only needs to (a) widen
`AGENTS.md`'s grep gate to also scan co-located test files, since #355 will have already
fixed the specific assertions. Don't redo the same edit twice.

**Note on #332 and #331** — #332 deduplicates `isSpecialtyPackCode`/`isReadySpecialtyPackCode`
in `lib/langRegistry.ts` (they're currently byte-identical). Do this before #331 (the header
fix for the same file) so the header describes the final, deduplicated export shape. This
also affects #330 (CLAUDE.md, which currently documents a deleted `getSpecialtyPacks` export
— check while you're in there whether it also needs updating to reflect whatever #332 leaves
behind) and #335 (a test for `isSpecialtyPackCode`'s `.ready` clause — make sure it tests
whichever function name survives your #332 consolidation).

**Task #361 is deferred to next wave, waiting on your #332** — a different stream's task
(`hooks/useLangPack.ts`'s `isKnownCode`) needs to call whatever canonical ready-check
function your #332 consolidation leaves behind. Document the final function name/signature
clearly in your completion.md.

## Your Tasks (run in this exact order)
1. /task #355 — LanguageGrid.test.tsx onUpgradeClick assertions don't check the argument
2. /task #353 — weak-assertion gate doesn't scan co-located component tests (do after #355 — narrower scope now)
3. /task #333 — LanguageGrid.test.tsx stale mock for a deleted export
4. /task #332 — isSpecialtyPackCode/isReadySpecialtyPackCode byte-identical, dedupe them
5. /task #331 — langRegistry.ts USED BY header (do after #332 — describe final export shape)
6. /task #330 — CLAUDE.md documents a deleted export (check against #332's outcome too)
7. /task #335 — langRegistry.test.ts never exercises the ready:false branch (test whichever function survives #332)
8. /task #352 — "All languages unlocked" is a length check, not a membership check
9. /task #359 — getLanguageConfig's hyphen fallback is a 3rd, weakest specialty-code check
10. /task #369 — featureFlags.ts USED BY header stale
11. /task #376 — Task #300's hasAddOn delegation is real but completely unproven by any test

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Derek — W13D
[✓] #355 — onUpgradeClick assertion fix   ← done
[→] #353 — weak-assertion gate scope   ← starting now
[ ] #333 — stale mock cleanup
[ ] #332 — isSpecialtyPackCode/isReadySpecialtyPackCode dedup
[ ] #331 — langRegistry.ts header
[ ] #330 — CLAUDE.md stale export doc
[ ] #335 — ready:false test coverage
[ ] #352 — "All languages unlocked" length-vs-membership
[ ] #359 — getLanguageConfig hyphen fallback
[ ] #369 — featureFlags.ts header
[ ] #376 — hasAddOn delegation test

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
AGENTS.md
components/LanguageGrid.test.tsx
lib/langRegistry.ts
CLAUDE.md
tests/langRegistry.test.ts
app/settings/page.tsx
lib/language.ts
lib/featureFlags.ts
tests/entitlement.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
app/page.tsx
components/LanguageGrid.tsx
hooks/useExportImport.ts
hooks/useLangPack.ts
hooks/useLicenseActivation.ts
lib/constants.ts
store/entitlementStore.ts
lib/packCache.ts
lib/packTypes.ts
lib/specialtyPackLoader.ts
lib/packLoader.ts
lib/importBackup.ts
store/migrations.ts

## Task Definitions

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

## Agent Memories

## QA Agent Memory (relevant excerpt)
Test Framework: Vitest 4 with vi.mock, vi.fn, vi.spyOn. @testing-library/react for hook
tests. Deletion Test mandatory for every new/modified assertion (Rule 18) — for #355,
specifically assert `toHaveBeenCalledWith(sp.code)` (not just that the callback fired) so
deleting the code-argument wiring would actually fail the test.

## Architect Agent Memory (relevant excerpt)
`lib/langRegistry.ts` — 20+ importers, single source of truth for all language packs,
codes, configs, and the specialty-pack registry. Before editing its module header, run a
real grep for every importer rather than trusting the existing list — that's exactly the
mistake this wave's header-staleness findings are about.

## Notes for this wave
This is the sixth remediation wave following the Batch 12 audit. Task #361 (deferred, not
in this wave) depends on your #332 — document the exact final function name/signature for
"is this a registered and ready specialty code" in your completion.md.

## When You Finish
Write your completion summary to .autocode/stream-W13D/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Also note in that file: the exact final shape of #332's dedup (which function name survived,
what the other one now does — removed entirely, or an alias) — next wave's #361 builder
needs this.

Then tell Max in this window: "Derek is done." (or describe what's incomplete).

— Derek | W13D | #355 #353 #333 #332 #331 #330 #335 #352 #359 #369 #376
