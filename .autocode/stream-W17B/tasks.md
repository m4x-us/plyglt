# Stream W17B Task State

### Task #417: Fix tests: hasValidUnitsArray has no test constructing a malformed card

**File:** tests/packTypes.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Every test in tests/packTypes.test.ts uses `cards: []`; none constructs a malformed card (wrong-typed tier, non-array accepted, missing prompt). Deletion Test: replace the card-validation callback with `return true;` — no test fails. at lib/packTypes.ts:hasValidUnitsArray:92.

**Acceptance Criteria:**
- [ ] At least one test constructs a card with a malformed field (per validated field) and asserts hasValidUnitsArray returns false
- [ ] Deletion Test: the card-validation callback returning unconditional true now fails the new test(s)

**Source:** Audit finding F017 — severity 4 — tests

---

### Task #418: Fix data-integrity: hasValidUnitsArray never cross-checks unitCount/cardCount against actual array lengths

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
hasValidUnitsArray validates unitCount/cardCount by type only, never cross-checking them against the actual units/cards array lengths, despite lib/specialtyPackLoader.ts's _mergeFromJson arithmetically summing exactly those two fields. A downloaded pack whose declared count doesn't match its real array length passes validation and produces an arithmetically wrong but type-safe merged total; no caller in the import graph checks this either. at lib/packTypes.ts:hasValidUnitsArray:75.

**Acceptance Criteria:**
- [ ] hasValidUnitsArray rejects a pack whose unitCount/cardCount doesn't match its actual units.length/summed cards.length
- [ ] Test: a pack with a mismatched declared count is rejected

**Source:** Audit finding F018 — severity 5 — data-integrity

---

### Task #421: Fix code-quality: store/srsStore.ts bypasses lib/constants.ts's sole-authorized-caller rule for localStorage

**File:** store/srsStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
store/srsStore.ts:26 calls `window.localStorage.getItem(LANG_PAIR_KEY) ?? "en-it"` directly, bypassing lib/constants.ts's sole-authorized-caller rule and reimplementing getLangPair() inline, even though the file already imports LANG_PAIR_KEY from lib/constants.ts. app/page.tsx and hooks/useExportImport.ts were fixed for the identical violation under Task #340/#389 (commit 91c0b58); this call site was the missed sibling. Matches already-known tracked debt entry DSC-004. at store/srsStore.ts:module-level:26.

**Acceptance Criteria:**
- [ ] store/srsStore.ts:26 calls getLangPair() from lib/constants.ts instead of localStorage directly
- [ ] `grep -rn "localStorage" store/srsStore.ts` returns zero hits

**Source:** Audit finding F021 — severity 5 — code-quality

---
