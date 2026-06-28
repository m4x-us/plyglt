---
status: done
agent: charles
stream: W1C
wave: 1
---

# Charles — Stream W1C — Wave 1 — 2026-06-27

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Charles | W1C | #033

You are Charles, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks
1. /task #033  — Update CONTRIBUTING_LANGUAGE.md (9 issues, EXPEDITED — first task in Batch 4)

## STATUS BOARD RULE — MANDATORY: After every completed /task, print before starting the next:

Charles — W1C
[→] #033 — CONTRIBUTING_LANGUAGE.md: 9 issues

(adjust ✓/→/[ ] as you go)

## Files You Own (edit ONLY these)
CONTRIBUTING_LANGUAGE.md

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
CLAUDE.md, STATUS.md, BRAND.md                        ← Barry W1B
hooks/useStudySession.test.ts                          ← Derek W1D
hooks/useLicenseActivation.test.ts                     ← Derek W1D
All files under lib/, store/, components/, hooks/, scripts/, app/  ← Adam W1A

## Task Definitions
See .autocode/stream-W1C/tasks.md for full verbatim task blocks.

## Agent Memories

### Documentation Agent Memory (full relevant context)
**CONTRIBUTING_LANGUAGE.md known issues (all 9 must be fixed in #033):**

1. NFC normalization: Add note that all card text is NFC-normalized on export by scripts/exportPack.ts. Authors write in composed form; tooling handles normalization. They do NOT need to list both composed and decomposed forms.

2. Diacritic tolerance: diacriticTolerant:true means accent-only diff returns "close" not "wrong". Authors must NOT add duplicate answers (e.g., both "café" and "cafe") — the engine handles accent tolerance automatically.

3. "close" threshold: The Levenshtein "close" rating only triggers when a.length > 4 AND distance === 1. Words with 4 or fewer characters have no fuzzy tolerance — wrong only. Document this so authors know short words are strict.

4. Card ID format: Italian cards use {level}u{unit:02d}-t{tier}-{seq:03d} (NO lang prefix). Non-Italian cards should use {lang}-{level}u{unit:02d}-t{tier}-{seq:03d}. The template in CONTRIBUTING_LANGUAGE.md currently shows the prefixed format only — must document both and clarify which applies when.

5. Step 2 TypeScript compile error: The LanguageEntry example has `pricing: { lifetime: "$9.99" }` — LanguageEntry has no pricing field. Remove it. The example must compile without error.

6. Step 5 french_lifetime: References a checkout key with "lifetime" in it. Lifetime checkouts were removed in Task #001 (lib/entitlement.ts:118). Replace with a subscription key example (e.g., italian_subscription or {lang}_monthly).

7. French as worked example: fr was removed from lib/langRegistry.ts on 2026-06-27. All references to "fr", "french", or French as a worked example must be replaced with a generic {lang} placeholder. This applies to file paths (content/fr/), language codes, and any fr-specific examples throughout all steps.

8. Step 1 wrong file: Step 1 references lib/srs.ts for ITALIAN_ARTICLES and checkAnswer. These were extracted to lib/answerCheck.ts in Task #027 (Batch 3). Correct all references.

9. ready:false stub: Document that when registering a new language in lib/langRegistry.ts, set ready:false to keep it out of production until public/packs/{lang}.json exists. This is how fr, de, pt were previously handled.

**Key files to read for context:**
- lib/answerCheck.ts — the actual home of checkAnswer, NFC logic, Levenshtein threshold
- lib/langRegistry.ts — current state (only it and es); shows ready:boolean pattern
- lib/entitlement.ts:118 — shows why lifetime keys are forbidden

**Known blind spots from prior runs:**
- Did not catch the Step 2 TypeScript compile error until /meet 2026-06-27.
- Did not flag fr worked example would break after langRegistry cleanup.
- Always re-check CONTRIBUTING_LANGUAGE.md for stale file references when any lib/ extraction task ships.

## When You Finish
Write your completion summary to .autocode/stream-W1C/completion.md:
  Tasks closed: [list]
  Tasks NOT completed: [list + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Charles is done."

— Charles | W1C | #033
