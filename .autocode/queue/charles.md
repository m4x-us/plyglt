---
status: done
agent: charles
stream: W4C
wave: 4
---

# Charles — Stream W4C — Wave 4 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Charles | W4C | #575 #582

You are Charles, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

Both your tasks touch `docs/INTERRUPT_ARCHITECTURE.md` section 10 — read the WHOLE section
10 first (not just the specific subsections named in the tasks), and read the CURRENT state
of `hooks/useStudySession.ts` (read-only reference — already fixed in Wave 3, merged to main)
before rewriting anything, since Wave 3 changed the actual mechanism this section describes.

## Your Tasks (run in this exact order)
1. /task #575  — Fix code-quality: section 10 doesn't mention the #552/#573 cold-start-freeze gap
2. /task #582  — Fix code-quality: section 10.3 restates a false per-introduction-ceiling claim

KEY FACTS FROM WAVE 3 (already merged, verify against the real code):
- The cold-start freeze (originally #552, more precisely diagnosed and actually fixed as #573)
  IS now fixed — via an `allCardMap`-as-ready-signal + `mountFillDoneRef` pattern in
  `hooks/useStudySession.ts`'s mount effect. Document this as RESOLVED, not as an open gap.
- The daily flex ceiling (`INTERRUPT_FLEX_DAILY_MAX`) is now enforced via a live per-iteration
  `canIntroduceNewCard` check inside the while loop — the ceiling claim in section 10.3 is now
  actually TRUE, it just needs to describe the real mechanism (per-iteration, not per-session).
- The never-empty backstop (previously documented in section 10.4) was DELETED entirely in
  Wave 3 (Task #565) — section 10.4 currently describes it as "now only fires when the same
  flex-gate allows it," which is now describing code that no longer exists. This needs a
  larger rewrite than either task individually describes — read the acceptance criteria below,
  but use your judgment on section 10.4's accuracy too, since fixing #575/#582 in isolation
  without touching 10.4 would leave the doc internally inconsistent (10.3/10.1 accurate,
  10.4 describing deleted code).

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Charles — W4C
[→] #575 — Fix code-quality: cold-start-freeze gap not documented   ← starting now
[ ] #582 — Fix code-quality: false per-introduction-ceiling claim

## Files You Own (edit ONLY these)
docs/INTERRUPT_ARCHITECTURE.md

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
hooks/useStudySession.test.ts
tests/srsStore.test.ts
CLAUDE.md
lib/queue.ts
hooks/useStudySession.ts (read-only reference — already fixed in Wave 3)
store/srsStore.ts (read-only reference)

## Task Definitions

### Task #575: Fix code-quality: section 10 doesn't mention the cold-start-freeze gap

**File:** docs/INTERRUPT_ARCHITECTURE.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
docs/INTERRUPT_ARCHITECTURE.md section 10 does not mention the #552 residual gap described in F012, leaving the documented state of that fix inaccurate.

As of Wave 3 (Task #573), this gap IS now fixed — via the allCardMap-as-ready-signal +
mountFillDoneRef pattern in hooks/useStudySession.ts's mount effect. Add a subsection (or
extend an existing one) documenting: the root cause (useState only consumes its initializer on
true first mount; a component mounting while a pack is still loading froze the queue empty),
and the fix (the ready-signal + once-guard pattern), explicitly noting this corrects the
original #552 fix which only addressed a useMemo dependency array and didn't touch the real
stale-closure root cause.

**Acceptance Criteria:**
- [ ] Fix code-quality issue at docs/INTERRUPT_ARCHITECTURE.md:section 10:0
- [ ] Audit passes: real Verification Gate (tsc, npm test, npm run lint) — `scripts/deep-audit.sh` does not exist in this repo

**Source:** Audit finding F014 — severity 2 — code-quality

---

### Task #582: Fix code-quality: section 10.3 restates a false per-introduction-ceiling claim

**File:** docs/INTERRUPT_ARCHITECTURE.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
docs/INTERRUPT_ARCHITECTURE.md section 10.3 restates the same false per-introduction-ceiling claim as F020 verbatim from the original completion note, never independently verified against the while loop's actual call pattern before being written down.

As of Wave 3 (Task #562), this claim is now TRUE — the daily ceiling is enforced via a live
per-iteration recheck inside the while loop. Rewrite section 10.3 to describe the actual
current mechanism (re-evaluated per introduction attempt, not computed once per session) —
do not just delete the caveat, replace it with an accurate description of the real,
now-correct enforcement.

While you're in this section, also address section 10.4 (the never-empty backstop) — it was
DELETED entirely in Wave 3 (Task #565), so section 10.4's current text ("the backstop now only
fires when the same flex-gate from 10.3 allows it") describes code that no longer exists.
Update it to state the backstop was removed and why (it was structurally unreachable — the
while loop above it always already tried and failed with identical inputs whenever the
backstop's own guard would have been true), and that the near-due fill and flex loop are now
the only two fill mechanisms for a floor-filling interrupt session.

**Acceptance Criteria:**
- [ ] Fix code-quality issue at docs/INTERRUPT_ARCHITECTURE.md:section 10.3:0
- [ ] Audit passes: real Verification Gate

**Source:** Audit finding F021 — severity 2 — code-quality

---

## When You Finish
Write your completion summary to .autocode/stream-W4C/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM] #[NUM]
NOT_CLOSED: #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Charles is done." (or describe what's incomplete).

— Charles | W4C | #575 #582
