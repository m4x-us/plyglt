# Derek — Stream W9D — Wave 9 — 2026-07-09

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Derek | W9D | #294 #293

You are Derek, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

Note on #294: Task #262 (Wave 8, complete) already fixed the specific hyphenated-code
truncation bug this finding originally described (getTargetLangCode/setTargetLangCode now
round-trip correctly via indexOf/slice). Do NOT treat #294 as moot, though — its remaining,
still-valid complaint is narrower: the function's `string` return type gives callers no
signal when the underlying localStorage value is malformed (no hyphen at all, corrupted
data, etc.) — it silently falls back to "it" with zero error signal, same silent-fallback
class as Task #279 (lib/language.ts, Wave 8) fixed for getLanguageConfig. Apply a similar
fix here: log when falling back due to malformed storage, don't just silently return "it".

## Your Tasks (run in this exact order)
1. /task #294 — getTargetLangCode's string return type implies round-trip fidelity it can't fully guarantee for malformed storage values
2. /task #293 — hasValidUnitsArray only checks Array.isArray(pack.units), no cross-check against unitCount/cardCount or element shapes

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Derek — W9D
[✓] #294 — getTargetLangCode silent-fallback signal   ← done
[→] #293 — hasValidUnitsArray shape validation   ← starting now

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
lib/constants.ts
lib/packTypes.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/specialtyPackLoader.ts
lib/packLoader.ts
lib/langRegistry.ts
hooks/useLangPack.ts
store/entitlementStore.ts
store/migrations.ts
lib/exportBackup.ts
lib/importBackup.ts

## Task Definitions

### Task #294: Fix requirements: getTargetLangCode's return type is declared string, implying round-trip fidelity with setT

**File:** lib/constants.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
getTargetLangCode's return type is declared string, implying round-trip fidelity with setTargetLangCode. For hyphenated codes it silently returns a truncated substring with no type-level or runtime failure signal -- a contract-lie framing distinct from F002's functional-bug framing. at lib/constants.ts:getTargetLangCode:19.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at lib/constants.ts:getTargetLangCode:19
- [ ] Audit passes: bash scripts/deep-audit.sh lib/constants.ts

**Source:** Audit finding F034 — severity 6 — requirements

---

### Task #293: Fix edge-case: hasValidUnitsArray validates only Array.isArray(pack.units); it does not cross-check unitC

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
hasValidUnitsArray validates only Array.isArray(pack.units); it does not cross-check unitCount/cardCount against units.length, and does not validate individual unit or card element shapes. at lib/packTypes.ts:hasValidUnitsArray:1.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/packTypes.ts:hasValidUnitsArray:1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F033 — severity 5 — edge-case

---

## Agent Memories

## Architect Agent Memory (first 100 lines)
# Architecture Agent Memory — plyglt

## lib/constants.ts (current state after Wave 8's Task #262 fix)
```
export function getTargetLangCode(): string {
  if (typeof window === "undefined") return "it";
  const pair = window.localStorage.getItem(LANG_PAIR_KEY) ?? "en-it";
  const sepIdx = pair.indexOf("-");
  return sepIdx === -1 ? "it" : (pair.slice(sepIdx + 1) || "it");
}
```
The `sepIdx === -1` branch is the malformed-storage fallback #294 is about — it's silent.
Add a console.error/warn with a ref ID (matching the `[ERR-...]` convention used elsewhere
in this codebase, e.g. lib/language.ts's `[ERR-LANG-CONFIG-UNKNOWN-...]` from Task #279) when
this branch is hit, so a corrupted localStorage value doesn't fail invisibly.

## lib/packTypes.ts — hasValidUnitsArray
Used by both lib/packLoader.ts and lib/specialtyPackLoader.ts as the shape-validation gate
before trusting fetched/cached pack JSON. Currently only checks `Array.isArray(pack.units)` —
add cross-checks against `unitCount`/`cardCount` fields (if present in the Pack shape) and
basic per-unit shape validation (each unit has an id/cards array, not just that units itself
is an array).

## Notes for this wave
This is the second remediation wave following the Batch 12 audit. Both your tasks are
independent single-function findings bundled for wave balance — no interaction between them.

## When You Finish
Write your completion summary to .autocode/stream-W9D/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Derek is done." (or describe what's incomplete).

— Derek | W9D | #294 #293
