---
status: done
agent: barry
stream: W1B
wave: 1
---

# Barry — Stream W1B — Wave 1 — 2026-06-30

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W1B | #131 #132 #133 #134 #135

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #131  — A1 Unit 06 Describing — Spanish source-language translation
2. /task #132  — A1 Unit 07 Likes — Spanish source-language translation
3. /task #133  — A1 Unit 08 Review — Spanish source-language translation
4. /task #134  — A1 Unit 09 Colors — Spanish source-language translation
5. /task #135  — A1 Unit 10 Body — Spanish source-language translation

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Barry — W1B
[✓] #131 — Unit 06 Describing   ← done
[→] #132 — Unit 07 Likes        ← starting now
[ ] #133 — Unit 08 Review
[ ] #134 — Unit 09 Colors
[ ] #135 — Unit 10 Body

## Files You Own (edit ONLY these)
content/cards/a1-unit-06-describing.ts
content/cards/a1-unit-07-likes.ts
content/cards/a1-unit-08-review.ts
content/cards/a1-unit-09-colors.ts
content/cards/a1-unit-10-body.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
content/cards/a1-unit-01 through a1-unit-05 (owned by Adam)
content/cards/a1-unit-11 through a1-unit-20 (owned by Charles/Derek)

## Task Definitions
See .autocode/briefs/stream-W1B-start.md for full task definitions and vocabulary reference.

Key schema rule: add `prompts: { es: "..." }` to produce cards, `translations: { es: ["..."] }` to recognize cards, skip all other card types.

## When You Finish
Write completion summary to .autocode/stream-W1B/completion.md, then tell Max: "Barry is done."

— Barry | W1B | #131 #132 #133 #134 #135
