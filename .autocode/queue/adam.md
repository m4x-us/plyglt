---
status: done
agent: adam
stream: W3A
wave: 3
---

# Adam — Stream W3A — Wave 3 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W3A | #562 #565 #566 #573 #574 #577

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

This is Wave 3 of Batch 23's remediation — a re-audit found real gaps in Wave 1/2's own
fixes. All six of your tasks live in `hooks/useStudySession.ts`'s mount-fill effect, and
several are tightly coupled — read all six task definitions below FIRST before writing any
code, since fixing #562 will likely change the shape of the code #565/#566/#574/#577 also
touch.

## Your Tasks (run in this exact order)
1. /task #562  — Fix edge-case: flexIntroAllowed computed once per mount, daily cap can overshoot by up to 2 cards
2. /task #565  — Fix code-quality: the never-empty backstop is dead code
3. /task #566  — Fix code-quality: flexIntroAllowed conflates two distinct block reasons
4. /task #573  — Fix async: useState(initialQueue) only consumes its initializer on first mount — cold-start freeze
5. /task #574  — Fix tests: no seam test proves normal-cap intro + flex fill interaction
6. /task #577  — Fix security: INTERRUPT_FLEX_DAILY_MAX has no cross-tab coordination

RECOMMENDED APPROACH — read this before starting, it will save you rework:
- #562 (the daily-cap overshoot) is the highest-leverage task. The current code computes
  `flexIntroAllowed` ONCE via `canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)` before
  the while loop, then the loop introduces up to 3 cards against that single stale check.
  The real fix is almost certainly to re-check inside the loop (e.g. call
  `canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)` again before each `introduceNext()`
  call, not just once before the loop starts) so the daily ceiling is genuinely enforced
  per-introduction, not per-session.
- #565 and #566 are about the SAME backstop code (`if (sessionIds.size === 0 && flexIntroAllowed) introduceNext();`
  at line 180) that #562 touches. Once #562 changes how `flexIntroAllowed`/the loop works,
  re-evaluate whether the backstop is STILL dead code — it may or may not be, depending on
  how you implement #562. If it's still unreachable after your #562 fix, the honest fix for
  #565 is to delete the backstop entirely and update the doc comment (do NOT leave dead code
  described as a safeguard — either make it reachable and real, or remove it). If you make it
  reachable, keep it and update the comment for #566 to describe both block reasons accurately.
- #573 (cold-start freeze) is a SEPARATE bug from #562/#565/#566 — it's about `useState(initialQueue)`
  only consuming its initializer on true first mount, and the mount-fill effect's empty
  dependency array closing over stale render-1 data. The real fix likely needs the effect (or
  a new one) to re-run when the underlying data actually becomes available — consider whether
  `initialQueue`/`allCardMap`/`cards`/`introductions` becoming non-empty after a pack finishes
  loading should re-trigger the fill logic, not just re-trigger a `useMemo`. This is async/lifecycle
  work — read `app/study/page.tsx`'s `packLoading` gate (READ-ONLY, that file is off-limits to you
  this wave — Charles's stream owns it) to understand exactly when `useStudySession` gets called
  before a pack is ready.
- #574 is a pure test-addition task once #562 is fixed — write a seam test using the real
  `store/srsStore.ts` actions (not mocks) proving a normal-cap introduction correctly consumes
  1 of the 3 flex slots.
- #577 is the lowest-priority (documented as low-stakes, accepted-tradeoff-adjacent) — a
  one-paragraph comment addition acknowledging the cross-tab race is enough; do not over-engineer
  a cross-tab locking mechanism for this.

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W3A
[→] #562 — Fix edge-case: flexIntroAllowed computed once per mount   ← starting now
[ ] #565 — Fix code-quality: never-empty backstop is dead code
[ ] #566 — Fix code-quality: flexIntroAllowed conflates two block reasons
[ ] #573 — Fix async: cold-start freeze
[ ] #574 — Fix tests: normal-cap + flex interaction seam test
[ ] #577 — Fix security: cross-tab daily cap coordination

## Files You Own (edit ONLY these)
hooks/useStudySession.ts
hooks/useStudySession.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
components/InterruptHandler.tsx
components/InterruptHandler.test.tsx
store/srsStore.ts
app/study/page.tsx
app/study/page.test.tsx
tests/seam_studyLoop.test.ts
supabase/functions/send-interrupt-notifications/dueEstimate.ts
lib/queue.ts
hooks/useSync.ts

Note: 8 more tasks are DEFERRED to Wave 4, waiting specifically on your work here — #563
(a new test for the #562 overshoot), #568 (CLAUDE.md doc update), #575 (docs update for the
#573 cold-start fix), #576 (regression tests for #538/#541 that depend on your #565 outcome),
#581/#582 (lib/queue.ts and docs comment fixes describing the daily-cap mechanism). Whatever
you actually implement for #562/#565/#573 will directly determine what those Wave 4 tasks
need to say — write clear, accurate code comments as you go, since the next wave will read
them to know what actually shipped.

## Task Definitions
[Full verbatim task blocks below]

### Task #562: Fix edge-case: flexIntroAllowed is computed once via canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX) at line 142

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
flexIntroAllowed is computed once via canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX) at line 142, then the while loop at 143-149 introduces up to INTERRUPT_SESSION_MAX_NEW (3) cards against that single stale boolean with no per-iteration recheck. Across repeated interrupt sessions in one day this lets the daily flex ceiling of 9 be exceeded by up to 2 cards (concrete trace: normal-cap introduces 1, then three interrupt sessions each re-evaluate flexIntroAllowed against a count still under 9 at 1, 4, 7 and each is granted a full 3-card batch, landing the day total at 10). Consequence is a cognitive-load overshoot against BRAND.md's documented working-memory ceiling, not data loss.

