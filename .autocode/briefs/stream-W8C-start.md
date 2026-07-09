# Charles — Stream W8C — Wave 8 — 2026-07-09

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Charles | W8C | #262 #267 #280 #291

You are Charles, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #262 — setTargetLangCode/getTargetLangCode hyphen truncation breaks every specialty code
2. /task #267 — hasAddOn (pure function) built to close the entitlement gap, has zero callers
3. /task #280 — isValidPackCode and isSpecialtyPackCode disagree on whether .ready is checked
4. /task #291 — langRegistry.ts header omits LanguageGrid.tsx as a known importer

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Charles — W8C
[✓] #262 — hyphen truncation in target-lang-code round-trip   ← done
[→] #267 — hasAddOn pure function has zero callers   ← starting now
[ ] #280 — isValidPackCode/isSpecialtyPackCode .ready disagreement
[ ] #291 — langRegistry.ts header missing LanguageGrid.tsx

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
lib/constants.ts
lib/entitlement.ts
lib/langRegistry.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
store/entitlementStore.ts
lib/specialtyPackLoader.ts
lib/packLoader.ts
components/LanguageGrid.tsx
store/migrations.ts
tests/langRegistry.test.ts
lib/language.ts
lib/packTypes.ts

## Task Definitions

### Task #262: Fix edge-case: setTargetLangCode('it-medical') stores 'en-it-medical'; getTargetLangCode's .split('-')[1]

**File:** lib/constants.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
setTargetLangCode('it-medical') stores 'en-it-medical'; getTargetLangCode's .split('-')[1] returns 'it', discarding '-medical'. The entire specialty-pack selection flow is unreachable from the real UI, deterministically, for any hyphenated code. Independently found by 5 of 7 auditors. Does NOT mitigate F001 -- fixing this alone exposes the entitlement gap through the primary UI with zero further code change. at lib/constants.ts:getTargetLangCode/setTargetLangCode:19.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/constants.ts:getTargetLangCode/setTargetLangCode:19
- [ ] Audit passes: bash scripts/deep-audit.sh lib/constants.ts

**Source:** Audit finding F002 — severity 8 — edge-case

---

### Task #267: Fix code-quality: lib/entitlement.ts:208 hasAddOn (pure function) has zero production callers; its own modul

**File:** lib/entitlement.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
lib/entitlement.ts:208 hasAddOn (pure function) has zero production callers; its own module doc comment states it exists 'for use outside React' -- purpose-built specifically to close the F001 entitlement gap and never wired in. store/entitlementStore.ts:133 duplicates the same logic instead of delegating, breaking the in-file pattern the file's own Rule-15 comment documents. Independently found by 5 of 7 auditors. at lib/entitlement.ts:hasAddOn:208.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/entitlement.ts:hasAddOn:208
- [ ] Audit passes: bash scripts/deep-audit.sh lib/entitlement.ts

**Source:** Audit finding F007 — severity 6 — code-quality

---

### Task #280: Fix requirements: isValidPackCode and isSpecialtyPackCode do not agree on what they validate: isSpecialtyPac

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
isValidPackCode and isSpecialtyPackCode do not agree on what they validate: isSpecialtyPackCode does not check .ready, while packLoader.ts's inline reimplementation (F006) does. A future developer would reasonably assume isValidPackCode covers any loadable pack code; it does not, and nothing in naming or types signals this. at lib/langRegistry.ts:isSpecialtyPackCode vs isValidPackCode:88.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at lib/langRegistry.ts:isSpecialtyPackCode vs isValidPackCode:88
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F020 — severity 5 — requirements

---

### Task #291: Fix code-quality: The 'USED BY' header omits components/LanguageGrid.tsx despite it directly importing LANGU

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The 'USED BY' header omits components/LanguageGrid.tsx despite it directly importing LANGUAGE_REGISTRY and getSpecialtyPacks. at lib/langRegistry.ts:N/A (file header):1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/langRegistry.ts:N/A (file header):1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F031 — severity 3 — code-quality

---

## Agent Memories

## Architect Agent Memory (first 100 lines)
# Architecture Agent Memory — plyglt

## Key Files and Blast Radius
- `lib/langRegistry.ts` — 20 importers. Touch carefully.
- `lib/constants.ts` — 8 importers.
- Entitlement cluster (`lib/entitlement.ts` + `lib/checkout.ts` + `store/entitlementStore.ts`) —
  26 files combined importers.

## Specialty Pack Architecture (Batch 12)
`lib/langRegistry.ts` exports `SpecialtyPack`, `SPECIALTY_PACKS` (frozen empty array),
`getSpecialtyPacks(lang)`, `isSpecialtyPackCode(s)`. `lib/entitlement.ts` exports a pure
`hasAddOn(state, code)` meant for use outside React — this is exactly the function #267 wires in.

## Security Agent Memory (first 100 lines)
# Security Agent Memory — plyglt
## Intentional Design (do not raise as findings)
- Client-only entitlement — honor-system, no server-side verification. Decision 2026-06-24.

## Notes for this wave
This is the remediation wave following the first-ever standalone audit of Batch 12 (2026-07-09,
FAIL verdict). YOUR TASK #262 IS THE HIGHEST-LEVERAGE TASK IN THIS ENTIRE WAVE — it is a hard
blocker for Task #261 (the core entitlement-enforcement fix, deferred to next wave) and for
Task #294 (deferred — becomes moot once you fix this). Do #262 first, exactly as ordered above.
The bug: `setTargetLangCode` stores `"${sourceLang}-${targetLang}"` (e.g. "en-it-medical" for
target "it-medical"), but `getTargetLangCode`'s `.split('-')[1]` only ever recovers the single
segment immediately after the first hyphen ("it"), silently discarding "-medical". Any target
code containing its own hyphen is truncated on every read. Fix by splitting on the first hyphen
only and taking everything after it (not just the second array element), or by choosing a
non-hyphen separator that can't collide with hyphenated pack codes — pick whichever is the
smaller, more honest fix; either way, add a regression test for a hyphenated code round-tripping
correctly, not just the two-segment case.

Your other three tasks (#267, #280, #291) are independent single-file findings in the same two
adjacent files (lib/entitlement.ts, lib/langRegistry.ts) — real but lower-severity code-quality/
requirements gaps, not part of the entitlement-gate wiring itself. Do not attempt the full
entitlement-gate fix (Task #261) yourself — it's out of scope for this stream and lands next wave
once your #262 fix is in place.

## When You Finish
Write your completion summary to .autocode/stream-W8C/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Also note in that file: exactly how you fixed the hyphen-truncation bug in #262 (which
separator/split strategy you used) — next wave's Task #261/#282/#294 builders need this to
know what the real, current round-trip behavior of getTargetLangCode/setTargetLangCode is.

Then tell Max in this window: "Charles is done." (or describe what's incomplete).

— Charles | W8C | #262 #267 #280 #291
