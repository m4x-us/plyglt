CLOSED: #568 #581
NOT_CLOSED: none

## Wave 4, Stream W4B — docs/comments accuracy vs. Wave 3's actual code (2026-08-15)

Both tasks were "make a doc/comment describe the CURRENT code," and the code
had moved twice since the text I was fixing was last written (Batch
23 → Wave 1's #551 → Wave 3's #562/#565/#573). Read `hooks/useStudySession.ts`
and `lib/queue.ts` fresh (both read-only reference this wave) before writing
either fix, per the brief's instruction, rather than trusting either file's
own prior comments.

### #568 — CLAUDE.md's `hooks/useStudySession.ts` architecture bullet
Was stale in two ways, both fixed:
1. Described the flex gate as `canIntroduceNewCard(today,
   Number.MAX_SAFE_INTEGER)` — that was already wrong as of Wave 1's #551
   (which introduced `INTERRUPT_FLEX_DAILY_MAX`), and doubly wrong as of
   Wave 3's #562, which moved the check from a single pre-loop call to a
   per-iteration re-evaluation inside the `while` condition itself
   (`canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)`, checked fresh on
   every introduction). Rewrote the bullet to describe this exact mechanism
   and why it matters (a once-per-mount check reads a stale count after the
   first introduction in the same pass, and separately let multiple same-day
   sessions each pass a still-under-ceiling check and each flex a full
   batch — the real bug #562 fixed).
2. Still described "a final backstop preserves #533's never-completely-empty
   guarantee" — that backstop was deleted entirely in Wave 3's #565 (it was
   structurally dead code: a pure function of frozen inputs, so a repeat
   call after the while loop's last attempt could never succeed where the
   loop had already failed). Replaced with a note that a session reaching
   the end of the fill pass with zero content is genuinely empty, per #561.

Also folded in, for completeness, the near-due full-pool-fetch change
(#541) and the two-distinct-stop-reasons note (#566) — both already live in
the code's own comments but absent from CLAUDE.md's summary, and omitting
them would have left the bullet accurate on the two named issues but still
describing a simplified/outdated picture of the same effect.

### #581 — `lib/queue.ts`'s `INTERRUPT_FLEX_DAILY_MAX` comment
The comment claimed the constant "gives a real cross-session ceiling with no
store-layer change needed" — true of the *value* and the *store layer*, but
misleading about the *call site*: at the time this comment was written (Wave
1), the value was passed via a single check computed once before the fill
loop started, which does NOT actually bound the running total the way the
comment implied (the exact gap Wave 3's #562 fixed). Rewrote to state
plainly: no store-layer change was needed (still true), but the enforcement
correctness depends on the call site — `hooks/useStudySession.ts`'s fill
loop now calls `canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)` inside
the `while` condition, once per iteration, and that per-iteration recheck
(not the constant alone) is what makes the claim true today. Kept the
"3x per-session cap" reasoning paragraph unchanged — that reasoning was
never wrong, only the enforcement-mechanism description below it was.

---

## Verification gate

- `npx tsc --noEmit` — clean (the 3 errors present at the start of Wave 3
  in other streams' off-limits files have since resolved)
- `npm run lint` — 0 errors (7 pre-existing warnings, unrelated files)
- `npm test` — **1966/1966 passed, 101 files.**

Debt entries logged: 0
Carry-forward tasks generated: 0

No files outside `CLAUDE.md` and `lib/queue.ts` (comment-only edit, the
exported constant's value is unchanged) were touched.

Barry is done.

— Barry | W4B | #568 #581