**Acceptance Criteria:**
- [ ] Fix edge-case issue at hooks/useStudySession.ts:mount-fill effect (flexIntroAllowed / while-loop introduction):142
- [ ] Audit passes: real Verification Gate (tsc, npm test, npm run lint) — `scripts/deep-audit.sh` does not exist in this repo

**Source:** Audit finding F001 — severity 6 — edge-case

---

### Task #565: Fix code-quality: the #533/#538 never-empty backstop is dead code

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
introduceNext() is a pure function of (allCardMap, cards, introductions, introducedIds), none of which change between the while loop's attempts (143-149) and the backstop call at line 180, so whenever the backstop's guard is true, the while loop already tried and failed with bit-identical arguments and the backstop is structurally guaranteed to fail again. The surrounding comment and docs/INTERRUPT_ARCHITECTURE.md section 10.4 both describe this as a working, distinct safeguard; it is a no-op.

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:never-empty backstop (post-loop fallback):180
- [ ] Audit passes: real Verification Gate

**Source:** Audit finding F004 — severity 3 — code-quality

---

### Task #566: Fix code-quality: flexIntroAllowed conflates two distinct block reasons

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
flexIntroAllowed is a single boolean that is false for two distinct, undistinguishable reasons -- the stranded-pause invariant and the daily-flex-ceiling being hit -- but the adjacent code comment and docs section 10.4 attribute 100% of the backstop's empty-session outcome to the stranded pause only.

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:flexIntroAllowed / backstop comment:142
- [ ] Audit passes: real Verification Gate

**Source:** Audit finding F005 — severity 3 — code-quality

---

### Task #573: Fix async: useState(initialQueue) cold-start freeze

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
useState(initialQueue) only consumes its initializer on true first mount, and the mount-fill effect has an empty dependency array, so it runs once and closes over render-1's data. app/study/page.tsx calls useStudySession before the packLoading early-return, so any component that mounts while a pack is still loading -- es-language sessions, specialty-pack loads, cold push-tap launches -- permanently freezes the queue empty. This regresses the never-completely-empty guarantee for the exact task (#552) that was supposed to have closed this gap: the fix that shipped (adding allCards to a useMemo dependency array) does not address the stale-closure root cause. No test can catch it because every test touching this path mocks useStudySession away.

**Acceptance Criteria:**
- [ ] Fix async issue at hooks/useStudySession.ts:mount-time introduce effect (useState(initialQueue)):83
- [ ] Audit passes: real Verification Gate

**Source:** Audit finding F012 — severity 7 — async

---

### Task #574: Fix tests: normal-cap + flex fill interaction untested

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
No seam test proves the combined interaction where a normal-cap introduction on session mount consumes 1 of the 3 available flex slots on an interrupt session. The code looks correct by inspection but the interaction path itself is untested.

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.ts:mount effect (normal-cap intro + flex fill interaction):142
- [ ] Audit passes: real Verification Gate

**Source:** Audit finding F013 — severity 3 — tests

---

### Task #577: Fix security: INTERRUPT_FLEX_DAILY_MAX has no cross-tab coordination

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
INTERRUPT_FLEX_DAILY_MAX is enforced via a check-then-act read of in-memory Zustand state with no cross-tab or cross-window coordination -- two tabs of the same account can each independently pass canIntroduceNewCard and each flex up to 3 new cards, exceeding the intended daily ceiling beyond even the single-tab overshoot in F001. Real but low-stakes given the client-only honor-system entitlement model already documented in CLAUDE.md section 5 as an accepted, intentional trade-off.

**Acceptance Criteria:**
- [ ] Fix security issue at hooks/useStudySession.ts:flexIntroAllowed check-then-act:142
- [ ] Audit passes: real Verification Gate

**Source:** Audit finding F016 — severity 3 — security

---

## Agent Memories

## Architect Agent Memory (relevant excerpt)
Rule 22 (Whole-Operation Consistency): a fix to a shared gate/boolean must hold across every
caller of that gate, and its own comment must accurately describe what it actually checks now
— not what it checked before the fix. Rule 23: a fix must not recreate its own defect class —
re-derive whether surrounding "safety net" code still does anything after you change the
condition it depends on, rather than leaving it in place unexamined. This exact codebase has
now hit this pattern twice in this file alone (the Task #533 backstop was originally added as
a real safeguard, then Task #538's fix left it unreachable without anyone re-deriving that).

## When You Finish
Write your completion summary to .autocode/stream-W3A/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM] #[NUM] #[NUM]
NOT_CLOSED: #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful — be SPECIFIC about exactly how
you implemented #562's per-iteration recheck and what you decided about #565's backstop
(deleted it, or made it genuinely reachable) — Wave 4 depends on this description to write
accurate docs and tests.

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W3A | #562 #565 #566 #573 #574 #577
